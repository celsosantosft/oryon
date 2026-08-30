const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

function readPositiveInteger(env, key, fallback) {
    const value = Number(env[key]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveRateLimitConfig(env = process.env) {
    return {
        windowMs: readPositiveInteger(env, 'RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        max: readPositiveInteger(env, 'RATE_LIMIT_MAX', 300)
    };
}

function resolveTrustProxyConfig(env = process.env) {
    const value = String(env.TRUST_PROXY || '1').trim().toLowerCase();

    if (value === 'true') return true;
    if (value === 'false') return false;

    return readPositiveInteger({ TRUST_PROXY: value }, 'TRUST_PROXY', 1);
}

function createSecurityMiddleware(env = process.env) {
    const rateLimitConfig = resolveRateLimitConfig(env);

    return [
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' }
        }),
        rateLimit({
            ...rateLimitConfig,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Muitas requisições. Tente novamente em instantes.' }
        })
    ];
}

module.exports = {
    createSecurityMiddleware,
    resolveRateLimitConfig,
    resolveTrustProxyConfig
};
