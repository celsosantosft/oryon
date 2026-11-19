const { findConversationClick, phoneVariants } = require('./metaMessaging');

const SOURCES = new Set(['unknown', 'meta_ads', 'social_organic', 'referral', 'returning_customer', 'store_other']);
function normalizeSource(value) {
    const source = value === undefined || value === null || value === '' ? 'unknown' : value;
    if (typeof source !== 'string' || !SOURCES.has(source)) throw new Error('invalid_acquisition_source');
    return source;
}

async function resolveOrderSource(db, phone, selected, now = Math.floor(Date.now() / 1000)) {
    const source = normalizeSource(selected);
    if (source !== 'unknown' || !phone) return source;
    const variants = phoneVariants(phone);
    const rows = await new Promise((resolve, reject) => db.all(
        `SELECT id,phone FROM whatsapp_conversations WHERE phone IN (${variants.map(() => '?').join(',')})`,
        variants, (error, rows) => error ? reject(error) : resolve(rows)));
    if (rows.length !== 1) return 'unknown';
    // Conservative CRM inference: a real click in the preceding seven days, never a phone match alone.
    const click = await findConversationClick(db, rows[0].id, rows[0].phone, now, now - 7 * 86400);
    return click ? 'meta_ads' : 'unknown';
}

module.exports = { normalizeSource, resolveOrderSource };
