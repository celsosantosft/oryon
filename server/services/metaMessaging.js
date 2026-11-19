// Meta's messaging dataset must be linked to the WABA in Events Manager.
// Never substitute a phone, ad ID or source URL for a real ctwa_clid.
const crypto = require('crypto');
function normalizePhone(value) {
    let digits = String(value || '').split('@')[0].replace(/\D/g, '');
    if ([10, 11].includes(digits.length)) digits = '55' + digits;
    return digits;
}

function phoneVariants(value) {
    const phone = normalizePhone(value);
    const legacy = /^55\d{2}9\d{8}$/.test(phone) ? phone.slice(0, 4) + phone.slice(5) : phone;
    return [...new Set([phone, legacy])];
}

function extractClickId(raw, phone) {
    let root;
    try { root = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return ''; }
    const expected = normalizePhone(phone);
    function visit(node, depth = 0) {
        if (!node || typeof node !== 'object' || depth > 10) return '';
        if (Array.isArray(node)) return node.map(item => visit(item, depth + 1)).find(Boolean) || '';
        const sender = node.key?.remoteJid || node.from || node.remoteJid;
        if (node.key?.fromMe || (sender && !phoneVariants(sender).some(value => phoneVariants(expected).includes(value)))) return '';
        // Inspect only the original message; quoted/forwarded messages must not provide attribution.
        if (sender) {
            const message = node.message || node;
            const contexts = [node, node.contextInfo, node.adReferral, message.contextInfo,
                message.extendedTextMessage?.contextInfo, message.imageMessage?.contextInfo,
                message.videoMessage?.contextInfo];
            for (const ctx of contexts) {
                const value = ctx?.referral?.ctwa_clid || ctx?.externalAdReply?.ctwaClid
                    || ctx?.ctwaClid || ctx?.ctwa_clid;
                if (typeof value === 'string' && /^[A-Za-z0-9_-]{10,2048}$/.test(value)) return value;
            }
        }
        for (const key of ['data', 'messages', 'entry', 'changes', 'value', 'records']) {
            const value = visit(node[key], depth + 1);
            if (value) return value;
        }
        return '';
    }
    return visit(root);
}

async function recordContactSignal(db, incoming, conversationId, raw) {
    if (incoming.fromMe || incoming.isGroup || incoming.isBroadcast) return;
    const clickId = extractClickId(raw, incoming.phone);
    // Store only contact/click metadata, never the message text, media, API key or full webhook.
    const providerId = clickId ? 'meta-click:' + crypto.createHash('sha256')
        .update(`${conversationId}:${clickId}`).digest('hex') : `meta-contact:${conversationId}`;
    const payload = { from: normalizePhone(incoming.phone) };
    if (clickId) payload.referral = { ctwa_clid: clickId };
    await new Promise((resolve, reject) => db.run(
        `INSERT OR IGNORE INTO whatsapp_messages
            (conversation_id,provider_message_id,phone,direction,message_type,body,raw_payload,created_at)
            VALUES(?,?,?,'incoming','conversion_signal','',?,COALESCE(?,CURRENT_TIMESTAMP))`,
        [conversationId, providerId, normalizePhone(incoming.phone), JSON.stringify(payload), incoming.timestamp || null],
        error => error ? reject(error) : resolve()));
}

async function linkOrderConversation(db, orderId) {
    const all = (sql, params) => new Promise((resolve, reject) => db.all(sql, params,
        (error, rows) => error ? reject(error) : resolve(rows)));
    const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params,
        error => error ? reject(error) : resolve()));
    const [order] = await all(`SELECT o.client_id,o.client_name,
        COALESCE(NULLIF(o.client_phone,''),c.phone) phone FROM orders o
        LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=?`, [orderId]);
    if (!order?.phone) return { linked: false, reason: 'missing_phone' };
    const variants = phoneVariants(order.phone);
    if (!/^\d{10,15}$/.test(variants[0])) return { linked: false, reason: 'invalid_phone' };
    const placeholders = variants.map(() => '?').join(',');
    const matches = await all(`SELECT id FROM whatsapp_conversations WHERE phone IN (${placeholders})`, variants);
    if (matches.length > 1) return { linked: false, reason: 'ambiguous_phone' };
    let conversationId = matches[0]?.id;
    if (!conversationId) {
        // Keep Oryon's existing local convention for Brazilian WhatsApp numbers.
        const phone = variants[variants.length - 1];
        await run(`INSERT OR IGNORE INTO whatsapp_conversations(phone,client_id,client_name) VALUES(?,?,?)`,
            [phone, order.client_id, order.client_name]);
        const [created] = await all('SELECT id FROM whatsapp_conversations WHERE phone=?', [phone]);
        conversationId = created.id;
    }
    await run('INSERT OR IGNORE INTO whatsapp_conversation_orders(conversation_id,order_id) VALUES(?,?)',
        [conversationId, orderId]);
    return { linked: true, conversationId };
}

async function findConversationClick(db, conversationId, phone, eventTime) {
    const rows = await new Promise((resolve, reject) => db.all(
        `SELECT raw_payload FROM whatsapp_messages WHERE conversation_id=? AND direction='incoming'
            AND datetime(created_at) <= datetime(?, 'unixepoch') AND raw_payload LIKE '%ctwa%'
            ORDER BY created_at DESC, id DESC LIMIT 20`,
        [conversationId, eventTime], (error, rows) => error ? reject(error) : resolve(rows)));
    return rows.map(row => extractClickId(row.raw_payload, phone)).find(Boolean) || '';
}

function applyMessaging(event, config, clickId = '') {
    if (!config.messagingDatasetId) return event;
    if (!config.whatsappBusinessAccountId || !config.pageId) throw new Error('missing_messaging_config');
    event.action_source = 'business_messaging';
    event.messaging_channel = 'whatsapp';
    // Contact matching is supported without a click ID, but attribution is not guaranteed.
    event.user_data = clickId
        ? { whatsapp_business_account_id: config.whatsappBusinessAccountId, ctwa_clid: clickId }
        : { ...event.user_data, page_id: config.pageId,
            whatsapp_business_account_id: config.whatsappBusinessAccountId };
    return event;
}

function datasetFor(payload, config) {
    const id = payload.data[0].action_source === 'business_messaging' ? config.messagingDatasetId : config.pixelId;
    if (!id) throw new Error('missing_messaging_config');
    return id;
}

module.exports = { extractClickId, findConversationClick, applyMessaging, datasetFor, recordContactSignal, linkOrderConversation };
