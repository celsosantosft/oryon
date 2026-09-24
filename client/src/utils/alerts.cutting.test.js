import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingLayersEditorHtml, normalizeCuttingLayerCounts } from './alerts.js';

test('builds one editable layer field per spread with a 20-layer limit', () => {
    const html = buildCuttingLayersEditorHtml({
        spreads: [
            { index: 1, layers: 12, sizes: ['P', 'M'] },
            { index: 2, layers: 5, sizes: ['G'] }
        ]
    }, 20);

    assert.match(html, /Enfesto 1/);
    assert.match(html, /Enfesto 2/);
    assert.match(html, /value="12"/);
    assert.match(html, /value="5"/);
    assert.equal((html.match(/max="20"/g) || []).length, 2);
});

test('accepts only whole layer counts inside the machine limit', () => {
    assert.deepEqual(normalizeCuttingLayerCounts(['12', '5'], 20), [12, 5]);
    assert.equal(normalizeCuttingLayerCounts(['0'], 20), null);
    assert.equal(normalizeCuttingLayerCounts(['21'], 20), null);
    assert.equal(normalizeCuttingLayerCounts(['2.5'], 20), null);
});
