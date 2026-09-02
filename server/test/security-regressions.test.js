const test = require('node:test');
const assert = require('node:assert/strict');

test('role checks do not treat every gerente subtype as global gerente', () => {
    const { roleIsAllowed } = require('../middlewares/auth');

    assert.equal(roleIsAllowed('gerente_producao', ['gerente']), false);
    assert.equal(roleIsAllowed('gerente_vendas', ['gerente_vendas']), true);
});

test('webhook secret validation accepts only the configured shared secret', () => {
    const { isWebhookSecretValid } = require('../middlewares/webhookAuth');

    assert.equal(isWebhookSecretValid('segredo-correto', 'segredo-correto'), true);
    assert.equal(isWebhookSecretValid('segredo-errado', 'segredo-correto'), false);
    assert.equal(isWebhookSecretValid('', 'segredo-correto'), false);
});

test('layout upload filter rejects active web content', () => {
    const { isAllowedLayoutUpload } = require('../utils/layoutUpload');

    assert.equal(isAllowedLayoutUpload({ originalname: 'layout.png', mimetype: 'image/png' }), true);
    assert.equal(isAllowedLayoutUpload({ originalname: 'orcamento.html', mimetype: 'text/html' }), false);
    assert.equal(isAllowedLayoutUpload({ originalname: 'vetor.svg', mimetype: 'image/svg+xml' }), false);
});

test('portal tracking requires the private portal token', () => {
    const ordersRouter = require('../routes/orders');
    const { requirePortalToken } = ordersRouter._security;

    const makeResponse = () => ({
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    });

    const missingTokenResponse = makeResponse();
    assert.equal(requirePortalToken({ portal_token: 'secret-token' }, { query: {}, headers: {}, body: {} }, missingTokenResponse), false);
    assert.equal(missingTokenResponse.statusCode, 403);

    const validTokenResponse = makeResponse();
    assert.equal(requirePortalToken({ portal_token: 'secret-token' }, { query: { token: 'secret-token' }, headers: {}, body: {} }, validTokenResponse), true);
});

test('quote conversion keeps the numeric tracking code for the new order', () => {
    const quotesRouter = require('../routes/quotes');

    assert.equal(quotesRouter._test.buildOrderCodeFromQuoteCode('#ORC-7400'), '#ATOS-7400');
});
