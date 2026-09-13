const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePlayerNumber } = require('../utils/playerNumber');

test('normalizes valid player numbers for storage', () => {
    assert.equal(normalizePlayerNumber('10'), '10');
    assert.equal(normalizePlayerNumber('√16'), '√16');
    assert.equal(normalizePlayerNumber(''), '');
});

test('rejects invalid player numbers at the API boundary', () => {
    assert.equal(normalizePlayerNumber('√'), null);
    assert.equal(normalizePlayerNumber('10A'), null);
    assert.equal(normalizePlayerNumber('=1+1'), null);
    assert.equal(normalizePlayerNumber('√123456'), null);
});
