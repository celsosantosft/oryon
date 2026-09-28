const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('formata evento de dia inteiro com lembretes e identificadores privados', () => {
    const { buildOrderCalendarEvent } = require('../services/orderCalendarSync');
    const event = buildOrderCalendarEvent({
        id: 42,
        tracking_code: '#ATOS-4242',
        client_name: 'Cliente Teste',
        delivery_date: '2026-10-20',
        sizes_json: '{"P":2,"M":3}',
        status: 'Costura Iniciada'
    }, [7, 1, 0], { tenantKey: 'atos', publicAppUrl: 'https://app.test' });
    assert.equal(event.summary, '#ATOS-4242 - Cliente Teste');
    assert.deepEqual(event.start, { date: '2026-10-20' });
    assert.deepEqual(event.end, { date: '2026-10-21' });
    assert.deepEqual(event.reminders.overrides.map(item => item.minutes), [10080, 1440, 0]);
    assert.equal(event.extendedProperties.private.oryonOrderId, '42');
    assert.doesNotMatch(event.description, /token/i);
});

test('nao cria evento para data invalida', () => {
    const { buildOrderCalendarEvent } = require('../services/orderCalendarSync');
    assert.equal(buildOrderCalendarEvent({ id: 1, delivery_date: '' }, [7], { tenantKey: 'atos' }), null);
    assert.equal(buildOrderCalendarEvent({ id: 1, delivery_date: '20/10/2026' }, [7], { tenantKey: 'atos' }), null);
});

test('reconhece estados finais do pedido', () => {
    const { shouldDeleteCalendarEvent } = require('../services/orderCalendarSync');
    assert.equal(shouldDeleteCalendarEvent('Entregue/Concluído'), true);
    assert.equal(shouldDeleteCalendarEvent('Cancelado'), true);
    assert.equal(shouldDeleteCalendarEvent('Costura Iniciada'), false);
});

test('exclusao reconcilia evento remoto mesmo sem event id local', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderCalendarSync.js'), 'utf8');
    assert.match(source, /if \(deleting\)[\s\S]*findOrderEvent\(accessToken, integration\.calendar_id, tenantKey, job\.order_id\)[\s\S]*deleteEvent/);
});
