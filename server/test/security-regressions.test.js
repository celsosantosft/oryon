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
