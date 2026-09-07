import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingPlan } from './cuttingPlanner.js';

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

    assert.equal(plan.spreads[0].usedLength, 204.8);
    assert.ok(plan.spreads[0].usedLength < plan.table.height);
});
