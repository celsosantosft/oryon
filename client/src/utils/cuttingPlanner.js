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

function makeMarkerCounts(sizes, requested, layers) {
    return Object.fromEntries(sizes.map((size) => {
        const quantity = requested.get(size);
        return [size, {
            front: Math.ceil(quantity / layers),
            back: Math.ceil(quantity / layers),
            sleeve: Math.ceil((quantity * 2) / layers)
        }];
    }));
}

function makeMarkers(markerCounts) {
    return Object.entries(markerCounts).flatMap(([size, counts]) => PARTS.flatMap((part) => {
        const [width, height] = SHIRT_MEASUREMENTS[size][part];
        return Array.from({ length: counts[part] }, (_, index) => ({
            id: `${size}-${part}-${index}`,
            part,
            label: PART_LABELS[part],
            size,
            width,
            height,
            rotated: false
        }));
    }));
}

function makePartTotals(markerCounts, layers) {
    return Object.entries(markerCounts).map(([size, counts]) => ({
        tamanho: size,
        front: counts.front * layers,
        back: counts.back * layers,
        sleeve: counts.sleeve * layers
    }));
}

function countCandidate(markerCounts, requested, layers) {
    const partTotals = makePartTotals(markerCounts, layers);
    let surplusPieces = 0;

    partTotals.forEach(({ tamanho, front, back, sleeve }) => {
        const quantity = requested.get(tamanho);
        surplusPieces += front - quantity;
        surplusPieces += back - quantity;
        surplusPieces += sleeve - (quantity * 2);
    });

    return { partTotals, surplusPieces };
}

function cloneMarkerCounts(markerCounts) {
    return Object.fromEntries(Object.entries(markerCounts).map(([size, counts]) => [size, { ...counts }]));
}

function makeSingleMarker(size, part, index) {
    const [width, height] = SHIRT_MEASUREMENTS[size][part];
    return {
        id: `${size}-${part}-${index}`,
        part,
        label: PART_LABELS[part],
        size,
        width,
        height,
        rotated: false,
        extra: true
    };
}

function compareFillOptions(left, right) {
    return (right.marker.width * right.marker.height) - (left.marker.width * left.marker.height)
        || left.usedLength - right.usedLength
        || left.marker.id.localeCompare(right.marker.id);
}

function fillSpread(spread, availableSizes, requested) {
    const baseMarkerCounts = cloneMarkerCounts(spread.markerCounts);
    const markerCounts = cloneMarkerCounts(spread.markerCounts);
    let markers = makeMarkers(markerCounts);
    let packed = spread.markers;

    while (true) {
        const options = [];

        availableSizes.forEach((size) => {
            PARTS.forEach((part) => {
                const index = markerCounts[size]?.[part] || 0;
                const marker = makeSingleMarker(size, part, index);
                const candidatePacked = packMarkers([...markers, marker]);
                if (!candidatePacked) return;

                options.push({
                    marker,
                    packed: candidatePacked,
                    usedLength: Math.max(...candidatePacked.map((item) => item.y + item.height))
                });
            });
        });

        if (!options.length) break;

        options.sort(compareFillOptions);
        const selected = options[0];
        if (!markerCounts[selected.marker.size]) {
            markerCounts[selected.marker.size] = { front: 0, back: 0, sleeve: 0 };
        }
        markerCounts[selected.marker.size][selected.marker.part] += 1;
        markers = [...markers, selected.marker];
        packed = selected.packed;
    }

    const usedLength = Math.round(Math.max(...packed.map((marker) => marker.y + marker.height)) * 10) / 10;
    const partTotals = makePartTotals(markerCounts, spread.layers);
    const baseSizes = new Set(spread.sizes);
    const surplusParts = sortGradeItems(partTotals.map((item) => {
        const quantity = baseSizes.has(item.tamanho) ? requested.get(item.tamanho) : 0;
        return {
            tamanho: item.tamanho,
            front: Math.max(0, item.front - quantity),
            back: Math.max(0, item.back - quantity),
            sleeve: Math.max(0, item.sleeve - (quantity * 2))
        };
    }).filter((item) => item.front || item.back || item.sleeve));

    return {
        ...spread,
        baseMarkerCounts,
        markerCounts,
        markers: packed,
        fillMarkers: packed.filter((marker) => marker.extra),
        partTotals,
        surplusParts,
        usedLength,
        fabricUsage: spread.layers * usedLength
    };
}

function compareSpreadCandidates(left, right) {
    return left.surplusPieces - right.surplusPieces
        || left.fabricUsage - right.fabricUsage
        || left.markers.length - right.markers.length
        || left.sizes.join('|').localeCompare(right.sizes.join('|'));
}

function buildBestSpread(sizes, requested) {
    const maxLayers = Math.max(...sizes.map((size) => requested.get(size)));
    let best = null;

    for (let layers = 1; layers <= maxLayers; layers += 1) {
        const markerCounts = makeMarkerCounts(sizes, requested, layers);
        const markers = makeMarkers(markerCounts);
        const markerArea = markers.reduce((sum, marker) => sum + (marker.width * marker.height), 0);
        if (markerArea > CUTTING_TABLE.width * CUTTING_TABLE.height) continue;

        const packed = packMarkers(markers);
        if (!packed) continue;

        const usedLength = Math.round(Math.max(...packed.map((marker) => marker.y + marker.height)) * 10) / 10;
        const counted = countCandidate(markerCounts, requested, layers);
        const candidate = {
            layers,
            sizes,
            markerCounts,
            markers: packed,
            usedLength,
            fabricUsage: layers * usedLength,
            ...counted
        };

        if (!best || compareSpreadCandidates(candidate, best) < 0) best = candidate;
    }

    return best;
}

function comparePlanCandidates(left, right) {
    return left.spreads.length - right.spreads.length
        || left.surplusPieces - right.surplusPieces
        || left.fabricUsage - right.fabricUsage;
}

function partitionSizes(sizes, requested) {
    const spreadByMask = new Map();
    const fullMask = (1 << sizes.length) - 1;

    for (let mask = 1; mask <= fullMask; mask += 1) {
        const subset = sizes.filter((_, index) => (mask & (1 << index)) !== 0);
        const spread = buildBestSpread(subset, requested);
        if (spread) spreadByMask.set(mask, spread);
    }

    const memo = new Map([[0, { spreads: [], surplusPieces: 0, fabricUsage: 0 }]]);
    const solve = (mask) => {
        if (memo.has(mask)) return memo.get(mask);

        const firstSizeBit = mask & -mask;
        let best = null;

        for (let subsetMask = mask; subsetMask > 0; subsetMask = (subsetMask - 1) & mask) {
            if ((subsetMask & firstSizeBit) === 0 || !spreadByMask.has(subsetMask)) continue;

            const remainder = solve(mask ^ subsetMask);
            if (!remainder) continue;

            const spread = spreadByMask.get(subsetMask);
            const candidate = {
                spreads: [spread, ...remainder.spreads],
                surplusPieces: spread.surplusPieces + remainder.surplusPieces,
                fabricUsage: spread.fabricUsage + remainder.fabricUsage
            };
            if (!best || comparePlanCandidates(candidate, best) < 0) best = candidate;
        }

        memo.set(mask, best);
        return best;
    };

    return solve(fullMask);
}

function aggregateProducedParts(spreads) {
    const produced = new Map();

    spreads.forEach((spread) => {
        spread.partTotals.forEach(({ tamanho, front, back, sleeve }) => {
            const current = produced.get(tamanho) || { front: 0, back: 0, sleeve: 0 };
            current.front += front;
            current.back += back;
            current.sleeve += sleeve;
            produced.set(tamanho, current);
        });
    });
    return produced;
}

function makeSurplusParts(produced, requested) {
    const surplus = new Map();

    produced.forEach((parts, size) => {
        const quantity = requested.get(size) || 0;
        const extra = {
            tamanho: size,
            front: Math.max(0, parts.front - quantity),
            back: Math.max(0, parts.back - quantity),
            sleeve: Math.max(0, parts.sleeve - (quantity * 2))
        };
        if (extra.front || extra.back || extra.sleeve) surplus.set(size, extra);
    });

    return sortGradeItems(Array.from(surplus.values()));
}

export function buildCuttingPlan(orders) {
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
    const solution = supportedSizes.length ? partitionSizes(supportedSizes, requested) : null;
    const plannedSpreads = (solution?.spreads || []).map((spread) => fillSpread(spread, supportedSizes, requested));
    const spreads = [...plannedSpreads]
        .sort((left, right) => right.layers - left.layers || left.sizes.join('|').localeCompare(right.sizes.join('|')))
        .map((spread, index) => ({
            ...spread,
            index: index + 1,
            cutTotals: sortGradeItems(spread.partTotals.map(({ tamanho, front, back, sleeve }) => ({
                tamanho,
                quantidade: Math.min(front, back, Math.floor(sleeve / 2))
            }))),
            table: CUTTING_TABLE
        }));
    const producedParts = aggregateProducedParts(spreads);
    const plannedSizes = new Set(spreads.flatMap((spread) => spread.sizes));
    const shortages = [
        ...unsupportedSizes,
        ...gradeTotals.filter((item) => SHIRT_MEASUREMENTS[item.tamanho] && !plannedSizes.has(item.tamanho))
    ];
    const fulfilled = new Map(gradeTotals
        .filter((item) => !shortages.some((shortage) => shortage.tamanho === item.tamanho))
        .map((item) => [item.tamanho, item.quantidade]));

    return {
        table: CUTTING_TABLE,
        orders: orders || [],
        totalPieces: Array.from(requested.values()).reduce((sum, quantity) => sum + quantity, 0),
        gradeTotals,
        cutTotals: makeGradeFromMap(fulfilled),
        producedParts: sortGradeItems(Array.from(producedParts.entries()).map(([tamanho, parts]) => ({ tamanho, ...parts }))),
        surplusParts: makeSurplusParts(producedParts, requested),
        shortages: sortGradeItems(shortages),
        spreads
    };
}
