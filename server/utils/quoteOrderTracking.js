const { appConfig, normalizePrefix } = require('../config/appConfig');

function buildOrderCodeFromQuoteCode(quoteCode) {
    const suffix = String(quoteCode || '').trim().toUpperCase().match(/(\d+)$/)?.[1];
    return suffix ? `#${normalizePrefix(appConfig.orderPrefix)}-${suffix}` : null;
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) return reject(error);
            resolve(this.changes || 0);
        });
    });
}

async function repairLinkedOrderTrackingCodes(db) {
    const linkedOrders = await all(db, `
        SELECT o.id, o.tracking_code, o.legacy_tracking_code, q.tracking_code AS quote_tracking_code
        FROM orders o
        JOIN quotes q ON q.id = o.quote_id
        WHERE o.quote_id IS NOT NULL
    `);
    let repaired = 0;
    let collisions = 0;

    for (const order of linkedOrders) {
        const expectedCode = buildOrderCodeFromQuoteCode(order.quote_tracking_code);
        if (!expectedCode || expectedCode === order.tracking_code) continue;

        const owner = await get(db, `
            SELECT id FROM orders
            WHERE id != ? AND (tracking_code = ? OR legacy_tracking_code = ?)
            LIMIT 1
        `, [order.id, expectedCode, expectedCode]);
        if (owner) {
            collisions += 1;
            continue;
        }

        repaired += await run(db, `
            UPDATE orders
            SET legacy_tracking_code = COALESCE(NULLIF(legacy_tracking_code, ''), tracking_code),
                tracking_code = ?
            WHERE id = ? AND tracking_code = ?
        `, [expectedCode, order.id, order.tracking_code]);
    }

    return { repaired, collisions };
}

module.exports = { buildOrderCodeFromQuoteCode, repairLinkedOrderTrackingCodes };
