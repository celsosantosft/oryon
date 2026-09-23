function syncConvertedOrdersFromQuote(db, quoteId, values, callback) {
    const safeQuoteId = Number(quoteId);
    if (!Number.isInteger(safeQuoteId) || safeQuoteId <= 0) return callback(null, []);

    db.all('SELECT id FROM orders WHERE quote_id = ? ORDER BY id', [safeQuoteId], (findErr, rows = []) => {
        if (findErr) return callback(findErr);

        const orderIds = rows.map((row) => row.id);
        if (orderIds.length === 0) return callback(null, []);

        db.run(`
            UPDATE orders
            SET sizes_json = ?,
                unit_price = ?,
                unit_cost = ?,
                total_price = CASE WHEN COALESCE(amount_paid, 0) > ? THEN amount_paid ELSE ? END,
                cost_price = ?
            WHERE quote_id = ?
        `, [
            values.sizesJson,
            values.unitPrice,
            values.unitCost,
            values.finalTotalPrice,
            values.finalTotalPrice,
            values.finalCostPrice,
            safeQuoteId
        ], (orderUpdateErr) => {
            if (orderUpdateErr) return callback(orderUpdateErr);

            db.run(`
                UPDATE order_product_lines
                SET sizes_json = ?,
                    unit_price = ?,
                    unit_cost = ?,
                    total_price = ?,
                    cost_price = ?
                WHERE id IN (
                    SELECT (
                        SELECT opl.id
                        FROM order_product_lines opl
                        WHERE opl.order_id = orders.id
                        ORDER BY opl.sort_order ASC, opl.id ASC
                        LIMIT 1
                    )
                    FROM orders
                    WHERE quote_id = ?
                )
            `, [
                values.sizesJson,
                values.unitPrice,
                values.unitCost,
                values.primaryLineTotal,
                values.primaryLineCost,
                safeQuoteId
            ], (lineUpdateErr) => callback(lineUpdateErr || null, orderIds));
        });
    });
}

module.exports = { syncConvertedOrdersFromQuote };
