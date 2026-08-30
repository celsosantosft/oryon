const test = require('node:test');
const assert = require('node:assert/strict');

test('security middleware factory exposes helmet and rate limit middleware', () => {
    const { createSecurityMiddleware } = require('../middlewares/security');
    const middleware = createSecurityMiddleware();

    assert.equal(Array.isArray(middleware), true);
    assert.equal(middleware.length, 2);
    assert.equal(typeof middleware[0], 'function');
    assert.equal(typeof middleware[1], 'function');
});

test('rate limit can be configured from environment', () => {
    const { resolveRateLimitConfig } = require('../middlewares/security');
    const config = resolveRateLimitConfig({
        RATE_LIMIT_WINDOW_MS: '120000',
        RATE_LIMIT_MAX: '25'
    });

    assert.equal(config.windowMs, 120000);
    assert.equal(config.max, 25);
});

test('trust proxy defaults to one reverse proxy', () => {
    const { resolveTrustProxyConfig } = require('../middlewares/security');

    assert.equal(resolveTrustProxyConfig({}), 1);
    assert.equal(resolveTrustProxyConfig({ TRUST_PROXY: 'false' }), false);
    assert.equal(resolveTrustProxyConfig({ TRUST_PROXY: '2' }), 2);
});
