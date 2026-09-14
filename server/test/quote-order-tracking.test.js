const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();

const {
    buildOrderCodeFromQuoteCode,
    repairLinkedOrderTrackingCodes
} = require('../utils/quoteOrderTracking');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => error ? reject(error) : resolve());
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

test('restores the quote number and preserves the previous order code', async () => {
    const db = new sqlite3.Database(':memory:');
    await run(db, 'CREATE TABLE quotes (id INTEGER PRIMARY KEY, tracking_code TEXT UNIQUE)');
    await run(db, 'CREATE TABLE orders (id INTEGER PRIMARY KEY, tracking_code TEXT UNIQUE, legacy_tracking_code TEXT, quote_id INTEGER)');
    await run(db, "INSERT INTO quotes (id, tracking_code) VALUES (48, '#ORC-9165'), (49, '#ORC-7000'), (50, '#ORC-8000')");
    await run(db, "INSERT INTO orders (id, tracking_code, quote_id) VALUES (118, '#ATOS-6066', 48), (119, '#ATOS-7000', 49), (120, '#ATOS-3333', 50), (121, '#ATOS-8000', NULL)");

    const result = await repairLinkedOrderTrackingCodes(db);
    const orders = await all(db, 'SELECT id, tracking_code, legacy_tracking_code FROM orders ORDER BY id');

    assert.deepEqual(result, { repaired: 1, collisions: 1 });
    assert.deepEqual(orders, [
        { id: 118, tracking_code: '#ATOS-9165', legacy_tracking_code: '#ATOS-6066' },
        { id: 119, tracking_code: '#ATOS-7000', legacy_tracking_code: null },
        { id: 120, tracking_code: '#ATOS-3333', legacy_tracking_code: null },
        { id: 121, tracking_code: '#ATOS-8000', legacy_tracking_code: null }
    ]);
    assert.equal(buildOrderCodeFromQuoteCode('#ORC-9165'), '#ATOS-9165');
    assert.deepEqual(await repairLinkedOrderTrackingCodes(db), { repaired: 0, collisions: 1 });

    await new Promise((resolve) => db.close(resolve));
});
