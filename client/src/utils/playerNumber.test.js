import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PLAYER_NUMBER_MAX_LENGTH,
    isValidPlayerNumber,
    normalizePlayerNumberInput
} from './playerNumber.js';

test('accepts common numbers and square-root numbers', () => {
    assert.equal(isValidPlayerNumber('10'), true);
    assert.equal(isValidPlayerNumber('√16'), true);
    assert.equal(isValidPlayerNumber(''), true);
});

test('keeps only a leading square root and digits while typing', () => {
    assert.equal(normalizePlayerNumberInput('√1a6<script>'), '√16');
    assert.equal(normalizePlayerNumberInput('1√6'), '16');
    assert.equal(normalizePlayerNumberInput('√1234567').length, PLAYER_NUMBER_MAX_LENGTH);
});

test('rejects incomplete roots and expressions', () => {
    assert.equal(isValidPlayerNumber('√'), false);
    assert.equal(isValidPlayerNumber('10A'), false);
    assert.equal(isValidPlayerNumber('=1+1'), false);
});
