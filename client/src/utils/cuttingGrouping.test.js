import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingFabricTabs } from './cuttingGrouping.js';

test('groups fabric variations into one fabric tab and separates modelings inside it', () => {
    const tabs = buildCuttingFabricTabs([
        {
            id_pedido: 1,
            tracking_code: '#ATOS-1',
            cliente: 'Escola Alfa',
            delivery_date: '2026-09-01',
            produtos: [
                {
                    nome_produto: 'Camisa Tradicional',
                    tecido: 'Dryfit Premium Azul',
                    grade: { M: 10 }
                }
            ]
        },
        {
            id_pedido: 2,
            tracking_code: '#ATOS-2',
            cliente: 'Time Beta',
            delivery_date: '2026-08-31',
            produtos: [
                {
                    nome_produto: 'Camisa Raglan',
                    tecido: 'Dryfit Branco 140g',
                    grade: { G: 5 }
                }
            ]
        },
        {
            id_pedido: 3,
            tracking_code: '#ATOS-3',
            cliente: 'Academia Delta',
            produtos: [
                {
                    nome_produto: 'Short',
                    tecido: 'Dryfit',
                    grade: { P: 3 }
                }
            ]
        }
    ]);

    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].label, 'Dryfit');
    assert.deepEqual(tabs[0].modelings.map((group) => group.label), ['Camisa', 'Camisa Raglan', 'Short']);
    assert.deepEqual(tabs[0].modelings[0].gradeTotals, [{ tamanho: 'P', quantidade: 0 }, { tamanho: 'M', quantidade: 10 }, { tamanho: 'G', quantidade: 0 }]);
    assert.equal(tabs[0].modelings[1].orders[0].tracking_code, '#ATOS-2');
});
