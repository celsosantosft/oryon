import { financeDay } from './financeEntry.js';

export const INITIAL_CASH_SUMMARY = {
    receitas: 0,
    despesas: 0,
    variacao_caixa: 0,
    undated: { count: 0, income: 0, expense: 0 },
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
    const today = parseDateFromInput(financeDay(referenceDate));

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

export const getDisplayDate = (transaction) => {
    if ('movement_date' in transaction) return transaction.movement_date || '';
    return (transaction.status === 'Pago' ? transaction.payment_date : transaction.due_date) || '';
};

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
        cashChangePercent: receitas > 0 ? ((receitas - despesas) / receitas) * 100 : null,
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

export const calculateMarketingInsights = (transactions, marketingTransactions, rangeInsights, rangeDays, dailyBudget) => {
    const marketingSpend = marketingTransactions.reduce((total, row) => total + normalizeNumber(row.amount), 0);
    const ordersWithReceipts = new Set();
    const ordersWithExpenses = new Set();
    let orderRevenue = 0;

    for (const row of transactions) {
        if (!row.order_id) continue;
        if (row.type === 'Receita') {
            ordersWithReceipts.add(row.order_id);
            orderRevenue += normalizeNumber(row.amount);
        } else if (row.type === 'Despesa' && normalizeNumber(row.amount) > 0) {
            ordersWithExpenses.add(row.order_id);
        }
    }

    const paidOrderCount = ordersWithReceipts.size;
    const ordersWithLinkedExpenses = [...ordersWithReceipts].filter((id) => ordersWithExpenses.has(id)).length;
    return {
        marketingSpend,
        marketingShare: rangeInsights.despesas > 0 ? marketingSpend / rangeInsights.despesas * 100 : 0,
        paidOrderCount,
        ordersWithLinkedExpenses,
        orderRevenue,
        averageRevenuePerOrder: paidOrderCount ? orderRevenue / paidOrderCount : null,
        receiptsPerMarketingReal: marketingSpend > 0 ? orderRevenue / marketingSpend : null,
        currentDailyMarketing: rangeDays > 0 ? marketingSpend / rangeDays : 0,
        projectedBudget: normalizeNumber(dailyBudget) * rangeDays
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
