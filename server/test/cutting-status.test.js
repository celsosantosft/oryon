const test = require('node:test');
const assert = require('node:assert/strict');

test('cutting queue only accepts orders that still belong to cutting', () => {
    const corteRouter = require('../routes/corte');
    const { isActiveCuttingStatus } = corteRouter._test;

    assert.equal(isActiveCuttingStatus('Arte Aprovada/Liberada'), true);
    assert.equal(isActiveCuttingStatus('Corte Iniciado'), true);
    assert.equal(isActiveCuttingStatus('Impressão/Estampa Iniciada'), false);
    assert.equal(isActiveCuttingStatus('Costura Iniciada'), false);
});
