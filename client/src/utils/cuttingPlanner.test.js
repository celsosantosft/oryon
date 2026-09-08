import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingPlan } from './cuttingPlanner.js';

test('plans the real PP6 P11 M18 G12 GG4 grade in two spreads', () => {
    const plan = buildCuttingPlan([
        {
            grade: [
                { tamanho: 'PP', quantidade: 6 },
                { tamanho: 'P', quantidade: 11 },
                { tamanho: 'M', quantidade: 18 },
                { tamanho: 'G', quantidade: 12 },
                { tamanho: 'GG', quantidade: 4 }
            ]
        }
    ]);

    assert.equal(plan.spreads.length, 2);
    assert.equal(plan.spreads[0].layers, 12);
    assert.deepEqual(plan.spreads[0].baseMarkerCounts, {
        P: { front: 1, back: 1, sleeve: 2 },
        M: { front: 2, back: 2, sleeve: 3 },
        G: { front: 1, back: 1, sleeve: 2 }
    });
    assert.equal(plan.spreads[1].layers, 4);
    assert.deepEqual(plan.spreads[1].baseMarkerCounts, {
        PP: { front: 2, back: 2, sleeve: 3 },
        GG: { front: 1, back: 1, sleeve: 2 }
    });
    assert.equal(plan.shortages.length, 0);
    assert.ok(plan.spreads.every((spread) => spread.fillMarkers.length > 0));

    const surplusBySize = new Map(plan.surplusParts.map((item) => [item.tamanho, item]));
    assert.ok(surplusBySize.get('PP').front >= 2);
    assert.ok(surplusBySize.get('PP').back >= 2);
    assert.ok(surplusBySize.get('P').front >= 1);
    assert.ok(surplusBySize.get('M').front >= 6);
    assert.ok(surplusBySize.get('M').back >= 6);

    for (const spread of plan.spreads) {
        assert.ok(spread.usedLength <= 280);
        assert.ok(spread.markers.every(({ x, y, width, height, rotated }) => (
            rotated === false
            && x >= 0
            && y >= 0
            && x + width <= 180
            && y + height <= 280
        )));
    }
});

test('builds fabric layers for selected shirt sizes without rotating pieces', () => {
    const plan = buildCuttingPlan([
        {
            tracking_code: '#ATOS-1',
            cliente: 'Cliente teste',
            fabricLabel: 'Dryfit',
            modelingLabel: 'Camisa',
            grade: [
                { tamanho: 'PP', quantidade: 6 },
                { tamanho: 'P', quantidade: 4 },
                { tamanho: 'M', quantidade: 7 },
                { tamanho: 'G', quantidade: 1 },
                { tamanho: 'GG', quantidade: 1 }
            ]
        }
    ]);

    assert.equal(plan.totalPieces, 19);
    assert.deepEqual(plan.gradeTotals, [
        { tamanho: 'PP', quantidade: 6 },
        { tamanho: 'P', quantidade: 4 },
        { tamanho: 'M', quantidade: 7 },
        { tamanho: 'G', quantidade: 1 },
        { tamanho: 'GG', quantidade: 1 }
    ]);
    assert.ok(plan.spreads.length > 1);
    assert.deepEqual(plan.cutTotals, plan.gradeTotals);
    assert.equal(plan.shortages.length, 0);
    assert.ok(plan.spreads.every((spread) => spread.markers.every((marker) => marker.rotated === false)));
});

test('splits markers into more spreads when the table does not fit every size together', () => {
    const plan = buildCuttingPlan([
        {
            tracking_code: '#ATOS-2',
            cliente: 'Cliente teste',
            fabricLabel: 'Dryfit',
            modelingLabel: 'Camisa',
            grade: [
                { tamanho: 'PP', quantidade: 1 },
                { tamanho: 'P', quantidade: 1 },
                { tamanho: 'M', quantidade: 1 },
                { tamanho: 'G', quantidade: 1 },
                { tamanho: 'GG', quantidade: 1 },
                { tamanho: 'XG', quantidade: 1 },
                { tamanho: 'EXG', quantidade: 1 }
            ]
        }
    ]);

    assert.ok(plan.spreads.length > 1);
    assert.equal(plan.shortages.length, 0);
});

test('reports only the fabric length occupied by the markers', () => {
    const plan = buildCuttingPlan([
        {
            grade: [
                { tamanho: 'P', quantidade: 1 },
                { tamanho: 'M', quantidade: 1 },
                { tamanho: 'G', quantidade: 1 }
            ]
        }
    ]);

    const lastMarkerEdge = Math.round(Math.max(
        ...plan.spreads[0].markers.map((marker) => marker.y + marker.height)
    ) * 10) / 10;

    assert.equal(plan.spreads[0].usedLength, lastMarkerEdge);
    assert.ok(plan.spreads[0].usedLength < plan.table.height);
});
