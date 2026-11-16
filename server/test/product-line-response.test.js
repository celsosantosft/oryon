const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const ordersRouter = require('../routes/orders');

test('keeps the official grade and value when the customer submits names', () => {
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

    assert.deepEqual(lines[0].sizes_json, { PP: 1, P: 6, M: 6 });
    assert.equal(lines[0].total_price, 388.7);
});

test('accepts only a nominal list that matches the official grade', () => {
    const sameSizeGrade = ordersRouter._test.sameSizeGrade;

    assert.equal(sameSizeGrade({ P: 2, M: 1 }, { M: 1, P: 2 }), true);
    assert.equal(sameSizeGrade({ P: 2, M: 1 }, { P: 1, M: 2 }), false);
    assert.equal(sameSizeGrade({ P: 2 }, { P: 2, G: 1 }), false);
});

test('customer submission does not update the official grade or price', () => {
    const source = readFileSync(require.resolve('../routes/orders'), 'utf8');
    const submitRoute = source.split("router.post('/api/tracking/portal/:code/submit'")[1]
        .split("router.post('/api/tracking/portal/:code/approve-art'")[0];

    assert.doesNotMatch(submitRoute, /UPDATE orders SET[^`]*(sizes_json|total_price|cost_price)/);
    assert.doesNotMatch(submitRoute, /UPDATE quotes SET[^`]*(sizes_json|total_price|cost_price)/);
});
