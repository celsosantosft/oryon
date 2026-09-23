const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();

const { syncConvertedOrdersFromQuote } = require('../utils/convertedOrderSync');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => error ? reject(error) : resolve());
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function sync(db, quoteId, values) {
    return new Promise((resolve, reject) => {
        syncConvertedOrdersFromQuote(db, quoteId, values, (error, orderIds) => {
            if (error) reject(error);
            else resolve(orderIds);
        });
    });
}

test('updates the grade and value of an order linked to an edited quote', async () => {
    const db = new sqlite3.Database(':memory:');
    await run(db, `CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        quote_id INTEGER,
        sizes_json TEXT,
        unit_price REAL,
        unit_cost REAL,
        total_price REAL,
        cost_price REAL,
        amount_paid REAL DEFAULT 0
    )`);
    await run(db, `CREATE TABLE order_product_lines (
        id INTEGER PRIMARY KEY,
        order_id INTEGER,
        sort_order INTEGER,
        sizes_json TEXT,
        unit_price REAL,
        unit_cost REAL,
        total_price REAL,
        cost_price REAL
    )`);
    await run(db, `INSERT INTO orders
        (id, quote_id, sizes_json, unit_price, unit_cost, total_price, cost_price, amount_paid)
        VALUES (137, 52, '{"PP":1,"P":6,"M":6}', 29.9, 10, 388.7, 130, 254.15)`);
    await run(db, `INSERT INTO order_product_lines
        (id, order_id, sort_order, sizes_json, unit_price, unit_cost, total_price, cost_price)
        VALUES (303, 137, 0, '{"PP":1,"P":6,"M":6}', 29.9, 10, 388.7, 130)`);

    const sizesJson = JSON.stringify({ PP: 2, P: 6, M: 9 });
    const orderIds = await sync(db, 52, {
        sizesJson,
        unitPrice: 29.9,
        unitCost: 10,
        primaryLineTotal: 508.3,
        primaryLineCost: 170,
        finalTotalPrice: 508.3,
        finalCostPrice: 170
    });

    const order = await get(db, 'SELECT * FROM orders WHERE id = 137');
    const line = await get(db, 'SELECT * FROM order_product_lines WHERE id = 303');

    assert.deepEqual(orderIds, [137]);
    assert.equal(order.sizes_json, sizesJson);
    assert.equal(order.total_price, 508.3);
    assert.equal(line.sizes_json, sizesJson);
    assert.equal(line.total_price, 508.3);

    await new Promise((resolve) => db.close(resolve));
});
