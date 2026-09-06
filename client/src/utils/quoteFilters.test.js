import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleQuoteStatuses, isQuoteVisibleInBoard } from './quoteFilters.js';

test('quote board uses operational status tabs and hides converted quotes', () => {
    assert.deepEqual(getVisibleQuoteStatuses(['Em Análise', 'Aprovado', 'Convertido em Pedido']), ['Em Análise', 'Aprovado']);
    assert.equal(isQuoteVisibleInBoard({ status: 'Convertido em Pedido' }), false);
    assert.equal(isQuoteVisibleInBoard({ status: 'Aprovado' }), true);
});
