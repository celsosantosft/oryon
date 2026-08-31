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
    assert.deepEqual(tabs[0].modelings[0].gradeTotals, [{ tamanho: 'M', quantidade: 10 }]);
    assert.equal(tabs[0].modelings[1].orders[0].tracking_code, '#ATOS-2');
});

test('creates only tabs for fabrics with real active orders', () => {
    const tabs = buildCuttingFabricTabs([
        {
            id_pedido: 10,
            tracking_code: '#ATOS-10',
            cliente: 'Cliente Dryfit',
            produtos: [
                { nome_produto: 'Camisa', tecido: 'Dryfit com Elastano Azul', grade: { M: 2 } }
            ]
        },
        {
            id_pedido: 11,
            tracking_code: '#ATOS-11',
            cliente: 'Cliente Helanca',
            produtos: [
                { nome_produto: 'Regata', tecido: 'Helanca Light Branca', grade: { P: 4 } }
            ]
        }
    ]);

    assert.deepEqual(tabs.map((tab) => tab.label), ['Dryfit', 'Helanca']);
});

test('keeps each card tied to its real order id and sorts urgent then nearest deadline', () => {
    const tabs = buildCuttingFabricTabs([
        {
            id_pedido: 21,
            tracking_code: '#ATOS-21',
            cliente: 'Normal distante',
            delivery_date: '2026-09-20',
            priority: 'normal',
            produtos: [
                { nome_produto: 'Camisa', tecido: 'Dryfit', grade: { M: 1 } }
            ]
        },
        {
            id_pedido: 22,
            tracking_code: '#ATOS-22',
            cliente: 'Urgente distante',
            delivery_date: '2026-09-30',
            priority: 'high',
            produtos: [
                { nome_produto: 'Camisa', tecido: 'Dryfit Premium', grade: { M: 1 } }
            ]
        },
        {
            id_pedido: 23,
            tracking_code: '#ATOS-23',
            cliente: 'Normal perto',
            delivery_date: '2026-09-01',
            priority: 'normal',
            produtos: [
                { nome_produto: 'Camisa', tecido: 'Dryfit Branco', grade: { M: 1 } }
            ]
        }
    ]);

    const orders = tabs[0].modelings[0].orders;

    assert.deepEqual(orders.map((order) => order.id_pedido), [22, 23, 21]);
    assert.deepEqual(orders.map((order) => order.tracking_code), ['#ATOS-22', '#ATOS-23', '#ATOS-21']);
});

test('keeps real production orders visible when grade is not informed yet', () => {
    const tabs = buildCuttingFabricTabs([
        {
            id_pedido: 30,
            tracking_code: '#ATOS-30',
            cliente: 'Cliente Regata',
            delivery_date: '2026-09-01',
            produtos: [
                {
                    nome_produto: 'REGATA MACHÃO - GOLA V',
                    tecido: 'Dryfit',
                    grade: {}
                }
            ]
        }
    ]);

    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].label, 'Dryfit');
    assert.equal(tabs[0].modelings[0].label, 'Regata');
    assert.equal(tabs[0].modelings[0].orders[0].id_pedido, 30);
    assert.equal(tabs[0].modelings[0].orders[0].totalPieces, 0);
});
