export const INITIAL_DRE = {
    receitas: 0,
    despesas: 0,
    lucro_operacional: 0,
    margem: 0,
    monthlyData: [],
    categoryData: []
};

export const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const PRESET_OPTIONS = [
    { id: 'current-month', label: 'Mês atual' },
    { id: 'last-30', label: '30 dias' },
    { id: 'last-90', label: '90 dias' },
    { id: 'year-to-date', label: 'Ano atual' },
    { id: 'custom', label: 'Personalizar' }
];

export const DEFAULT_FINANCE_THEME = {
    primary: '#2563EB',
    secondary: '#0F172A',
    accent: '#38BDF8'
};

export const MARKETING_KEYWORDS = ['marketing', 'markenting', 'trafego', 'tráfego', 'ads', 'anuncio', 'anúncio', 'google', 'meta', 'facebook', 'instagram'];

export const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
}).format(Number(value) || 0);

export const formatCompactMoney = (value) => {
    const numericValue = Number(value) || 0;

    if (Math.abs(numericValue) < 1000) return formatMoney(numericValue);

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(numericValue);
};

export const formatPercent = (value) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
export const normalizeNumber = (value) => Number(value) || 0;
export const clampPercentage = (value) => Math.max(0, Math.min(Number(value) || 0, 100));

export const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

export const normalizeText = (value) => (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const formatDateInput = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
].join('-');

export const parseDateFromInput = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const addDays = (date, amount) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
};

export const getCurrentMonthKey = (referenceDate = new Date()) => (
    `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
);

export const buildPresetRange = (preset, referenceDate = new Date()) => {
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    if (preset === 'current-month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    if (preset === 'last-30') {
        start = addDays(today, -29);
        end = today;
    }

    if (preset === 'last-90') {
        start = addDays(today, -89);
        end = today;
    }

    if (preset === 'year-to-date') {
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
    }

    return {
        startDate: formatDateInput(start),
        endDate: formatDateInput(end)
    };
};

export const sanitizeCustomRange = (range) => {
    if (!range?.startDate || !range?.endDate) return buildPresetRange('current-month');
    if (range.startDate <= range.endDate) return range;
    return { startDate: range.endDate, endDate: range.startDate };
};

export const getDaysBetweenInclusive = (startDate, endDate) => {
    const start = parseDateFromInput(startDate);
    const end = parseDateFromInput(endDate);
    const difference = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return difference + 1;
};

export const formatCalendarDate = (dateString) => {
    if (!dateString) return '--';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const formatLongDate = (dateString) => {
    if (!dateString) return '';
    return capitalize(new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(parseDateFromInput(dateString)));
};

export const formatMonthShortLabel = (monthKey) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    return `${MONTH_NAMES_SHORT[Number(month) - 1]}/${String(year).slice(-2)}`;
};

export const formatMonthLongLabel = (monthKey) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-').map(Number);
    return capitalize(new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric'
    }).format(new Date(year, month - 1, 1)));
};

export const getPeriodLabel = (preset, range) => {
    if (preset === 'current-month') return formatMonthLongLabel(range.startDate.slice(0, 7));
    if (preset === 'last-30') return 'Últimos 30 dias';
    if (preset === 'last-90') return 'Últimos 90 dias';
    if (preset === 'year-to-date') return `Ano atual até ${formatCalendarDate(range.endDate)}`;
    return `${formatLongDate(range.startDate)} até ${formatLongDate(range.endDate)}`;
};

export const getDisplayDate = (transaction) => transaction.movement_date || transaction.payment_date || transaction.due_date || '';

export const groupTransactionsByPeriod = (transactions, rangeDays) => {
    const grouped = {};
    const useDaily = rangeDays <= 45;

    transactions.forEach((transaction) => {
        const movementDate = getDisplayDate(transaction);
        if (!movementDate) return;

        const key = useDaily ? movementDate : movementDate.slice(0, 7);

        if (!grouped[key]) {
            grouped[key] = useDaily
                ? {
                    key,
                    label: movementDate.slice(8, 10),
                    fullLabel: formatCalendarDate(movementDate),
                    Receitas: 0,
                    Despesas: 0
                }
                : {
                    key,
                    label: formatMonthShortLabel(movementDate.slice(0, 7)),
                    fullLabel: formatMonthLongLabel(movementDate.slice(0, 7)),
                    Receitas: 0,
                    Despesas: 0
                };
        }

        if (transaction.type === 'Receita') grouped[key].Receitas += normalizeNumber(transaction.amount);
        if (transaction.type === 'Despesa') grouped[key].Despesas += normalizeNumber(transaction.amount);
    });

    return Object.values(grouped)
        .sort((first, second) => first.key.localeCompare(second.key))
        .map((item) => ({
            ...item,
            Resultado: item.Receitas - item.Despesas
        }));
};

export const calculateRangeInsights = (transactions, rangeDays) => {
    const expenseMap = {};
    let receitas = 0;
    let despesas = 0;
    let revenueCount = 0;
    let expenseCount = 0;
    let topRevenue = null;
    let topExpense = null;

    transactions.forEach((transaction) => {
        const amount = normalizeNumber(transaction.amount);
        const displayDate = getDisplayDate(transaction);

        if (transaction.type === 'Receita') {
            receitas += amount;
            revenueCount += 1;
            if (!topRevenue || amount > topRevenue.amount) topRevenue = { ...transaction, amount, displayDate };
        }

        if (transaction.type === 'Despesa') {
            despesas += amount;
            expenseCount += 1;
            const categoryName = transaction.account_name || 'Geral/Sem Categoria';

            if (!expenseMap[categoryName]) expenseMap[categoryName] = { name: categoryName, total: 0, count: 0 };

            expenseMap[categoryName].total += amount;
            expenseMap[categoryName].count += 1;

            if (!topExpense || amount > topExpense.amount) topExpense = { ...transaction, amount, displayDate };
        }
    });

    return {
        receitas,
        despesas,
        saldo: receitas - despesas,
        margem: receitas > 0 ? ((receitas - despesas) / receitas) * 100 : (despesas > 0 ? -100 : 0),
        volume: receitas + despesas,
        revenueCount,
        expenseCount,
        averageRevenue: revenueCount > 0 ? receitas / revenueCount : 0,
        averageExpense: expenseCount > 0 ? despesas / expenseCount : 0,
        expenseCategoryData: Object.values(expenseMap)
            .sort((first, second) => second.total - first.total)
            .slice(0, 7)
            .map((item) => ({
                ...item,
                share: despesas > 0 ? (item.total / despesas) * 100 : 0
            })),
        trendData: groupTransactionsByPeriod(transactions, rangeDays),
        trendMode: rangeDays <= 45 ? 'daily' : 'monthly',
        recentMovements: [...transactions]
            .sort((first, second) => new Date(getDisplayDate(second)) - new Date(getDisplayDate(first)))
            .slice(0, 7)
            .map((transaction) => ({
                ...transaction,
                amount: normalizeNumber(transaction.amount),
                displayDate: getDisplayDate(transaction)
            })),
        topRevenue,
        topExpense
    };
};

export const calculateMarketingInsights = (transactions, rangeInsights, rangeDays, dailyBudget) => {
    const marketingTransactions = transactions.filter((transaction) => {
        if (transaction.type !== 'Despesa') return false;
        const haystack = normalizeText(`${transaction.account_name || ''} ${transaction.description || ''} ${transaction.cost_center_name || ''}`);
        return MARKETING_KEYWORDS.some((keyword) => haystack.includes(normalizeText(keyword)));
    });

    const marketingSpend = marketingTransactions.reduce((total, transaction) => total + normalizeNumber(transaction.amount), 0);
    const marketingShare = rangeInsights.despesas > 0 ? (marketingSpend / rangeInsights.despesas) * 100 : 0;

    const orderRevenueMap = {};
    const orderCostMap = {};

    transactions.forEach((transaction) => {
        if (!transaction.order_id) return;

        if (transaction.type === 'Receita') orderRevenueMap[transaction.order_id] = (orderRevenueMap[transaction.order_id] || 0) + normalizeNumber(transaction.amount);
        if (transaction.type === 'Despesa') orderCostMap[transaction.order_id] = (orderCostMap[transaction.order_id] || 0) + normalizeNumber(transaction.amount);
    });

    const paidOrderIds = Object.keys(orderRevenueMap);
    const paidOrderCount = paidOrderIds.length;
    const orderRevenue = paidOrderIds.reduce((total, orderId) => total + (orderRevenueMap[orderId] || 0), 0);
    const orderCost = paidOrderIds.reduce((total, orderId) => total + (orderCostMap[orderId] || 0), 0);
    const averageRevenuePerOrder = paidOrderCount > 0 ? orderRevenue / paidOrderCount : 0;
    const averageProfitPerOrder = paidOrderCount > 0 ? (orderRevenue - orderCost) / paidOrderCount : 0;
    const estimatedRoas = marketingSpend > 0 ? orderRevenue / marketingSpend : 0;
    const estimatedProfitRoas = marketingSpend > 0 ? (orderRevenue - orderCost) / marketingSpend : 0;
    const projectedBudget = normalizeNumber(dailyBudget) * rangeDays;
    const breakEvenOrders = averageProfitPerOrder > 0 ? Math.ceil(projectedBudget / averageProfitPerOrder) : null;
    const comfortOrders = averageProfitPerOrder > 0 ? Math.ceil((projectedBudget * 1.35) / averageProfitPerOrder) : null;

    let scaleMultiplier = 1;
    if (estimatedRoas >= 8 && estimatedProfitRoas >= 3) scaleMultiplier = 1.25;
    else if (estimatedRoas >= 5 && estimatedProfitRoas >= 2) scaleMultiplier = 1.15;
    else if (estimatedRoas > 0 && estimatedRoas < 3) scaleMultiplier = 0.8;

    const currentDailyMarketing = rangeDays > 0 ? marketingSpend / rangeDays : 0;
    const baselineDaily = currentDailyMarketing > 0 ? currentDailyMarketing : normalizeNumber(dailyBudget);
    const suggestedDailyBudget = baselineDaily > 0 ? baselineDaily * scaleMultiplier : 0;

    const recommendations = [];

    if (marketingSpend === 0) {
        recommendations.push({
            title: 'Piloto controlado',
            text: `A categoria Marketing já está pronta. Comece testando entre ${formatMoney(10)} e ${formatMoney(20)} por dia para gerar histórico com segurança.`,
            tone: 'info'
        });
    }

    if (marketingSpend > 0 && averageProfitPerOrder <= 0) {
        recommendations.push({
            title: 'Segurar escala',
            text: 'O lucro médio por pedido ainda não absorve mídia com folga. Primeiro ajuste preço, oferta ou custo antes de subir verba.',
            tone: 'warning'
        });
    }

    if (marketingSpend > 0 && estimatedRoas >= 6 && averageProfitPerOrder > 0) {
        recommendations.push({
            title: 'Escala favorável',
            text: `Os resultados suportam aumentar com prudência. Uma faixa saudável agora gira perto de ${formatMoney(suggestedDailyBudget)} por dia.`,
            tone: 'positive'
        });
    }

    if (marketingSpend > 0 && estimatedRoas >= 3 && estimatedRoas < 6) {
        recommendations.push({
            title: 'Otimizar antes de acelerar',
            text: 'Você já tem tração. Mantenha a verba controlada, ajuste criativos e ofertas e só aumente após consistência.',
            tone: 'info'
        });
    }

    if (marketingSpend > 0 && marketingShare > 25 && rangeInsights.margem < 20) {
        recommendations.push({
            title: 'Peso alto no caixa',
            text: 'O marketing já consome uma fatia grande das saídas para a margem atual do período. Vale revisar campanhas antes de escalar.',
            tone: 'warning'
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Base saudável',
            text: 'Continue registrando marketing no plano de contas e acompanhe pedidos pagos. Quanto mais histórico, mais precisa fica a leitura.',
            tone: 'info'
        });
    }

    return {
        marketingTransactions,
        marketingSpend,
        marketingShare,
        paidOrderCount,
        orderRevenue,
        orderCost,
        averageRevenuePerOrder,
        averageProfitPerOrder,
        estimatedRoas,
        estimatedProfitRoas,
        currentDailyMarketing,
        dailyBudget: normalizeNumber(dailyBudget),
        projectedBudget,
        breakEvenOrders,
        comfortOrders,
        suggestedDailyBudget,
        recommendations
    };
};

export const getStoredFinanceTheme = () => {
    if (typeof window === 'undefined') return DEFAULT_FINANCE_THEME;

    try {
        const stored = window.localStorage.getItem('oryon_finance_theme');
        if (!stored) return DEFAULT_FINANCE_THEME;
        const parsed = JSON.parse(stored);
        return {
            primary: parsed.primary || DEFAULT_FINANCE_THEME.primary,
            secondary: parsed.secondary || DEFAULT_FINANCE_THEME.secondary,
            accent: parsed.accent || DEFAULT_FINANCE_THEME.accent
        };
    } catch {
        return DEFAULT_FINANCE_THEME;
    }
};

export const saveFinanceTheme = (theme) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('oryon_finance_theme', JSON.stringify(theme));
};

export const buildFinanceGradient = (theme) => (
    `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.primary} 55%, ${theme.accent} 100%)`
);
