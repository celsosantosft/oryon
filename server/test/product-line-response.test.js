const test = require('node:test');
const assert = require('node:assert/strict');

const ordersRouter = require('../routes/orders');

test('shows the latest submitted grade and recalculated value for one product line', () => {
    const normalizeProductLinesForResponse = ordersRouter._test.normalizeProductLinesForResponse;
    const lines = normalizeProductLinesForResponse([{
        id: 303,
        sizes_json: JSON.stringify({ PP: 1, P: 6, M: 6 }),
        unit_price: 29.9,
        unit_cost: 0,
        total_price: 388.7,
        cost_price: 0
    }], {
        sizes_json: JSON.stringify({ PP: 1, P: 6, M: 6 }),
        submitted_sizes_json: { PP: 2, P: 6, M: 9 },
        unit_price: 29.9,
        total_price: 388.7
    });

    assert.deepEqual(lines[0].sizes_json, { PP: 2, P: 6, M: 9 });
    assert.equal(lines[0].total_price, 508.3);
});
