const { loadEnv } = require('./env');

loadEnv();

function readConfig(keys, fallback = '') {
    for (const key of keys) {
        const value = process.env[key];
        if (String(value || '').trim()) return String(value).trim();
    }

    return fallback;
}

function normalizeUrl(value, fallback = '') {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function normalizePrefix(value, fallback = 'ATOS') {
    const normalized = String(value || fallback)
        .trim()
        .toUpperCase()
        .replace(/^#/, '')
        .replace(/[^A-Z0-9]/g, '');

    return normalized || fallback;
}

const appConfig = Object.freeze({
    port: Number(readConfig(['PORT', 'APP_PORT'], '3001')) || 3001,
    brandName: readConfig(['APP_BRAND_NAME', 'BRAND_NAME'], 'Atos Fardamentos'),
    systemName: readConfig(['APP_SYSTEM_NAME', 'SYSTEM_NAME'], 'Atos System'),
    adminName: readConfig(['ADMIN_NAME', 'APP_ADMIN_NAME'], 'Administrador atos'),
    orderPrefix: normalizePrefix(readConfig(['APP_ORDER_PREFIX', 'ORDER_PREFIX'], 'ATOS')),
    quotePrefix: normalizePrefix(readConfig(['APP_QUOTE_PREFIX', 'QUOTE_PREFIX'], 'ORC'), 'ORC'),
    supportEmail: readConfig(['APP_SUPPORT_EMAIL', 'SUPPORT_EMAIL'], 'atosfardamentos@gmail.com'),
    metaLeadSource: readConfig(['APP_META_LEAD_SOURCE', 'META_LEAD_SOURCE'], 'Oryon CRM'),
    publicAppUrl: normalizeUrl(readConfig(['PUBLIC_APP_URL', 'APP_PUBLIC_URL'], 'https://atosfardamentos.com.br'))
});

function buildTrackingCode(prefix = appConfig.orderPrefix) {
    return `#${normalizePrefix(prefix)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizeTrackingCode(value, prefix = appConfig.orderPrefix) {
    let safeCode = String(value || '').trim().toUpperCase();

    try {
        safeCode = decodeURIComponent(safeCode).trim().toUpperCase();
    } catch {
        // Mantem o valor original se vier com encoding invalido.
    }

    if (/^\d+$/.test(safeCode)) return `#${normalizePrefix(prefix)}-${safeCode}`;
    if (!safeCode.startsWith('#')) return `#${safeCode}`;

    return safeCode;
}

module.exports = {
    appConfig,
    buildTrackingCode,
    normalizeTrackingCode,
    normalizePrefix,
    normalizeUrl
};
