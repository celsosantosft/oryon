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
    isQualifiedLeadLabel
} = require('../services/metaCapiService');

const router = express.Router();
let QRCode = null;

try {
    QRCode = require('qrcode');
} catch (error) {
    console.warn('Pacote qrcode não instalado. Rode npm install no server para gerar QR Code quando a Evolution retornar apenas o código bruto.');
}

const EVOLUTION_WEBHOOK_EVENTS = [
    'CHATS_UPSERT',
    'CHATS_UPDATE',
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

const evolution = createEvolutionClient();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase() || '.ogg';
        const baseName = path
            .basename(file.originalname || 'audio', extension)
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60);

        cb(null, `${Date.now()}-${baseName || 'audio'}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        if (extension !== '.ogg') {
            return cb(new Error('Envie apenas arquivos de áudio no formato .ogg.'));
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

function isLikelyWhatsappPhone(value) {
    const digits = normalizePhone(value);
    if (!digits) return false;
    if (digits.startsWith('55')) return digits.length === 12 || digits.length === 13;
    return digits.length >= 10 && digits.length <= 14;
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

    const candidates = [
        payload.data,
        payload.messages,
        payload.message,
        payload.data?.messages,
        payload.data?.message,
        payload.data?.messages?.records,
        payload.data?.records,
        payload.response,
        payload.response?.messages,
        payload.response?.records
    ];

    const collected = candidates.flatMap(collectMessagePayloads);
    if (collected.length) return collected;

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

    const searchForText = (obj) => {
        if (typeof obj === 'string') return obj;
        if (!obj || typeof obj !== 'object') return '';
        
        if (obj.conversation) return obj.conversation;
        if (obj.text) return obj.text;
        if (obj.caption) return obj.caption;
        if (obj.selectedDisplayText) return obj.selectedDisplayText;
        if (obj.title) return obj.title;
        
        if (obj.extendedTextMessage?.text) return obj.extendedTextMessage.text;
        if (obj.ephemeralMessage?.message) return searchForText(obj.ephemeralMessage.message);
        if (obj.documentWithCaptionMessage?.message?.documentMessage?.caption) return obj.documentWithCaptionMessage.message.documentMessage.caption;
        
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

    if (normalizedType.includes('audio')) return '[Audio enviado pelo aparelho]';
    if (normalizedType.includes('image')) return '[Imagem enviada pelo aparelho]';
    if (normalizedType.includes('video')) return '[Video enviado pelo aparelho]';
    if (normalizedType.includes('document')) return '[Documento enviado pelo aparelho]';
    if (normalizedType.includes('sticker')) return '[Figurinha enviada pelo aparelho]';
    if (normalizedType.includes('location')) return '[Localizacao enviada pelo aparelho]';
    if (normalizedType.includes('contact')) return '[Contato enviado pelo aparelho]';
    if (normalizedType.includes('reaction')) return '[Reacao enviada pelo aparelho]';

    return '';
}

function extractMessageTimestamp(messagePayload) {
    const value = messagePayload?.messageTimestamp
        || messagePayload?.timestamp
        || messagePayload?.createdAt
        || messagePayload?.dateTime;

    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    if (typeof value === 'object') {
        if (typeof value.low === 'number') return value.low;
        if (typeof value.seconds === 'number') return value.seconds;
    }

    return value;
}

function toSqlDateTime(value) {
    if (!value) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        const milliseconds = value > 1000000000000 ? value : value * 1000;
        return new Date(milliseconds).toISOString().slice(0, 19).replace('T', ' ');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function extractIncomingMessage(payload, rootPayload = null) {
    const messagePayload = extractIncomingPayload(payload);
    if (!messagePayload) return null;

    const key = messagePayload.key || {};
    const remoteJid = key.remoteJid || messagePayload.remoteJid || messagePayload.from || '';
    const phone = normalizePhone(remoteJid.split('@')[0]);

    return {
        id: key.id || messagePayload.id || '',
        phone,
        remoteJid,
        fromMe: Boolean(key.fromMe || messagePayload.fromMe),
        pushName: messagePayload.pushName || messagePayload.sender?.pushName || '',
        text: extractIncomingText(messagePayload, rootPayload || payload),
        type: extractMessageType(messagePayload, rootPayload || payload),
        timestamp: toSqlDateTime(extractMessageTimestamp(messagePayload)),
        isGroup: remoteJid.includes('@g.us'),
        isBroadcast: remoteJid.includes('status@broadcast')
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

    if (existingConversation) {
        await dbRun(
            `UPDATE whatsapp_conversations
                SET remote_jid = COALESCE(NULLIF(?, ''), remote_jid),
                    push_name = COALESCE(NULLIF(?, ''), push_name),
                    client_id = COALESCE(?, client_id),
                    client_name = COALESCE(NULLIF(?, ''), client_name),
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [
                metadata.remoteJid || '',
                metadata.pushName || '',
                existingClient?.id || metadata.clientId || null,
                clientName,
                existingConversation.id
            ]
        );

        return dbGet(`SELECT * FROM whatsapp_conversations WHERE id = ?`, [existingConversation.id]);
    }

    await dbRun(
        `INSERT INTO whatsapp_conversations
            (phone, remote_jid, push_name, client_id, client_name, updated_at)
         VALUES
            (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(phone) DO UPDATE SET
            remote_jid = COALESCE(NULLIF(excluded.remote_jid, ''), remote_jid),
            push_name = COALESCE(NULLIF(excluded.push_name, ''), push_name),
            client_id = COALESCE(excluded.client_id, client_id),
            client_name = COALESCE(NULLIF(excluded.client_name, ''), client_name),
            updated_at = CURRENT_TIMESTAMP`,
        [
            normalizedPhone,
            metadata.remoteJid || '',
            metadata.pushName || '',
            existingClient?.id || metadata.clientId || null,
            clientName
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
    const eventName = String(payload?.event || payload?.type || payload?.eventType || '')
        .toUpperCase()
        .replace(/[.\-\s]+/g, '_');

    if (eventName.includes('LABELS_ASSOCIATION') || eventName.includes('LABELS_EDIT')) {
        return processLabelWebhook(payload, eventName);
    }

    if (eventName.includes('CHATS_UPSERT') || eventName.includes('CHATS_UPDATE')) {
        return processChatWebhook(payload, eventName);
    }

    return {
        ignored: true,
        event: eventName || 'UNKNOWN',
        reason: 'whatsapp_message_events_disabled'
    };
}

function collectChatPayloads(payload) {
    const candidates = [
        payload?.data,
        payload?.chat,
        payload?.chats,
        payload?.conversation,
        payload?.message?.chat,
        payload
    ];
    const chats = [];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            chats.push(...candidate.filter(item => item && typeof item === 'object'));
        } else if (candidate && typeof candidate === 'object') {
            chats.push(candidate);
        }
    }

    return chats;
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
            pushName: target.pushName
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
    const labelsResult = await callEvolutionFallbacks('Buscar etiquetas oficiais', [
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
        },
        {
            name: 'findLabels oficial',
            method: 'get',
            url: `/label/findLabels/${EVOLUTION_INSTANCE}`
        }
    ]);

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
    const labels = mergeConversationTags(formatEvolutionLabels(remoteLabels), localLabels);

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
    const targetPhone = normalizePhone(phone || targetJid.split('@')[0]);
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
        'records',
        'data.chats',
        'data.records',
        'response',
        'response.chats',
        'response.records',
        'data',
        'result',
        'results'
    ]);

    if (chats.length) return chats;

    const objectCandidates = [
        payload?.chats,
        payload?.records,
        payload?.data?.chats,
        payload?.data?.records,
        payload?.response?.chats,
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
        id: String(value.id || value.labelId || value.label_id || value._id || value.jid || value.key || '').trim(),
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

        const tag = matchedLabel || normalizeEvolutionLabel(ref);
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
    const phone = normalizePhone(target?.phone || target?.number || remoteJid.split('@')[0]);

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

function collectChatTargets(value, targets = []) {
    if (!value) return targets;

    if (Array.isArray(value)) {
        value.forEach(item => collectChatTargets(item, targets));
        return targets;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const rawValue = String(value).trim();
        const remoteJid = normalizeWhatsappJid(rawValue);
        const phone = normalizePhone(rawValue.includes('@') ? rawValue.split('@')[0] : rawValue);

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
        || value.id?._serialized
        || '';
    const phone = normalizePhone(value.phone || value.number || value.user || String(remoteJid || '').split('@')[0]);

    if (remoteJid || phone) {
        targets.push({ remoteJid, phone });
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
        value.conversations,
        value.items,
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
        const label = matchedLabel || normalizedLabel;
        if (!label.name) continue;

        const targets = collectChatTargets([
            record.remoteJid,
            record.remote_jid,
            record.jid,
            record.chatId,
            record.chat_id,
            record.chat,
            record.chats,
            record.chatIds,
            record.chat_ids,
            record.jids,
            record.contacts,
            record.conversations,
            record.items
        ]);

        targets.forEach(target => linkedTags.push({ target, tag: label }));
    }

    return linkedTags;
}

async function fetchEvolutionChatsWithLabels() {
    const chatsResult = await callEvolutionFallbacks('Buscar conversas com etiquetas', [
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
    ]);

    return readEvolutionChats(chatsResult.response.data);
}

async function fetchEvolutionLabelsFromChats() {
    const seen = new Set();
    const labels = [];
    const chats = await fetchEvolutionChatsWithLabels();

    for (const chat of chats) {
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
    let labelPayload = null;
    const tagsByPhone = new Map();
    const tagsByJid = new Map();

    const [chatsResult, labelsResult] = await Promise.allSettled([
        fetchEvolutionChatsWithLabels(),
        fetchEvolutionLabelPayload()
    ]);

    if (chatsResult.status === 'fulfilled') {
        chats = chatsResult.value;
    } else {
        console.warn('Não foi possível buscar conversas com etiquetas nativas:', chatsResult.reason?.failures || summarizeEvolutionError(chatsResult.reason));
    }

    if (labelsResult.status === 'fulfilled') {
        labelPayload = labelsResult.value;
        labels = readEvolutionLabels(labelPayload);
    } else {
        console.warn('Não foi possível buscar etiquetas nativas da Evolution:', labelsResult.reason?.failures || summarizeEvolutionError(labelsResult.reason));
    }

    const labelsById = new Map(labels.map(label => [normalizeLabelKey(label.id), label]));
    const labelsByName = new Map(labels.map(label => [normalizeLabelKey(label.name), label]));

    for (const chat of chats) {
        const tags = mapChatTags(chat, labelsById, labelsByName);
        if (!tags.length) continue;

        const remoteJid = extractChatRemoteJid(chat);
        const phone = normalizePhone(chat?.phone || chat?.number || remoteJid.split('@')[0]);

        tags.forEach(tag => addTagToTargetMaps({ tagsByPhone, tagsByJid }, { remoteJid, phone }, tag));
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
            'associationAction',
            'labelAction',
            'data.action',
            'data.operation'
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

    return {
        labels,
        labelsById: new Map(labels.map(label => [normalizeLabelKey(label.id), label])),
        labelsByName: new Map(labels.map(label => [normalizeLabelKey(label.name), label]))
    };
}

async function persistLabelAssociationTarget(linkedTag, action, userId = null) {
    const target = normalizeChatTarget(linkedTag.target || {});
    if (!target) return { processed: false, reason: 'invalid_target' };

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

function normalizeChatTarget(chat) {
    const remoteJid = extractChatRemoteJid(chat);
    const phone = normalizePhone(chat?.phone || chat?.number || remoteJid.split('@')[0]);
    const finalRemoteJid = remoteJid || (phone ? `${phone}@s.whatsapp.net` : '');

    if (!phone || !finalRemoteJid || !isLikelyWhatsappPhone(phone)) return null;
    if (finalRemoteJid.includes('@g.us') || finalRemoteJid.includes('status@broadcast')) return null;

    return {
        phone,
        remoteJid: finalRemoteJid,
        pushName: chat?.pushName || chat?.name || chat?.profileName || chat?.client_name || ''
    };
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
    const warnings = [];
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

    try {
        const labelMirror = await getEvolutionLabelMirror({ force: true });
        labelSync = await persistLabelMirrorAssociations(labelMirror, userId);
    } catch (error) {
        errors.push({
            step: 'labels',
            message: 'Não foi possível sincronizar etiquetas do WhatsApp.',
            error: error.failures || summarizeEvolutionError(error)
        });
    }

    return {
        chats: labelSync.conversations || 0,
        messages: 0,
        labels: labelSync.labels,
        label_associations: labelSync.associations,
        label_sync: labelSync,
        source: 'labels',
        warnings,
        errors: [
            ...errors,
            ...(Array.isArray(labelSync.errors) ? labelSync.errors : [])
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
        res.json({
            status: state.status,
            configured: true,
            config: getEvolutionDiagnostics()
        });
    } catch (error) {
        if (isInstanceNotFound(error)) {
            return res.json({
                status: 'close',
                configured: true,
                config: getEvolutionDiagnostics()
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
            ...result
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
            errors: []
        });
    }
});

router.post('/whatsapp/webhook', async (req, res) => {
    try {
        const result = await processIncomingWebhook(req.body);
        res.json({ ok: true, ...result });
    } catch (error) {
        console.error('Erro ao processar webhook WhatsApp:', error.response?.data || error.message);
        res.status(200).json({ ok: false });
    }
});

router.get('/whatsapp/conversations', authenticateToken, async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const params = [];
        let whereClause = '';

        if (search) {
            const searchLike = `%${search}%`;
            whereClause = `
                WHERE wc.phone LIKE ?
                   OR wc.push_name LIKE ?
                   OR wc.client_name LIKE ?
                   OR c.name LIKE ?
                   OR wc.last_message_text LIKE ?
                   OR EXISTS (
                        SELECT 1
                        FROM whatsapp_conversation_tags wct
                        JOIN whatsapp_tags wt ON wt.id = wct.tag_id
                        WHERE wct.conversation_id = wc.id
                          AND wt.name LIKE ?
                   )
            `;
            params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
        }

        const conversations = await dbAll(
            `SELECT
                wc.*,
                COALESCE(c.name, wc.client_name, wc.push_name, wc.phone) AS display_name,
                c.name AS matched_client_name
             FROM whatsapp_conversations wc
             LEFT JOIN clients c ON c.id = wc.client_id
             ${whereClause}
             ORDER BY COALESCE(wc.last_message_at, wc.updated_at) DESC
             LIMIT 120`,
            params
        );

        const visibleConversations = conversations.filter(item => isLikelyWhatsappPhone(item.phone));
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
            phone: phone || finalRemoteJid.split('@')[0],
            label: selectedLabel
        });

        clearEvolutionLabelMirrorCache();

        const metaPhone = normalizePhone(phone || finalRemoteJid.split('@')[0]);
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

module.exports = router;
