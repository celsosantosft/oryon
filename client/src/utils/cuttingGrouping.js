export const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'];

export function normalizeCuttingKey(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function sortGradeItems(grade) {
    return [...grade].sort((left, right) => {
        const leftIndex = SIZE_ORDER.indexOf(left.tamanho);
        const rightIndex = SIZE_ORDER.indexOf(right.tamanho);

        if (leftIndex === -1 && rightIndex === -1) return left.tamanho.localeCompare(right.tamanho);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
    });
}

export function normalizeBaseFabric(value) {
    const rawValue = String(value || '').trim() || 'Não Informado';
    const normalized = normalizeCuttingKey(rawValue);

    if (normalized.includes('dryfit') || normalized.includes('dry fit')) return 'Dryfit';
    if (normalized.includes('helanca')) return 'Helanca';
    if (normalized.includes('algodao')) return 'Algodão';
    if (normalized.includes('moletom')) return 'Moletom';
    if (normalized.includes('pv')) return 'PV';

    return rawValue.split(/\s+/)[0] || 'Não Informado';
}

export function detectModeling(value) {
    const normalized = normalizeCuttingKey(value);

    if (normalized.includes('raglan')) return 'Camisa Raglan';
    if (normalized.includes('regata')) return 'Regata';
    if (normalized.includes('short') || normalized.includes('calcao')) return 'Short';
    if (normalized.includes('baby')) return 'Baby Look';
    if (normalized.includes('polo')) return 'Polo';
    if (normalized.includes('camisa') || normalized.includes('camiseta')) return 'Camisa';

    return String(value || '').trim() || 'Não Classificado';
}

function normalizeGrade(grade) {
    if (Array.isArray(grade)) {
        return grade
            .map(({ tamanho, quantidade }) => ({
                tamanho: String(tamanho || '').trim().toUpperCase(),
                quantidade: Number(quantidade) || 0
            }))
            .filter((item) => item.tamanho && item.quantidade > 0);
    }

    return Object.entries(grade || {})
        .map(([tamanho, quantidade]) => ({
            tamanho: String(tamanho || '').trim().toUpperCase(),
            quantidade: Number(quantidade) || 0
        }))
        .filter((item) => item.tamanho && item.quantidade > 0);
}

function addGradeToMap(map, grade) {
    grade.forEach(({ tamanho, quantidade }) => {
        map.set(tamanho, (map.get(tamanho) || 0) + quantidade);
    });
}

function mapGradeTotals(map, sizesToShow) {
    return sortGradeItems(
        sizesToShow.map((tamanho) => ({
            tamanho,
            quantidade: map.get(tamanho) || 0
        }))
    );
}

export function buildCuttingFabricTabs(pedidos) {
    const fabrics = new Map();

    (pedidos || []).forEach((pedido) => {
        (pedido.produtos || []).forEach((produto) => {
            const baseFabric = normalizeBaseFabric(produto.tecido);
            const modeling = detectModeling(produto.nome_produto);
            const grade = normalizeGrade(produto.grade);

            const fabricKey = normalizeCuttingKey(baseFabric);
            const modelingKey = normalizeCuttingKey(modeling);

            if (!fabrics.has(fabricKey)) {
                fabrics.set(fabricKey, {
                    id: fabricKey,
                    label: baseFabric,
                    totalPieces: 0,
                    gradeMap: new Map(),
                    orderIds: new Set(),
                    modelings: new Map()
                });
            }

            const fabric = fabrics.get(fabricKey);
            if (!fabric.modelings.has(modelingKey)) {
                fabric.modelings.set(modelingKey, {
                    id: `${fabricKey}-${modelingKey}`,
                    label: modeling,
                    totalPieces: 0,
                    gradeMap: new Map(),
                    orderIds: new Set(),
                    orders: []
                });
            }

            const group = fabric.modelings.get(modelingKey);
            const totalPieces = grade.reduce((sum, item) => sum + item.quantidade, 0);
            const order = {
                ...pedido,
                produto,
                fabricLabel: baseFabric,
                modelingLabel: modeling,
                grade: sortGradeItems(grade),
                totalPieces
            };

            fabric.totalPieces += totalPieces;
            group.totalPieces += totalPieces;
            fabric.orderIds.add(pedido.id_pedido);
            group.orderIds.add(pedido.id_pedido);
            addGradeToMap(fabric.gradeMap, grade);
            addGradeToMap(group.gradeMap, grade);
            group.orders.push(order);
        });
    });

    return Array.from(fabrics.values())
        .map((fabric) => {
            const sizesToShow = sortGradeItems(
                Array.from(fabric.gradeMap.keys()).map((tamanho) => ({ tamanho, quantidade: 0 }))
            ).map(({ tamanho }) => tamanho);

            return {
                id: fabric.id,
                label: fabric.label,
                totalPieces: fabric.totalPieces,
                orderCount: fabric.orderIds.size,
                gradeTotals: mapGradeTotals(fabric.gradeMap, sizesToShow),
                modelings: Array.from(fabric.modelings.values())
                    .map((group) => ({
                        id: group.id,
                        label: group.label,
                        totalPieces: group.totalPieces,
                        orderCount: group.orderIds.size,
                        gradeTotals: mapGradeTotals(group.gradeMap, sizesToShow),
                        orders: group.orders.sort(compareCuttingOrders)
                    }))
                    .sort((left, right) => left.label.localeCompare(right.label))
            };
        })
        .sort((left, right) => left.label.localeCompare(right.label));
}

export function compareCuttingOrders(left, right) {
    const leftPriority = left.priority === 'high' ? 0 : 1;
    const rightPriority = right.priority === 'high' ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftDate = left.delivery_date || '9999-12-31';
    const rightDate = right.delivery_date || '9999-12-31';
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);

    return Number(left.id_pedido || 0) - Number(right.id_pedido || 0);
}
