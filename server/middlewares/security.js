const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const DEFAULT_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_MAX_ATTEMPTS = 10;

function readPositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function applyHttpSecurity(app, options = {}) {
    const loginWindowMs = readPositiveInteger(
        options.loginWindowMs ?? process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
        DEFAULT_LOGIN_WINDOW_MS
    );
    const loginMaxAttempts = readPositiveInteger(
        options.loginMaxAttempts ?? process.env.LOGIN_RATE_LIMIT_MAX,
        DEFAULT_LOGIN_MAX_ATTEMPTS
    );

    app.set('trust proxy', 'loopback');
    app.use(helmet());
    app.post('/api/login', rateLimit({
        windowMs: loginWindowMs,
        limit: loginMaxAttempts,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        handler: (req, res) => {
            res.status(429).json({
                message: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
            });
        }
    }));
}

module.exports = { applyHttpSecurity };
