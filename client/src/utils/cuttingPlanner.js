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

function makeShirtMarkers(size) {
    const measurement = SHIRT_MEASUREMENTS[size];
    if (!measurement) return [];

    return [
        ['front', ...measurement.front],
        ['back', ...measurement.back],
        ['sleeve', ...measurement.sleeve],
        ['sleeve', ...measurement.sleeve]
    ].map(([part, width, height], index) => ({
        id: `${size}-${part}-${index}`,
        part,
        label: PART_LABELS[part],
        size,
        width,
        height,
        rotated: false
    }));
}

function packMarkers(markers) {
    const sorted = [...markers].sort((left, right) => right.height - left.height || right.width - left.width);
    const packed = [];
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (const marker of sorted) {
        if (marker.width > CUTTING_TABLE.width || marker.height > CUTTING_TABLE.height) return null;

        if (x + marker.width > CUTTING_TABLE.width) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }

        if (y + marker.height > CUTTING_TABLE.height) return null;

        packed.push({ ...marker, x, y });
        x += marker.width;
        rowHeight = Math.max(rowHeight, marker.height);
    }

    return packed;
}

function makeGradeFromMap(map) {
    return sortGradeItems(Array.from(map.entries()).map(([tamanho, quantidade]) => ({ tamanho, quantidade })));
}

function addSpread(spreads, layers, sizes) {
    const markers = sizes.flatMap((size) => makeShirtMarkers(size));
    const packed = packMarkers(markers);
    if (!packed) return false;
    const usedLength = Math.round(Math.max(...packed.map((marker) => marker.y + marker.height)) * 10) / 10;

    const cutMap = new Map();
    sizes.forEach((size) => addTotal(cutMap, size, layers));

    spreads.push({
        index: spreads.length + 1,
        layers,
        sizes,
        markers: packed,
        usedLength,
        cutTotals: makeGradeFromMap(cutMap),
        table: CUTTING_TABLE
    });
    return true;
}

export function buildCuttingPlan(orders) {
    const remaining = new Map();
    const requested = new Map();

    (orders || []).forEach((order) => {
        (order.grade || []).forEach(({ tamanho, quantidade }) => {
            addTotal(remaining, tamanho, Number(quantidade) || 0);
            addTotal(requested, tamanho, Number(quantidade) || 0);
        });
    });

    const spreads = [];

    while (Array.from(remaining.values()).some((quantity) => quantity > 0)) {
        const activeSizes = makeGradeFromMap(remaining).filter((item) => item.quantidade > 0).map((item) => item.tamanho);
        const layers = Math.min(...activeSizes.map((size) => remaining.get(size)));
        let sizes = [...activeSizes];

        while (sizes.length && !addSpread(spreads, layers, sizes)) {
            sizes = sizes.slice(0, -1);
        }

        if (!sizes.length) break;
        sizes.forEach((size) => remaining.set(size, remaining.get(size) - layers));
    }

    const cutMap = new Map();
    spreads.forEach((spread) => {
        spread.cutTotals.forEach(({ tamanho, quantidade }) => addTotal(cutMap, tamanho, quantidade));
    });

    const shortages = makeGradeFromMap(remaining).filter((item) => item.quantidade > 0);

    return {
        table: CUTTING_TABLE,
        orders: orders || [],
        totalPieces: Array.from(requested.values()).reduce((sum, quantity) => sum + quantity, 0),
        gradeTotals: makeGradeFromMap(requested),
        cutTotals: makeGradeFromMap(cutMap),
        shortages,
        spreads
    };
}
