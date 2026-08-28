const DEFAULT_BRAND_NAME = 'Atos Fardamentos';
const DEFAULT_SYSTEM_NAME = 'Atos System';
const DEFAULT_ORDER_PREFIX = 'ATOS';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const readEnv = (key, fallback = '') => {
    const value = import.meta.env[key];
    return String(value || '').trim() || fallback;
};

const normalizePrefix = (value, fallback = DEFAULT_ORDER_PREFIX) => {
    const normalized = String(value || fallback)
        .trim()
        .toUpperCase()
        .replace(/^#/, '')
        .replace(/[^A-Z0-9]/g, '');

    return normalized || fallback;
};

const CONFIGURED_BRAND_NAME = readEnv('VITE_APP_BRAND_NAME', DEFAULT_BRAND_NAME);
const CONFIGURED_SYSTEM_NAME = readEnv('VITE_APP_SYSTEM_NAME', DEFAULT_SYSTEM_NAME);
const CONFIGURED_ORDER_PREFIX = normalizePrefix(readEnv('VITE_APP_ORDER_PREFIX', DEFAULT_ORDER_PREFIX));

const isLocalDevHost = (hostname) => (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
);

export const resolveApiBaseUrl = () => {
    const envUrl = readEnv('VITE_API_BASE_URL');
    if (envUrl) return trimTrailingSlash(envUrl);

    if (typeof window === 'undefined') return 'https://atosfardamentos.com.br/api';

    const { hostname, origin } = window.location;
    if (isLocalDevHost(hostname)) {
        return `http://${hostname || 'localhost'}:3001/api`;
    }

    return `${trimTrailingSlash(origin)}/api`;
};

export const normalizeTrackingCode = (value, prefix = CONFIGURED_ORDER_PREFIX) => {
    let safeCode = String(value || '').trim().toUpperCase();

    if (/^\d+$/.test(safeCode)) {
        safeCode = `#${normalizePrefix(prefix)}-${safeCode}`;
    } else if (!safeCode.startsWith('#')) {
        safeCode = `#${safeCode}`;
    }

    return safeCode;
};

export const appConfig = Object.freeze({
    theme: readEnv('VITE_APP_THEME', 'default').trim().toLowerCase(),
    brandName: CONFIGURED_BRAND_NAME,
    systemName: CONFIGURED_SYSTEM_NAME,
    orderPrefix: CONFIGURED_ORDER_PREFIX,
    supportEmail: readEnv('VITE_APP_SUPPORT_EMAIL', 'atosfardamentos@gmail.com'),
    logoUrl: readEnv('VITE_APP_LOGO_URL', '/logo.png'),
    logoSmallUrl: readEnv('VITE_APP_LOGO_SMALL_URL', '/logo-120.png'),
    logoMediumUrl: readEnv('VITE_APP_LOGO_MEDIUM_URL', '/logo-240.png'),
    logoWhiteUrl: readEnv('VITE_APP_LOGO_WHITE_URL', '/logo-white.png'),
    printLogoUrl: readEnv('VITE_APP_PRINT_LOGO_URL', '/atos_logo.png'),
    apiBaseUrl: resolveApiBaseUrl()
});
