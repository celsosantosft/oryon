const axios = require('axios');
const crypto = require('crypto');
const db = require('../database');
const { metaCapiConfig, getMetaCapiDiagnostics } = require('../config/metaCapi');

const META_CAPI_TIMEOUT_MS = 12000;

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
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

let metaCapiTablesReady = null;

function ensureMetaCapiTables() {
    if (metaCapiTablesReady) return metaCapiTablesReady;

    metaCapiTablesReady = Promise.resolve()
        .then(() => dbRun(`
        CREATE TABLE IF NOT EXISTS meta_capi_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            source_id TEXT NOT NULL,
            conversation_id INTEGER,
            client_id INTEGER,
            created_by_user_id INTEGER,
            event_name TEXT NOT NULL,
            event_time INTEGER NOT NULL,
            event_id TEXT,
            email_hash TEXT,
            phone_hash TEXT,
            request_payload TEXT,
            response_payload TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source, event_name, source_id)
        )
    `))
        .then(() => dbRun(`CREATE INDEX IF NOT EXISTS idx_meta_capi_events_status ON meta_capi_events(status)`))
        .then(() => dbRun(`CREATE INDEX IF NOT EXISTS idx_meta_capi_events_conversation ON meta_capi_events(conversation_id)`));

    return metaCapiTablesReady;
}

ensureMetaCapiTables().catch((error) => {
    console.error('Erro ao preparar tabela de eventos da Meta CAPI:', error.message);
});

function normalizeComparable(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function isQualifiedLeadLabel(label) {
    const candidates = [
        label?.name,
        label?.labelName,
        label?.title,
        label?.text,
        label?.value,
        label?.id,
        label?.evolution_label_id
    ].map(normalizeComparable).filter(Boolean);

    if (!candidates.length) return false;

    return metaCapiConfig.qualifiedLeadLabels
        .map(normalizeComparable)
        .filter(Boolean)
        .some(expected => candidates.includes(expected));
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
    const countryCode = metaCapiConfig.defaultCountryCode || '55';
    let digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');

    if (!digits) return '';
    if (!digits.startsWith(countryCode) && digits.length <= 11) {
        digits = `${countryCode}${digits}`;
    }

    return digits;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stringifyPayload(payload) {
    try {
        return JSON.stringify(payload || {});
    } catch (error) {
        return JSON.stringify({ error: 'payload_not_serializable' });
    }
}

function summarizeMetaResponse(data) {
    if (!data || typeof data !== 'object') return data || null;

    return {
        events_received: data.events_received,
        messages: data.messages,
        fbtrace_id: data.fbtrace_id,
        trace_id: data.trace_id
    };
}

function summarizeMetaError(error) {
    return {
        status: error.response?.status || null,
        code: error.code || '',
        message: error.response?.data?.error?.message || error.message,
        type: error.response?.data?.error?.type || '',
        fbtrace_id: error.response?.data?.error?.fbtrace_id || error.response?.data?.fbtrace_id || '',
        data: error.response?.data || null
    };
}

async function findSuccessfulEvent(source, eventName, sourceId) {
    await ensureMetaCapiTables();

    return dbGet(
        `SELECT id, event_id, response_payload
         FROM meta_capi_events
         WHERE source = ?
           AND event_name = ?
           AND source_id = ?
           AND status = 'sent'
         LIMIT 1`,
        [source, eventName, sourceId]
    );
}

async function upsertEventAttempt(event) {
    await ensureMetaCapiTables();

    await dbRun(
        `INSERT INTO meta_capi_events
            (source, source_id, conversation_id, client_id, created_by_user_id, event_name, event_time,
             event_id, email_hash, phone_hash, request_payload, response_payload, status, error)
         VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(source, event_name, source_id) DO UPDATE SET
            conversation_id = excluded.conversation_id,
            client_id = excluded.client_id,
            created_by_user_id = excluded.created_by_user_id,
            event_time = excluded.event_time,
            event_id = excluded.event_id,
            email_hash = excluded.email_hash,
            phone_hash = excluded.phone_hash,
            request_payload = excluded.request_payload,
            response_payload = NULL,
            status = excluded.status,
            error = excluded.error,
            updated_at = CURRENT_TIMESTAMP`,
        [
            event.source,
            event.sourceId,
            event.conversationId || null,
            event.clientId || null,
            event.createdByUserId || null,
            event.eventName,
            event.eventTime,
            event.eventId,
            event.emailHash || null,
            event.phoneHash || null,
            event.requestPayload || null,
            event.status,
            event.error || null
        ]
    );
}

async function updateEventResult(source, eventName, sourceId, status, responsePayload, error = '') {
    await ensureMetaCapiTables();

    await dbRun(
        `UPDATE meta_capi_events
         SET status = ?,
             response_payload = ?,
             error = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE source = ?
           AND event_name = ?
           AND source_id = ?`,
        [
            status,
            responsePayload ? stringifyPayload(responsePayload) : null,
            error || null,
            source,
            eventName,
            sourceId
        ]
    );
}

function buildSkippedResult(reason) {
    return {
        sent: false,
        skipped: true,
        reason,
        config: getMetaCapiDiagnostics()
    };
}

async function sendQualifiedLeadEvent(leadData = {}, options = {}) {
    const eventName = options.eventName || metaCapiConfig.qualifiedLeadEventName;
    const source = options.source || 'whatsapp';
    const sourceId = String(options.sourceId || leadData.leadId || leadData.phone || leadData.email || '').trim();
    const normalizedEmail = normalizeEmail(leadData.email);
    const normalizedPhone = normalizePhone(leadData.phone);
    const emailHash = normalizedEmail ? sha256(normalizedEmail) : '';
    const phoneHash = normalizedPhone ? sha256(normalizedPhone) : '';
    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = options.eventId || `${source}:${sourceId}:${normalizeComparable(eventName)}`;

    if (!sourceId) {
        return buildSkippedResult('missing_source_id');
    }

    if (!emailHash && !phoneHash) {
        await upsertEventAttempt({
            source,
            sourceId,
            conversationId: options.conversationId,
            clientId: options.clientId,
            createdByUserId: options.createdByUserId,
            eventName,
            eventTime,
            eventId,
            status: 'skipped',
            error: 'missing_user_data'
        });

        return buildSkippedResult('missing_user_data');
    }

    if (!metaCapiConfig.pixelId || !metaCapiConfig.accessToken) {
        await upsertEventAttempt({
            source,
            sourceId,
            conversationId: options.conversationId,
            clientId: options.clientId,
            createdByUserId: options.createdByUserId,
            eventName,
            eventTime,
            eventId,
            emailHash,
            phoneHash,
            status: 'skipped',
            error: 'missing_config'
        });

        console.warn('Meta CAPI nao configurada. Defina META_PIXEL_ID e META_ACCESS_TOKEN.');
        return buildSkippedResult('missing_config');
    }

    if (options.skipDuplicates !== false) {
        const existingEvent = await findSuccessfulEvent(source, eventName, sourceId);
        if (existingEvent) {
            return {
                sent: false,
                skipped: true,
                reason: 'already_sent',
                event_id: existingEvent.event_id,
                config: getMetaCapiDiagnostics()
            };
        }
    }

    const userData = {};
    if (emailHash) userData.em = [emailHash];
    if (phoneHash) userData.ph = [phoneHash];

    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: eventTime,
                action_source: 'system_generated',
                event_id: eventId,
                user_data: userData
            }
        ]
    };

    if (metaCapiConfig.testEventCode) {
        payload.test_event_code = metaCapiConfig.testEventCode;
    }

    await upsertEventAttempt({
        source,
        sourceId,
        conversationId: options.conversationId,
        clientId: options.clientId,
        createdByUserId: options.createdByUserId,
        eventName,
        eventTime,
        eventId,
        emailHash,
        phoneHash,
        requestPayload: stringifyPayload(payload),
        status: 'pending'
    });

    const url = `https://graph.facebook.com/${metaCapiConfig.graphVersion}/${metaCapiConfig.pixelId}/events`;

    try {
        const response = await axios.post(url, payload, {
            timeout: META_CAPI_TIMEOUT_MS,
            params: {
                access_token: metaCapiConfig.accessToken
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const metaResponse = summarizeMetaResponse(response.data);
        await updateEventResult(source, eventName, sourceId, 'sent', metaResponse);
        console.log(`Meta CAPI: evento "${eventName}" enviado com sucesso.`, metaResponse);

        return {
            sent: true,
            skipped: false,
            event_id: eventId,
            response: metaResponse,
            config: getMetaCapiDiagnostics()
        };
    } catch (error) {
        const metaError = summarizeMetaError(error);
        await updateEventResult(source, eventName, sourceId, 'failed', null, stringifyPayload(metaError));
        console.error(`Meta CAPI: erro ao enviar evento "${eventName}".`, metaError);

        const wrappedError = new Error('Falha ao enviar evento para Meta CAPI.');
        wrappedError.metaCapi = {
            sent: false,
            skipped: false,
            event_id: eventId,
            error: metaError,
            config: getMetaCapiDiagnostics()
        };
        throw wrappedError;
    }
}

module.exports = {
    sendQualifiedLeadEvent,
    isQualifiedLeadLabel,
    normalizeEmail,
    normalizePhone,
    sha256,
    getMetaCapiDiagnostics
};
