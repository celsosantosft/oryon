const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('formata evento as 07h com cliente primeiro e link direto para o portal', () => {
    const { buildOrderCalendarEvent } = require('../services/orderCalendarSync');
    const event = buildOrderCalendarEvent({
        id: 42,
        tracking_code: '#ATOS-4242',
        client_name: 'Cliente Teste',
        delivery_date: '2026-10-20',
        portal_token: 'token-seguro',
        sizes_json: '{"P":2,"M":3}',
        status: 'Costura Iniciada'
    }, [7, 1, 0], { tenantKey: 'atos', publicAppUrl: 'https://app.test' });
    assert.equal(event.summary, 'Cliente Teste - #ATOS-4242');
    assert.deepEqual(event.start, { dateTime: '2026-10-20T07:00:00', timeZone: 'America/Sao_Paulo' });
    assert.deepEqual(event.end, { dateTime: '2026-10-20T08:00:00', timeZone: 'America/Sao_Paulo' });
    assert.deepEqual(event.reminders.overrides.map(item => item.minutes), [10080, 1440, 0]);
    assert.equal(event.extendedProperties.private.oryonOrderId, '42');
    assert.match(event.description, /Abrir no sistema: https:\/\/app\.test\/portal\/%23ATOS-4242\?token=token-seguro/);
    assert.doesNotMatch(event.description, /Abrir no Oryon|\/orders/);
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
