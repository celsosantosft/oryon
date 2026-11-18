import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quotesSource = readFileSync(new URL('./Quotes.jsx', import.meta.url), 'utf8');

test('opens and passes the print window before loading quote details', () => {
    const openPosition = quotesSource.indexOf("window.open('', '_blank'");
    const fetchPosition = quotesSource.indexOf('fetchQuoteSnapshot(quote.tracking_code)', openPosition);

    assert.ok(openPosition >= 0 && openPosition < fetchPosition);
    assert.match(quotesSource, /printQuote\(detailedQuote, API_BASE_URL, printWindow, \{ autoPrint: !mobile \}\)/);
    assert.match(quotesSource, /Permita a abertura de novas abas para imprimir o orçamento/);
});
