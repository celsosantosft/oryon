import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatCurrencyInput,
    formatCurrencyValueInput,
    parseCurrencyInput
} from './currencyInput.js';

test('formats typed cents with Brazilian thousands and decimal separators', () => {
    assert.equal(formatCurrencyInput('10373290'), '103.732,90');
    assert.equal(formatCurrencyInput('103.732,90'), '103.732,90');
    assert.equal(formatCurrencyValueInput(103732.9), '103.732,90');
});

test('parses a Brazilian currency field back to a database number', () => {
    assert.equal(parseCurrencyInput('103.732,90'), 103732.9);
    assert.equal(parseCurrencyInput(''), 0);
});
