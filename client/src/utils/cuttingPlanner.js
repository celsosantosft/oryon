import { sortGradeItems } from './cuttingGrouping.js';

export const CUTTING_TABLE = { width: 180, height: 280 };

export const SHIRT_MEASUREMENTS = {
    PP: { front: [50.7, 69.2], back: [50.7, 74], sleeve: [39.1, 24.3] },
    P: { front: [53.4, 70.8], back: [53.4, 74], sleeve: [41.5, 24.6] },
    M: { front: [55, 74], back: [55, 77], sleeve: [43.5, 25.7] },
    G: { front: [57.3, 76.2], back: [57.3, 79.7], sleeve: [45, 26.5] },
    GG: { front: [59.3, 79.7], back: [59.3, 82.5], sleeve: [45, 26.5] },
    XG: { front: [62.5, 82.5], back: [62.5, 85], sleeve: [45.5, 27] },
    EXG: { front: [65, 83], back: [65, 85], sleeve: [48, 27.5] }
};

const PARTS = ['front', 'back', 'sleeve'];
const PART_LABELS = {
    front: 'FRENTE',
    back: 'COSTAS',
    sleeve: 'MANGA'
};

function normalizeSize(size) {
    const normalized = String(size || '').trim().toUpperCase();
    return normalized === 'XXG' || normalized === 'XXXG' ? 'EXG' : normalized;
}

function addTotal(map, size, quantity) {
    const normalizedSize = normalizeSize(size);
    if (!normalizedSize || quantity <= 0) return;
    map.set(normalizedSize, (map.get(normalizedSize) || 0) + quantity);
}

function makeGradeFromMap(map) {
    return sortGradeItems(Array.from(map.entries()).map(([tamanho, quantidade]) => ({ tamanho, quantidade })));
}

function intersects(left, right) {
    return !(
        right.x >= left.x + left.width
        || right.x + right.width <= left.x
        || right.y >= left.y + left.height
        || right.y + right.height <= left.y
    );
}

function isContained(inner, outer) {
    return inner.x >= outer.x
        && inner.y >= outer.y
        && inner.x + inner.width <= outer.x + outer.width
        && inner.y + inner.height <= outer.y + outer.height;
}

function splitFreeRectangle(free, used) {
    if (!intersects(free, used)) return [free];

    const split = [];
    if (used.x > free.x) {
        split.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height });
    }
    if (used.x + used.width < free.x + free.width) {
        split.push({
            x: used.x + used.width,
            y: free.y,
            width: free.x + free.width - used.x - used.width,
            height: free.height
        });
    }
    if (used.y > free.y) {
        split.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y });
    }
    if (used.y + used.height < free.y + free.height) {
        split.push({
            x: free.x,
            y: used.y + used.height,
            width: free.width,
            height: free.y + free.height - used.y - used.height
        });
    }
    return split;
}

function pruneFreeRectangles(rectangles) {
    return rectangles.filter((rectangle, index) => !rectangles.some((other, otherIndex) => (
        index !== otherIndex && isContained(rectangle, other)
    )));
}

function packMarkers(markers) {
    const sorted = [...markers].sort((left, right) => (
        (right.width * right.height) - (left.width * left.height)
        || right.height - left.height
        || left.id.localeCompare(right.id)
    ));
    const packed = [];
    let freeRectangles = [{ x: 0, y: 0, width: CUTTING_TABLE.width, height: CUTTING_TABLE.height }];

    for (const marker of sorted) {
        let placement = null;

        for (const free of freeRectangles) {
            if (marker.width > free.width || marker.height > free.height) continue;

            const shortSide = Math.min(free.width - marker.width, free.height - marker.height);
            const longSide = Math.max(free.width - marker.width, free.height - marker.height);
            const candidate = { x: free.x, y: free.y, shortSide, longSide };

            if (!placement
                || candidate.shortSide < placement.shortSide
                || (candidate.shortSide === placement.shortSide && candidate.longSide < placement.longSide)
                || (candidate.shortSide === placement.shortSide && candidate.longSide === placement.longSide && candidate.y < placement.y)
                || (candidate.shortSide === placement.shortSide && candidate.longSide === placement.longSide
                    && candidate.y === placement.y && candidate.x < placement.x)) {
                placement = candidate;
            }
        }

        if (!placement) return null;

        const used = { ...marker, x: placement.x, y: placement.y, rotated: false };
        packed.push(used);
        freeRectangles = pruneFreeRectangles(freeRectangles.flatMap((free) => splitFreeRectangle(free, used)));
    }

    return packed;
}

function makeMarker(size, part, id, transformation = null) {
    const [width, height] = SHIRT_MEASUREMENTS[size][part];
    return {
        id,
        part,
        label: PART_LABELS[part],
        size,
        width,
        height,
        rotated: false,
        transformation
    };
}

function emptyParts() {
    return { front: 0, back: 0, sleeve: 0 };
}

function addParts(map, size, additions) {
    const current = map.get(size) || emptyParts();
    map.set(size, {
        front: current.front + (additions.front || 0),
        back: current.back + (additions.back || 0),
        sleeve: current.sleeve + (additions.sleeve || 0)
    });
}

function partsToArray(map, includeEmpty = false) {
    return sortGradeItems(Array.from(map.entries()).map(([tamanho, parts]) => ({
        tamanho,
        ...parts
    })).filter((item) => includeEmpty || item.front || item.back || item.sleeve));
}

function subtractQuantity(map, size, quantity) {
    map.set(size, Math.max(0, (map.get(size) || 0) - quantity));
}

function markerArea(markers) {
    return markers.reduce((sum, marker) => sum + (marker.width * marker.height), 0);
}

function makeFullUnit(size, layers, index) {
    const prefix = `${size}-full-${layers}-${index}`;
    return {
        size,
        quantity: layers,
        markers: [
            makeMarker(size, 'front', `${prefix}-front`),
            makeMarker(size, 'back', `${prefix}-back`),
            makeMarker(size, 'sleeve', `${prefix}-sleeve-0`),
            makeMarker(size, 'sleeve', `${prefix}-sleeve-1`)
        ],
        transformations: []
    };
}

function makeHalfUnit(size, layers) {
    const quantity = layers / 2;
    const transformation = { tamanho: size, bodies: layers, keepBack: quantity, toFront: quantity };
    const prefix = `${size}-half-${layers}`;
    return {
        size,
        quantity,
        markers: [
            makeMarker(size, 'back', `${prefix}-back`, transformation),
            makeMarker(size, 'sleeve', `${prefix}-sleeve`)
        ],
        transformations: [transformation]
    };
}

function makeEconomyUnits(remaining, layers) {
    const units = [];

    remaining.forEach((quantity, size) => {
        const fullRuns = Math.floor(quantity / layers);
        for (let index = 0; index < fullRuns; index += 1) {
            units.push(makeFullUnit(size, layers, index));
        }

        const remainder = quantity % layers;
        if (layers % 2 === 0 && remainder >= layers / 2) {
            units.push(makeHalfUnit(size, layers));
        }
    });

    return units.sort((left, right) => (
        (markerArea(left.markers) / left.quantity) - (markerArea(right.markers) / right.quantity)
        || right.quantity - left.quantity
        || left.size.localeCompare(right.size)
        || left.markers[0].id.localeCompare(right.markers[0].id)
    ));
}

function summarizeSpread(layers, packed, acceptedUnits) {
    const produced = new Map();
    const applied = new Map();
    const transformations = acceptedUnits.flatMap((unit) => unit.transformations);

    packed.forEach((marker) => {
        if (marker.transformation) {
            addParts(produced, marker.size, {
                front: marker.transformation.toFront,
                back: layers - marker.transformation.toFront
            });
            return;
        }
        addParts(produced, marker.size, { [marker.part]: layers });
    });
    acceptedUnits.forEach((unit) => {
        addParts(applied, unit.size, {
            front: unit.quantity,
            back: unit.quantity,
            sleeve: unit.quantity * 2
        });
    });

    const usedLength = Math.round(Math.max(...packed.map((marker) => marker.y + marker.height)) * 10) / 10;
    const surplus = new Map();
    produced.forEach((parts, size) => {
        const used = applied.get(size) || emptyParts();
        addParts(surplus, size, {
            front: Math.max(0, parts.front - used.front),
            back: Math.max(0, parts.back - used.back),
            sleeve: Math.max(0, parts.sleeve - used.sleeve)
        });
    });

    return {
        layers,
        sizes: [...new Set(acceptedUnits.map((unit) => unit.size))],
        markers: packed,
        transformations,
        partTotals: partsToArray(produced),
        appliedParts: partsToArray(applied),
        surplusParts: partsToArray(surplus),
        usedLength,
        fabricUsage: layers * usedLength,
        appliedShirts: acceptedUnits.reduce((sum, unit) => sum + unit.quantity, 0)
    };
}

function buildEconomyCandidate(remaining, layers) {
    const units = makeEconomyUnits(remaining, layers);
    if (!units.length) return null;

    let markers = [];
    let packed = [];
    const accepted = [];

    units.forEach((unit) => {
        const nextPacked = packMarkers([...markers, ...unit.markers]);
        if (!nextPacked) return;
        markers = [...markers, ...unit.markers];
        packed = nextPacked;
        accepted.push(unit);
    });

    return accepted.length ? summarizeSpread(layers, packed, accepted) : null;
}

function compareEconomyCandidates(left, right) {
    return right.appliedShirts - left.appliedShirts
        || (left.fabricUsage / left.appliedShirts) - (right.fabricUsage / right.appliedShirts)
        || left.markers.length - right.markers.length
        || left.sizes.join('|').localeCompare(right.sizes.join('|'));
}

function buildEconomySolution(requested) {
    const remaining = new Map(requested);
    const spreads = [];

    while (Math.max(0, ...remaining.values()) >= 2) {
        const maxLayers = Math.max(...remaining.values());
        let best = null;

        for (let layers = 2; layers <= maxLayers; layers += 1) {
            const candidate = buildEconomyCandidate(remaining, layers);
            if (candidate && (!best || compareEconomyCandidates(candidate, best) < 0)) best = candidate;
        }

        if (!best) break;
        best.appliedParts.forEach((item) => subtractQuantity(remaining, item.tamanho, item.front));
        spreads.push(best);
    }

    const loose = new Map();
    remaining.forEach((quantity, size) => {
        if (quantity <= 0) return;
        addParts(loose, size, { front: quantity, back: quantity, sleeve: quantity * 2 });
    });
    return { spreads, loose };
}

function makeRoundedSizeUnit(size, quantity, layers) {
    if (layers > quantity * 2) return null;

    const markers = [];
    const transformations = [];
    const fullRuns = Math.floor(quantity / layers);
    for (let index = 0; index < fullRuns; index += 1) {
        const unit = makeFullUnit(size, layers, index);
        markers.push(...unit.markers.slice(0, 2));
    }

    const remainder = quantity % layers;
    if (remainder > 0 && remainder * 2 <= layers) {
        const transformation = {
            tamanho: size,
            bodies: layers,
            keepBack: remainder,
            toFront: remainder
        };
        transformations.push(transformation);
        markers.push(makeMarker(size, 'back', `${size}-rounded-${layers}-back`, transformation));
    } else if (remainder > 0) {
        markers.push(makeMarker(size, 'front', `${size}-rounded-${layers}-front`));
        markers.push(makeMarker(size, 'back', `${size}-rounded-${layers}-back`));
    }

    const sleeveMarkers = Math.ceil((quantity * 2) / layers);
    for (let index = 0; index < sleeveMarkers; index += 1) {
        markers.push(makeMarker(size, 'sleeve', `${size}-rounded-${layers}-sleeve-${index}`));
    }

    return { size, quantity, markers, transformations };
}

function buildRoundedSpread(sizes, requested, layers) {
    const units = sizes.map((size) => makeRoundedSizeUnit(size, requested.get(size), layers));
    if (units.some((unit) => !unit)) return null;
    const markers = units.flatMap((unit) => unit.markers);
    const packed = packMarkers(markers);
    return packed ? summarizeSpread(layers, packed, units) : null;
}

function countSurplus(spread) {
    return spread.surplusParts.reduce((sum, item) => sum + item.front + item.back + item.sleeve, 0);
}

function compareRoundedSpreads(left, right) {
    return countSurplus(left) - countSurplus(right)
        || left.fabricUsage - right.fabricUsage
        || left.layers - right.layers;
}

function compareRoundedPlans(left, right) {
    return left.spreads.length - right.spreads.length
        || left.surplusPieces - right.surplusPieces
        || left.fabricUsage - right.fabricUsage;
}

function buildRoundedSolution(sizes, requested) {
    const spreadByMask = new Map();
    const fullMask = (1 << sizes.length) - 1;
    const maxQuantity = Math.max(...requested.values());
    const maxLayers = maxQuantity + 10;

    for (let mask = 1; mask <= fullMask; mask += 1) {
        const subset = sizes.filter((_, index) => (mask & (1 << index)) !== 0);
        let best = null;
        for (let layers = 1; layers <= maxLayers; layers += 1) {
            const spread = buildRoundedSpread(subset, requested, layers);
            if (spread && (!best || compareRoundedSpreads(spread, best) < 0)) best = spread;
        }
        if (best) spreadByMask.set(mask, best);
    }

    const memo = new Map([[0, { spreads: [], surplusPieces: 0, fabricUsage: 0 }]]);
    const solve = (mask) => {
        if (memo.has(mask)) return memo.get(mask);
        const firstBit = mask & -mask;
        let best = null;

        for (let subset = mask; subset > 0; subset = (subset - 1) & mask) {
            if ((subset & firstBit) === 0 || !spreadByMask.has(subset)) continue;
            const remainder = solve(mask ^ subset);
            if (!remainder) continue;
            const spread = spreadByMask.get(subset);
            const candidate = {
                spreads: [spread, ...remainder.spreads],
                surplusPieces: countSurplus(spread) + remainder.surplusPieces,
                fabricUsage: spread.fabricUsage + remainder.fabricUsage
            };
            if (!best || compareRoundedPlans(candidate, best) < 0) best = candidate;
        }
        memo.set(mask, best);
        return best;
    };

    return solve(fullMask) || { spreads: [], surplusPieces: 0, fabricUsage: 0 };
}

function aggregateSpreadParts(spreads, field) {
    const totals = new Map();
    spreads.forEach((spread) => {
        (spread[field] || []).forEach(({ tamanho, front, back, sleeve }) => {
            addParts(totals, tamanho, { front, back, sleeve });
        });
    });
    return totals;
}

function makeRequestedParts(requested) {
    const parts = new Map();
    requested.forEach((quantity, size) => {
        parts.set(size, { front: quantity, back: quantity, sleeve: quantity * 2 });
    });
    return parts;
}

function makeSurplusParts(produced, loose, applied) {
    const surplus = new Map();
    applied.forEach((needed, size) => {
        const made = produced.get(size) || emptyParts();
        const cutLoose = loose.get(size) || emptyParts();
        const extra = {
            front: Math.max(0, made.front + cutLoose.front - needed.front),
            back: Math.max(0, made.back + cutLoose.back - needed.back),
            sleeve: Math.max(0, made.sleeve + cutLoose.sleeve - needed.sleeve)
        };
        if (extra.front || extra.back || extra.sleeve) surplus.set(size, extra);
    });
    return surplus;
}

export function buildCuttingPlan(orders, strategy = 'economy') {
    const requested = new Map();
    (orders || []).forEach((order) => {
        (order.grade || []).forEach(({ tamanho, quantidade }) => {
            addTotal(requested, tamanho, Number(quantidade) || 0);
        });
    });

    const gradeTotals = makeGradeFromMap(requested);
    const supportedSizes = gradeTotals
        .map((item) => item.tamanho)
        .filter((size) => Boolean(SHIRT_MEASUREMENTS[size]));
    const unsupportedSizes = gradeTotals.filter((item) => !SHIRT_MEASUREMENTS[item.tamanho]);
    const supportedRequested = new Map(supportedSizes.map((size) => [size, requested.get(size)]));
    const economy = buildEconomySolution(supportedRequested);
    const rounded = supportedSizes.length ? buildRoundedSolution(supportedSizes, supportedRequested) : { spreads: [] };
    const useRounded = strategy === 'fewer-spreads' && rounded.spreads.length < economy.spreads.length;
    const selected = useRounded ? { spreads: rounded.spreads, loose: new Map() } : economy;
    const spreads = [...selected.spreads]
        .sort((left, right) => right.layers - left.layers || left.sizes.join('|').localeCompare(right.sizes.join('|')))
        .map((spread, index) => ({
            ...spread,
            index: index + 1,
            cutTotals: sortGradeItems(spread.appliedParts.map(({ tamanho, front, back, sleeve }) => ({
                tamanho,
                quantidade: Math.min(front, back, Math.floor(sleeve / 2))
            }))),
            table: CUTTING_TABLE
        }));
    const loose = selected.loose || new Map();
    const producedParts = aggregateSpreadParts(spreads, 'partTotals');
    const appliedParts = makeRequestedParts(supportedRequested);
    const surplusParts = makeSurplusParts(producedParts, loose, appliedParts);
    const shortages = [...unsupportedSizes];
    const fulfilled = new Map(gradeTotals
        .filter((item) => !shortages.some((shortage) => shortage.tamanho === item.tamanho))
        .map((item) => [item.tamanho, item.quantidade]));
    const fabricUsage = spreads.reduce((sum, spread) => sum + spread.fabricUsage, 0);
    const looseCuts = partsToArray(loose);
    const surplusArray = partsToArray(surplusParts);

    return {
        strategy,
        table: CUTTING_TABLE,
        orders: orders || [],
        totalPieces: Array.from(requested.values()).reduce((sum, quantity) => sum + quantity, 0),
        gradeTotals,
        cutTotals: makeGradeFromMap(fulfilled),
        producedParts: partsToArray(producedParts),
        appliedParts: partsToArray(appliedParts),
        looseCuts,
        surplusParts: surplusArray,
        shortages: sortGradeItems(shortages),
        spreads,
        metrics: {
            spreadCount: spreads.length,
            looseCutPieces: looseCuts.reduce((sum, item) => sum + item.front + item.back + item.sleeve, 0),
            surplusPieces: surplusArray.reduce((sum, item) => sum + item.front + item.back + item.sleeve, 0),
            fabricMeters: Number((fabricUsage / 100).toFixed(2))
        }
    };
}
