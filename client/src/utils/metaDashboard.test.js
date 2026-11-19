import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMetaLeads, purchasePresentation, formatMetaDate } from './metaDashboard.js';

test('lead history searches names and Brazilian phone formats and combines the status filter', () => {
    const records = [{ id: 1, display_name: 'João Silva', phone: '558199990000', status: 'sent' },
        { id: 2, display_name: 'Maria', phone: '558188887777', status: 'review' }];
    assert.deepEqual(filterMetaLeads(records, 'joao').map(item => item.id), [1]);
    assert.deepEqual(filterMetaLeads(records, '(81) 99999-0000', 'sent').map(item => item.id), [1]);
    assert.deepEqual(filterMetaLeads(records, '', 'attention').map(item => item.id), [2]);
    assert.deepEqual(filterMetaLeads(records, 'joao', 'attention'), []);
    assert.deepEqual(filterMetaLeads(records, 'sem resultado'), []);
});

test('purchase statuses give an action and do not present non-ad sales as delivery failures', () => {
    assert.match(purchasePresentation({ status: 'not_meta', last_error: 'non_meta_acquisition' }).detail, /não enviada à Meta/);
    assert.match(purchasePresentation({ status: 'awaiting_source' }).detail, /Edite o pedido/);
    assert.equal(purchasePresentation({ status: 'sent' }).tone, 'success');
    assert.equal(purchasePresentation({ status: 'retry', last_error: 'missing_customer_phone_or_email' }).label, 'Contato incompleto');
    assert.match(purchasePresentation({ status: 'review' }).detail, /antes de reenviar/);
});

test('UTC receipt dates display in Fortaleza, with invalid dates kept explicit', () => {
    assert.match(formatMetaDate('2026-11-19 12:30:00'), /09:30/);
    assert.equal(formatMetaDate('bad-date'), '—');
    assert.equal(formatMetaDate(null), '—');
});
