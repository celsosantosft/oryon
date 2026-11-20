import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bulkTabSource = readFileSync(new URL('../components/tabs/BulkTab.jsx', import.meta.url), 'utf8');
const portalSource = readFileSync(new URL('../pages/ClientPortal.jsx', import.meta.url), 'utf8');

test('keeps the customer portal grade read-only', () => {
    assert.match(bulkTabSource, /Somente visualização/);
    assert.doesNotMatch(bulkTabSource, /<input/);
    assert.doesNotMatch(bulkTabSource, /Enviar Grade/);
    assert.doesNotMatch(portalSource, /handleBulkSubmit|confirmBulkSubmitAlert|submit-bulk/);
});

test('separates the portal grade by product line', () => {
    assert.match(portalSource, /productLines=\{order\.product_lines\}/);
    assert.match(bulkTabSource, /productLines = \[\]/);
    assert.match(bulkTabSource, /line\?\.sizes_json/);
    assert.match(bulkTabSource, /Produto \{section\.index \+ 1\}/);
    assert.match(bulkTabSource, /section\.productName/);
    assert.match(bulkTabSource, /section\.total\} peça\(s\)/);
});
