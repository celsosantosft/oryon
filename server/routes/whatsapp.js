const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');
const {
    EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE,
    EVOLUTION_WEBHOOK_URL,
    createEvolutionClient,
    buildEvolutionTextPayload,
    getEvolutionDiagnostics
} = require('../config/evolution');
const {
    sendQualifiedLeadEvent,
    isQualifiedLeadLabel,
    resolveQualifiedLeadLabel,
    getMetaCapiDiagnostics
} = require('../services/metaCapiService');

const router = express.Router();
let QRCode = null;

try {
    QRCode = require('qrcode');
} catch (error) {
    console.warn('Pacote qrcode não instalado. Rode npm install no server para gerar QR Code quando a Evolution retornar apenas o código bruto.');
}

const EVOLUTION_WEBHOOK_EVENTS = [
    'APPLICATION_STARTUP',
    'QRCODE_UPDATED',
    'CHATS_SET',
    'CHATS_UPSERT',
    'CHATS_UPDATE',
    'CHATS_DELETE',
    'CONTACTS_SET',
    'CONTACTS_UPSERT',
    'CONTACTS_UPDATE',
    'MESSAGES_SET',
    'MESSAGES_UPSERT',
    'MESSAGES_UPDATE',
    'MESSAGES_DELETE',
    'SEND_MESSAGE',
    'LABELS_EDIT',
    'LABELS_ASSOCIATION',
    'CONNECTION_UPDATE'
];
const EVOLUTION_LABEL_CACHE_MS = 10000;

if (!EVOLUTION_API_KEY) {
    console.warn('EVOLUTION_API_KEY não definida. Integração WhatsApp pela Evolution API ficará indisponível.');
}

let evolutionLabelMirrorCache = {
    expiresAt: 0,
    labels: [],
    tagsByPhone: new Map(),
    tagsByJid: new Map()
};
let webhookConfigPromise = null;
let lastWebhookConfiguredAt = 0;

const WEBHOOK_CONFIG_TTL_MS = 5 * 60 * 1000;

const AUDIO_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'whatsapp');

fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_automation_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        welcome_message TEXT NOT NULL DEFAULT '',
        delay_seconds INTEGER NOT NULL DEFAULT 0,
        audio_path TEXT,
        audio_original_name TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_automation_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        remote_jid TEXT,
        push_name TEXT,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        welcome_sent_at DATETIME,
        welcome_sent_count INTEGER NOT NULL DEFAULT 0,
        skipped_reason TEXT,
        last_message_text TEXT,
        last_error TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#2563eb',
        evolution_label_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`ALTER TABLE whatsapp_tags ADD COLUMN evolution_label_id TEXT`, () => {});

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversation_tags (
        conversation_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, tag_id)
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_label_webhook_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT,
        processed_count INTEGER NOT NULL DEFAULT 0,
        raw_payload TEXT,
        result_payload TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_webhook_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT,
        processed_count INTEGER NOT NULL DEFAULT 0,
        summary TEXT,
        raw_payload TEXT,
        result_payload TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        audio_filename TEXT NOT NULL,
        audio_original_name TEXT,
        simulate_recording BOOLEAN DEFAULT 1,
        delay_seconds INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reply_text TEXT,
        image_filename TEXT,
        image_original_name TEXT
    )
`);

try {
    db.run(`ALTER TABLE whatsapp_auto_replies ADD COLUMN reply_text TEXT`, () => {});
} catch (e) {}
try {
    db.run(`ALTER TABLE whatsapp_auto_replies ADD COLUMN image_filename TEXT`, () => {});
} catch (e) {}
try {
    db.run(`ALTER TABLE whatsapp_auto_replies ADD COLUMN image_original_name TEXT`, () => {});
} catch (e) {}

const evolution = createEvolutionClient();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        const fallbackExt = file.fieldname === 'image' ? '.jpg' : '.ogg';
        const finalExt = extension || fallbackExt;
        
        const baseName = path
            .basename(file.originalname || file.fieldname, finalExt)
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60);

        cb(null, `${Date.now()}-${baseName || file.fieldname}${finalExt}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        
        if (file.fieldname === 'audio') {
            if (extension !== '.ogg') {
                return cb(new Error('Envie apenas arquivos de áudio no formato .ogg.'));
            }
        } else if (file.fieldname === 'image') {
            if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
                return cb(new Error('Envie apenas imagens no formato .jpg ou .png.'));
            }
        }

        cb(null, true);
    }
});

function normalizeConnectionState(payload) {
    const rawState = payload?.instance?.state
        || payload?.state
        || payload?.status
        || payload?.connectionState
        || payload?.connection
        || 'close';

    const state = String(rawState).toLowerCase();

    if (state === 'open' || state.includes('open') || state.includes('connected')) return 'open';
    if (state === 'connecting' || state.includes('connecting') || state.includes('pairing')) return 'connecting';
    return 'close';
}

function getNestedValue(payload, paths) {
    for (const itemPath of paths) {
        const value = itemPath.split('.').reduce((current, key) => current?.[key], payload);
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return '';
}

function asDataImage(value) {
    if (!value) return '';
    if (value.startsWith('data:image')) return value;
    if (value.startsWith('base64,')) return `data:image/png;base64,${value.replace('base64,', '')}`;
    if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
        return `data:image/png;base64,${value.replace(/\s/g, '')}`;
    }

    return '';
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function createInstance() {
    return evolution.post('/instance/create', {
        instanceName: EVOLUTION_INSTANCE,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        msgCall: '',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        webhook: {
            enabled: true,
            url: EVOLUTION_WEBHOOK_URL,
            byEvents: false,
            base64: false,
            events: EVOLUTION_WEBHOOK_EVENTS
        }
    });
}

async function configureInstanceSettings() {
    return evolution.post(`/settings/set/${EVOLUTION_INSTANCE}`, {
        rejectCall: false,
        msgCall: '',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false
    });
}

async function configureInstanceWebhook() {
    const webhook = {
        enabled: true,
        url: EVOLUTION_WEBHOOK_URL,
        webhook_by_events: false,
        webhook_base64: false,
        byEvents: false,
        base64: false,
        events: EVOLUTION_WEBHOOK_EVENTS
    };
    const wrappedPayload = { webhook };
    const failures = [];

    const attempts = [
        { name: 'webhook/set wrapped', url: `/webhook/set/${EVOLUTION_INSTANCE}`, data: wrappedPayload },
        { name: 'webhook/set flat', url: `/webhook/set/${EVOLUTION_INSTANCE}`, data: webhook },
        { name: 'webhook/instance wrapped', url: `/webhook/instance/${EVOLUTION_INSTANCE}`, data: wrappedPayload },
        { name: 'webhook/instance flat', url: `/webhook/instance/${EVOLUTION_INSTANCE}`, data: webhook }
    ];

    for (const attempt of attempts) {
        try {
            return await evolution.post(attempt.url, attempt.data);
        } catch (error) {
            failures.push({
                attempt: attempt.name,
                status: error.response?.status || null,
                error: summarizeEvolutionError(error)
            });
        }
    }

    const error = new Error('Não foi possível configurar webhook da Evolution API.');
    error.failures = failures;
    throw error;
}

async function fetchEvolutionWebhookConfig() {
    const response = await evolution.get(`/webhook/find/${EVOLUTION_INSTANCE}`);
    return response.data || null;
}

async function ensureLightweightWebhookConfigured(options = {}) {
    if (!EVOLUTION_API_KEY || !EVOLUTION_WEBHOOK_URL) {
        return {
            skipped: true,
            reason: 'missing_config'
        };
    }

    const now = Date.now();
    if (!options.force && lastWebhookConfiguredAt && now - lastWebhookConfiguredAt < WEBHOOK_CONFIG_TTL_MS) {
        return {
            skipped: true,
            reason: 'recently_configured',
            configured_at: new Date(lastWebhookConfiguredAt).toISOString()
        };
    }

    if (webhookConfigPromise) return webhookConfigPromise;

    webhookConfigPromise = Promise.allSettled([
        configureInstanceWebhook(),
        configureInstanceSettings()
    ])
        .then(([webhookResult, settingsResult]) => {
            lastWebhookConfiguredAt = Date.now();

            const summary = {
                skipped: false,
                configured_at: new Date(lastWebhookConfiguredAt).toISOString(),
                events: EVOLUTION_WEBHOOK_EVENTS,
                webhook: webhookResult.status === 'fulfilled' ? 'ok' : summarizeEvolutionError(webhookResult.reason),
                settings: settingsResult.status === 'fulfilled' ? 'ok' : summarizeEvolutionError(settingsResult.reason)
            };

            if (webhookResult.status === 'rejected') {
                console.warn('Não foi possível configurar webhook leve da Evolution:', webhookResult.reason?.failures || summarizeEvolutionError(webhookResult.reason));
            }

            if (settingsResult.status === 'rejected') {
                console.warn('Não foi possível aplicar configuração leve da Evolution:', settingsResult.reason?.failures || summarizeEvolutionError(settingsResult.reason));
            }

            return summary;
        })
        .finally(() => {
            webhookConfigPromise = null;
        });

    return webhookConfigPromise;
}

async function extractQrCode(payload) {
    const base64 = getNestedValue(payload, [
        'base64',
        'qrcode.base64',
        'qrcode.base64Qr',
        'qrcode.qrCode',
        'qr.base64',
        'qrCode.base64'
    ]);

    const image = asDataImage(base64);
    if (image) return image;

    const code = getNestedValue(payload, [
        'code',
        'qrcode.code',
        'qr.code',
        'qrCode.code',
        'pairingCode'
    ]);

    if (!code || !QRCode) return '';
    return QRCode.toDataURL(code, { margin: 1, width: 320 });
}

async function fetchConnectionState() {
    const response = await evolution.get(`/instance/connectionState/${EVOLUTION_INSTANCE}`);
    return {
        status: normalizeConnectionState(response.data),
        raw: response.data
    };
}

function handleEvolutionError(res, error, fallbackMessage) {
    const status = error.response?.status || (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code) ? 503 : 502);
    const details = error.failures || error.response?.data || error.message;

    return res.status(status).json({
        error: fallbackMessage,
        details,
        config: getEvolutionDiagnostics()
    });
}

function requireEvolutionApiKey(res) {
    if (EVOLUTION_API_KEY) return false;

    res.status(400).json({
        error: 'Chave da Evolution API não configurada. Defina EVOLUTION_API_KEY ou AUTHENTICATION_API_KEY.',
        config: getEvolutionDiagnostics()
    });
    return true;
}

function getEvolutionStorageWarnings() {
    const diagnostics = getEvolutionDiagnostics();
    const storage = diagnostics.dataStorage || {};
    const warnings = [];

    [
        ['labels', 'DATABASE_SAVE_DATA_LABELS'],
        ['chats', 'DATABASE_SAVE_DATA_CHATS'],
        ['contacts', 'DATABASE_SAVE_DATA_CONTACTS']
    ].forEach(([key, envName]) => {
        if (storage[key]?.configured && storage[key].value === false) {
            warnings.push({
                step: 'evolution_storage',
                env: envName,
                message: `${envName}=false impede a Evolution API de devolver etiquetas/vínculos para sincronização.`
            });
        }
    });

    return warnings;
}

function isInstanceNotFound(error) {
    const message = JSON.stringify(error.response?.data || {});
    return error.response?.status === 404 && message.includes('instance does not exist');
}

function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');

    if (!digits) return '';

    digits = digits.replace(/^0+/, '');

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = `55${digits}`;
    }

    if (digits.startsWith('55') && digits.length === 13) {
        const countryCode = digits.slice(0, 2);
        const areaCode = digits.slice(2, 4);
        const localNumber = digits.slice(4);

        if (localNumber.length === 9 && localNumber.startsWith('9')) {
            return `${countryCode}${areaCode}${localNumber.slice(1)}`;
        }
    }

    return digits;
}

function phoneLooksSame(left, right) {
    const normalizedLeft = normalizePhone(left);
    const normalizedRight = normalizePhone(right);

    if (!normalizedLeft || !normalizedRight) return false;
    return normalizedLeft.endsWith(normalizedRight) || normalizedRight.endsWith(normalizedLeft);
}

function formatHistoryPhone(value) {
    const digits = normalizePhone(value);
    if (!digits) return '';

    const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    if (match) return `+55 (${match[1]}) ${match[2]}-${match[3]}`;
    return digits;
}

function getPhoneSearchVariants(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return [];

    const variants = [
        digits,
        normalizePhone(digits)
    ];

    if (digits.startsWith('55')) variants.push(digits.slice(2));
    if (normalizePhone(digits).startsWith('55')) variants.push(normalizePhone(digits).slice(2));

    if (digits.length === 11 && digits[2] === '9') {
        variants.push(`${digits.slice(0, 2)}${digits.slice(3)}`);
    }

    if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
        variants.push(`${digits.slice(0, 4)}${digits.slice(5)}`);
        variants.push(`${digits.slice(2, 4)}${digits.slice(5)}`);
    }

    return Array.from(new Set(variants.filter(item => item && item.length >= 4)));
}

function isLikelyWhatsappPhone(value) {
    const digits = normalizePhone(value);
    if (!digits) return false;
    return digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
}

function isLidJid(value) {
    return String(value || '').includes('@lid');
}

function extractPhoneFromRemoteJid(remoteJid) {
    const jid = String(remoteJid || '').trim();
    if (!jid || isLidJid(jid) || jid.includes('@g.us') || jid.includes('status@broadcast')) return '';

    const rawPhone = jid.includes('@') ? jid.split('@')[0] : jid;
    const phone = normalizePhone(rawPhone);
    return isLikelyWhatsappPhone(phone) ? phone : '';
}

async function findExistingConversationByPhone(phone) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const directMatch = await dbGet(
        `SELECT * FROM whatsapp_conversations WHERE phone = ?`,
        [normalizedPhone]
    );

    if (directMatch) return directMatch;

    const conversations = await dbAll(
        `SELECT * FROM whatsapp_conversations WHERE phone IS NOT NULL AND phone <> ''`
    );
    const samePhoneConversation = conversations.find((conversation) => phoneLooksSame(conversation.phone, normalizedPhone));

    if (!samePhoneConversation) return null;

    if (samePhoneConversation.phone !== normalizedPhone) {
        try {
            await dbRun(
                `UPDATE whatsapp_conversations
                    SET phone = ?,
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
                [normalizedPhone, samePhoneConversation.id]
            );

            return dbGet(
                `SELECT * FROM whatsapp_conversations WHERE id = ?`,
                [samePhoneConversation.id]
            );
        } catch (error) {
            const canonicalConversation = await dbGet(
                `SELECT * FROM whatsapp_conversations WHERE phone = ?`,
                [normalizedPhone]
            );

            return canonicalConversation || samePhoneConversation;
        }
    }

    return samePhoneConversation;
}

async function findExistingConversationByRemoteJid(remoteJid) {
    const normalizedRemoteJid = normalizeWhatsappJid(remoteJid);
    if (!normalizedRemoteJid) return null;

    return dbGet(
        `SELECT * FROM whatsapp_conversations WHERE remote_jid = ? LIMIT 1`,
        [normalizedRemoteJid]
    );
}

function extractIncomingPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    if (Array.isArray(payload)) {
        return payload.map(extractIncomingPayload).find(Boolean) || null;
    }

    if (Array.isArray(payload.data)) {
        return extractIncomingPayload(payload.data);
    }

    if (payload.data && typeof payload.data === 'object') {
        return payload.data;
    }

    return payload;
}

function collectMessagePayloads(payload) {
    if (!payload || typeof payload !== 'object') return [];

    if (Array.isArray(payload)) {
        return payload.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.data)) {
        return payload.data.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.messages)) {
        return payload.messages.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.records)) {
        return payload.records.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.data?.messages)) {
        return payload.data.messages.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.data?.records)) {
        return payload.data.records.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.response?.messages)) {
        return payload.response.messages.flatMap(collectMessagePayloads);
    }

    if (Array.isArray(payload.response?.records)) {
        return payload.response.records.flatMap(collectMessagePayloads);
    }

    if (payload.data && typeof payload.data === 'object' && (payload.data.key || payload.data.message || payload.data.remoteJid || payload.data.messageTimestamp)) {
        return [payload.data];
    }

    if (payload.message && typeof payload.message === 'object' && (payload.key || payload.remoteJid || payload.messageTimestamp)) {
        return [payload];
    }

    if (payload.key || payload.remoteJid || payload.from || payload.messageTimestamp || payload.messageType) {
        return [payload];
    }

    return [];
}

function normalizeTextValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getPathValue(source, pathName) {
    if (!source || typeof source !== 'object') return '';

    const value = pathName.split('.').reduce((current, key) => {
        if (!current || typeof current !== 'object') return undefined;
        return current[key];
    }, source);

    return normalizeTextValue(value);
}

function findTextByPaths(sources, paths) {
    for (const source of sources) {
        const directValue = normalizeTextValue(source);
        if (directValue) return directValue;

        for (const pathName of paths) {
            const value = getPathValue(source, pathName);
            if (value) return value;
        }
    }

    return '';
}

function findTextLikeValue(payload, depth = 0, seen = new Set()) {
    if (!payload || depth > 9) return '';
    if (typeof payload === 'string') return '';
    if (typeof payload !== 'object') return '';
    if (seen.has(payload)) return '';
    seen.add(payload);

    if (Array.isArray(payload)) {
        for (const item of payload) {
            const value = findTextLikeValue(item, depth + 1, seen);
            if (value) return value;
        }

        return '';
    }

    const skipKeys = new Set([
        'key',
        'contextInfo',
        'messageContextInfo',
        'quotedMessage',
        'externalAdReply',
        'sender',
        'participant'
    ]);

    const textKeys = new Set([
        'text',
        'caption',
        'conversation',
        'body',
        'content',
        'selectedDisplayText',
        'selectedButtonId',
        'selectedRowId'
    ]);

    for (const [key, value] of Object.entries(payload)) {
        const normalizedKey = key.toLowerCase();

        if (
            textKeys.has(key)
            || normalizedKey.endsWith('text')
            || normalizedKey.endsWith('caption')
            || normalizedKey === 'conversation'
        ) {
            const text = normalizeTextValue(value);
            if (text) return text;
        }
    }

    for (const [key, value] of Object.entries(payload)) {
        if (skipKeys.has(key)) continue;

        const nested = findTextLikeValue(value, depth + 1, seen);
        if (nested) return nested;
    }

    return '';
}

function extractIncomingText(messagePayload) {
    if (!messagePayload) return '';

    const searchForText = (obj, depth = 0) => {
        if (!obj || depth > 6) return '';
        if (typeof obj === 'string') return obj;
        if (typeof obj !== 'object') return '';

        if (obj.conversation) return obj.conversation;
        if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
        if (obj.caption) return obj.caption;
        if (obj.selectedDisplayText) return obj.selectedDisplayText;
        if (obj.title) return obj.title;
        if (typeof obj.body?.text === 'string' && obj.body.text.trim()) return obj.body.text.trim();

        if (obj.extendedTextMessage?.text) return obj.extendedTextMessage.text;
        if (obj.imageMessage?.caption) return obj.imageMessage.caption;
        if (obj.videoMessage?.caption) return obj.videoMessage.caption;
        if (obj.documentMessage?.caption) return obj.documentMessage.caption;
        if (obj.documentMessage?.fileName) return `[Documento: ${obj.documentMessage.fileName}]`;
        if (obj.buttonsResponseMessage?.selectedDisplayText) return obj.buttonsResponseMessage.selectedDisplayText;
        if (obj.templateButtonReplyMessage?.selectedDisplayText) return obj.templateButtonReplyMessage.selectedDisplayText;
        if (obj.listResponseMessage?.title) return obj.listResponseMessage.title;
        if (obj.interactiveMessage?.body?.text) return obj.interactiveMessage.body.text;
        if (obj.ephemeralMessage?.message) return searchForText(obj.ephemeralMessage.message, depth + 1);
        if (obj.viewOnceMessage?.message) return searchForText(obj.viewOnceMessage.message, depth + 1);
        if (obj.viewOnceMessageV2?.message) return searchForText(obj.viewOnceMessageV2.message, depth + 1);
        if (obj.documentWithCaptionMessage?.message?.documentMessage?.caption) {
            return obj.documentWithCaptionMessage.message.documentMessage.caption;
        }
        if (obj.editedMessage?.message) return searchForText(obj.editedMessage.message, depth + 1);
        if (obj.locationMessage) return `[Localização${obj.locationMessage.name ? `: ${obj.locationMessage.name}` : ''}]`;
        if (obj.contactMessage) return `[Contato: ${obj.contactMessage.displayName || 'WhatsApp'}]`;

        return '';
    };

    const text = searchForText(messagePayload?.message) || searchForText(messagePayload);
    return String(text || '').trim();
}

function extractMessageType(messagePayload, rootPayload = null) {
    const message = messagePayload?.message && typeof messagePayload.message === 'object'
        ? messagePayload.message
        : {};

    return messagePayload?.messageType
        || Object.keys(message).find(key => key !== 'messageContextInfo')
        || (extractIncomingText(messagePayload, rootPayload) ? 'text' : 'unknown');
}

function outgoingDeviceFallbackText(messageType) {
    const normalizedType = String(messageType || '').toLowerCase();

    if (normalizedType.includes('audio')) return '[Áudio enviado]';
    if (normalizedType.includes('image')) return '[Imagem enviada]';
    if (normalizedType.includes('video')) return '[Vídeo enviado]';
    if (normalizedType.includes('document')) return '[Documento enviado]';
    if (normalizedType.includes('sticker')) return '[Figurinha enviada]';
    if (normalizedType.includes('location')) return '[Localização enviada]';
    if (normalizedType.includes('contact')) return '[Contato enviado]';
    if (normalizedType.includes('reaction')) return '[Reação enviada]';

    return '';
}

function extractMessageTimestamp(messagePayload) {
    if (!messagePayload) return null;
    const value = messagePayload?.messageTimestamp
        || messagePayload?.timestamp
        || messagePayload?.conversationTimestamp
        || messagePayload?.conversation_timestamp
        || messagePayload?.lastMessageTimestamp
        || messagePayload?.last_message_timestamp
        || messagePayload?.lastMessageTime
        || messagePayload?.last_message_time
        || messagePayload?.createdAt
        || messagePayload?.created_at
        || messagePayload?.updatedAt
        || messagePayload?.updated_at
        || messagePayload?.dateTime
        || messagePayload?.date_time;

    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        if (/^\d+$/.test(value.trim())) return Number(value.trim());
        return value.trim();
    }
    if (typeof value === 'object') {
        if (typeof value.low === 'number') return value.low;
        if (typeof value.seconds === 'number') return value.seconds;
        if (typeof value.getTime === 'function') return value.getTime();
    }

    return value;
}

function toSqlDateTime(value) {
    if (!value) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        const milliseconds = value > 100000000000 ? value : value * 1000;
        const date = new Date(milliseconds);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const num = Number(value.trim());
        const milliseconds = num > 100000000000 ? num : num * 1000;
        const date = new Date(milliseconds);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function extractIncomingMessage(payload, rootPayload = null) {
    const messagePayload = extractIncomingPayload(payload) || payload;
    if (!messagePayload || typeof messagePayload !== 'object') return null;

    const key = messagePayload.key || payload?.key || {};

    const candidateJids = [
        key.remoteJid,
        messagePayload.remoteJid,
        messagePayload.from,
        messagePayload.jid,
        key.participant,
        messagePayload.participant,
        messagePayload.sender,
        messagePayload.senderJid,
        messagePayload.recipient,
        rootPayload?.data?.key?.remoteJid,
        rootPayload?.data?.remoteJid
    ].filter(Boolean);

    let remoteJid = '';
    let phone = '';

    for (const cand of candidateJids) {
        const extracted = extractPhoneFromRemoteJid(cand);
        if (extracted) {
            phone = extracted;
            remoteJid = normalizeWhatsappJid(cand);
            break;
        }
    }

    if (!phone) {
        const candidatePhones = [
            messagePayload.phone,
            messagePayload.number,
            messagePayload.phoneNumber,
            messagePayload.phone_number,
            key.phone,
            key.number,
            rootPayload?.data?.phone,
            rootPayload?.data?.number
        ].filter(Boolean);

        for (const cand of candidatePhones) {
            const normalized = normalizePhone(cand);
            if (isLikelyWhatsappPhone(normalized)) {
                phone = normalized;
                remoteJid = `${normalized}@s.whatsapp.net`;
                break;
            }
        }
    }

    const mainJid = key.remoteJid || messagePayload.remoteJid || remoteJid || '';
    const isGroup = mainJid.includes('@g.us');
    const isBroadcast = mainJid.includes('status@broadcast');

    const pushName = messagePayload.pushName
        || messagePayload.pushname
        || messagePayload.name
        || messagePayload.verifiedName
        || messagePayload.notify
        || messagePayload.sender?.pushName
        || messagePayload.sender?.name
        || messagePayload.contact?.pushName
        || messagePayload.contact?.name
        || rootPayload?.data?.pushName
        || rootPayload?.pushName
        || '';

    const text = extractIncomingText(messagePayload, rootPayload || payload);
    const type = extractMessageType(messagePayload, rootPayload || payload);
    const rawTimestamp = extractMessageTimestamp(messagePayload) || extractMessageTimestamp(rootPayload);
    const timestamp = toSqlDateTime(rawTimestamp) || new Date().toISOString().slice(0, 19).replace('T', ' ');

    return {
        id: key.id || messagePayload.id || '',
        phone,
        remoteJid: remoteJid || mainJid,
        fromMe: Boolean(key.fromMe || messagePayload.fromMe),
        pushName: String(pushName).trim(),
        text,
        type,
        timestamp,
        isGroup,
        isBroadcast
    };
}

async function findExistingClientByPhone(phone) {
    const clients = await dbAll('SELECT id, name, phone FROM clients WHERE phone IS NOT NULL AND phone <> ""');
    return clients.find(client => phoneLooksSame(phone, client.phone)) || null;
}

async function getAutomationSettings() {
    return dbGet(
        `SELECT welcome_message, delay_seconds, audio_path, audio_original_name
         FROM whatsapp_automation_settings
         WHERE id = 1`
    );
}

async function sendWelcomeText(phone, text) {
    return sendTextMessage(phone, text);
}

async function sendWelcomeAudio(phone, settings) {
    if (!settings?.audio_path) return null;

    const audioFilePath = path.join(__dirname, '..', 'uploads', settings.audio_path);
    if (!fs.existsSync(audioFilePath)) return null;

    const audioBase64 = fs.readFileSync(audioFilePath).toString('base64');

    return evolution.post(`/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`, {
        number: phone,
        audio: audioBase64,
        delay: 0,
        linkPreview: false
    });
}

function stringifyPayload(payload) {
    try {
        return JSON.stringify(payload || {});
    } catch (error) {
        return JSON.stringify({ error: 'payload_not_serializable' });
    }
}

function normalizeConversationStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    return ['open', 'archived'].includes(normalized) ? normalized : 'open';
}

async function ensureConversation(phone, metadata = {}) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error('Telefone inválido para conversa WhatsApp.');

    const existingClient = metadata.client || await findExistingClientByPhone(normalizedPhone).catch(() => null);
    const clientName = metadata.clientName || existingClient?.name || '';
    const existingConversation = await findExistingConversationByPhone(normalizedPhone).catch(() => null);
    const lastMessageText = String(metadata.lastMessageText || '').trim();
    const lastMessageAt = toSqlDateTime(metadata.lastMessageAt) || null;

    if (existingConversation) {
        await dbRun(
            `UPDATE whatsapp_conversations
                SET remote_jid = COALESCE(NULLIF(?, ''), remote_jid),
                    push_name = COALESCE(NULLIF(?, ''), push_name),
                    client_id = COALESCE(?, client_id),
                    client_name = COALESCE(NULLIF(?, ''), client_name),
                    last_message_text = COALESCE(NULLIF(?, ''), last_message_text),
                    last_message_at = COALESCE(?, last_message_at),
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [
                metadata.remoteJid || '',
                metadata.pushName || '',
                existingClient?.id || metadata.clientId || null,
                clientName,
                lastMessageText,
                lastMessageAt,
                existingConversation.id
            ]
        );

        return dbGet(`SELECT * FROM whatsapp_conversations WHERE id = ?`, [existingConversation.id]);
    }

    await dbRun(
        `INSERT INTO whatsapp_conversations
            (phone, remote_jid, push_name, client_id, client_name, last_message_text, last_message_at, updated_at)
         VALUES
            (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(phone) DO UPDATE SET
            remote_jid = COALESCE(NULLIF(excluded.remote_jid, ''), remote_jid),
            push_name = COALESCE(NULLIF(excluded.push_name, ''), push_name),
            client_id = COALESCE(excluded.client_id, client_id),
            client_name = COALESCE(NULLIF(excluded.client_name, ''), client_name),
            last_message_text = COALESCE(NULLIF(excluded.last_message_text, ''), last_message_text),
            last_message_at = COALESCE(excluded.last_message_at, last_message_at),
            updated_at = CURRENT_TIMESTAMP`,
        [
            normalizedPhone,
            metadata.remoteJid || '',
            metadata.pushName || '',
            existingClient?.id || metadata.clientId || null,
            clientName,
            lastMessageText,
            lastMessageAt
        ]
    );

    return dbGet(`SELECT * FROM whatsapp_conversations WHERE phone = ?`, [normalizedPhone]);
}

async function getLinkedOrders(conversationId) {
    return dbAll(
        `SELECT
            o.id,
            o.tracking_code,
            o.client_name,
            o.status,
            o.total_price,
            o.delivery_date,
            wco.created_at AS linked_at
         FROM whatsapp_conversation_orders wco
         JOIN orders o ON o.id = wco.order_id
         WHERE wco.conversation_id = ?
         ORDER BY wco.created_at DESC`,
        [conversationId]
    );
}

async function findClientForMetaLead(conversation) {
    if (!conversation) return null;

    if (conversation.client_id) {
        const client = await dbGet(
            `SELECT id, name, phone, email FROM clients WHERE id = ?`,
            [conversation.client_id]
        );

        if (client) return client;
    }

    const clients = await dbAll(
        `SELECT id, name, phone, email
         FROM clients
         WHERE phone IS NOT NULL
           AND phone <> ''`
    );

    return clients.find(client => phoneLooksSame(client.phone, conversation.phone)) || null;
}

async function sendQualifiedLeadToMetaIfNeeded(conversation, label, userId) {
    if (!isQualifiedLeadLabel(label)) {
        return {
            sent: false,
            skipped: true,
            reason: 'label_not_qualified'
        };
    }

    try {
        const client = await findClientForMetaLead(conversation);
        const phone = client?.phone || conversation?.phone || '';
        const email = client?.email || '';

        return await sendQualifiedLeadEvent(
            {
                leadId: conversation.id,
                phone,
                email
            },
            {
                source: 'whatsapp',
                sourceId: String(conversation.id),
                conversationId: conversation.id,
                clientId: client?.id || conversation.client_id || null,
                createdByUserId: userId || null,
                eventId: `whatsapp-qualified-lead-${conversation.id}`
            }
        );
    } catch (error) {
        console.error('Erro ao enviar lead qualificado do WhatsApp para Meta CAPI:', error.metaCapi || error.message);
        return error.metaCapi || {
            sent: false,
            skipped: false,
            error: error.message
        };
    }
}

async function persistIncomingMessage(incoming, payload, options = {}) {
    const conversation = await ensureConversation(incoming.phone, {
        remoteJid: incoming.remoteJid,
        pushName: incoming.pushName
    });

    const body = incoming.text || '';
    const createdAt = incoming.timestamp || null;
    const countUnread = options.countUnread !== false;
    const insertResult = await dbRun(
        `INSERT OR IGNORE INTO whatsapp_messages
            (conversation_id, provider_message_id, phone, direction, message_type, body, raw_payload, created_at)
         VALUES
            (?, ?, ?, 'incoming', ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
            conversation.id,
            incoming.id || null,
            incoming.phone,
            incoming.type || (body ? 'text' : 'unknown'),
            body,
            stringifyPayload(payload),
            createdAt
        ]
    );

    if (insertResult.changes > 0) {
        await dbRun(
            `UPDATE whatsapp_conversations
             SET last_message_text = ?,
                 last_message_at = CURRENT_TIMESTAMP,
                 unread_count = unread_count + ?,
                 status = CASE WHEN status = 'archived' THEN 'open' ELSE status END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [body || 'Mensagem recebida', countUnread ? 1 : 0, conversation.id]
        );
    }

    return { conversation, inserted: insertResult.changes > 0 };
}

async function persistOutgoingMessage(phone, body, userId = null, rawPayload = null, messageType = 'text', createdAt = null) {
    const normalizedPhone = normalizePhone(phone);
    const conversation = await ensureConversation(normalizedPhone);
    const providerMessageId = rawPayload?.key?.id
        || rawPayload?.message?.key?.id
        || rawPayload?.messageId
        || rawPayload?.id
        || null;

    await dbRun(
        `INSERT OR IGNORE INTO whatsapp_messages
            (conversation_id, provider_message_id, phone, direction, message_type, body, raw_payload, sent_by_user_id, created_at)
         VALUES
            (?, ?, ?, 'outgoing', ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
            conversation.id,
            providerMessageId,
            normalizedPhone,
            messageType,
            body,
            rawPayload ? stringifyPayload(rawPayload) : null,
            userId,
            createdAt
        ]
    );

    await dbRun(
        `UPDATE whatsapp_conversations
         SET last_message_text = ?,
             last_message_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [body || 'Mensagem enviada', conversation.id]
    );

    return dbGet(`SELECT * FROM whatsapp_conversations WHERE id = ?`, [conversation.id]);
}

async function sendTextMessage(phone, text) {
    const normalizedPhone = normalizePhone(phone);
    const payload = buildEvolutionTextPayload(normalizedPhone, text, {
        delay: 1000,
        linkPreview: true
    });

    try {
        const response = await evolution.post(`/message/sendText/${EVOLUTION_INSTANCE}`, payload);
        return { data: response.data };
    } catch (error) {
        throw error;
    }
}

async function processWebhookMessage(messagePayload, rootPayload, options = {}) {
    const incoming = extractIncomingMessage(messagePayload, rootPayload);
    if (!incoming?.phone || !isLikelyWhatsappPhone(incoming.phone) || incoming.fromMe || incoming.isGroup || incoming.isBroadcast) {
        if (incoming?.fromMe && incoming?.phone && isLikelyWhatsappPhone(incoming.phone) && !incoming.isGroup && !incoming.isBroadcast) {
            const outgoingText = incoming.text || outgoingDeviceFallbackText(incoming.type);

            await persistOutgoingMessage(
                incoming.phone,
                outgoingText,
                null,
                messagePayload,
                incoming.type || 'unknown',
                incoming.timestamp || null
            );

            return { saved: true, direction: 'outgoing', phone: incoming.phone };
        }

        return { ignored: true, reason: 'invalid_or_group_message' };
    }

    await persistIncomingMessage(incoming, messagePayload, { countUnread: options.countUnread });

    if (!options.runAutomation) {
        return { saved: true, direction: 'incoming', phone: incoming.phone, automation: 'skipped' };
    }

    const inserted = await dbRun(
        `INSERT OR IGNORE INTO whatsapp_automation_contacts
            (phone, remote_jid, push_name, last_message_text, updated_at)
         VALUES
            (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [incoming.phone, incoming.remoteJid, incoming.pushName, incoming.text]
    );

    await dbRun(
        `UPDATE whatsapp_automation_contacts
         SET remote_jid = COALESCE(NULLIF(?, ''), remote_jid),
             push_name = COALESCE(NULLIF(?, ''), push_name),
             last_message_text = ?,
             last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE phone = ?`,
        [incoming.remoteJid, incoming.pushName, incoming.text, incoming.phone]
    );

    if (inserted.changes === 0) {
        return { ignored: true, reason: 'contact_already_seen', phone: incoming.phone };
    }

    const existingClient = await findExistingClientByPhone(incoming.phone);
    if (existingClient) {
        await dbRun(
            `UPDATE whatsapp_automation_contacts
             SET skipped_reason = ?, updated_at = CURRENT_TIMESTAMP
             WHERE phone = ?`,
            [`existing_client:${existingClient.id}`, incoming.phone]
        );

        return { ignored: true, reason: 'existing_client', phone: incoming.phone };
    }

    const settings = await getAutomationSettings();
    const welcomeMessage = String(settings?.welcome_message || '').trim();

    if (!welcomeMessage && !settings?.audio_path) {
        await dbRun(
            `UPDATE whatsapp_automation_contacts
             SET skipped_reason = 'empty_automation', updated_at = CURRENT_TIMESTAMP
             WHERE phone = ?`,
            [incoming.phone]
        );

        return { ignored: true, reason: 'empty_automation', phone: incoming.phone };
    }

    try {
        const delaySeconds = Math.max(0, Number(settings?.delay_seconds || 0));
        if (delaySeconds) await wait(Math.min(delaySeconds, 60) * 1000);

        if (welcomeMessage) {
            const textResponse = await sendWelcomeText(incoming.phone, welcomeMessage);
            await persistOutgoingMessage(incoming.phone, welcomeMessage, null, textResponse.data, 'text');
        }

        const audioResponse = await sendWelcomeAudio(incoming.phone, settings);
        if (audioResponse) {
            await persistOutgoingMessage(incoming.phone, '[Audio de boas-vindas]', null, audioResponse.data, 'audio');
        }

        await dbRun(
            `UPDATE whatsapp_automation_contacts
             SET welcome_sent_at = CURRENT_TIMESTAMP,
                 welcome_sent_count = welcome_sent_count + 1,
                 skipped_reason = NULL,
                 last_error = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE phone = ?`,
            [incoming.phone]
        );

        return { sent: true, phone: incoming.phone };
    } catch (error) {
        await dbRun(
            `UPDATE whatsapp_automation_contacts
             SET last_error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE phone = ?`,
            [error.response?.data ? JSON.stringify(error.response.data) : error.message, incoming.phone]
        );

        throw error;
    }
}

async function processIncomingWebhook(payload) {
    const eventName = normalizeWebhookEventName(payload);

    if (eventName.includes('LABEL')) {
        return processLabelWebhook(payload, eventName);
    }

    if (
        eventName.includes('CHAT')
        || eventName.includes('CONTACT')
        || eventName === 'CHATS_SET'
        || eventName === 'CHATS_UPSERT'
        || eventName === 'CHATS_UPDATE'
        || eventName === 'CONTACTS_SET'
        || eventName === 'CONTACTS_UPSERT'
        || eventName === 'CONTACTS_UPDATE'
    ) {
        return processChatWebhook(payload, eventName);
    }

    if (
        eventName.includes('MESSAGE')
        || eventName.includes('SEND_MESSAGE')
        || eventName === 'MESSAGES_SET'
        || eventName === 'MESSAGES_UPSERT'
        || eventName === 'MESSAGES_UPDATE'
        || collectMessagePayloads(payload).length > 0
    ) {
        return processMessageContactWebhook(payload, eventName);
    }

    if (eventName.includes('CONNECTION') || eventName.includes('QRCODE')) {
        return {
            processed: 0,
            event: eventName,
            status: normalizeConnectionState(payload?.data || payload)
        };
    }

    return {
        ignored: true,
        event: eventName || 'UNKNOWN',
        reason: 'unhandled_event'
    };
}

function collectChatPayloads(payload) {
    if (!payload || typeof payload !== 'object') return [];

    if (Array.isArray(payload)) {
        return payload.flatMap(collectChatPayloads);
    }

    if (Array.isArray(payload.data)) {
        return payload.data.filter(item => item && typeof item === 'object');
    }

    if (Array.isArray(payload.chats)) {
        return payload.chats.filter(item => item && typeof item === 'object');
    }

    if (Array.isArray(payload.contacts)) {
        return payload.contacts.filter(item => item && typeof item === 'object');
    }

    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        if (Array.isArray(payload.data.chats)) return payload.data.chats;
        if (Array.isArray(payload.data.contacts)) return payload.data.contacts;
        return [payload.data];
    }

    if (payload.chat && typeof payload.chat === 'object') {
        return [payload.chat];
    }

    if (payload.contact && typeof payload.contact === 'object') {
        return [payload.contact];
    }

    if (payload.remoteJid || payload.jid || payload.id || payload.phone || payload.number) {
        return [payload];
    }

    return [];
}

async function processChatWebhook(payload, eventName) {
    const results = [];
    const seenPhones = new Set();

    for (const chat of collectChatPayloads(payload)) {
        const target = normalizeChatTarget(chat);
        if (!target || seenPhones.has(target.phone)) continue;

        seenPhones.add(target.phone);
        const conversation = await ensureConversation(target.phone, {
            remoteJid: target.remoteJid,
            pushName: target.pushName,
            lastMessageText: target.lastMessageText,
            lastMessageAt: target.lastMessageAt
        });

        results.push({
            saved: true,
            conversation_id: conversation.id,
            phone: target.phone
        });
    }

    return {
        processed: results.length,
        event: eventName || 'CHAT_UPDATE',
        results
    };
}

async function processMessageContactWebhook(payload, eventName) {
    const results = [];
    const seenMessages = new Set();

    for (const messagePayload of collectMessagePayloads(payload)) {
        const incoming = extractIncomingMessage(messagePayload, payload);
        const messageKey = incoming?.id || JSON.stringify(messagePayload?.key || {});

        if (!incoming?.phone || !isLikelyWhatsappPhone(incoming.phone) || incoming.isGroup || incoming.isBroadcast) {
            continue;
        }

        if (seenMessages.has(messageKey)) continue;
        seenMessages.add(messageKey);

        results.push(await persistMessageContactActivity(incoming));

        // Disparar resposta automática em áudio, se houver
        if (!incoming.fromMe) {
            await handleAutoReply(incoming);
        }
    }

    return {
        processed: results.length,
        event: eventName || 'MESSAGES_UPSERT',
        mode: 'contact_activity_only',
        results
    };
}

async function handleAutoReply(incoming) {
    if (!incoming.text) return;
    const textLower = incoming.text.toLowerCase();
    
    try {
        const rules = await dbAll(`SELECT * FROM whatsapp_auto_replies`);
        if (!rules || rules.length === 0) return;

        // Split keyword by comma and trim, check if any keyword matches
        const matchedRule = rules.find(rule => {
            const keywords = rule.keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            return keywords.some(k => textLower.includes(k));
        });
        
        if (matchedRule) {
            const remoteJid = incoming.remoteJid || incoming.phone;
            const delay = matchedRule.delay_seconds || 3;
            
            if (matchedRule.simulate_recording) {
                try {
                    const presenceType = matchedRule.audio_filename ? 'recording' : 'composing';
                    await evolution.post(`/chat/sendPresence/${EVOLUTION_INSTANCE}`, {
                        number: remoteJid,
                        presence: presenceType,
                        delay: delay * 1000
                    });
                } catch (e) {
                    console.warn(`Falha ao enviar presence:`, summarizeEvolutionError(e));
                }
                
                await wait(delay * 1000);
            }
            
            // Enviar Imagem (+ Texto opcional no caption)
            if (matchedRule.image_filename) {
                const imgPath = path.join(AUDIO_UPLOAD_DIR, matchedRule.image_filename);
                if (fs.existsSync(imgPath)) {
                    const ext = path.extname(imgPath).toLowerCase();
                    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                    const base64Img = fs.readFileSync(imgPath, { encoding: 'base64' });
                    const dataUrl = `data:${mimeType};base64,${base64Img}`;

                    await evolution.post(`/message/sendMedia/${EVOLUTION_INSTANCE}`, {
                        number: remoteJid,
                        mediatype: 'image',
                        media: dataUrl,
                        caption: matchedRule.reply_text || undefined
                    });
                } else {
                    console.warn(`Imagem não encontrada para a regra: ${imgPath}`);
                }
            } else if (matchedRule.reply_text) {
                // Enviar Apenas Texto (se não tem imagem)
                await evolution.post(`/message/sendText/${EVOLUTION_INSTANCE}`, {
                    number: remoteJid,
                    text: matchedRule.reply_text,
                    linkPreview: true
                });
            }
            
            // Enviar Áudio
            if (matchedRule.audio_filename) {
                const audioPath = path.join(AUDIO_UPLOAD_DIR, matchedRule.audio_filename);
                if (fs.existsSync(audioPath)) {
                    const base64Audio = fs.readFileSync(audioPath, { encoding: 'base64' });
                    const dataUrl = `data:audio/ogg;base64,${base64Audio}`;

                    await evolution.post(`/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`, {
                        number: remoteJid,
                        audio: dataUrl,
                        ptt: true
                    });
                } else {
                    console.warn(`Arquivo de áudio não encontrado para a regra: ${audioPath}`);
                }
            }
        }
    } catch (error) {
        console.error('Erro no processamento da resposta automática:', summarizeEvolutionError(error));
    }
}

async function persistMessageContactActivity(incoming) {
    const previewText = incoming.text
        || outgoingDeviceFallbackText(incoming.type)
        || (incoming.fromMe ? 'Mensagem enviada' : 'Mensagem recebida');
    const timestamp = incoming.timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const conversation = await ensureConversation(incoming.phone, {
        remoteJid: incoming.remoteJid,
        pushName: incoming.pushName,
        lastMessageText: previewText,
        lastMessageAt: timestamp
    });

    return {
        saved: true,
        conversation_id: conversation.id,
        phone: incoming.phone,
        direction: incoming.fromMe ? 'outgoing' : 'incoming'
    };
}

function asArrayResponse(payload, keys = []) {
    if (Array.isArray(payload)) return payload;

    for (const key of keys) {
        const value = key.split('.').reduce((current, item) => current?.[item], payload);
        if (Array.isArray(value)) return value;
    }

    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.response)) return payload.response;
    if (Array.isArray(payload?.records)) return payload.records;
    return [];
}

function extractChatRemoteJid(chat) {
    return chat?.remoteJid
        || chat?.id
        || chat?.jid
        || chat?.key?.remoteJid
        || chat?.conversation?.remoteJid
        || chat?.contact?.remoteJid
        || chat?.contact?.jid
        || chat?.contact?.id
        || '';
}

function summarizeEvolutionError(error) {
    const details = error.response?.data || error.message || 'Erro desconhecido';
    if (typeof details === 'string') return details.slice(0, 500);

    try {
        return JSON.stringify(details).slice(0, 500);
    } catch (_) {
        return 'Erro sem detalhes legíveis';
    }
}

function normalizeWebhookEventName(payload) {
    return String(payload?.event || payload?.type || payload?.eventType || '')
        .toUpperCase()
        .replace(/[.\-\s]+/g, '_');
}

function sanitizeWebhookPayload(payload, maxLength = 10000) {
    try {
        const json = JSON.stringify(payload, (key, value) => {
            const normalizedKey = String(key || '').toLowerCase();
            if (['apikey', 'api_key', 'token', 'access_token', 'authorization'].includes(normalizedKey)) {
                return '[redacted]';
            }

            return value;
        });

        return json.length > maxLength ? `${json.slice(0, maxLength)}...[truncated]` : json;
    } catch (error) {
        return JSON.stringify({ error: 'payload_not_serializable' });
    }
}

async function recordLabelWebhookAudit(eventName, payload, result = null, error = '') {
    if (!eventName.includes('LABEL')) return;

    await dbRun(
        `INSERT INTO whatsapp_label_webhook_audit
            (event_name, processed_count, raw_payload, result_payload, error)
         VALUES
            (?, ?, ?, ?, ?)`,
        [
            eventName,
            Number(result?.processed || 0),
            sanitizeWebhookPayload(payload),
            result ? sanitizeWebhookPayload(result, 4000) : null,
            error || null
        ]
    );

    await dbRun(
        `DELETE FROM whatsapp_label_webhook_audit
         WHERE id NOT IN (
            SELECT id
            FROM whatsapp_label_webhook_audit
            ORDER BY id DESC
            LIMIT 100
         )`
    ).catch(() => {});
}

async function recordWebhookAudit(eventName, payload, result = null, error = '') {
    const processedCount = Number(result?.processed || (result?.saved ? 1 : 0) || 0);
    const summary = error
        ? `Erro: ${error}`
        : `${eventName || 'UNKNOWN'}: ${processedCount} contato(s) processado(s)${result?.mode ? ` (${result.mode})` : ''}`;

    console.log(`[WhatsApp Webhook] ${summary}`);

    await dbRun(
        `INSERT INTO whatsapp_webhook_audit
            (event_name, processed_count, summary, raw_payload, result_payload, error)
         VALUES
            (?, ?, ?, ?, ?, ?)`,
        [
            eventName || 'UNKNOWN',
            processedCount,
            summary,
            sanitizeWebhookPayload(payload),
            result ? sanitizeWebhookPayload(result, 4000) : null,
            error || null
        ]
    ).catch((err) => {
        console.warn('Não foi possível auditar webhook do WhatsApp:', err.message);
    });

    if (eventName && eventName.includes('LABEL')) {
        await recordLabelWebhookAudit(eventName, payload, result, error).catch(() => {});
    }

    await dbRun(
        `DELETE FROM whatsapp_webhook_audit
         WHERE id NOT IN (
            SELECT id
            FROM whatsapp_webhook_audit
            ORDER BY id DESC
            LIMIT 100
         )`
    ).catch(() => {});
}

async function callEvolutionFallbacks(label, attempts) {
    const failures = [];

    for (const attempt of attempts) {
        const request = {
            method: attempt.method || 'post',
            url: attempt.url
        };

        if (attempt.data !== undefined) request.data = attempt.data;
        if (attempt.params !== undefined) request.params = attempt.params;

        try {
            const response = await evolution.request(request);
            return {
                response,
                attempt: attempt.name || `${request.method.toUpperCase()} ${request.url}`,
                failures
            };
        } catch (error) {
            failures.push({
                attempt: attempt.name || `${request.method.toUpperCase()} ${request.url}`,
                status: error.response?.status || null,
                error: summarizeEvolutionError(error)
            });
        }
    }

    const fallbackError = new Error(`${label} falhou na Evolution API.`);
    fallbackError.failures = failures;
    throw fallbackError;
}

async function callEvolutionFallbacksPreferData(label, attempts, readItems) {
    const failures = [];
    let firstSuccess = null;

    for (const attempt of attempts) {
        const request = {
            method: attempt.method || 'post',
            url: attempt.url
        };

        if (attempt.data !== undefined) request.data = attempt.data;
        if (attempt.params !== undefined) request.params = attempt.params;

        try {
            const response = await evolution.request(request);
            const items = readItems(response.data);
            const success = {
                response,
                attempt: attempt.name || `${request.method.toUpperCase()} ${request.url}`,
                failures,
                items
            };

            if (Array.isArray(items) && items.length) return success;
            if (!firstSuccess) firstSuccess = success;
        } catch (error) {
            failures.push({
                attempt: attempt.name || `${request.method.toUpperCase()} ${request.url}`,
                status: error.response?.status || null,
                error: summarizeEvolutionError(error)
            });
        }
    }

    if (firstSuccess) return firstSuccess;

    const fallbackError = new Error(`${label} falhou na Evolution API.`);
    fallbackError.failures = failures;
    throw fallbackError;
}

function normalizeLabelKey(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeLabelColor(value) {
    const color = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`;
    return '#64748b';
}

function normalizeEvolutionLabel(label) {
    const id = String(
        label?.id
        || label?.labelId
        || label?.label_id
        || label?.idLabel
        || label?.predefinedId
        || label?._id
        || label?.jid
        || label?.key
        || ''
    ).trim();
    const name = String(
        label?.name
        || label?.labelName
        || label?.title
        || label?.text
        || label?.value
        || ''
    ).trim();

    return {
        id: id || name,
        name,
        color: normalizeLabelColor(label?.color || label?.hexColor || label?.backgroundColor || label?.labelColor)
    };
}

function readEvolutionLabels(payload) {
    const labels = asArrayResponse(payload, [
        'labels',
        'response',
        'response.labels',
        'data',
        'data.labels',
        'result',
        'results'
    ]);

    if (labels.length) {
        return labels.map(normalizeEvolutionLabel).filter(label => label.name);
    }

    const objectCandidates = [
        payload?.labels,
        payload?.response,
        payload?.response?.labels,
        payload?.data,
        payload?.data?.labels,
        payload?.result,
        payload?.results
    ];

    for (const candidate of objectCandidates) {
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            const values = Object.values(candidate)
                .filter(value => value && typeof value === 'object')
                .map(normalizeEvolutionLabel)
                .filter(label => label.name);
            if (values.length) return values;
        }
    }

    return [];
}

async function fetchEvolutionLabelPayload() {
    const labelsResult = await callEvolutionFallbacksPreferData('Buscar etiquetas oficiais', [
        {
            name: 'findLabels oficial',
            method: 'get',
            url: `/label/findLabels/${EVOLUTION_INSTANCE}`
        },
        {
            name: 'findLabels em chat',
            method: 'get',
            url: `/chat/findLabels/${EVOLUTION_INSTANCE}`
        },
        {
            name: 'find labels legado',
            method: 'get',
            url: `/label/find/${EVOLUTION_INSTANCE}`
        },
        {
            name: 'fetchLabels em chat',
            method: 'post',
            url: '/chat/fetchLabels',
            data: { instanceName: EVOLUTION_INSTANCE }
        },
        {
            name: 'fetchLabels em chat com instance',
            method: 'post',
            url: '/chat/fetchLabels',
            data: { instance: EVOLUTION_INSTANCE }
        }
    ], readEvolutionLabels);

    return labelsResult.response.data;
}

async function fetchEvolutionLabels() {
    return readEvolutionLabels(await fetchEvolutionLabelPayload());
}

function clearEvolutionLabelMirrorCache() {
    evolutionLabelMirrorCache = {
        expiresAt: 0,
        labels: [],
        tagsByPhone: new Map(),
        tagsByJid: new Map()
    };
}

function formatEvolutionLabels(labels) {
    return labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        evolution_label_id: label.id
    }));
}

function getConfiguredQualifiedLabelsForWebhook() {
    const metaDiagnostics = getMetaCapiDiagnostics();
    const ids = Array.isArray(metaDiagnostics.qualifiedLeadLabelIds)
        ? metaDiagnostics.qualifiedLeadLabelIds
        : [];
    const names = Array.isArray(metaDiagnostics.qualifiedLeadLabels)
        ? metaDiagnostics.qualifiedLeadLabels
        : [];
    const fallbackName = names[0] || metaDiagnostics.qualifiedLeadEventName || 'Lead Qualificado';

    return ids
        .map((id, index) => resolveQualifiedLeadLabel({
            id: String(id || '').trim(),
            name: names[index] || fallbackName,
            color: '#22c55e',
            evolution_label_id: String(id || '').trim()
        }))
        .filter(label => label.id && label.name);
}

function getQualifiedLeadLocalLabel() {
    const configuredLabel = getConfiguredQualifiedLabelsForWebhook()[0];
    if (configuredLabel) return configuredLabel;

    const metaDiagnostics = getMetaCapiDiagnostics();
    const labelName = metaDiagnostics.qualifiedLeadLabels?.[0]
        || metaDiagnostics.qualifiedLeadEventName
        || 'Lead Qualificado';

    return resolveQualifiedLeadLabel({
        id: labelName,
        name: labelName,
        color: '#22c55e',
        evolution_label_id: labelName
    });
}

function mergeConversationTags(...tagGroups) {
    const seen = new Set();
    const tags = [];

    for (const group of tagGroups) {
        for (const tag of Array.isArray(group) ? group : []) {
            const tagKey = normalizeLabelKey(tag?.evolution_label_id || tag?.id || tag?.name);
            if (!tag?.name || !tagKey || seen.has(tagKey)) continue;

            seen.add(tagKey);
            tags.push({
                id: tag.id || tag.evolution_label_id || tag.name,
                name: tag.name,
                color: tag.color || '#64748b',
                evolution_label_id: tag.evolution_label_id || tag.id || null
            });
        }
    }

    return tags;
}

async function getLocalTagsForConversations(conversationIds) {
    const tagsByConversation = new Map();
    if (!conversationIds.length) return tagsByConversation;

    const placeholders = conversationIds.map(() => '?').join(',');
    const rows = await dbAll(
        `SELECT
            wct.conversation_id,
            wt.id,
            wt.name,
            wt.color,
            wt.evolution_label_id
         FROM whatsapp_conversation_tags wct
         JOIN whatsapp_tags wt ON wt.id = wct.tag_id
         WHERE wct.conversation_id IN (${placeholders})
           AND wt.evolution_label_id IS NOT NULL
           AND wt.evolution_label_id <> ''`,
        conversationIds
    );

    rows.forEach((tag) => {
        const current = tagsByConversation.get(tag.conversation_id) || [];
        current.push({
            id: tag.evolution_label_id || tag.id,
            name: tag.name,
            color: tag.color,
            evolution_label_id: tag.evolution_label_id
        });
        tagsByConversation.set(tag.conversation_id, current);
    });

    return tagsByConversation;
}

async function getLocalWhatsappLabels() {
    const rows = await dbAll(
        `SELECT DISTINCT
            wt.id,
            wt.name,
            wt.color,
            wt.evolution_label_id
         FROM whatsapp_tags wt
         WHERE wt.evolution_label_id IS NOT NULL
           AND wt.evolution_label_id <> ''
         ORDER BY wt.name COLLATE NOCASE ASC`
    );

    return rows.map(tag => ({
        id: tag.evolution_label_id || tag.id,
        name: tag.name,
        color: tag.color || '#64748b',
        evolution_label_id: tag.evolution_label_id || tag.id
    }));
}

async function loadAvailableWhatsappLabels() {
    let remoteLabels = [];
    let warning = '';

    try {
        remoteLabels = await fetchEvolutionLabels();
        if (!remoteLabels.length) remoteLabels = await fetchEvolutionLabelsFromChats();
    } catch (error) {
        warning = 'Não foi possível consultar etiquetas oficiais da Evolution agora.';
        console.error('Erro ao buscar etiquetas oficiais do WhatsApp:', error.failures || summarizeEvolutionError(error));
    }

    const localLabels = await getLocalWhatsappLabels();
    const labels = mergeConversationTags(
        formatEvolutionLabels(remoteLabels),
        localLabels,
        getConfiguredQualifiedLabelsForWebhook()
    );

    return { labels, warning };
}

async function upsertLocalWhatsappTag(tag) {
    const label = normalizeEvolutionLabel(tag);
    if (!label.name && !label.id) return null;

    const tagName = label.name || label.id;
    const evolutionLabelId = label.id || null;

    await dbRun(
        `INSERT OR IGNORE INTO whatsapp_tags (name, color, evolution_label_id)
         VALUES (?, ?, ?)`,
        [tagName, label.color || '#64748b', evolutionLabelId]
    );

    await dbRun(
        `UPDATE whatsapp_tags
         SET color = ?,
             evolution_label_id = COALESCE(NULLIF(?, ''), evolution_label_id)
         WHERE name = ?`,
        [label.color || '#64748b', evolutionLabelId || '', tagName]
    );

    if (evolutionLabelId) {
        const byEvolutionId = await dbGet(
            `SELECT id, name, color, evolution_label_id
             FROM whatsapp_tags
             WHERE evolution_label_id = ?
             LIMIT 1`,
            [evolutionLabelId]
        );

        if (byEvolutionId) return byEvolutionId;
    }

    return dbGet(
        `SELECT id, name, color, evolution_label_id
         FROM whatsapp_tags
         WHERE name = ?
         LIMIT 1`,
        [tagName]
    );
}

async function persistLocalConversationTag(conversation, tag, action = 'add') {
    if (!conversation?.id) return { changed: false, action, reason: 'missing_conversation' };

    const localTag = await upsertLocalWhatsappTag(tag);
    if (!localTag?.id) return { changed: false, action, reason: 'missing_tag' };

    if (action === 'remove') {
        const result = await dbRun(
            `DELETE FROM whatsapp_conversation_tags
             WHERE conversation_id = ?
               AND tag_id = ?`,
            [conversation.id, localTag.id]
        );

        return {
            changed: result.changes > 0,
            action,
            tag: localTag
        };
    }

    const result = await dbRun(
        `INSERT OR IGNORE INTO whatsapp_conversation_tags
            (conversation_id, tag_id)
         VALUES
            (?, ?)`,
        [conversation.id, localTag.id]
    );

    return {
        changed: result.changes > 0,
        action: 'add',
        tag: localTag
    };
}

function normalizeWhatsappJid(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (rawValue.includes('@')) return rawValue;

    const phone = normalizePhone(rawValue);
    return phone ? `${phone}@s.whatsapp.net` : '';
}

function findEvolutionLabel(labels, labelId, labelName = '') {
    const idKey = normalizeLabelKey(labelId);
    const nameKey = normalizeLabelKey(labelName);

    return labels.find(label => (
        normalizeLabelKey(label.id) === idKey
        || normalizeLabelKey(label.name) === idKey
        || (nameKey && normalizeLabelKey(label.name) === nameKey)
        || (nameKey && normalizeLabelKey(label.id) === nameKey)
    )) || null;
}

async function applyEvolutionLabelToChat({ remoteJid, phone, label }) {
    const targetJid = normalizeWhatsappJid(remoteJid) || normalizeWhatsappJid(phone);
    const targetPhone = normalizePhone(phone || extractPhoneFromRemoteJid(targetJid));
    const labelId = String(label?.id || '').trim();
    const labelName = String(label?.name || '').trim();

    if (!targetJid) {
        throw new Error('Informe um telefone ou JID válido para aplicar a etiqueta.');
    }

    if (!labelId && !labelName) {
        throw new Error('Informe uma etiqueta válida.');
    }

    return callEvolutionFallbacks('Aplicar etiqueta oficial', [
        {
            name: 'handleLabel oficial',
            method: 'post',
            url: `/label/handleLabel/${EVOLUTION_INSTANCE}`,
            data: {
                name: labelName,
                type: 'chat',
                id: targetJid,
                action: 'add'
            }
        },
        {
            name: 'handleLabel oficial PUT',
            method: 'put',
            url: `/label/handleLabel/${EVOLUTION_INSTANCE}`,
            data: {
                name: labelName,
                type: 'chat',
                id: targetJid,
                action: 'add'
            }
        },
        {
            name: 'handleLabel por labelId',
            method: 'post',
            url: `/label/handleLabel/${EVOLUTION_INSTANCE}`,
            data: {
                number: targetPhone,
                remoteJid: targetJid,
                jid: targetJid,
                labelId,
                action: 'add'
            }
        },
        {
            name: 'handleLabel por labelId PUT',
            method: 'put',
            url: `/label/handleLabel/${EVOLUTION_INSTANCE}`,
            data: {
                number: targetPhone,
                remoteJid: targetJid,
                jid: targetJid,
                labelId,
                action: 'add'
            }
        },
        {
            name: 'addChat legado',
            method: 'post',
            url: `/label/addChat/${EVOLUTION_INSTANCE}`,
            data: {
                number: targetPhone,
                remoteJid: targetJid,
                jid: targetJid,
                labelId
            }
        }
    ]);
}

function readEvolutionChats(payload) {
    const chats = asArrayResponse(payload, [
        'chats',
        'contacts',
        'records',
        'data.chats',
        'data.contacts',
        'data.records',
        'response',
        'response.chats',
        'response.contacts',
        'response.records',
        'data',
        'result',
        'results'
    ]);

    if (chats.length) return chats;

    const objectCandidates = [
        payload?.chats,
        payload?.contacts,
        payload?.records,
        payload?.data?.chats,
        payload?.data?.contacts,
        payload?.data?.records,
        payload?.response?.chats,
        payload?.response?.contacts,
        payload?.response?.records
    ];

    for (const candidate of objectCandidates) {
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            const values = Object.values(candidate).filter(value => value && typeof value === 'object');
            if (values.length) return values;
        }
    }

    return [];
}

function readEvolutionMessages(payload) {
    const collected = collectMessagePayloads(payload);
    if (collected.length) return collected;

    const records = asArrayResponse(payload, [
        'messages',
        'records',
        'data.messages',
        'data.records',
        'data.rows',
        'response',
        'response.messages',
        'response.records',
        'result',
        'results'
    ]);

    return records.flatMap(record => collectMessagePayloads(record));
}

function collectLabelRefs(value, refs = []) {
    if (!value) return refs;

    if (Array.isArray(value)) {
        value.forEach(item => collectLabelRefs(item, refs));
        return refs;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        refs.push({ id: String(value), name: String(value) });
        return refs;
    }

    if (typeof value !== 'object') return refs;

    const ref = {
        id: String(value.id || value.labelId || value.label_id || value.idLabel || value.predefinedId || value._id || value.jid || value.key || '').trim(),
        name: String(value.name || value.labelName || value.title || value.text || value.value || '').trim(),
        color: value.color || value.hexColor || value.backgroundColor || value.labelColor
    };

    if (ref.id || ref.name) refs.push(ref);

    [
        value.label,
        value.labels,
        value.labelInfo,
        value.labelData,
        value.whatsappLabel,
        value.chatLabels,
        value.labelNames,
        value.labelnames,
        value.items
    ].forEach(nested => collectLabelRefs(nested, refs));

    return refs;
}

function extractChatLabelRefs(chat) {
    return [
        chat?.labels,
        chat?.label,
        chat?.labelNames,
        chat?.labelnames,
        chat?.labelIds,
        chat?.label_ids,
        chat?.labelsId,
        chat?.chatLabels,
        chat?.chat_labels,
        chat?.whatsappLabels,
        chat?.contact?.labels,
        chat?.contact?.labelNames,
        chat?.conversation?.labels,
        chat?.conversation?.labelNames,
        chat?.data?.labels,
        chat?.data?.label,
        chat?.data?.labelNames,
        chat?._data?.labels
    ].reduce((refs, value) => collectLabelRefs(value, refs), []);
}

function mapChatTags(chat, labelsById, labelsByName) {
    const seen = new Set();
    const tags = [];

    for (const ref of extractChatLabelRefs(chat)) {
        const matchedLabel = labelsById.get(normalizeLabelKey(ref.id))
            || labelsByName.get(normalizeLabelKey(ref.name))
            || labelsById.get(normalizeLabelKey(ref.name))
            || labelsByName.get(normalizeLabelKey(ref.id));

        const tag = resolveQualifiedLeadLabel(matchedLabel || normalizeEvolutionLabel(ref));
        if (!tag.name) continue;

        const tagKey = normalizeLabelKey(tag.id || tag.name);
        if (seen.has(tagKey)) continue;

        seen.add(tagKey);
        tags.push({
            id: tag.id || tag.name,
            name: tag.name,
            color: tag.color
        });
    }

    return tags;
}

function addTagToTargetMaps({ tagsByPhone, tagsByJid }, target, tag) {
    if (!tag?.name) return;

    const remoteJid = normalizeWhatsappJid(target?.remoteJid || target?.jid || '');
    const phone = normalizePhone(target?.phone || target?.number || extractPhoneFromRemoteJid(remoteJid));

    const addTag = (map, key) => {
        if (!key) return;
        const current = map.get(key) || [];
        const tagKey = normalizeLabelKey(tag.id || tag.name);

        if (!current.some(item => normalizeLabelKey(item.id || item.name) === tagKey)) {
            current.push({
                id: tag.id || tag.name,
                name: tag.name,
                color: tag.color || '#3B82F6'
            });
        }

        map.set(key, current);
    };

    addTag(tagsByPhone, phone);
    addTag(tagsByJid, remoteJid);
}

function looksLikeChatIdentifier(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return false;
    if (rawValue.includes('@s.whatsapp.net') || rawValue.includes('@c.us') || rawValue.includes('@lid')) return true;
    return isLikelyWhatsappPhone(rawValue);
}

function collectChatTargets(value, targets = []) {
    if (!value) return targets;

    if (Array.isArray(value)) {
        value.forEach(item => collectChatTargets(item, targets));
        return targets;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const rawValue = String(value).trim();
        const remoteJid = normalizeWhatsappJid(rawValue);
        const phone = rawValue.includes('@')
            ? extractPhoneFromRemoteJid(rawValue)
            : normalizePhone(rawValue);

        if (remoteJid || phone) {
            targets.push({ remoteJid, phone });
        }

        return targets;
    }

    if (typeof value !== 'object') return targets;

    const remoteJid = extractChatRemoteJid(value)
        || value.remoteJid
        || value.remote_jid
        || value.jid
        || value.chatId
        || value.chat_id
        || value.key?.remoteJid
        || value.contact?.id
        || value.contactId
        || value.contact_id
        || value.id?._serialized
        || '';
    const phone = normalizePhone(
        value.phone
        || value.number
        || value.user
        || value.contact?.phone
        || value.contact?.number
        || extractPhoneFromRemoteJid(remoteJid)
    );

    if (remoteJid || phone) {
        targets.push({
            remoteJid,
            phone,
            pushName: value.pushName || value.name || value.profileName || value.contact?.pushName || value.contact?.name || ''
        });
    }

    [
        value.chat,
        value.chats,
        value.chatIds,
        value.chat_ids,
        value.remoteJids,
        value.remote_jids,
        value.jids,
        value.contacts,
        value.contact,
        value.conversations,
        value.items,
        value.message,
        value.key,
        value.data,
        value.value
    ].forEach(nested => collectChatTargets(nested, targets));

    return targets;
}

function looksLikeLabelRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

    return Boolean(
        value.label
        || value.labels
        || value.labelInfo
        || value.labelData
        || value.whatsappLabel
        || value.labelId
        || value.label_id
        || value.idLabel
        || value.labelName
        || value.remoteJid
        || value.remote_jid
        || value.jid
        || value.chatId
        || value.chat_id
        || value.chat
        || value.chats
        || value.contacts
        || value.conversations
    );
}

function readEvolutionLabelRecords(payload) {
    const records = asArrayResponse(payload, [
        'labels',
        'response',
        'response.labels',
        'data',
        'data.labels',
        'records',
        'data.records',
        'result',
        'results'
    ]);

    if (records.length) return records;

    for (const candidate of [payload, payload?.data, payload?.response, payload?.result]) {
        if (looksLikeLabelRecord(candidate)) return [candidate];
    }

    const objectCandidates = [
        payload?.labels,
        payload?.response,
        payload?.response?.labels,
        payload?.data,
        payload?.data?.labels,
        payload?.records,
        payload?.data?.records,
        payload?.result,
        payload?.results
    ];

    for (const candidate of objectCandidates) {
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            const values = Object.values(candidate).filter(value => value && typeof value === 'object');
            if (values.length) return values;
        }
    }

    return [];
}

function mapLabelPayloadToTargets(payload, labelsById, labelsByName) {
    const linkedTags = [];

    for (const record of readEvolutionLabelRecords(payload)) {
        const labelRef = record?.label || record?.labelInfo || record?.labelData || record?.whatsappLabel || record;
        const normalizedLabel = normalizeEvolutionLabel(labelRef);
        const matchedLabel = labelsById.get(normalizeLabelKey(normalizedLabel.id))
            || labelsByName.get(normalizeLabelKey(normalizedLabel.name))
            || labelsById.get(normalizeLabelKey(record?.labelId || record?.label_id || record?.idLabel))
            || labelsByName.get(normalizeLabelKey(record?.labelName || record?.name));
        const label = resolveQualifiedLeadLabel(matchedLabel || normalizedLabel);
        if (!label.name) continue;

        const targets = collectChatTargets([
            looksLikeChatIdentifier(record.id) || normalizeLabelKey(record.type) === 'chat' ? record.id : '',
            record.remoteJid,
            record.remote_jid,
            record.jid,
            record.chatId,
            record.chat_id,
            record.key?.remoteJid,
            record.contactId,
            record.contact_id,
            record.chat,
            record.chats,
            record.chatIds,
            record.chat_ids,
            record.jids,
            record.contacts,
            record.contact,
            record.conversations,
            record.items,
            record.data,
            record.value
        ]);

        targets.forEach(target => linkedTags.push({ target, tag: label }));
    }

    return linkedTags;
}

async function fetchEvolutionChatsWithLabels() {
    const chatsResult = await callEvolutionFallbacksPreferData('Buscar conversas com etiquetas', [
        {
            name: 'find chats',
            url: `/chat/find/${EVOLUTION_INSTANCE}`,
            data: { where: {}, take: 500, skip: 0, orderBy: { updatedAt: 'desc' } }
        },
        {
            name: 'find chats GET',
            method: 'get',
            url: `/chat/find/${EVOLUTION_INSTANCE}`
        },
        {
            name: 'findChats completo',
            url: `/chat/findChats/${EVOLUTION_INSTANCE}`,
            data: { where: {}, take: 500, skip: 0, orderBy: { updatedAt: 'desc' } }
        },
        {
            name: 'findChats simples',
            url: `/chat/findChats/${EVOLUTION_INSTANCE}`,
            data: { where: {}, take: 500, skip: 0 }
        },
        {
            name: 'findChats GET',
            method: 'get',
            url: `/chat/findChats/${EVOLUTION_INSTANCE}`
        }
    ], readEvolutionChats);

    return readEvolutionChats(chatsResult.response.data);
}

async function fetchEvolutionContactsWithLabels() {
    const contactsResult = await callEvolutionFallbacksPreferData('Buscar contatos com etiquetas', [
        {
            name: 'findContacts completo',
            url: `/chat/findContacts/${EVOLUTION_INSTANCE}`,
            data: { where: {}, take: 500, skip: 0 }
        },
        {
            name: 'findContacts vazio',
            url: `/chat/findContacts/${EVOLUTION_INSTANCE}`,
            data: {}
        },
        {
            name: 'findContacts GET',
            method: 'get',
            url: `/chat/findContacts/${EVOLUTION_INSTANCE}`
        }
    ], readEvolutionChats);

    return readEvolutionChats(contactsResult.response.data);
}

async function fetchEvolutionRecentMessages() {
    const messagesResult = await callEvolutionFallbacksPreferData('Buscar mensagens recentes', [
        {
            name: 'findMessages recente',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`,
            data: { where: {}, take: 300, skip: 0, orderBy: { messageTimestamp: 'desc' } }
        },
        {
            name: 'findMessages limit',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`,
            data: { where: {}, limit: 300, orderBy: { messageTimestamp: 'desc' } }
        },
        {
            name: 'findMessages take simplificado',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`,
            data: { take: 300 }
        },
        {
            name: 'findMessages limit simplificado',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`,
            data: { limit: 300 }
        },
        {
            name: 'findMessages vazio',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`,
            data: {}
        },
        {
            name: 'findMessages GET',
            method: 'get',
            url: `/chat/findMessages/${EVOLUTION_INSTANCE}`
        }
    ], readEvolutionMessages);

    return readEvolutionMessages(messagesResult.response.data);
}

async function fetchEvolutionLabelsFromChats() {
    const seen = new Set();
    const labels = [];
    const [chatsResult, contactsResult] = await Promise.allSettled([
        fetchEvolutionChatsWithLabels(),
        fetchEvolutionContactsWithLabels()
    ]);
    const records = [
        ...(chatsResult.status === 'fulfilled' ? chatsResult.value : []),
        ...(contactsResult.status === 'fulfilled' ? contactsResult.value : [])
    ];

    for (const chat of records) {
        for (const ref of extractChatLabelRefs(chat)) {
            const label = normalizeEvolutionLabel(ref);
            if (!label.name) continue;

            const key = normalizeLabelKey(label.id || label.name);
            if (seen.has(key)) continue;

            seen.add(key);
            labels.push(label);
        }
    }

    return labels;
}

async function getEvolutionLabelMirror(options = {}) {
    const now = Date.now();
    if (!options.force && evolutionLabelMirrorCache.expiresAt > now) {
        return evolutionLabelMirrorCache;
    }

    let labels = [];
    let chats = [];
    let contacts = [];
    let labelPayload = null;
    const tagsByPhone = new Map();
    const tagsByJid = new Map();

    const [chatsResult, contactsResult, labelsResult] = await Promise.allSettled([
        fetchEvolutionChatsWithLabels(),
        fetchEvolutionContactsWithLabels(),
        fetchEvolutionLabelPayload()
    ]);

    if (chatsResult.status === 'fulfilled') {
        chats = chatsResult.value;
    } else {
        console.warn('Não foi possível buscar conversas com etiquetas nativas:', chatsResult.reason?.failures || summarizeEvolutionError(chatsResult.reason));
    }

    if (contactsResult.status === 'fulfilled') {
        contacts = contactsResult.value;
    } else {
        console.warn('Não foi possível buscar contatos com etiquetas nativas:', contactsResult.reason?.failures || summarizeEvolutionError(contactsResult.reason));
    }

    if (labelsResult.status === 'fulfilled') {
        labelPayload = labelsResult.value;
        labels = readEvolutionLabels(labelPayload);
    } else {
        console.warn('Não foi possível buscar etiquetas nativas da Evolution:', labelsResult.reason?.failures || summarizeEvolutionError(labelsResult.reason));
    }

    const labelsById = new Map(labels.map(label => [normalizeLabelKey(label.id), label]));
    const labelsByName = new Map(labels.map(label => [normalizeLabelKey(label.name), label]));

    for (const chat of [...chats, ...contacts]) {
        const tags = mapChatTags(chat, labelsById, labelsByName);
        if (!tags.length) continue;

        const target = normalizeChatTarget(chat);
        if (!target) continue;

        tags.forEach(tag => addTagToTargetMaps({ tagsByPhone, tagsByJid }, target, tag));
    }

    if (labelPayload) {
        for (const linkedTag of mapLabelPayloadToTargets(labelPayload, labelsById, labelsByName)) {
            addTagToTargetMaps({ tagsByPhone, tagsByJid }, linkedTag.target, linkedTag.tag);
        }
    }

    evolutionLabelMirrorCache = {
        expiresAt: now + EVOLUTION_LABEL_CACHE_MS,
        labels,
        tagsByPhone,
        tagsByJid
    };

    return evolutionLabelMirrorCache;
}

function setEmptyEvolutionLabelMirrorCache(ttlMs = EVOLUTION_LABEL_CACHE_MS) {
    evolutionLabelMirrorCache = {
        expiresAt: Date.now() + ttlMs,
        labels: [],
        tagsByPhone: new Map(),
        tagsByJid: new Map()
    };

    return evolutionLabelMirrorCache;
}

async function getEvolutionLabelMirrorForInbox() {
    if (!EVOLUTION_API_KEY) {
        return setEmptyEvolutionLabelMirrorCache();
    }

    if (evolutionLabelMirrorCache.expiresAt > Date.now()) {
        return evolutionLabelMirrorCache;
    }

    return Promise.race([
        getEvolutionLabelMirror().catch((error) => {
            console.warn('Não foi possível buscar etiquetas da Evolution para a caixa de entrada:', error.failures || summarizeEvolutionError(error));
            return setEmptyEvolutionLabelMirrorCache();
        }),
        wait(2500).then(() => {
            console.warn('Busca de etiquetas da Evolution excedeu 2.5s; exibindo conversas locais sem etiquetas remotas.');
            return setEmptyEvolutionLabelMirrorCache();
        })
    ]);
}

function extractLabelAssociationAction(payload) {
    const action = findTextByPaths(
        [payload?.data, payload],
        [
            'action',
            'operation',
            'type',
            'associationAction',
            'labelAction',
            'data.action',
            'data.operation',
            'data.type'
        ]
    );
    const normalizedAction = normalizeLabelKey(action);

    if (
        normalizedAction.includes('remove')
        || normalizedAction.includes('delete')
        || normalizedAction.includes('unlink')
        || normalizedAction.includes('unassign')
    ) {
        return 'remove';
    }

    return 'add';
}

async function getLabelsByKeyForWebhook(payload) {
    let labels = readEvolutionLabels(payload);

    if (!labels.length) {
        labels = await fetchEvolutionLabels().catch((error) => {
            console.warn('Não foi possível buscar etiquetas para mapear webhook:', error.failures || summarizeEvolutionError(error));
            return [];
        });
    }

    const localLabels = await getLocalWhatsappLabels().catch(() => []);
    labels = mergeConversationTags(
        formatEvolutionLabels(labels),
        localLabels,
        getConfiguredQualifiedLabelsForWebhook()
    );

    return {
        labels,
        labelsById: new Map(labels.map(label => [normalizeLabelKey(label.id), label])),
        labelsByName: new Map(labels.map(label => [normalizeLabelKey(label.name), label]))
    };
}

async function persistLabelAssociationTarget(linkedTag, action, userId = null) {
    const rawTarget = linkedTag.target || {};
    let target = normalizeChatTarget(rawTarget);

    if (!target) {
        const remoteJid = normalizeWhatsappJid(rawTarget.remoteJid || rawTarget.jid || rawTarget.id || rawTarget.chatId || rawTarget.chat_id || '');
        const explicitPhone = normalizePhone(rawTarget.phone || rawTarget.number || '');
        const jidPhone = extractPhoneFromRemoteJid(remoteJid);
        const candidatePhone = explicitPhone || jidPhone;
        const existingConversation = await findExistingConversationByRemoteJid(remoteJid).catch(() => null);

        if (existingConversation?.phone && isLikelyWhatsappPhone(existingConversation.phone)) {
            target = {
                phone: existingConversation.phone,
                remoteJid: remoteJid || existingConversation.remote_jid,
                pushName: rawTarget.pushName || existingConversation.push_name || ''
            };
        } else if (candidatePhone && isLikelyWhatsappPhone(candidatePhone)) {
            target = {
                phone: candidatePhone,
                remoteJid,
                pushName: rawTarget.pushName || ''
            };
        } else {
            return {
                processed: false,
                reason: isLidJid(remoteJid) ? 'lid_without_known_phone' : 'invalid_target',
                remoteJid,
                tag: linkedTag.tag
            };
        }
    }

    const conversation = await ensureConversation(target.phone, {
        remoteJid: target.remoteJid,
        pushName: target.pushName
    });
    const persisted = await persistLocalConversationTag(conversation, linkedTag.tag, action);
    let metaCapi = null;

    if (action === 'add' && isQualifiedLeadLabel(linkedTag.tag)) {
        metaCapi = await sendQualifiedLeadToMetaIfNeeded(conversation, linkedTag.tag, userId);
    }

    return {
        processed: true,
        phone: target.phone,
        action,
        tag: persisted.tag || linkedTag.tag,
        changed: persisted.changed,
        meta_capi: metaCapi
    };
}

async function processLabelWebhook(payload, eventName) {
    clearEvolutionLabelMirrorCache();

    const action = eventName.includes('LABELS_EDIT') ? 'add' : extractLabelAssociationAction(payload);
    const { labels, labelsById, labelsByName } = await getLabelsByKeyForWebhook(payload);
    const linkedTags = mapLabelPayloadToTargets(payload, labelsById, labelsByName);
    const results = [];

    if (!linkedTags.length && eventName.includes('LABELS_EDIT')) {
        for (const label of labels) {
            const localTag = await upsertLocalWhatsappTag(label);
            if (localTag) {
                results.push({
                    processed: true,
                    action: 'upsert_label',
                    tag: localTag
                });
            }
        }
    }

    for (const linkedTag of linkedTags) {
        try {
            results.push(await persistLabelAssociationTarget(linkedTag, action));
        } catch (error) {
            results.push({
                processed: false,
                action,
                error: error.message
            });
        }
    }

    return {
        processed: results.filter(result => result.processed).length,
        event: eventName,
        action,
        labels: labels.length,
        results
    };
}

async function persistLabelMirrorAssociations(labelMirror, userId = null) {
    const summary = {
        labels: labelMirror?.labels?.length || 0,
        conversations: 0,
        associations: 0,
        changed: 0,
        meta_sent: 0,
        meta_skipped: 0,
        errors: []
    };

    const tagsByPhone = labelMirror?.tagsByPhone instanceof Map ? labelMirror.tagsByPhone : new Map();

    for (const [phone, tags] of tagsByPhone.entries()) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || !isLikelyWhatsappPhone(normalizedPhone)) continue;

        try {
            const conversation = await ensureConversation(normalizedPhone);
            summary.conversations += 1;

            for (const tag of tags) {
                const persisted = await persistLocalConversationTag(conversation, tag, 'add');
                summary.associations += 1;
                if (persisted.changed) summary.changed += 1;

                if (isQualifiedLeadLabel(tag)) {
                    const metaCapi = await sendQualifiedLeadToMetaIfNeeded(conversation, tag, userId);
                    if (metaCapi.sent) summary.meta_sent += 1;
                    if (metaCapi.skipped) summary.meta_skipped += 1;
                }
            }
        } catch (error) {
            summary.errors.push({
                phone: normalizedPhone,
                error: error.message
            });
        }
    }

    return summary;
}

function extractChatActivity(chat) {
    if (!chat || typeof chat !== 'object') {
        return {
            lastMessageText: '',
            lastMessageAt: null
        };
    }

    const lastMessage = Array.isArray(chat.messages) ? chat.messages[0] : (
        chat.lastMessage
        || chat.last_message
        || chat.message
        || chat.messages
        || chat.recentMessage
        || chat.recent_message
        || null
    );
    const lastMessageText = findTextByPaths(
        [chat, lastMessage],
        [
            'lastMessageText',
            'last_message_text',
            'messageText',
            'message_text',
            'body',
            'text',
            'conversation',
            'message.conversation',
            'message.extendedTextMessage.text',
            'lastMessage.message.conversation',
            'lastMessage.message.extendedTextMessage.text',
            'last_message.message.conversation',
            'last_message.message.extendedTextMessage.text'
        ]
    ) || extractIncomingText(lastMessage || chat);
    const timestamp = chat.lastMessageAt
        || chat.last_message_at
        || chat.conversationTimestamp
        || chat.conversation_timestamp
        || chat.lastMessageTimestamp
        || chat.last_message_timestamp
        || chat.lastMessageTime
        || chat.last_message_time
        || chat.updatedAt
        || chat.updated_at
        || chat.date_time
        || chat.dateTime
        || chat.createdAt
        || chat.created_at
        || chat.timestamp
        || chat.messageTimestamp
        || lastMessage?.conversationTimestamp
        || lastMessage?.conversation_timestamp
        || lastMessage?.lastMessageTimestamp
        || lastMessage?.messageTimestamp
        || lastMessage?.timestamp
        || lastMessage?.createdAt
        || null;

    return {
        lastMessageText,
        lastMessageAt: toSqlDateTime(extractMessageTimestamp({ timestamp })) || toSqlDateTime(timestamp)
    };
}

function normalizeChatTarget(chat) {
    const remoteJid = extractChatRemoteJid(chat);
    const explicitPhone = normalizePhone(
        chat?.phone
        || chat?.number
        || chat?.phoneNumber
        || chat?.phone_number
        || chat?.waId
        || chat?.wa_id
        || chat?.user
        || chat?.contact?.phone
        || chat?.contact?.number
        || chat?.contact?.phoneNumber
        || chat?.contact?.waId
        || ''
    );
    const phone = normalizePhone(
        explicitPhone || extractPhoneFromRemoteJid(remoteJid)
    );
    const finalRemoteJid = remoteJid || (phone ? `${phone}@s.whatsapp.net` : '');
    const activity = extractChatActivity(chat);

    if (!phone || !finalRemoteJid || !isLikelyWhatsappPhone(phone)) return null;
    if (isLidJid(finalRemoteJid) || finalRemoteJid.includes('@g.us') || finalRemoteJid.includes('status@broadcast')) return null;

    return {
        phone,
        remoteJid: finalRemoteJid,
        pushName: chat?.pushName
            || chat?.push_name
            || chat?.name
            || chat?.profileName
            || chat?.client_name
            || chat?.contact?.pushName
            || chat?.contact?.name
            || '',
        lastMessageText: activity.lastMessageText,
        lastMessageAt: activity.lastMessageAt
    };
}

async function persistEvolutionConversationTargets() {
    const summary = {
        contacts: 0,
        changed: 0,
        errors: []
    };
    const seen = new Set();
    const [chatsResult, contactsResult] = await Promise.allSettled([
        fetchEvolutionChatsWithLabels(),
        fetchEvolutionContactsWithLabels()
    ]);
    const records = [
        ...(chatsResult.status === 'fulfilled' ? chatsResult.value : []),
        ...(contactsResult.status === 'fulfilled' ? contactsResult.value : [])
    ];

    if (chatsResult.status === 'rejected') {
        summary.errors.push({
            step: 'chats',
            error: chatsResult.reason?.failures || summarizeEvolutionError(chatsResult.reason)
        });
    }

    if (contactsResult.status === 'rejected') {
        summary.errors.push({
            step: 'contacts',
            error: contactsResult.reason?.failures || summarizeEvolutionError(contactsResult.reason)
        });
    }

    for (const record of records) {
        const target = normalizeChatTarget(record);
        if (!target || seen.has(target.phone) || !isLikelyWhatsappPhone(target.phone)) continue;

        seen.add(target.phone);

        try {
            const existingConversation = await findExistingConversationByPhone(target.phone);
            await ensureConversation(target.phone, {
                remoteJid: target.remoteJid,
                pushName: target.pushName,
                lastMessageText: target.lastMessageText,
                lastMessageAt: target.lastMessageAt
            });

            summary.contacts += 1;
            if (!existingConversation) summary.changed += 1;
        } catch (error) {
            summary.errors.push({
                phone: target.phone,
                error: error.message
            });
        }
    }

    return summary;
}

async function persistEvolutionRecentMessageTargets() {
    const summary = {
        contacts: 0,
        messages: 0,
        changed: 0,
        errors: []
    };
    const seenPhones = new Set();
    const seenMessages = new Set();
    const messages = await fetchEvolutionRecentMessages();

    for (const messagePayload of messages.slice(0, 300)) {
        const incoming = extractIncomingMessage(messagePayload, messagePayload);
        const messageKey = incoming?.id || JSON.stringify(messagePayload?.key || {});

        if (!incoming?.phone || !isLikelyWhatsappPhone(incoming.phone) || incoming.isGroup || incoming.isBroadcast) continue;
        if (seenMessages.has(messageKey)) continue;
        seenMessages.add(messageKey);

        try {
            const existingConversation = await findExistingConversationByPhone(incoming.phone);
            await persistMessageContactActivity(incoming);

            summary.messages += 1;
            if (!seenPhones.has(incoming.phone)) {
                seenPhones.add(incoming.phone);
                summary.contacts += 1;
                if (!existingConversation) summary.changed += 1;
            }
        } catch (error) {
            summary.errors.push({
                phone: incoming.phone,
                error: error.message
            });
        }
    }

    return summary;
}

async function getKnownConversationTargets() {
    const rows = await dbAll(`
        SELECT phone, remote_jid, push_name FROM whatsapp_conversations
        WHERE phone IS NOT NULL AND phone <> ''
        UNION
        SELECT phone, remote_jid, push_name FROM whatsapp_automation_contacts
        WHERE phone IS NOT NULL AND phone <> ''
        LIMIT 120
    `);

    const seen = new Set();
    const targets = [];

    for (const row of rows) {
        const target = normalizeChatTarget({
            phone: row.phone,
            remoteJid: row.remote_jid,
            pushName: row.push_name
        });

        if (!target || seen.has(target.phone) || !isLikelyWhatsappPhone(target.phone)) continue;
        seen.add(target.phone);
        targets.push(target);
    }

    return targets;
}

async function importEvolutionMessage(messagePayload, options = {}) {
    const incoming = extractIncomingMessage(messagePayload, options.rootPayload || messagePayload);
    if (!incoming?.phone || incoming.isGroup || incoming.isBroadcast) {
        return { ignored: true };
    }

    if (incoming.fromMe) {
        const outgoingText = incoming.text || outgoingDeviceFallbackText(incoming.type);

        await persistOutgoingMessage(
            incoming.phone,
            outgoingText,
            null,
            messagePayload,
            incoming.type || 'unknown',
            incoming.timestamp || null
        );

        return { saved: true, direction: 'outgoing', phone: incoming.phone };
    }

    await persistIncomingMessage(incoming, messagePayload, { countUnread: options.countUnread === true });
    return { saved: true, direction: 'incoming', phone: incoming.phone };
}

async function syncEvolutionLabelsAndContacts(userId = null) {
    const warnings = getEvolutionStorageWarnings();
    const errors = [];

    try {
        await configureInstanceWebhook();
    } catch (error) {
        warnings.push({
            step: 'webhook',
            message: 'Não foi possível confirmar o webhook antes da sincronização.',
            error: summarizeEvolutionError(error)
        });
    }

    try {
        await configureInstanceSettings();
    } catch (error) {
        warnings.push({
            step: 'settings',
            message: 'Não foi possível confirmar a configuração leve da instância antes da sincronização.',
            error: summarizeEvolutionError(error)
        });
    }

    let labelSync = {
        labels: 0,
        conversations: 0,
        associations: 0,
        changed: 0,
        meta_sent: 0,
        meta_skipped: 0,
        errors: []
    };
    let contactSync = {
        contacts: 0,
        changed: 0,
        errors: []
    };
    let messageSync = {
        contacts: 0,
        messages: 0,
        changed: 0,
        errors: []
    };

    try {
        const labelMirror = await getEvolutionLabelMirror({ force: true });
        labelSync = await persistLabelMirrorAssociations(labelMirror, userId);

        if (!labelSync.labels && !labelSync.associations) {
            warnings.push({
                step: 'labels',
                message: 'A Evolution API respondeu, mas não retornou etiquetas nem associações. Se a etiqueta foi aplicada no WhatsApp Desktop, teste aplicar pelo app WhatsApp Business no celular para disparar o webhook.'
            });
        } else if (labelSync.labels && !labelSync.associations) {
            warnings.push({
                step: 'label_associations',
                message: 'A Evolution API retornou etiquetas, mas não informou quais contatos estão vinculados a elas. Novas aplicações de etiqueta dependem do webhook LABELS_ASSOCIATION.'
            });
        }
    } catch (error) {
        errors.push({
            step: 'labels',
            message: 'Não foi possível sincronizar etiquetas do WhatsApp.',
            error: error.failures || summarizeEvolutionError(error)
        });
    }

    try {
        contactSync = await persistEvolutionConversationTargets();

        if (!contactSync.contacts) {
            warnings.push({
                step: 'contacts',
                message: 'A Evolution API não retornou contatos com telefone real para importar.'
            });
        }
    } catch (error) {
        errors.push({
            step: 'contacts',
            message: 'Não foi possível importar contatos recentes da Evolution API.',
            error: error.failures || summarizeEvolutionError(error)
        });
    }

    try {
        messageSync = await persistEvolutionRecentMessageTargets();

        if (!messageSync.contacts) {
            warnings.push({
                step: 'recent_messages',
                message: 'A Evolution API não retornou mensagens recentes com telefone real para atualizar a lista.'
            });
        }
    } catch (error) {
        errors.push({
            step: 'recent_messages',
            message: 'Não foi possível importar contatos a partir de mensagens recentes da Evolution API.',
            error: error.failures || summarizeEvolutionError(error)
        });
    }

    const importedContacts = Math.max(
        labelSync.conversations || 0,
        contactSync.contacts || 0,
        messageSync.contacts || 0
    );

    return {
        chats: importedContacts,
        contacts: contactSync.contacts || 0,
        imported_contacts: importedContacts,
        messages: messageSync.messages || 0,
        labels: labelSync.labels,
        label_associations: labelSync.associations,
        label_sync: labelSync,
        contact_sync: contactSync,
        message_sync: messageSync,
        source: 'labels_contacts',
        warnings,
        errors: [
            ...errors,
            ...(Array.isArray(labelSync.errors) ? labelSync.errors : []),
            ...(Array.isArray(contactSync.errors) ? contactSync.errors : []),
            ...(Array.isArray(messageSync.errors) ? messageSync.errors : [])
        ]
    };
}

router.get('/whatsapp/status', authenticateToken, async (req, res) => {
    if (!EVOLUTION_API_KEY) {
        return res.json({
            status: 'close',
            configured: false,
            config: getEvolutionDiagnostics(),
            error: 'Chave da Evolution API não configurada.'
        });
    }

    try {
        const state = await fetchConnectionState();
        let webhook = null;

        if (state.status === 'open') {
            webhook = await Promise.race([
                ensureLightweightWebhookConfigured(),
                wait(2000).then(() => ({
                    skipped: true,
                    reason: 'timeout'
                }))
            ]);
        }

        res.json({
            status: state.status,
            configured: true,
            config: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics(),
            webhook
        });
    } catch (error) {
        if (isInstanceNotFound(error)) {
            return res.json({
                status: 'close',
                configured: true,
                config: getEvolutionDiagnostics(),
                meta: getMetaCapiDiagnostics()
            });
        }

        handleEvolutionError(res, error, 'Não foi possível consultar o status da Evolution API.');
    }
});

router.post('/whatsapp/connect', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const currentState = await fetchConnectionState().catch((error) => {
            if (error.response?.status === 404) return null;
            throw error;
        });

        if (currentState?.status === 'open') {
            await configureInstanceWebhook().catch(error => {
                console.warn('Não foi possível configurar webhook da Evolution:', error.response?.data || error.message);
            });
            await configureInstanceSettings().catch(error => {
                console.warn('Não foi possível configurar modo leve da instância:', error.response?.data || error.message);
            });

            return res.json({
                status: 'open',
                qrcode: '',
                base64: '',
                message: 'Instância já conectada.',
                config: getEvolutionDiagnostics()
            });
        }

        let response = null;
        let createResponse = null;

        try {
            response = await evolution.get(`/instance/connect/${EVOLUTION_INSTANCE}`);
        } catch (connectError) {
            const instanceNotFound = connectError.response?.status === 404;
            if (!instanceNotFound) throw connectError;

            createResponse = await createInstance();
            await wait(1500);

            response = await evolution
                .get(`/instance/connect/${EVOLUTION_INSTANCE}`)
                .catch(() => createResponse);
        }

        let qrcode = await extractQrCode(response.data) || await extractQrCode(createResponse?.data);

        if (!qrcode) {
            const retryResponse = await evolution
                .get(`/instance/connect/${EVOLUTION_INSTANCE}`)
                .catch(() => null);

            qrcode = await extractQrCode(retryResponse?.data);
            if (retryResponse?.data) response = retryResponse;
        }

        res.json({
            status: qrcode ? 'connecting' : 'close',
            qrcode,
            base64: qrcode,
            message: qrcode
                ? 'QR Code gerado.'
                : 'A Evolution API respondeu, mas não retornou QR Code. A instância foi preservada para evitar derrubar sessões conectadas.',
            details: qrcode ? undefined : response?.data,
            config: getEvolutionDiagnostics()
        });
    } catch (error) {
        handleEvolutionError(res, error, 'Não foi possível gerar o QR Code da instância WhatsApp.');
    }
});

router.post('/whatsapp/configure-webhook', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const response = await configureInstanceWebhook();
        const settings = await configureInstanceSettings().catch(error => ({
            data: {
                warning: 'Não foi possível aplicar o modo leve da instância.',
                details: error.response?.data || error.message
            }
        }));

        res.json({
            message: 'Webhook da Evolution configurado com sucesso.',
            webhookUrl: EVOLUTION_WEBHOOK_URL,
            events: EVOLUTION_WEBHOOK_EVENTS,
            details: response.data,
            settings: settings.data
        });
    } catch (error) {
        handleEvolutionError(res, error, 'Não foi possível configurar o webhook da Evolution API.');
    }
});

router.post('/whatsapp/sync', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const result = await syncEvolutionLabelsAndContacts(req.user.id);

        res.json({
            message: 'Sincronização de etiquetas solicitada.',
            ...result,
            config: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics()
        });
    } catch (error) {
        console.error('Erro inesperado ao sincronizar etiquetas da Evolution:', error.response?.data || error.message);
        res.status(200).json({
            message: 'Sincronização executada com avisos.',
            chats: 0,
            messages: 0,
            source: 'none',
            warnings: [{
                step: 'sync',
                message: 'Não foi possível consultar etiquetas da Evolution agora.',
                error: summarizeEvolutionError(error)
            }],
            labels: 0,
            label_associations: 0,
            label_sync: null,
            errors: [],
            config: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics()
        });
    }
});

router.post('/whatsapp/meta/qualified-lead', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone || '');
        const email = String(req.body?.email || '').trim().toLowerCase();
        const name = String(req.body?.name || '').trim();

        if (!phone && !email) {
            return res.status(400).json({ error: 'Informe telefone ou e-mail para enviar o lead qualificado.' });
        }

        if (phone && !isLikelyWhatsappPhone(phone)) {
            return res.status(400).json({ error: 'Telefone inválido para WhatsApp. Use DDD e número.' });
        }

        let conversation = null;
        let localTag = null;

        if (phone) {
            conversation = await ensureConversation(phone, { clientName: name });
            localTag = await persistLocalConversationTag(conversation, getQualifiedLeadLocalLabel(), 'add');
        }

        const sourceId = phone || email;
        const metaCapi = await sendQualifiedLeadEvent(
            {
                leadId: sourceId,
                name,
                phone,
                email
            },
            {
                source: 'whatsapp_manual',
                sourceId,
                conversationId: conversation?.id || null,
                clientId: conversation?.client_id || null,
                createdByUserId: req.user.id,
                eventId: `whatsapp-qualified-lead-manual-${sourceId}`
            }
        );

        res.json({
            message: metaCapi.sent
                ? 'Lead qualificado enviado para a Meta.'
                : 'Lead qualificado processado.',
            meta_capi: metaCapi,
            conversation,
            local_tag: localTag
        });
    } catch (error) {
        console.error('Erro ao enviar lead qualificado manual para Meta CAPI:', error.metaCapi || error.message);
        res.status(500).json({
            error: 'Não foi possível enviar o lead qualificado para a Meta.',
            meta_capi: error.metaCapi || null
        });
    }
});

router.delete('/whatsapp/meta/qualified-leads/history', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM meta_capi_events`, function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
        res.json({ message: 'Histórico da Meta apagado com sucesso.' });
    } catch (error) {
        console.error('Erro ao limpar histórico da Meta:', error);
        res.status(500).json({ error: 'Erro ao limpar histórico.' });
    }
});

router.get('/whatsapp/meta/qualified-leads/history', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
        const eventName = getMetaCapiDiagnostics().qualifiedLeadEventName || 'Lead Qualificado';
        const sources = ['whatsapp_manual', 'whatsapp'];
        const sourcePlaceholders = sources.map(() => '?').join(', ');
        const queryParams = [eventName, ...sources];
        const summary = await dbGet(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
             FROM meta_capi_events
             WHERE event_name = ?
               AND source IN (${sourcePlaceholders})`,
            queryParams
        );
        const rows = await dbAll(
            `SELECT
                mce.id,
                mce.source,
                mce.source_id,
                mce.conversation_id,
                mce.client_id,
                mce.event_name,
                mce.status,
                mce.error,
                mce.created_at,
                mce.updated_at,
                wc.phone,
                wc.push_name,
                wc.client_name,
                c.name AS client_name_match
             FROM meta_capi_events mce
             LEFT JOIN whatsapp_conversations wc ON wc.id = mce.conversation_id
             LEFT JOIN clients c ON c.id = COALESCE(mce.client_id, wc.client_id)
             WHERE mce.event_name = ?
               AND mce.source IN (${sourcePlaceholders})
             ORDER BY COALESCE(mce.updated_at, mce.created_at) DESC
             LIMIT ?`,
            [...queryParams, limit]
        );

        res.json({
            summary: {
                total: Number(summary?.total || 0),
                sent: Number(summary?.sent || 0),
                failed: Number(summary?.failed || 0)
            },
            history: rows.map(row => {
                const fallbackPhone = isLikelyWhatsappPhone(row.source_id) ? normalizePhone(row.source_id) : '';
                const phone = normalizePhone(row.phone || fallbackPhone);

                return {
                    id: row.id,
                    event_name: row.event_name,
                    status: row.status,
                    source: row.source,
                    source_id: row.source_id,
                    conversation_id: row.conversation_id,
                    client_id: row.client_id,
                    display_name: row.client_name_match || row.client_name || row.push_name || formatHistoryPhone(phone) || row.source_id,
                    phone,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    error: row.status === 'failed' ? row.error : ''
                };
            })
        });
    } catch (error) {
        res.status(500).json({
            error: 'Não foi possível carregar o histórico de leads Meta.',
            details: error.message,
            history: []
        });
    }
});

router.post('/whatsapp/webhook', async (req, res) => {
    const eventName = normalizeWebhookEventName(req.body);

    try {
        const result = await processIncomingWebhook(req.body);
        await recordWebhookAudit(eventName || result.event || '', req.body, result).catch((auditError) => {
            console.warn('Não foi possível auditar webhook do WhatsApp:', auditError.message);
        });
        res.json({ ok: true, ...result });
    } catch (error) {
        console.error('Erro ao processar webhook WhatsApp:', error.response?.data || error.message);
        await recordWebhookAudit(eventName, req.body, null, error.message).catch(() => {});
        res.status(200).json({ ok: false });
    }
});

router.get('/whatsapp/conversations', authenticateToken, async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const params = [];
        const metaEventName = getMetaCapiDiagnostics().qualifiedLeadEventName || 'Lead Qualificado';
        let whereClause = '';

        if (search) {
            const searchLike = `%${search}%`;
            const searchPredicates = [
                'wc.phone LIKE ?',
                'wc.push_name LIKE ?',
                'wc.client_name LIKE ?',
                'c.name LIKE ?',
                'wc.last_message_text LIKE ?',
                `EXISTS (
                        SELECT 1
                        FROM whatsapp_conversation_tags wct
                        JOIN whatsapp_tags wt ON wt.id = wct.tag_id
                        WHERE wct.conversation_id = wc.id
                          AND wt.name LIKE ?
                   )`
            ];
            params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);

            for (const variant of getPhoneSearchVariants(search)) {
                searchPredicates.push('wc.phone LIKE ?');
                params.push(`%${variant}%`);
            }

            whereClause = `WHERE (${searchPredicates.join(' OR ')})`;
        }

        const conversations = await dbAll(
            `SELECT
                wc.*,
                COALESCE(c.name, wc.client_name, wc.push_name, wc.phone) AS display_name,
                c.name AS matched_client_name,
                COALESCE(mce_manual.status, mce_auto.status) AS meta_capi_status,
                COALESCE(mce_manual.updated_at, mce_auto.updated_at) AS meta_capi_updated_at
             FROM whatsapp_conversations wc
             LEFT JOIN clients c ON c.id = wc.client_id
             LEFT JOIN meta_capi_events mce_manual
                    ON mce_manual.source = 'whatsapp_manual'
                   AND mce_manual.source_id = wc.phone
                   AND mce_manual.event_name = ?
             LEFT JOIN meta_capi_events mce_auto
                    ON mce_auto.source = 'whatsapp'
                   AND mce_auto.source_id = CAST(wc.id AS TEXT)
                   AND mce_auto.event_name = ?
             ${whereClause}
             ORDER BY COALESCE(NULLIF(wc.last_message_at, ''), wc.updated_at) DESC
             LIMIT 150`,
            [metaEventName, metaEventName, ...params]
        );

        const visibleConversations = conversations.filter(item => (
            isLikelyWhatsappPhone(item.phone)
            && !isLidJid(item.remote_jid)
        ));
        const conversationIds = visibleConversations.map(item => item.id);
        const localTagsByConversation = await getLocalTagsForConversations(conversationIds);

        res.json({
            conversations: visibleConversations.map(item => {
                const localTags = localTagsByConversation.get(item.id) || [];

                return {
                    ...item,
                    client_name: item.matched_client_name || item.client_name || '',
                    linked_orders: [],
                    tags: mergeConversationTags(localTags).map(tag => ({
                        id: tag.id,
                        name: tag.name,
                        color: tag.color,
                        evolution_label_id: tag.evolution_label_id
                    }))
                };
            })
        });
    } catch (error) {
        res.status(500).json({ error: error.message, conversations: [] });
    }
});

router.get('/whatsapp/labels', authenticateToken, async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const { labels, warning } = await loadAvailableWhatsappLabels();
        res.json({ tags: labels, labels, warning });
    } catch (error) {
        res.status(500).json({ error: error.message, tags: [], labels: [] });
    }
});

router.get('/whatsapp/tags', authenticateToken, async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const { labels, warning } = await loadAvailableWhatsappLabels();
        res.json({ tags: labels, labels, warning });
    } catch (error) {
        res.status(500).json({ error: error.message, tags: [], labels: [] });
    }
});

router.get('/whatsapp/diagnostics', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const [recentWebhooks, totalConversations, providerWebhook] = await Promise.all([
            dbAll(`
                SELECT id, event_name, processed_count, summary, error, created_at
                FROM whatsapp_webhook_audit
                ORDER BY id DESC
                LIMIT 30
            `),
            dbGet(`SELECT COUNT(*) AS total FROM whatsapp_conversations`),
            fetchEvolutionWebhookConfig().catch(error => ({
                error: summarizeEvolutionError(error)
            }))
        ]);

        res.json({
            evolution: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics(),
            webhook: {
                configuredUrl: EVOLUTION_WEBHOOK_URL,
                events: EVOLUTION_WEBHOOK_EVENTS,
                lastConfiguredAt: lastWebhookConfiguredAt ? new Date(lastWebhookConfiguredAt).toISOString() : null,
                provider: providerWebhook
            },
            conversations: {
                total: Number(totalConversations?.total || 0)
            },
            recent_webhooks: recentWebhooks
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            evolution: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics()
        });
    }
});

router.get('/whatsapp/labels/diagnostics', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const [localLabels, taggedConversations, recentWebhooks, recentAllWebhooks, providerWebhook] = await Promise.all([
            getLocalWhatsappLabels(),
            dbGet(`
                SELECT COUNT(DISTINCT wc.id) AS total
                FROM whatsapp_conversations wc
                JOIN whatsapp_conversation_tags wct ON wct.conversation_id = wc.id
                JOIN whatsapp_tags wt ON wt.id = wct.tag_id
                WHERE wt.evolution_label_id IS NOT NULL
                  AND wt.evolution_label_id <> ''
            `),
            dbAll(`
                SELECT id, event_name, processed_count, result_payload, error, created_at
                FROM whatsapp_label_webhook_audit
                ORDER BY id DESC
                LIMIT 20
            `),
            dbAll(`
                SELECT id, event_name, processed_count, summary, error, created_at
                FROM whatsapp_webhook_audit
                ORDER BY id DESC
                LIMIT 30
            `),
            fetchEvolutionWebhookConfig().catch(error => ({
                error: summarizeEvolutionError(error)
            }))
        ]);

        res.json({
            evolution: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics(),
            webhook: {
                events: EVOLUTION_WEBHOOK_EVENTS,
                lastConfiguredAt: lastWebhookConfiguredAt ? new Date(lastWebhookConfiguredAt).toISOString() : null,
                provider: providerWebhook
            },
            labels: localLabels,
            tagged_conversations: Number(taggedConversations?.total || 0),
            recent_webhooks: recentWebhooks,
            recent_all_webhooks: recentAllWebhooks
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            evolution: getEvolutionDiagnostics(),
            meta: getMetaCapiDiagnostics()
        });
    }
});

router.post('/whatsapp/add-label', authenticateToken, async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const phone = normalizePhone(req.body?.phone || '');
        const remoteJid = normalizeWhatsappJid(req.body?.jid || req.body?.remoteJid || '');
        const labelId = String(req.body?.labelId || req.body?.label_id || req.body?.id || '').trim();
        const labelName = String(req.body?.labelName || req.body?.name || '').trim();
        const conversation = phone ? await findExistingConversationByPhone(phone) : null;
        const finalRemoteJid = remoteJid || conversation?.remote_jid || normalizeWhatsappJid(phone);

        if (!finalRemoteJid) {
            return res.status(400).json({ error: 'Informe o telefone ou JID do contato.' });
        }

        if (!labelId && !labelName) {
            return res.status(400).json({ error: 'Informe a etiqueta que será aplicada.' });
        }

        const labels = await fetchEvolutionLabels();
        const selectedLabel = findEvolutionLabel(labels, labelId, labelName);

        if (!selectedLabel) {
            return res.status(404).json({ error: 'Etiqueta não encontrada na Evolution API.' });
        }

        const result = await applyEvolutionLabelToChat({
            remoteJid: finalRemoteJid,
            phone: phone || extractPhoneFromRemoteJid(finalRemoteJid),
            label: selectedLabel
        });

        clearEvolutionLabelMirrorCache();

        const metaPhone = normalizePhone(phone || extractPhoneFromRemoteJid(finalRemoteJid));
        let updatedConversation = null;
        let localTag = null;
        let metaCapi = {
            sent: false,
            skipped: true,
            reason: 'label_not_qualified'
        };

        if (metaPhone && isLikelyWhatsappPhone(metaPhone)) {
            updatedConversation = await ensureConversation(metaPhone, {
                remoteJid: finalRemoteJid
            });
            localTag = await persistLocalConversationTag(updatedConversation, selectedLabel, 'add');
        }

        if (isQualifiedLeadLabel(selectedLabel)) {
            try {
                if (!updatedConversation) {
                    metaCapi = {
                        sent: false,
                        skipped: true,
                        reason: 'invalid_phone'
                    };
                } else {
                    metaCapi = await sendQualifiedLeadToMetaIfNeeded(updatedConversation, selectedLabel, req.user.id);
                }
            } catch (metaError) {
                console.error('Erro ao preparar lead qualificado do WhatsApp para Meta CAPI:', metaError.metaCapi || metaError.message);
                metaCapi = metaError.metaCapi || {
                    sent: false,
                    skipped: false,
                    error: metaError.message
                };
            }
        }

        res.json({
            message: 'Etiqueta aplicada no WhatsApp Business.',
            label: {
                id: selectedLabel.id,
                name: selectedLabel.name,
                color: selectedLabel.color,
                evolution_label_id: selectedLabel.id
            },
            local_tag: localTag,
            meta_capi: metaCapi,
            provider: result.response.data,
            attempt: result.attempt
        });
    } catch (error) {
        handleEvolutionError(res, error, 'Não foi possível aplicar a etiqueta no WhatsApp.');
    }
});

router.post('/whatsapp/conversations/:phone/tags', authenticateToken, async (req, res) => {
    res.status(405).json({
        error: 'Etiquetas do WhatsApp agora são somente leitura no ERP. Gerencie as etiquetas pelo app WhatsApp Business.'
    });
});

router.get('/whatsapp/conversations/:phone/messages', authenticateToken, async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const conversation = await findExistingConversationByPhone(phone);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversa não encontrada.' });
        }

        const messages = await dbAll(
            `SELECT
                wm.*,
                u.name AS sent_by_name
             FROM whatsapp_messages wm
             LEFT JOIN users u ON u.id = wm.sent_by_user_id
             WHERE wm.conversation_id = ?
             ORDER BY wm.created_at ASC, wm.id ASC
             LIMIT 500`,
            [conversation.id]
        );

        await dbRun(
            `UPDATE whatsapp_conversations
             SET unread_count = 0, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [conversation.id]
        );

        res.json({
            conversation: { ...conversation, unread_count: 0 },
            messages,
            linked_orders: await getLinkedOrders(conversation.id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message, messages: [] });
    }
});

router.post('/whatsapp/conversations/:phone/send', authenticateToken, async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        const phone = normalizePhone(req.params.phone);
        const text = String(req.body.text || '').trim();

        if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });
        if (!isLikelyWhatsappPhone(phone)) return res.status(400).json({ error: 'Telefone inválido para WhatsApp. Atualize a lista e selecione uma conversa com número válido.' });
        if (!text) return res.status(400).json({ error: 'Digite uma mensagem para enviar.' });

        const response = await sendTextMessage(phone, text);
        const conversation = await persistOutgoingMessage(phone, text, req.user.id, response.data, 'text');

        res.json({
            message: 'Mensagem enviada.',
            conversation,
            provider: response.data
        });
    } catch (error) {
        handleEvolutionError(res, error, 'Não foi possível enviar a mensagem pelo WhatsApp.');
    }
});

router.patch('/whatsapp/conversations/:phone', authenticateToken, async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const status = normalizeConversationStatus(req.body.status);
        const conversation = await ensureConversation(phone);

        await dbRun(
            `UPDATE whatsapp_conversations
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, conversation.id]
        );

        res.json({
            message: status === 'archived' ? 'Conversa arquivada.' : 'Conversa reaberta.',
            conversation: await dbGet(`SELECT * FROM whatsapp_conversations WHERE id = ?`, [conversation.id])
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/whatsapp/conversations/:phone/orders', authenticateToken, async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const orderId = Number(req.body.order_id || req.body.orderId);

        if (!phone) return res.status(400).json({ error: 'Telefone inválido.' });
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ error: 'Informe um pedido válido.' });
        }

        const order = await dbGet(
            `SELECT id, tracking_code, client_name, client_id, client_phone, status
             FROM orders
             WHERE id = ?`,
            [orderId]
        );

        if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const conversation = await ensureConversation(phone, {
            clientId: order.client_id || null,
            clientName: order.client_name || ''
        });

        await dbRun(
            `INSERT OR IGNORE INTO whatsapp_conversation_orders
                (conversation_id, order_id, created_by_user_id)
             VALUES
                (?, ?, ?)`,
            [conversation.id, order.id, req.user.id || null]
        );

        await dbRun(
            `UPDATE whatsapp_conversations
             SET client_id = COALESCE(client_id, ?),
                 client_name = COALESCE(NULLIF(client_name, ''), ?),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [order.client_id || null, order.client_name || '', conversation.id]
        );

        await dbRun(
            `UPDATE orders
             SET client_phone = COALESCE(NULLIF(client_phone, ''), ?)
             WHERE id = ?`,
            [phone, order.id]
        );

        res.json({
            message: 'Conversa vinculada ao pedido.',
            linked_orders: await getLinkedOrders(conversation.id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/whatsapp/conversations/:phone/orders/:orderId', authenticateToken, async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const orderId = Number(req.params.orderId);
        const conversation = await findExistingConversationByPhone(phone);

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });

        await dbRun(
            `DELETE FROM whatsapp_conversation_orders
             WHERE conversation_id = ? AND order_id = ?`,
            [conversation.id, orderId]
        );

        res.json({
            message: 'Pedido removido da conversa.',
            linked_orders: await getLinkedOrders(conversation.id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/whatsapp/logout', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    if (requireEvolutionApiKey(res)) return;

    try {
        await evolution.delete(`/instance/logout/${EVOLUTION_INSTANCE}`);
        res.json({
            message: 'WhatsApp desconectado com sucesso.',
            status: 'close'
        });
    } catch (error) {
        if (isInstanceNotFound(error)) {
            return res.json({
                message: 'Instância ainda não existe. WhatsApp já está desconectado.',
                status: 'close'
            });
        }

        handleEvolutionError(res, error, 'Não foi possível desconectar a instância WhatsApp.');
    }
});

router.get('/whatsapp/automation', authenticateToken, (req, res) => {
    db.get(
        `SELECT welcome_message, delay_seconds, audio_path, audio_original_name, updated_at
         FROM whatsapp_automation_settings
         WHERE id = 1`,
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json(row || {
                welcome_message: '',
                delay_seconds: 3,
                audio_path: null,
                audio_original_name: null,
                updated_at: null
            });
        }
    );
});

router.post('/whatsapp/save-automation', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    upload.single('audio')(req, res, (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: uploadErr.message });

        const welcomeMessage = String(req.body.welcome_message || req.body.message || '').trim();
        const delaySeconds = Number(req.body.delay_seconds || req.body.delay || 0);

        if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
            return res.status(400).json({ error: 'Informe um delay válido em segundos.' });
        }

        const audioPath = req.file ? `whatsapp/${req.file.filename}` : null;
        const audioOriginalName = req.file?.originalname || null;

        db.run(
            `
                INSERT INTO whatsapp_automation_settings
                    (id, welcome_message, delay_seconds, audio_path, audio_original_name, updated_at)
                VALUES
                    (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    welcome_message = excluded.welcome_message,
                    delay_seconds = excluded.delay_seconds,
                    audio_path = COALESCE(excluded.audio_path, whatsapp_automation_settings.audio_path),
                    audio_original_name = COALESCE(excluded.audio_original_name, whatsapp_automation_settings.audio_original_name),
                    updated_at = CURRENT_TIMESTAMP
            `,
            [welcomeMessage, Math.round(delaySeconds), audioPath, audioOriginalName],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });

                db.get(
                    `SELECT welcome_message, delay_seconds, audio_path, audio_original_name, updated_at
                     FROM whatsapp_automation_settings
                     WHERE id = 1`,
                    [],
                    (fetchErr, row) => {
                        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                        res.json({
                            message: 'Automação do WhatsApp salva com sucesso.',
                            settings: row
                        });
                    }
                );
            }
        );
    });
});

router.get('/whatsapp/auto-replies', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAll(`SELECT * FROM whatsapp_auto_replies ORDER BY id DESC`);
        res.json({ auto_replies: rows });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar respostas automáticas.' });
    }
});

router.post('/whatsapp/auto-replies', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'image', maxCount: 1 }])(req, res, async (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: uploadErr.message });

        const keyword = String(req.body.keyword || '').trim().toLowerCase();
        const replyText = String(req.body.reply_text || '').trim();
        const simulateRecording = req.body.simulate_recording !== 'false' && req.body.simulate_recording !== false ? 1 : 0;
        const delaySeconds = Number(req.body.delay_seconds || 3);

        if (!keyword) {
            return res.status(400).json({ error: 'A palavra-chave é obrigatória.' });
        }

        const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
        const imageFile = req.files && req.files['image'] ? req.files['image'][0] : null;

        if (!audioFile && !imageFile && !replyText) {
            return res.status(400).json({ error: 'Você precisa enviar um áudio, imagem ou texto de resposta.' });
        }

        const audioFilename = audioFile ? audioFile.filename : '';
        const audioOriginalName = audioFile ? audioFile.originalname : '';
        const imageFilename = imageFile ? imageFile.filename : '';
        const imageOriginalName = imageFile ? imageFile.originalname : '';

        try {
            await dbRun(
                `INSERT INTO whatsapp_auto_replies 
                    (keyword, audio_filename, audio_original_name, simulate_recording, delay_seconds, reply_text, image_filename, image_original_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [keyword, audioFilename, audioOriginalName, simulateRecording, delaySeconds, replyText, imageFilename, imageOriginalName]
            );
            
            const rows = await dbAll(`SELECT * FROM whatsapp_auto_replies ORDER BY id DESC`);
            res.json({ message: 'Regra cadastrada com sucesso.', auto_replies: rows });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao salvar a regra no banco de dados.' });
        }
    });
});

router.put('/whatsapp/auto-replies/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'image', maxCount: 1 }])(req, res, async (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: uploadErr.message });

        const id = Number(req.params.id);
        const keyword = String(req.body.keyword || '').trim().toLowerCase();
        const replyText = String(req.body.reply_text || '').trim();
        const simulateRecording = req.body.simulate_recording !== 'false' && req.body.simulate_recording !== false ? 1 : 0;
        const delaySeconds = Number(req.body.delay_seconds || 3);

        if (!keyword) {
            return res.status(400).json({ error: 'A palavra-chave é obrigatória.' });
        }

        try {
            const existingRow = await dbGet(`SELECT * FROM whatsapp_auto_replies WHERE id = ?`, [id]);
            if (!existingRow) {
                return res.status(404).json({ error: 'Regra não encontrada.' });
            }

            const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
            const imageFile = req.files && req.files['image'] ? req.files['image'][0] : null;

            let audioFilename = existingRow.audio_filename;
            let audioOriginalName = existingRow.audio_original_name;
            if (audioFile) {
                if (existingRow.audio_filename) {
                    try { fs.unlinkSync(path.join(AUDIO_UPLOAD_DIR, existingRow.audio_filename)); } catch (e) {}
                }
                audioFilename = audioFile.filename;
                audioOriginalName = audioFile.originalname;
            }

            let imageFilename = existingRow.image_filename;
            let imageOriginalName = existingRow.image_original_name;
            if (imageFile) {
                if (existingRow.image_filename) {
                    try { fs.unlinkSync(path.join(AUDIO_UPLOAD_DIR, existingRow.image_filename)); } catch (e) {}
                }
                imageFilename = imageFile.filename;
                imageOriginalName = imageFile.originalname;
            }

            if (!audioFilename && !imageFilename && !replyText) {
                return res.status(400).json({ error: 'Você precisa enviar um áudio, imagem ou texto de resposta.' });
            }

            await dbRun(
                `UPDATE whatsapp_auto_replies 
                 SET keyword = ?, audio_filename = ?, audio_original_name = ?, simulate_recording = ?, delay_seconds = ?, reply_text = ?, image_filename = ?, image_original_name = ?
                 WHERE id = ?`,
                [keyword, audioFilename, audioOriginalName, simulateRecording, delaySeconds, replyText, imageFilename, imageOriginalName, id]
            );
            
            const rows = await dbAll(`SELECT * FROM whatsapp_auto_replies ORDER BY id DESC`);
            res.json({ message: 'Regra atualizada com sucesso.', auto_replies: rows });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar a regra no banco de dados.' });
        }
    });
});

router.delete('/whatsapp/auto-replies/:id', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const row = await dbGet(`SELECT * FROM whatsapp_auto_replies WHERE id = ?`, [id]);
        
        if (!row) {
            return res.status(404).json({ error: 'Regra não encontrada.' });
        }

        // Try to delete the audio file
        if (row.audio_filename) {
            try {
                fs.unlinkSync(path.join(AUDIO_UPLOAD_DIR, row.audio_filename));
            } catch (e) {
                console.warn('Não foi possível apagar o arquivo de áudio:', e.message);
            }
        }
        
        // Try to delete the image file
        if (row.image_filename) {
            try {
                fs.unlinkSync(path.join(AUDIO_UPLOAD_DIR, row.image_filename));
            } catch (e) {
                console.warn('Não foi possível apagar o arquivo de imagem:', e.message);
            }
        }

        await dbRun(`DELETE FROM whatsapp_auto_replies WHERE id = ?`, [id]);
        
        const rows = await dbAll(`SELECT * FROM whatsapp_auto_replies ORDER BY id DESC`);
        res.json({ message: 'Regra excluída com sucesso.', auto_replies: rows });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir regra.' });
    }
});

module.exports = router;
