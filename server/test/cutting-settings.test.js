const test = require('node:test');
const assert = require('node:assert/strict');

const corteRouter = require('../routes/corte');

test('cutting settings expose independent payload validation for table and fabric', () => {
    assert.equal(typeof corteRouter._test.parseCuttingTablePayload, 'function');
    assert.equal(typeof corteRouter._test.parseCuttingFabricPayload, 'function');
});

test('normalizes a valid fabric measurement in centimeters', () => {
    const result = corteRouter._test.parseCuttingFabricPayload({
        malha_nome: '  DryFit Furadinho  ',
        malha_largura_cm: '165,5'
    });

    assert.deepEqual(result, {
        malha_key: 'dryfit furadinho',
        malha_nome: 'DryFit Furadinho',
        malha_largura_cm: 165.5
    });
});

test('normalizes valid table measurements in centimeters', () => {
    assert.deepEqual(corteRouter._test.parseCuttingTablePayload({
        mesa_largura_cm: '180',
        mesa_comprimento_cm: 280
    }), {
        mesa_largura_cm: 180,
        mesa_comprimento_cm: 280
    });
});

test('rejects unsafe or incomplete cutting measurements', () => {
    assert.throws(() => corteRouter._test.parseCuttingFabricPayload({
        malha_nome: 'Algodão',
        malha_largura_cm: 0
    }), /largura da malha/i);

    assert.throws(() => corteRouter._test.parseCuttingFabricPayload({
        malha_nome: '',
        malha_largura_cm: 160
    }), /malha/i);

    assert.throws(() => corteRouter._test.parseCuttingTablePayload({
        mesa_largura_cm: 180,
        mesa_comprimento_cm: ''
    }), /comprimento da mesa/i);
});
