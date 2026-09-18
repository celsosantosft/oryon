import test from 'node:test';
import assert from 'node:assert/strict';

import { printOrder } from './printUtils.js';

const renderPrintHtml = (order) => {
    let html = '';
    const previousWindow = globalThis.window;

    globalThis.window = {
        location: { origin: 'https://atosfardamentos.com.br' },
        open: () => ({
            document: {
                write: (content) => { html = content; },
                close: () => {}
            }
        })
    };

    try {
        printOrder(order, 'https://atosfardamentos.com.br/api');
        return html;
    } finally {
        globalThis.window = previousWindow;
    }
};

const changedOrder = {
    tracking_code: '#ATOS-9762',
    client_name: 'BORJA - ESCOLA JOAO FONSECA',
    delivery_date: '2026-10-20',
    product_lines: [{
        product_type: 'CAMISA BASICA',
        fabric_type: 'Helanca Light',
        sizes_json: {
            PP: 5,
            P: 1,
            M: 3,
            G: 2,
            XG: 1,
            '14 ANOS': 15,
            '12 ANOS': 4
        }
    }],
    items: [
        { player_name: 'DUDEX', player_number: '16', size: 'G' },
        { player_name: 'LARISSA', player_number: '10', size: 'G' },
        { player_name: 'PROF CLECIO', player_number: '67', size: 'XG' }
    ]
};

test('prints every current size label submitted by the customer', () => {
    const html = renderPrintHtml(changedOrder);

    assert.match(html, />14 ANOS</);
    assert.match(html, />12 ANOS</);
    assert.match(html, /<td class="total-col">31<\/td>/);
});

test('prints the current customer list with names and numbers', () => {
    const html = renderPrintHtml(changedOrder);

    assert.match(html, /DUDEX/);
    assert.match(html, /PROF CLECIO/);
    assert.match(html, />16</);
    assert.match(html, />67</);
});

test('places the compact customer list below the layout and groups entries by size', () => {
    const html = renderPrintHtml(changedOrder);
    const layoutPosition = html.indexOf('LAYOUTS DO PEDIDO');
    const listPosition = html.indexOf('NOMES E NÚMEROS POR TAMANHO');
    const gGroup = html.match(/<section class="customer-size-group" data-size="G">[\s\S]*?<\/section>/)?.[0] || '';

    assert.ok(layoutPosition >= 0 && layoutPosition < listPosition);
    assert.match(html, /class="customer-groups"/);
    assert.match(gGroup, /DUDEX/);
    assert.match(gGroup, /LARISSA/);
    assert.match(gGroup, />16</);
    assert.match(gGroup, />10</);
    assert.doesNotMatch(gGroup, /PROF CLECIO/);
});
