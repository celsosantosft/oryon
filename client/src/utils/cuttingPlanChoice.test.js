import test from 'node:test';
import assert from 'node:assert/strict';

test('shows the calculated metrics for all three cutting strategies', async () => {
    const alerts = await import('./alerts.js');
    assert.equal(typeof alerts.buildCuttingPlanChoiceHtml, 'function');

    const html = alerts.buildCuttingPlanChoiceHtml({
        economy: {
            metrics: { spreadCount: 2, totalLayers: 28, fabricMeters: 30.21, looseCutPieces: 4, surplusPieces: 0 },
            surplusParts: []
        },
        balanced: {
            metrics: { spreadCount: 2, totalLayers: 25, fabricMeters: 31.4, looseCutPieces: 0, surplusPieces: 4 },
            surplusParts: [{ tamanho: 'P', front: 1, back: 1, sleeve: 2 }]
        },
        fewerSpreads: {
            metrics: { spreadCount: 1, totalLayers: 20, fabricMeters: 35.5, looseCutPieces: 0, surplusPieces: 12 },
            surplusParts: [{ tamanho: 'M', front: 3, back: 3, sleeve: 6 }]
        }
    });

    assert.match(html, /Economizar malha/);
    assert.match(html, /2 enfestos/);
    assert.match(html, /30,21 m/);
    assert.match(html, /28 folhas somadas/);
    assert.match(html, /4 componentes em retalho/);
    assert.match(html, /Equilibrado/);
    assert.match(html, /31,40 m/);
    assert.match(html, /Reduzir trabalho/);
    assert.match(html, /1 enfesto/);
    assert.match(html, /12 componentes excedentes/);
    assert.match(html, /M: 3 frentes, 3 costas, 6 mangas/);
});
