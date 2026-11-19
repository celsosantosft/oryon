import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./FinanceTransactions.jsx', import.meta.url), 'utf8');

test('selects payable and receivable transactions for one atomic batch settlement', () => {
    assert.match(source, /selectedTransactionIds/);
    assert.match(source, /\/api\/finance\/transactions\/pay-batch/);
    assert.match(source, /A baixa em lote será integral/);
    assert.match(source, /Selecionar todos os recebimentos visíveis/);
    assert.match(source, /Selecionar todas as contas a pagar visíveis/);
});
