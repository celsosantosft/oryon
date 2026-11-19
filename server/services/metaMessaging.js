// Meta's messaging dataset must be linked to the WABA in Events Manager.
// Never substitute a phone, ad ID or source URL for a real ctwa_clid.
function normalizePhone(value) {
    let digits = String(value || '').split('@')[0].replace(/\D/g, '');
    if ([10, 11].includes(digits.length)) digits = '55' + digits;
    return digits;
}

function extractClickId(raw, phone) {
    let root;
    try { root = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return ''; }
    const expected = normalizePhone(phone);
    function visit(node, depth = 0) {
        if (!node || typeof node !== 'object' || depth > 10) return '';
        if (Array.isArray(node)) return node.map(item => visit(item, depth + 1)).find(Boolean) || '';
        const sender = node.key?.remoteJid || node.from || node.remoteJid;
        if (node.key?.fromMe || (sender && normalizePhone(sender) !== expected)) return '';
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

module.exports = { extractClickId, findConversationClick, applyMessaging, datasetFor };
