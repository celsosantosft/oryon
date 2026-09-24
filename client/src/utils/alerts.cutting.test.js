import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCuttingLayersEditorHtml,
    buildCuttingPlanChoiceHtml,
    normalizeCuttingLayerCounts
} from './alerts.js';

test('shows the three cutting proposals with their selectable strategies', () => {
    const plan = { metrics: { spreadCount: 1, totalLayers: 8, fabricMeters: 2.8, looseCutPieces: 0, surplusPieces: 0 } };
    const html = buildCuttingPlanChoiceHtml({ economy: plan, balanced: plan, fewerSpreads: plan });

    assert.match(html, /Economizar malha/);
    assert.match(html, /Equilibrado/);
    assert.match(html, /Reduzir trabalho/);
    assert.match(html, /8 folhas somadas/);
    assert.match(html, /value="economy"/);
    assert.match(html, /value="balanced"/);
    assert.match(html, /value="fewer-spreads"/);
    assert.equal((html.match(/name="cutting-plan"/g) || []).length, 3);
});

test('builds one editable layer field per spread without imposing a maximum', () => {
    const html = buildCuttingLayersEditorHtml({
        spreads: [
            { index: 1, layers: 12, sizes: ['P', 'M'] },
            { index: 2, layers: 5, sizes: ['G'] }
        ]
    });

    assert.match(html, /Enfesto 1/);
    assert.match(html, /Enfesto 2/);
    assert.match(html, /value="12"/);
    assert.match(html, /value="5"/);
    assert.doesNotMatch(html, /max="/);
    assert.match(html, /qualquer número inteiro positivo/);
});

test('accepts any positive whole layer count', () => {
    assert.deepEqual(normalizeCuttingLayerCounts(['12', '50']), [12, 50]);
    assert.equal(normalizeCuttingLayerCounts(['0']), null);
    assert.equal(normalizeCuttingLayerCounts(['2.5']), null);
});
