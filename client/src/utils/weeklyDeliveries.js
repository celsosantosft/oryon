const CLOSED_STATUSES = new Set(['Entregue/Concluído', 'Cancelado', 'Arte Arquivada']);

const parseDeliveryDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = String(dateString).split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day, 12, 0, 0) : null;
};

const normalizeMoney = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const buildWeeklyDeliveryView = (orders, today = new Date(), showAll = false) => {
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 23, 59, 59);
    const activeOrders = (Array.isArray(orders) ? orders : [])
        .filter((order) => parseDeliveryDate(order.delivery_date) && !CLOSED_STATUSES.has(order.status))
        .sort((a, b) => parseDeliveryDate(a.delivery_date) - parseDeliveryDate(b.delivery_date));
    const weeklyOrders = activeOrders.filter((order) => parseDeliveryDate(order.delivery_date) <= cutoff);

    return {
        orders: showAll ? activeOrders : weeklyOrders,
        remainingCount: showAll ? 0 : activeOrders.length - weeklyOrders.length
    };
};

export const getDeliveryFinancialSummary = (order) => {
    const total = normalizeMoney(order?.total_price);
    const paid = Math.max(
        normalizeMoney(order?.amount_paid),
        normalizeMoney(order?.synced_amount_paid)
    );

    return { total, paid, remaining: Math.max(0, total - paid) };
};
