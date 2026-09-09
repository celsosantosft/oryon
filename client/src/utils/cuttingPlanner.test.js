import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuttingPlan } from './cuttingPlanner.js';

function bySize(items = []) {
    return new Map(items.map((item) => [item.tamanho, item]));
}

function countParts(items = []) {
    return items.reduce((sum, item) => sum + item.front + item.back + item.sleeve, 0);
}

test('economy sends singleton demand to loose cuts instead of multiplying it by the largest layer count', () => {
    const plan = buildCuttingPlan([
        {
            grade: [
                { tamanho: 'P', quantidade: 8 },
                { tamanho: 'M', quantidade: 15 },
                { tamanho: 'G', quantidade: 10 },
                { tamanho: 'GG', quantidade: 7 },
                { tamanho: 'XG', quantidade: 2 },
                { tamanho: 'EXG', quantidade: 1 }
            ]
        }
    ], 'economy');

    assert.equal(plan.strategy, 'economy');
    assert.equal(plan.shortages.length, 0);
    assert.equal(countParts(plan.surplusParts), 0);
    assert.deepEqual(bySize(plan.looseCuts).get('EXG'), {
        tamanho: 'EXG',
        front: 1,
        back: 1,
        sleeve: 2
    });
    assert.equal(bySize(plan.producedParts).get('EXG')?.front || 0, 0);

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

test('uses selected layers from a back marker as fronts for every size', () => {
    const plan = buildCuttingPlan([{ grade: [
        { tamanho: 'P', quantidade: 20 },
        { tamanho: 'M', quantidade: 10 },
        { tamanho: 'G', quantidade: 5 },
        { tamanho: 'GG', quantidade: 5 }
    ] }], 'economy');

    const tenLayerSpread = plan.spreads.find((spread) => spread.layers === 10);
    assert.ok(tenLayerSpread);
    assert.ok(tenLayerSpread.transformations.some((item) => (
        item.tamanho === 'G' && item.keepBack === 5 && item.toFront === 5
    )));
    assert.ok(tenLayerSpread.transformations.some((item) => (
        item.tamanho === 'GG' && item.keepBack === 5 && item.toFront === 5
    )));
    assert.equal(countParts(plan.surplusParts), 0);
    assert.equal(plan.shortages.length, 0);
});

test('both strategies preserve component accounting and fewer-spreads exposes its surplus', () => {
    const grade = [
        { tamanho: 'P', quantidade: 8 },
        { tamanho: 'M', quantidade: 15 },
        { tamanho: 'G', quantidade: 10 },
        { tamanho: 'GG', quantidade: 7 },
        { tamanho: 'XG', quantidade: 2 },
        { tamanho: 'EXG', quantidade: 1 }
    ];
    const economy = buildCuttingPlan([{ grade }], 'economy');
    const fewerSpreads = buildCuttingPlan([{ grade }], 'fewer-spreads');

    assert.ok(fewerSpreads.spreads.length <= economy.spreads.length);
    assert.equal(fewerSpreads.metrics.spreadCount, fewerSpreads.spreads.length);
    assert.ok(fewerSpreads.metrics.surplusPieces >= 0);

    for (const plan of [economy, fewerSpreads]) {
        const applied = bySize(plan.appliedParts);
        const produced = bySize(plan.producedParts);
        const loose = bySize(plan.looseCuts);
        const surplus = bySize(plan.surplusParts);

        for (const { tamanho, quantidade } of grade) {
            assert.deepEqual(applied.get(tamanho), {
                tamanho,
                front: quantidade,
                back: quantidade,
                sleeve: quantidade * 2
            });
            for (const part of ['front', 'back', 'sleeve']) {
                assert.equal(
                    (produced.get(tamanho)?.[part] || 0) + (loose.get(tamanho)?.[part] || 0),
                    applied.get(tamanho)[part] + (surplus.get(tamanho)?.[part] || 0)
                );
            }
        }
    }
});

test('fewer-spreads never creates surplus when it does not remove a spread', () => {
    const grade = [
        { tamanho: 'P', quantidade: 8 },
        { tamanho: 'M', quantidade: 15 },
        { tamanho: 'G', quantidade: 10 },
        { tamanho: 'GG', quantidade: 7 },
        { tamanho: 'XG', quantidade: 2 },
        { tamanho: 'EXG', quantidade: 1 }
    ];
    const economy = buildCuttingPlan([{ grade }], 'economy');
    const fewerSpreads = buildCuttingPlan([{ grade }], 'fewer-spreads');

    assert.equal(economy.spreads.length, 2);
    assert.equal(fewerSpreads.spreads.length, 2);
    assert.equal(fewerSpreads.metrics.surplusPieces, 0);
    assert.deepEqual(fewerSpreads.looseCuts, economy.looseCuts);
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
    assert.ok(plan.spreads.length >= 1);
    assert.ok(plan.looseCuts.length >= 1);
    assert.deepEqual(plan.cutTotals, plan.gradeTotals);
    assert.equal(plan.shortages.length, 0);
    assert.ok(plan.spreads.every((spread) => spread.markers.every((marker) => marker.rotated === false)));
});

test('uses one loose-cut instruction when every selected size is a singleton', () => {
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

    assert.equal(plan.spreads.length, 0);
    assert.equal(plan.looseCuts.length, 7);
    assert.equal(plan.shortages.length, 0);
});

test('reports only the fabric length occupied by the markers', () => {
    const plan = buildCuttingPlan([
        {
            grade: [
                { tamanho: 'P', quantidade: 10 },
                { tamanho: 'M', quantidade: 10 },
                { tamanho: 'G', quantidade: 10 }
            ]
        }
    ]);

    const lastMarkerEdge = Math.round(Math.max(
        ...plan.spreads[0].markers.map((marker) => marker.y + marker.height)
    ) * 10) / 10;

    assert.equal(plan.spreads[0].usedLength, lastMarkerEdge);
    assert.ok(plan.spreads[0].usedLength < plan.table.height);
});
