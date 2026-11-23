import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildClientJpgPages, printOrder, shareClientJpg } from './printUtils.js';

const printUtilsSource = readFileSync(new URL('./printUtils.js', import.meta.url), 'utf8');

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
        amount_paid: 400,
        synced_amount_paid: 450,
        product_lines: [
            { ...changedOrder.product_lines[0], total_price: 700 },
            { product_type: 'Bandeirão', fabric_type: 'Oxford', sizes_json: { ESP: 1 }, total_price: 280 }
        ]
    }, 'https://atosfardamentos.com.br/api');

    assert.equal(pages.length, 3);
    assert.deepEqual(pages.map(({ width, height }) => [width, height]), [[1080, 1350], [1080, 1350], [1080, 1350]]);
    assert.equal(pages[0].documentLabel, 'PEDIDO');
    assert.equal(pages[0].clientName, 'BORJA - ESCOLA JOAO FONSECA');
    assert.equal(pages[0].total, 700);
    assert.equal(pages[1].kind, 'names');
    assert.equal(pages[1].totalNames, 3);
    assert.equal(pages[1].fileName, 'pedido-ATOS-9762-nomes.jpg');
    assert.equal(pages[2].total, 280);
    assert.equal(pages[0].amountPaid, 450);
    assert.equal(pages[2].amountPaid, 450);
    assert.match(pages[0].fileName, /^pedido-ATOS-9762-1\.jpg$/);
    assert.equal(pages[2].line.product_type, 'Bandeirão');
});

test('puts one ordered nominal list in the second shared image', () => {
    const pages = buildClientJpgPages({
        ...changedOrder,
        items: [
            { player_name: 'ADOLESCENTE', player_number: '14', size: '14 ANOS' },
            { player_name: 'ADULTO M', player_number: '8', size: 'M' },
            { player_name: 'CRIANÇA', player_number: '2', size: '2' },
            { player_name: 'ADULTO PP', player_number: '1', size: 'PP' }
        ]
    }, 'https://atosfardamentos.com.br/api');
    const namesPage = pages[1];

    assert.equal(namesPage.kind, 'names');
    assert.deepEqual(namesPage.nominalSections.map(({ label, range }) => [label, range]), [
        ['INFANTIL', '2 A 14 ANOS'],
        ['ADULTO', 'PP AO XXG']
    ]);
    assert.deepEqual(namesPage.nominalSections[0].items.map(({ size }) => size), ['2 ANOS', '14 ANOS']);
    assert.deepEqual(namesPage.nominalSections[1].items.map(({ size }) => size), ['PP', 'M']);
});

test('labels quote images and filenames as orçamento', () => {
    const [page] = buildClientJpgPages({ ...changedOrder, tracking_code: '#ORC-6435' }, 'https://atosfardamentos.com.br/api');

    assert.equal(page.documentLabel, 'ORÇAMENTO');
    assert.equal(page.fileName, 'orcamento-ORC-6435.jpg');
});

test('shares client images without silently downloading them', () => {
    assert.match(printUtilsSource, /navigator\.share\(\{/);
    assert.match(printUtilsSource, /SHARE_UNSUPPORTED/);
    assert.doesNotMatch(printUtilsSource, /link\.download/);
    assert.doesNotMatch(printUtilsSource, /imagem 1080 × 1350 px/);
    assert.doesNotMatch(printUtilsSource, /page\.pageCount/);
    assert.match(printUtilsSource, /prepareOnly \? prepared : shareClientJpg\(prepared\)/);
});

test('shares already prepared files from the explicit user action', async () => {
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let sharedPayload;
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            canShare: () => true,
            share: async (payload) => { sharedPayload = payload; }
        }
    });

    try {
        const prepared = { files: [{ name: 'pedido.jpg' }], title: 'Pedido', text: 'Cliente', count: 1 };
        const result = await shareClientJpg(prepared);
        assert.equal(result.mode, 'shared');
        assert.deepEqual(sharedPayload, { files: prepared.files, title: 'Pedido', text: 'Cliente' });
    } finally {
        if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
        else delete globalThis.navigator;
    }
});
