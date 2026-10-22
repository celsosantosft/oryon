const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { createMetaPurchaseSync } = require('../services/metaPurchaseSync');

async function fixture(t, { seed, post } = {}) {
    const db = new sqlite3.Database(':memory:');
    const exec = sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
    const all = sql => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
    t.after(() => new Promise(resolve => db.close(resolve)));
    await exec(`CREATE TABLE clients(id INTEGER PRIMARY KEY,phone TEXT,email TEXT);
        CREATE TABLE orders(id INTEGER PRIMARY KEY,client_id INTEGER,client_phone TEXT,
            status TEXT DEFAULT 'Criação de Arte',total_price REAL,amount_paid REAL DEFAULT 0);
        CREATE TABLE transactions(id INTEGER PRIMARY KEY,order_id INTEGER,type TEXT,status TEXT,amount REAL);
        INSERT INTO clients VALUES(1,'85999999999','comprador@example.com');`);
    if (seed) await exec(seed);
    let clock = Math.floor(Date.now() / 1000);
    const calls = [];
    const config = { pixelId: 'test-pixel', accessToken: 'secret-test-token', graphVersion: 'v26.0', defaultCountryCode: '55' };
    const options = { db, config, tenantKey: 'test', now: () => clock, post: async (...args) => {
        calls.push(structuredClone(args));
        return post ? post(...args) : { data: { events_received: 1, messages: [] } };
    } };
    const sync = createMetaPurchaseSync(options);
    await sync.initialize();
    return { db, exec, all, calls, config, sync, options, advance: seconds => { clock += seconds; } };
}

test('first deposit sends full order value as Purchase, not Lead or deposit amount', async t => {
    const f = await fixture(t);
    await f.exec('INSERT INTO orders(id,client_id,total_price) VALUES(1,1,1000);');
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
    await f.exec('UPDATE orders SET amount_paid=200 WHERE id=1;');
    await f.sync.processDue();
    assert.equal(f.calls.length, 1);
    const event = f.calls[0][1].data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.action_source, 'chat');
    assert.deepEqual(event.custom_data, { currency: 'BRL', value: 1000, order_id: '1' });
    assert.equal(event.event_id, 'test:order:1:purchase');
    assert.equal(event.user_data.ph[0].length, 64);
    assert.equal(event.user_data.em[0].length, 64);
    assert.equal((await f.all('SELECT status FROM meta_purchase_events'))[0].status, 'sent');
});

test('order created with deposit sends once, installments and finance reconciliation do not duplicate', async t => {
    const f = await fixture(t);
    await f.exec(`INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);
        INSERT INTO transactions VALUES(1,1,'Receita','Pago',200);
        UPDATE orders SET amount_paid=1000 WHERE id=1;
        INSERT INTO transactions VALUES(2,1,'Receita','Pago',800);`);
    await f.sync.processDue();
    await f.sync.processDue();
    assert.equal(f.calls.length, 1);
});

test('partial financial settlement queues purchase even when order amount_paid stays zero', async t => {
    const f = await fixture(t);
    await f.exec(`INSERT INTO orders(id,client_id,total_price) VALUES(1,1,1000);
        INSERT INTO transactions VALUES(1,1,'Receita','Pendente',1000);
        UPDATE transactions SET status='Pago',amount=200 WHERE id=1;
        INSERT INTO transactions VALUES(2,1,'Receita','Pendente',800);`);
    await f.sync.processDue();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][1].data[0].custom_data.value, 1000);
});

test('historical paid orders are excluded across restarts, including financial-only payments', async t => {
    const f = await fixture(t, { seed: `INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200),(2,1,500,0);
        INSERT INTO transactions VALUES(1,2,'Receita','Pago',100);` });
    const restarted = createMetaPurchaseSync(f.options);
    await restarted.initialize();
    await f.exec('UPDATE orders SET amount_paid=1000 WHERE id IN (1,2);');
    await restarted.processDue();
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await f.all('SELECT status FROM meta_purchase_events'), [{ status: 'historical' }, { status: 'historical' }]);
});

test('same customer can make two purchases with different stable event IDs', async t => {
    const f = await fixture(t);
    await f.exec('INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200),(2,1,300,100);');
    await f.sync.processDue();
    assert.equal(f.calls.length, 2);
    assert.notEqual(f.calls[0][1].data[0].event_id, f.calls[1][1].data[0].event_id);
});

test('payment rollback also rolls back the queued event', async t => {
    const f = await fixture(t);
    await f.exec(`INSERT INTO orders(id,client_id,total_price) VALUES(1,1,1000);
        BEGIN; UPDATE orders SET amount_paid=200 WHERE id=1; ROLLBACK;`);
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
    assert.equal((await f.all('SELECT * FROM meta_purchase_events')).length, 0);
});

test('expenses, pending receipts and cancelled orders are never purchases', async t => {
    const f = await fixture(t);
    await f.exec(`INSERT INTO orders(id,client_id,total_price) VALUES(1,1,1000);
        INSERT INTO transactions VALUES(1,1,'Despesa','Pago',100),(2,1,'Receita','Pendente',200);
        INSERT INTO orders(id,client_id,total_price,amount_paid,status) VALUES(2,1,1000,200,'Cancelado');
        INSERT INTO transactions VALUES(3,2,'Receita','Pago',200);`);
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
});

test('cancellation or reversed payment before dispatch suppresses purchase', async t => {
    const f = await fixture(t);
    await f.exec(`INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200),(2,1,500,100);
        UPDATE orders SET status='Cancelado' WHERE id=1;
        UPDATE orders SET amount_paid=0 WHERE id=2;`);
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
    assert.deepEqual(await f.all('SELECT status FROM meta_purchase_events'), [{ status: 'cancelled' }, { status: 'cancelled' }]);
});

test('timeout retry survives restart and preserves exact payload, time and ID', async t => {
    let first = true;
    const f = await fixture(t, { post: async () => {
        if (first) { first = false; throw new Error('timeout with secret-test-token'); }
        return { data: { events_received: 1 } };
    } });
    await f.exec('INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);');
    await f.sync.processDue();
    assert.equal((await f.all('SELECT status FROM meta_purchase_events'))[0].status, 'retry');
    const restarted = createMetaPurchaseSync(f.options);
    await restarted.initialize();
    await f.exec("UPDATE clients SET phone='85988888888' WHERE id=1; UPDATE orders SET total_price=2000 WHERE id=1;");
    f.advance(60);
    await restarted.processDue();
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.calls[0][1], f.calls[1][1]);
    const row = (await f.all('SELECT * FROM meta_purchase_events'))[0];
    assert.equal(row.status, 'sent');
    assert.doesNotMatch(JSON.stringify(row), /secret-test-token/);
});

test('missing contact waits for correction, zero purchase value is never sent', async t => {
    const f = await fixture(t);
    await f.exec('INSERT INTO orders(id,total_price,amount_paid) VALUES(1,1000,200); INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(2,1,0,200);');
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
    assert.deepEqual((await f.all('SELECT last_error FROM meta_purchase_events ORDER BY order_id')).map(r => r.last_error),
        ['missing_customer_phone_or_email', 'invalid_purchase_value']);
    await f.exec('UPDATE orders SET client_id=1 WHERE id=1;');
    f.advance(60);
    await f.sync.processDue();
    assert.equal(f.calls.length, 1);
    await f.exec('UPDATE orders SET total_price=500 WHERE id=2;');
    f.advance(120);
    await f.sync.processDue();
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1][1].data[0].custom_data.value, 500);
});

test('expired events are not given a new date to force acceptance', async t => {
    const f = await fixture(t);
    await f.exec('INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);');
    f.advance(8 * 86400);
    await f.sync.processDue();
    assert.equal(f.calls.length, 0);
    assert.equal((await f.all('SELECT status FROM meta_purchase_events'))[0].status, 'expired');
});

test('API success without explicit event receipt remains retryable', async t => {
    const f = await fixture(t, { post: async () => ({ data: { events_received: 0 } }) });
    await f.exec('INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);');
    await f.sync.processDue();
    assert.equal((await f.all('SELECT status FROM meta_purchase_events'))[0].status, 'retry');
});

test('concurrent processors claim each job only once', async t => {
    const f = await fixture(t);
    const other = createMetaPurchaseSync(f.options);
    await other.initialize();
    await f.exec('INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);');
    await Promise.all([f.sync.processDue(), other.processDue()]);
    assert.equal(f.calls.length, 1);
});

test('Brazil DDD 55 is not mistaken for an existing international prefix', async t => {
    const f = await fixture(t);
    await f.exec("UPDATE clients SET phone='55999999999',email=NULL WHERE id=1; INSERT INTO orders(id,client_id,total_price,amount_paid) VALUES(1,1,1000,200);");
    await f.sync.processDue();
    const hash = require('crypto').createHash('sha256').update('5555999999999').digest('hex');
    assert.deepEqual(f.calls[0][1].data[0].user_data.ph, [hash]);
});
