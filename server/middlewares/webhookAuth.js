const crypto = require('crypto');

function getSuppliedWebhookSecret(req) {
    return String(
        req.headers['x-evolution-webhook-secret']
        || req.headers['x-webhook-secret']
        || req.query?.secret
        || req.query?.token
        || ''
    );
}

function isWebhookSecretValid(suppliedSecret, expectedSecret) {
    if (!suppliedSecret || !expectedSecret) return false;

    const supplied = Buffer.from(String(suppliedSecret));
    const expected = Buffer.from(String(expectedSecret));
    if (supplied.length !== expected.length) return false;

    return crypto.timingSafeEqual(supplied, expected);
}

function requireWebhookSecret(req, res, next) {
    const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET;

    if (!expectedSecret) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({ ok: false });
        }

        console.warn('EVOLUTION_WEBHOOK_SECRET não definido. Webhook aceito apenas em ambiente local.');
        return next();
    }

    if (!isWebhookSecretValid(getSuppliedWebhookSecret(req), expectedSecret)) {
        return res.status(403).json({ ok: false });
    }

    next();
}

module.exports = { getSuppliedWebhookSecret, isWebhookSecretValid, requireWebhookSecret };
