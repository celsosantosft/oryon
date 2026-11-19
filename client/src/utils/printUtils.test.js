import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClientJpgPages, printOrder } from './printUtils.js';

const renderPrintDocument = (order, options) => {
    let html = '';
    let onLoad;
    let onClick;
    let prints = 0;
    const previousWindow = globalThis.window;
    const button = {
        disabled: true,
        addEventListener: (_, handler) => { onClick = handler; }
    };
    const printWindow = {
        document: {
            open: () => {},
            write: (content) => { html = content; },
            getElementById: () => button,
            close: () => {}
        },
        addEventListener: (_, handler) => { onLoad = handler; },
        print: () => { prints++; }
    };

    globalThis.window = {
        location: { origin: 'https://atosfardamentos.com.br' }
    };

    try {
        printOrder(order, 'https://atosfardamentos.com.br/api', printWindow, options);
        return { html, button, onLoad, onClick, printCount: () => prints };
    } finally {
        globalThis.window = previousWindow;
    }
};

const renderPrintHtml = (order) => renderPrintDocument(order).html;

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

test('waits for the mobile print button and keeps automatic printing on desktop', () => {
    const mobile = renderPrintDocument(changedOrder, { autoPrint: false });
    assert.match(mobile.html, /Imprimir ou salvar PDF/);
    assert.equal(mobile.button.disabled, true);
    mobile.onLoad();
    assert.equal(mobile.button.disabled, false);
    assert.equal(mobile.printCount(), 0);
    mobile.onClick();
    assert.equal(mobile.printCount(), 1);

    const desktop = renderPrintDocument(changedOrder);
    desktop.onLoad();
    assert.equal(desktop.printCount(), 1);
});

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

test('builds one 1080 by 1350 client image per product', () => {
    const pages = buildClientJpgPages({
        ...changedOrder,
        total_price: 980,
        product_lines: [
            { ...changedOrder.product_lines[0], total_price: 700 },
            { product_type: 'Bandeirão', fabric_type: 'Oxford', sizes_json: { ESP: 1 }, total_price: 280 }
        ]
    }, 'https://atosfardamentos.com.br/api');

    assert.equal(pages.length, 2);
    assert.deepEqual(pages.map(({ width, height }) => [width, height]), [[1080, 1350], [1080, 1350]]);
    assert.equal(pages[0].documentLabel, 'PEDIDO');
    assert.equal(pages[0].total, 980);
    assert.match(pages[0].fileName, /^pedido-ATOS-9762-1\.jpg$/);
    assert.equal(pages[1].line.product_type, 'Bandeirão');
});

test('labels quote images and filenames as orçamento', () => {
    const [page] = buildClientJpgPages({ ...changedOrder, tracking_code: '#ORC-6435' }, 'https://atosfardamentos.com.br/api');

    assert.equal(page.documentLabel, 'ORÇAMENTO');
    assert.equal(page.fileName, 'orcamento-ORC-6435.jpg');
});
