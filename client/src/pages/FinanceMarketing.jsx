import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    MARKETING_KEYWORDS,
    PRESET_OPTIONS,
    buildFinanceGradient,
    buildPresetRange,
    calculateMarketingInsights,
    calculateRangeInsights,
    formatCalendarDate,
    formatCompactMoney,
    formatDateInput,
    formatMoney,
    formatPercent,
    getDisplayDate,
    getDaysBetweenInclusive,
    getPeriodLabel,
    getStoredFinanceTheme,
    normalizeNumber,
    normalizeText,
    saveFinanceTheme,
    sanitizeCustomRange
} from '../utils/financeIntelligence';

const ACTIVE_FILTER_GRADIENT = 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.94) 100%)';
const PRIMARY_ACTION_GRADIENT = 'linear-gradient(135deg, #1E3A8A 0%, #38BDF8 100%)';
const CHANNEL_COLORS = ['#2563EB', '#16A34A', '#F97316', '#7C3AED', '#0F766E'];
const SOURCE_OPTIONS = [
    { value: 'card', label: 'Cartão' },
    { value: 'pix', label: 'PIX' },
    { value: 'bank', label: 'Conta bancária' },
    { value: 'boleto', label: 'Boleto' }
];
const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Diário', multiplier: 1 },
    { value: 'weekly', label: 'Semanal', multiplier: 7 },
    { value: 'monthly', label: 'Mensal', multiplier: 30 }
];
const CHANNEL_OPTIONS = ['Meta/Facebook', 'Google', 'Instagram', 'TikTok', 'LinkedIn', 'Outros'];
const HERO_FALLBACK_THEME = getStoredFinanceTheme();

const Icons = {
    Megaphone: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5v1A2.5 2.5 0 0 0 5.5 15H8l4.8 3.2a1 1 0 0 0 1.55-.83V6.63a1 1 0 0 0-1.55-.83L8 9H5.5A2.5 2.5 0 0 0 3 11.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9a5 5 0 0 1 0 6M17.5 7a8 8 0 0 1 0 10" />
        </svg>
    ),
    Calendar: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    ),
    ArrowRight: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
    ),
    Palette: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 0 0 0 18h1a2 2 0 1 0 0-4h-1a5 5 0 1 1 4.9-6H19a2 2 0 1 0 0-4h-2.1A9 9 0 0 0 12 3Z" />
            <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    ),
    Refresh: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
    ),
    Money: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    TrendUp: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m22 7-8.5 8.5-5-5L2 17" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7h6v6" />
        </svg>
    ),
    Wallet: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-11A2.5 2.5 0 0 1 3 16.5v-9Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h2.5" />
        </svg>
    ),
    Target: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
    ),
    Spark: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.8 4.7L18 9.5l-4.2 1.8L12 16l-1.8-4.7L6 9.5l4.2-1.8L12 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 15 .8 2 .2.8.8.2 2 .8-2 .8-.8.2-.2.8-.8 2-.8-2-.2-.8-.8-.2-2-.8 2-.8.8-.2.2-.8.8-2Z" />
        </svg>
    ),
    Check: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    ),
    Edit: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4l10-10a2.12 2.12 0 1 0-3-3L5 17v3Z" />
        </svg>
    ),
    Trash: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7 5 7M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        </svg>
    )
};

const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};

const getMultiplier = (frequency) => FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.multiplier || 1;

const buildAutoDueDate = (frequency) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDateInput(addDays(today, getMultiplier(frequency) - 1));
};

const getStoredMarketingPlan = () => {
    if (typeof window === 'undefined') {
        return {
            dailyBudget: 10,
            channel: 'Meta/Facebook',
            frequency: 'weekly',
            sourceType: 'card',
            cardLabel: '',
            dueDate: buildAutoDueDate('weekly'),
            notes: ''
        };
    }

    try {
        const stored = window.localStorage.getItem('oryon_marketing_plan');
        if (!stored) {
            return {
                dailyBudget: 10,
                channel: 'Meta/Facebook',
                frequency: 'weekly',
                sourceType: 'card',
                cardLabel: '',
                dueDate: buildAutoDueDate('weekly'),
                notes: ''
            };
        }

        const parsed = JSON.parse(stored);
        return {
            dailyBudget: normalizeNumber(parsed.dailyBudget) || 10,
            channel: parsed.channel || 'Meta/Facebook',
            frequency: parsed.frequency || 'weekly',
            sourceType: parsed.sourceType || 'card',
            cardLabel: parsed.cardLabel || '',
            dueDate: parsed.dueDate || buildAutoDueDate(parsed.frequency || 'weekly'),
            notes: parsed.notes || ''
        };
    } catch {
        return {
            dailyBudget: 10,
            channel: 'Meta/Facebook',
            frequency: 'weekly',
            sourceType: 'card',
            cardLabel: '',
            dueDate: buildAutoDueDate('weekly'),
            notes: ''
        };
    }
};

const saveMarketingPlan = (plan) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('oryon_marketing_plan', JSON.stringify(plan));
};

const buildPaymentMethodLabel = (sourceType, cardLabel) => {
    if (sourceType === 'card') return cardLabel ? `Cartão - ${cardLabel}` : 'Cartão';
    if (sourceType === 'pix') return 'PIX';
    if (sourceType === 'bank') return 'Conta bancária';
    return 'Boleto';
};

const getChannelLabel = (transaction) => {
    const haystack = normalizeText(`${transaction.description || ''} ${transaction.account_name || ''} ${transaction.cost_center_name || ''}`);
    if (haystack.includes('meta') || haystack.includes('facebook') || haystack.includes('instagram')) return 'Meta/Facebook';
    if (haystack.includes('google') || haystack.includes('youtube')) return 'Google';
    if (haystack.includes('tiktok')) return 'TikTok';
    if (haystack.includes('linkedin')) return 'LinkedIn';
    return 'Outros';
};

const isMarketingTransaction = (transaction, marketingAccountId) => {
    const haystack = normalizeText(`${transaction.account_name || ''} ${transaction.description || ''} ${transaction.cost_center_name || ''}`);
    if (marketingAccountId && Number(transaction.chart_of_account_id) === Number(marketingAccountId)) return true;
    return MARKETING_KEYWORDS.some((keyword) => haystack.includes(normalizeText(keyword)));
};

const buildMarketingTrendData = (transactions, marketingTransactions, rangeDays) => {
    const grouped = {};
    const useDaily = rangeDays <= 45;

    const ensureBucket = (key, label, fullLabel) => {
        if (!grouped[key]) {
            grouped[key] = { key, label, fullLabel, Receita: 0, Marketing: 0 };
        }
    };

    transactions.forEach((transaction) => {
        const movementDate = getDisplayDate(transaction);
        if (!movementDate) return;

        const key = useDaily ? movementDate : movementDate.slice(0, 7);
        const label = useDaily
            ? movementDate.slice(8, 10)
            : new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${movementDate.slice(0, 7)}-01T00:00:00`)).replace('.', '');
        const fullLabel = useDaily
            ? formatCalendarDate(movementDate)
            : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${movementDate.slice(0, 7)}-01T00:00:00`));

        ensureBucket(key, label, fullLabel);
        if (transaction.type === 'Receita') grouped[key].Receita += normalizeNumber(transaction.amount);
    });

    marketingTransactions.forEach((transaction) => {
        const movementDate = getDisplayDate(transaction);
        if (!movementDate) return;

        const key = useDaily ? movementDate : movementDate.slice(0, 7);
        const label = useDaily
            ? movementDate.slice(8, 10)
            : new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${movementDate.slice(0, 7)}-01T00:00:00`)).replace('.', '');
        const fullLabel = useDaily
            ? formatCalendarDate(movementDate)
            : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${movementDate.slice(0, 7)}-01T00:00:00`));

        ensureBucket(key, label, fullLabel);
        grouped[key].Marketing += normalizeNumber(transaction.amount);
    });

    return Object.values(grouped).sort((first, second) => first.key.localeCompare(second.key));
};

const buildChannelData = (transactions) => {
    const grouped = transactions.reduce((accumulator, transaction) => {
        const channel = getChannelLabel(transaction);
        if (!accumulator[channel]) accumulator[channel] = { name: channel, value: 0 };
        accumulator[channel].value += normalizeNumber(transaction.amount);
        return accumulator;
    }, {});

    return Object.values(grouped).sort((first, second) => second.value - first.value);
};

const getRecommendationTone = (tone) => {
    if (tone === 'positive') {
        return {
            border: 'rgba(34,197,94,0.22)',
            background: 'linear-gradient(180deg, rgba(240,253,244,0.96), rgba(220,252,231,0.82))',
            icon: '#16A34A'
        };
    }

    if (tone === 'warning') {
        return {
            border: 'rgba(249,115,22,0.22)',
            background: 'linear-gradient(180deg, rgba(255,247,237,0.96), rgba(255,237,213,0.82))',
            icon: '#EA580C'
        };
    }

    return {
        border: 'rgba(37,99,235,0.2)',
        background: 'linear-gradient(180deg, rgba(239,246,255,0.96), rgba(219,234,254,0.82))',
        icon: '#2563EB'
    };
};

const KPI_THEMES = {
    spend: {
        surface: '#FAFAFA',
        border: '#FED7AA',
        iconBackground: '#FFF7ED',
        iconColor: '#EA580C',
        labelColor: '#64748B',
        helperColor: '#475569'
    },
    share: {
        surface: '#FAFAFA',
        border: '#BFDBFE',
        iconBackground: '#EFF6FF',
        iconColor: '#1D4ED8',
        labelColor: '#64748B',
        helperColor: '#475569'
    },
    roas: {
        surface: '#FAFAFA',
        border: '#A7F3D0',
        iconBackground: '#ECFDF5',
        iconColor: '#15803D',
        labelColor: '#64748B',
        helperColor: '#475569'
    },
    profit: {
        surface: '#FAFAFA',
        border: '#CBD5E1',
        iconBackground: '#F8FAFC',
        iconColor: '#0F172A',
        labelColor: '#64748B',
        helperColor: '#475569'
    }
};

const StatCard = ({ icon, label, value, helper, accent, tone = 'share' }) => {
    const visual = KPI_THEMES[tone] || KPI_THEMES.share;

    return (
        <div className="marketing-stat-card" style={{ ...styles.statCard, background: visual.surface, border: `1px solid ${visual.border}` }}>
            <div style={styles.statTop}>
                <div style={styles.statHeading}>
                    <p style={{ ...styles.statLabel, color: visual.labelColor }}>{label}</p>
                    <h3 style={styles.statValue}>{value}</h3>
                </div>
                <div style={{ ...styles.statIcon, backgroundColor: visual.iconBackground, color: visual.iconColor }}>{icon}</div>
            </div>
            {accent ? <span style={{ ...styles.statAccent, backgroundColor: visual.iconBackground, color: visual.iconColor }}>{accent}</span> : null}
            <p style={{ ...styles.statHelper, color: visual.helperColor }}>{helper}</p>
        </div>
    );
};

const ScenarioCard = ({ label, value, helper, tone = '#0F172A' }) => (
    <div style={styles.scenarioCard}>
        <span style={styles.scenarioLabel}>{label}</span>
        <strong style={{ ...styles.scenarioValue, color: tone }}>{value}</strong>
        <span style={styles.scenarioHelper}>{helper}</span>
    </div>
);

const PendingChargeCard = ({ transaction, onPay, onEdit, onDelete }) => (
    <div style={styles.pendingCard}>
        <div style={styles.pendingTop}>
            <div>
                <strong style={styles.pendingTitle}>{transaction.description}</strong>
                <div style={styles.pendingMeta}>
                    <span>{transaction.payment_method || 'Forma pendente'}</span>
                    <span>{formatCalendarDate(transaction.due_date)}</span>
                    <span>{getChannelLabel(transaction)}</span>
                </div>
            </div>
            <strong style={styles.pendingAmount}>{formatMoney(transaction.amount)}</strong>
        </div>

        <div style={styles.pendingActions}>
            <button type="button" onClick={() => onEdit(transaction)} style={styles.pendingSecondaryButton}>
                {Icons.Edit} Editar
            </button>
            <button type="button" onClick={() => onDelete(transaction)} style={styles.pendingDeleteButton}>
                {Icons.Trash} Excluir
            </button>
            <button type="button" onClick={() => onPay(transaction)} style={styles.payButton}>
                {Icons.Check} Efetuar pagamento
            </button>
        </div>
    </div>
);

const RecommendationCard = ({ item }) => {
    const tone = getRecommendationTone(item.tone);

    return (
        <div style={{ ...styles.recommendationCard, borderColor: tone.border, background: tone.background }}>
            <div style={{ ...styles.recommendationIcon, color: tone.icon }}>{Icons.Spark}</div>
            <div>
                <strong style={styles.recommendationTitle}>{item.title}</strong>
                <p style={styles.recommendationText}>{item.text}</p>
            </div>
        </div>
    );
};

const FinanceMarketing = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const customStartDateRef = useRef(null);
    const customEndDateRef = useRef(null);

    const [transactions, setTransactions] = useState([]);
    const [pendingCharges, setPendingCharges] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingCharge, setSavingCharge] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [lastUpdated, setLastUpdated] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('last-30');
    const [customRange, setCustomRange] = useState(buildPresetRange('last-30'));
    const [relativeNow, setRelativeNow] = useState(Date.now());
    const [theme, setTheme] = useState(() => HERO_FALLBACK_THEME);
    const [themeDraft, setThemeDraft] = useState(() => HERO_FALLBACK_THEME);
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [plan, setPlan] = useState(() => getStoredMarketingPlan());

    const marketingAccount = useMemo(
        () => accounts.find((account) => normalizeText(account.name) === 'marketing' && account.type === 'Despesa'),
        [accounts]
    );

    useEffect(() => {
        if (selectedPreset === 'custom') return undefined;
        const interval = setInterval(() => setRelativeNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [selectedPreset]);

    const activeRange = useMemo(() => (
        selectedPreset === 'custom'
            ? sanitizeCustomRange(customRange)
            : buildPresetRange(selectedPreset, new Date(relativeNow))
    ), [customRange, relativeNow, selectedPreset]);

    const rangeDays = useMemo(
        () => getDaysBetweenInclusive(activeRange.startDate, activeRange.endDate),
        [activeRange]
    );

    const periodLabel = useMemo(
        () => getPeriodLabel(selectedPreset, activeRange),
        [activeRange, selectedPreset]
    );

    const plannedChargeAmount = useMemo(
        () => normalizeNumber(plan.dailyBudget) * getMultiplier(plan.frequency),
        [plan.dailyBudget, plan.frequency]
    );

    const topGradient = useMemo(
        () => buildFinanceGradient(theme),
        [theme]
    );

    const fetchData = async () => {
        setLoading(true);

        try {
            const [accountsResponse, paidResponse, pendingResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/finance/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/finance/transactions`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        status: 'Pago',
                        start_date: activeRange.startDate,
                        end_date: activeRange.endDate
                    }
                }),
                axios.get(`${API_BASE_URL}/api/finance/transactions`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        type: 'Despesa',
                        status: 'Pendente'
                    }
                })
            ]);

            const accountList = accountsResponse.data || [];
            const marketingAccountEntry = accountList.find((account) => normalizeText(account.name) === 'marketing' && account.type === 'Despesa');

            setAccounts(accountList);
            setTransactions(paidResponse.data || []);
            setPendingCharges(
                (pendingResponse.data || [])
                    .filter((transaction) => isMarketingTransaction(transaction, marketingAccountEntry?.id))
                    .sort((first, second) => new Date(first.due_date) - new Date(second.due_date))
            );
            setError('');
            setLastUpdated(new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date()));
        } catch (requestError) {
            console.error('Erro ao carregar marketing financeiro', requestError);
            setError('Não foi possível carregar o painel de marketing.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [API_BASE_URL, token, activeRange]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleThemeToggle = () => {
        if (!showThemePanel) setThemeDraft(theme);
        setShowThemePanel((current) => !current);
    };

    const handleThemeConfirm = () => {
        setTheme(themeDraft);
        saveFinanceTheme(themeDraft);
        setShowThemePanel(false);
    };

    const handleThemeCancel = () => {
        setThemeDraft(theme);
        setShowThemePanel(false);
    };

    const handlePresetClick = (presetId) => {
        if (presetId === 'custom') {
            setSelectedPreset('custom');
            requestAnimationFrame(() => {
                customStartDateRef.current?.showPicker?.();
                customStartDateRef.current?.focus?.();
            });
            return;
        }

        setSelectedPreset(presetId);
    };

    const updatePlan = (field, value) => {
        setPlan((current) => ({ ...current, [field]: value }));
    };

    const handleFrequencyChange = (value) => {
        setPlan((current) => ({
            ...current,
            frequency: value,
            dueDate: buildAutoDueDate(value)
        }));
    };

    const handleSavePlan = () => {
        saveMarketingPlan(plan);
        setFeedback('Planejamento salvo. Agora você pode gerar a cobrança ou pagar direto.');
        Swal.fire({
            title: 'Planejamento salvo',
            text: 'Seu controle de verba foi atualizado com sucesso.',
            icon: 'success',
            timer: 1700,
            showConfirmButton: false
        });
    };

    const rangeInsights = useMemo(
        () => calculateRangeInsights(transactions, rangeDays),
        [transactions, rangeDays]
    );

    const marketingTransactions = useMemo(
        () => transactions.filter((transaction) => isMarketingTransaction(transaction, marketingAccount?.id)),
        [marketingAccount?.id, transactions]
    );

    const marketingInsights = useMemo(
        () => calculateMarketingInsights(transactions, rangeInsights, rangeDays, plan.dailyBudget),
        [plan.dailyBudget, rangeDays, rangeInsights, transactions]
    );

    const marketingTrendData = useMemo(
        () => buildMarketingTrendData(transactions, marketingTransactions, rangeDays),
        [marketingTransactions, rangeDays, transactions]
    );

    const channelData = useMemo(
        () => buildChannelData(marketingTransactions),
        [marketingTransactions]
    );

    const recentMarketing = useMemo(
        () => marketingTransactions
            .map((transaction) => ({ ...transaction, displayDate: getDisplayDate(transaction) }))
            .sort((first, second) => new Date(second.displayDate) - new Date(first.displayDate))
            .slice(0, 6),
        [marketingTransactions]
    );

    const breakEvenText = marketingInsights.breakEvenOrders ? `${marketingInsights.breakEvenOrders} pedidos` : 'Aguardando base';
    const comfortText = marketingInsights.comfortOrders ? `${marketingInsights.comfortOrders} pedidos` : 'Aguardando base';

    const createCharge = async ({ markAsPaid = false } = {}) => {
        if (!marketingAccount?.id) {
            setError('A categoria Marketing ainda não foi encontrada no plano de contas.');
            return;
        }

        if (normalizeNumber(plan.dailyBudget) <= 0) {
            setError('Informe uma verba diária maior que zero.');
            return;
        }

        if (plan.sourceType === 'card' && !plan.cardLabel.trim()) {
            setError('Informe qual cartão será usado.');
            return;
        }

        setSavingCharge(true);
        setError('');
        setFeedback('');

        try {
            const today = formatDateInput(new Date());
            const payload = {
                description: `Tráfego ${plan.channel} - ${FREQUENCY_OPTIONS.find((item) => item.value === plan.frequency)?.label || 'Diário'}${plan.notes ? ` - ${plan.notes}` : ''}`,
                type: 'Despesa',
                status: markAsPaid ? 'Pago' : 'Pendente',
                amount: plannedChargeAmount,
                due_date: plan.dueDate,
                payment_date: markAsPaid ? today : null,
                payment_method: buildPaymentMethodLabel(plan.sourceType, plan.cardLabel),
                chart_of_account_id: marketingAccount.id
            };

            await axios.post(`${API_BASE_URL}/api/finance/transactions`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            saveMarketingPlan(plan);
            setFeedback(markAsPaid ? 'Pagamento lançado e custo registrado no financeiro.' : 'Cobrança agendada. Quando pagar, use Efetuar pagamento.');
            await fetchData();
        } catch (requestError) {
            console.error('Erro ao criar cobrança de marketing', requestError);
            setError('Não foi possível registrar a cobrança agora.');
        } finally {
            setSavingCharge(false);
        }
    };

    const handlePayPending = async (transaction) => {
        setSavingCharge(true);
        setError('');
        setFeedback('');

        try {
            await axios.put(`${API_BASE_URL}/api/finance/transactions/${transaction.id}/pay`, {
                payment_date: formatDateInput(new Date()),
                payment_method: transaction.payment_method || buildPaymentMethodLabel(plan.sourceType, plan.cardLabel)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFeedback('Cobrança baixada com sucesso e já entrou no custo do marketing.');
            await fetchData();
        } catch (requestError) {
            console.error('Erro ao pagar cobrança de marketing', requestError);
            setError('Não foi possível efetuar o pagamento agora.');
        } finally {
            setSavingCharge(false);
        }
    };

    const handleEditPending = async (transaction) => {
        const result = await Swal.fire({
            title: 'Editar cobrança',
            html: `
                <input id="marketing-description" class="swal2-input" placeholder="Descrição" value="${transaction.description || ''}">
                <input id="marketing-amount" class="swal2-input" placeholder="Valor" type="number" step="0.01" value="${normalizeNumber(transaction.amount)}">
                <input id="marketing-date" class="swal2-input" placeholder="Vencimento" type="date" value="${transaction.due_date || ''}">
                <input id="marketing-method" class="swal2-input" placeholder="Forma de pagamento" value="${transaction.payment_method || ''}">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const description = document.getElementById('marketing-description')?.value?.trim();
                const amount = Number(document.getElementById('marketing-amount')?.value || 0);
                const dueDate = document.getElementById('marketing-date')?.value;
                const paymentMethod = document.getElementById('marketing-method')?.value?.trim();

                if (!description) {
                    Swal.showValidationMessage('Informe a descrição.');
                    return false;
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    Swal.showValidationMessage('Informe um valor válido.');
                    return false;
                }

                if (!dueDate) {
                    Swal.showValidationMessage('Informe o vencimento.');
                    return false;
                }

                return { description, amount, dueDate, paymentMethod };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        setSavingCharge(true);
        setError('');
        setFeedback('');

        try {
            await axios.put(`${API_BASE_URL}/api/finance/transactions/${transaction.id}`, {
                ...transaction,
                description: result.value.description,
                amount: result.value.amount,
                due_date: result.value.dueDate,
                payment_method: result.value.paymentMethod
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFeedback('Cobrança atualizada com sucesso.');
            await fetchData();
        } catch (requestError) {
            console.error('Erro ao editar cobrança de marketing', requestError);
            setError('Não foi possível editar a cobrança agora.');
        } finally {
            setSavingCharge(false);
        }
    };

    const handleDeletePending = async (transaction) => {
        const result = await Swal.fire({
            title: 'Excluir cobrança?',
            text: 'Essa cobrança pendente será removida do financeiro.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Excluir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#EF4444'
        });

        if (!result.isConfirmed) return;

        setSavingCharge(true);
        setError('');
        setFeedback('');

        try {
            await axios.delete(`${API_BASE_URL}/api/finance/transactions/${transaction.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFeedback('Cobrança excluída com sucesso.');
            await fetchData();
        } catch (requestError) {
            console.error('Erro ao excluir cobrança de marketing', requestError);
            setError('Não foi possível excluir a cobrança agora.');
        } finally {
            setSavingCharge(false);
        }
    };

    if (loading && transactions.length === 0) {
        return <div style={styles.loadingState}>Carregando painel de marketing...</div>;
    }

    return (
        <div style={styles.mainContainer}>
            <style>{`
                .glass-card {
                    background: linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.64) 100%);
                    border: 1px solid rgba(255,255,255,0.46);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
                }

                .preset-button {
                    transition: all 0.22s ease;
                }

                .preset-button:hover {
                    background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,246,255,0.82));
                    border-color: rgba(96,165,250,0.32) !important;
                }

                .preset-button.active {
                    color: #1D4ED8 !important;
                    box-shadow: 0 10px 24px rgba(59, 130, 246, 0.14), inset 0 1px 0 rgba(255,255,255,0.9);
                }

                .marketing-stat-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .marketing-stat-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);
                }

                .finance-hidden-date {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                }

                .marketing-grid-4 {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 18px;
                }

                .marketing-grid-2 {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 24px;
                }

                @media (max-width: 1180px) {
                    .marketing-grid-4,
                    .marketing-grid-2 {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            <div style={{ ...styles.heroCard, background: topGradient }}>
                <div style={styles.heroGlow} />
                <div style={styles.heroHeader}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={styles.heroTitle}>Marketing & Tráfego</h1>
                        <p style={styles.heroSubtitle}>{periodLabel}</p>
                    </div>

                    <div style={styles.heroActions}>
                        <button className="preset-button" onClick={handleThemeToggle} style={styles.heroGhostButton}>
                            {Icons.Palette} Cor
                        </button>
                        <button className="preset-button" onClick={() => navigate('/finance/dashboard')} style={styles.heroGhostButton}>
                            Dashboard {Icons.ArrowRight}
                        </button>
                        <button className="preset-button" onClick={fetchData} style={styles.heroPrimaryButton}>
                            {Icons.Refresh} Atualizar
                        </button>
                    </div>
                </div>

                {showThemePanel ? (
                    <div style={styles.themePanel}>
                        <div style={styles.themeField}>
                            <label style={styles.themeLabel}>Primária</label>
                            <input type="color" value={themeDraft.primary} onChange={(event) => setThemeDraft((current) => ({ ...current, primary: event.target.value }))} style={styles.colorInput} />
                        </div>
                        <div style={styles.themeField}>
                            <label style={styles.themeLabel}>Secundária</label>
                            <input type="color" value={themeDraft.secondary} onChange={(event) => setThemeDraft((current) => ({ ...current, secondary: event.target.value }))} style={styles.colorInput} />
                        </div>
                        <div style={styles.themeField}>
                            <label style={styles.themeLabel}>Destaque</label>
                            <input type="color" value={themeDraft.accent} onChange={(event) => setThemeDraft((current) => ({ ...current, accent: event.target.value }))} style={styles.colorInput} />
                        </div>
                        <div style={styles.themeActions}>
                            <button type="button" onClick={handleThemeCancel} style={styles.themeSecondaryButton}>Cancelar</button>
                            <button type="button" onClick={handleThemeConfirm} style={styles.themePrimaryButton}>OK</button>
                        </div>
                    </div>
                ) : null}

                <div style={styles.heroMetaRow}>
                    <div style={styles.heroPill}>{Icons.Calendar} {formatCalendarDate(activeRange.startDate)} até {formatCalendarDate(activeRange.endDate)}</div>
                    <div style={styles.heroPill}>Última atualização: {lastUpdated || 'agora'}</div>
                </div>
            </div>

            {error ? <div style={styles.errorBanner}>{error}</div> : null}
            {feedback ? <div style={styles.successBanner}>{feedback}</div> : null}

            <div className="glass-card" style={styles.filterCard}>
                <div style={styles.filterHeader}>
                    <h2 style={styles.filterTitle}>Período</h2>
                    <button className="preset-button" onClick={() => navigate('/finance/transactions')} style={styles.inlineButton}>
                        Lançamentos {Icons.ArrowRight}
                    </button>
                </div>

                <div style={styles.presetGrid}>
                    {PRESET_OPTIONS.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            className={`preset-button ${selectedPreset === preset.id ? 'active' : ''}`}
                            onClick={() => handlePresetClick(preset.id)}
                            style={{
                                ...styles.presetButton,
                                ...(selectedPreset === preset.id ? {
                                    background: ACTIVE_FILTER_GRADIENT,
                                    borderColor: 'rgba(96,165,250,0.42)',
                                    color: '#1D4ED8',
                                    boxShadow: '0 10px 24px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.9)'
                                } : {})
                            }}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {selectedPreset === 'custom' ? (
                    <div style={styles.customRangeGrid}>
                        <button type="button" onClick={() => customStartDateRef.current?.showPicker?.()} style={styles.dateButton}>
                            <span style={styles.dateButtonLabel}>De</span>
                            <strong style={styles.dateButtonValue}>{formatCalendarDate(customRange.startDate)}</strong>
                            <input
                                ref={customStartDateRef}
                                className="finance-hidden-date"
                                type="date"
                                value={customRange.startDate}
                                onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
                            />
                        </button>
                        <button type="button" onClick={() => customEndDateRef.current?.showPicker?.()} style={styles.dateButton}>
                            <span style={styles.dateButtonLabel}>Até</span>
                            <strong style={styles.dateButtonValue}>{formatCalendarDate(customRange.endDate)}</strong>
                            <input
                                ref={customEndDateRef}
                                className="finance-hidden-date"
                                type="date"
                                value={customRange.endDate}
                                onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
                            />
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="marketing-grid-4" style={{ marginBottom: 24 }}>
                <StatCard
                    icon={Icons.Money}
                    label="Investimento"
                    value={formatMoney(marketingInsights.marketingSpend)}
                    helper={`${marketingTransactions.length} lançamento(s) pagos`}
                    tone="spend"
                />
                <StatCard
                    icon={Icons.Target}
                    label="Peso nas saídas"
                    value={formatPercent(marketingInsights.marketingShare)}
                    helper="Participação do marketing no caixa"
                    tone="share"
                />
                <StatCard
                    icon={Icons.TrendUp}
                    label="ROAS estimado"
                    value={marketingInsights.estimatedRoas > 0 ? `${marketingInsights.estimatedRoas.toFixed(1)}x` : 'Sem base'}
                    helper="Receita paga por real investido"
                    tone="roas"
                />
                <StatCard
                    icon={Icons.Wallet}
                    label="Lucro médio por pedido"
                    value={marketingInsights.averageProfitPerOrder > 0 ? formatMoney(marketingInsights.averageProfitPerOrder) : 'Sem base'}
                    helper={`${marketingInsights.paidOrderCount} pedido(s) pagos`}
                    accent={marketingInsights.paidOrderCount > 0 ? formatMoney(marketingInsights.averageRevenuePerOrder) : null}
                    tone="profit"
                />
            </div>

            <div className="marketing-grid-2" style={{ marginBottom: 24 }}>
                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Mídia x receita</h3>
                    </div>

                    <div style={{ width: '100%', height: 320 }}>
                        {marketingTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={marketingTrendData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="marketingRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                                        </linearGradient>
                                        <linearGradient id="marketingSpendFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FB923C" stopOpacity={0.16} />
                                            <stop offset="95%" stopColor="#FB923C" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={formatCompactMoney} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value) => formatMoney(value)}
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                                        contentStyle={styles.tooltipCard}
                                    />
                                    <Area type="monotone" dataKey="Receita" stroke="#2563EB" strokeWidth={2.5} fill="url(#marketingRevenueFill)" />
                                    <Area type="monotone" dataKey="Marketing" stroke="#FB923C" strokeWidth={2.5} fill="url(#marketingSpendFill)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={styles.emptyState}>Sem histórico suficiente nesse período.</div>
                        )}
                    </div>
                </div>

                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Controle da verba</h3>
                    </div>

                    <div style={styles.controlGrid}>
                        <div style={styles.inputCard}>
                            <span style={styles.inputLabel}>Verba por dia</span>
                            <div style={styles.inputRow}>
                                <span style={styles.inputPrefix}>R$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={plan.dailyBudget}
                                    onChange={(event) => updatePlan('dailyBudget', Math.max(0, Number(event.target.value) || 0))}
                                    style={styles.budgetInput}
                                />
                            </div>
                        </div>

                        <div style={styles.quickBudgetRow}>
                            {[10, 20, 50, 100].map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    className="preset-button"
                                    onClick={() => updatePlan('dailyBudget', amount)}
                                    style={{
                                        ...styles.quickBudgetButton,
                                        ...(Number(plan.dailyBudget) === amount ? {
                                            background: ACTIVE_FILTER_GRADIENT,
                                            color: '#1D4ED8',
                                            borderColor: 'rgba(96,165,250,0.42)',
                                            boxShadow: '0 10px 24px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.9)'
                                        } : {})
                                    }}
                                >
                                    {formatMoney(amount)}
                                </button>
                            ))}
                        </div>

                        <div style={styles.formGrid}>
                            <label style={styles.fieldWrap}>
                                <span style={styles.fieldLabel}>Canal</span>
                                <select value={plan.channel} onChange={(event) => updatePlan('channel', event.target.value)} style={styles.fieldInput}>
                                    {CHANNEL_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={styles.fieldWrap}>
                                <span style={styles.fieldLabel}>Cobrança</span>
                                <select value={plan.frequency} onChange={(event) => handleFrequencyChange(event.target.value)} style={styles.fieldInput}>
                                    {FREQUENCY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={styles.fieldWrap}>
                                <span style={styles.fieldLabel}>Sai de onde</span>
                                <select value={plan.sourceType} onChange={(event) => updatePlan('sourceType', event.target.value)} style={styles.fieldInput}>
                                    {SOURCE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={styles.fieldWrap}>
                                <span style={styles.fieldLabel}>Vencimento</span>
                                <input type="date" value={plan.dueDate} onChange={(event) => updatePlan('dueDate', event.target.value)} style={styles.fieldInput} />
                            </label>

                            {plan.sourceType === 'card' ? (
                                <label style={{ ...styles.fieldWrap, gridColumn: '1 / -1' }}>
                                    <span style={styles.fieldLabel}>Cartão</span>
                                    <input type="text" value={plan.cardLabel} onChange={(event) => updatePlan('cardLabel', event.target.value)} placeholder="Ex.: Nubank final 3021" style={styles.fieldInput} />
                                </label>
                            ) : null}

                            <label style={{ ...styles.fieldWrap, gridColumn: '1 / -1' }}>
                                <span style={styles.fieldLabel}>Observação</span>
                                <input type="text" value={plan.notes} onChange={(event) => updatePlan('notes', event.target.value)} placeholder="Ex.: cobrança do Facebook da semana" style={styles.fieldInput} />
                            </label>
                        </div>

                        <div style={styles.chargePreview}>
                            <div>
                                <span style={styles.previewLabel}>Cobrança prevista</span>
                                <strong style={styles.previewValue}>{formatMoney(plannedChargeAmount)}</strong>
                            </div>
                            <div>
                                <span style={styles.previewLabel}>Forma de pagamento</span>
                                <strong style={styles.previewMethod}>{buildPaymentMethodLabel(plan.sourceType, plan.cardLabel)}</strong>
                            </div>
                        </div>

                        <div style={styles.controlActions}>
                            <button type="button" onClick={handleSavePlan} style={styles.secondaryButton}>Salvar planejamento</button>
                            <button type="button" onClick={() => createCharge({ markAsPaid: false })} disabled={savingCharge} style={styles.ghostButton}>
                                Gerar cobrança
                            </button>
                            <button type="button" onClick={() => createCharge({ markAsPaid: true })} disabled={savingCharge} style={styles.primaryButton}>
                                {savingCharge ? 'Processando...' : 'Pagar agora'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="marketing-grid-2" style={{ marginBottom: 24 }}>
                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Escala e leitura inteligente</h3>
                    </div>

                    <div style={styles.scenarioGrid}>
                        <ScenarioCard label="Orçamento do recorte" value={formatMoney(marketingInsights.projectedBudget)} helper={`${rangeDays} dia(s) simulados`} tone="#1D4ED8" />
                        <ScenarioCard label="Empata em" value={breakEvenText} helper="Pedidos para pagar a mídia" tone="#EA580C" />
                        <ScenarioCard label="Escala confortável" value={comfortText} helper="Faixa com mais folga" tone="#16A34A" />
                        <ScenarioCard label="Sugestão por dia" value={marketingInsights.suggestedDailyBudget > 0 ? formatMoney(marketingInsights.suggestedDailyBudget) : 'Sem base'} helper="Leitura do histórico" tone="#0F766E" />
                    </div>

                    <div style={styles.recommendationsGrid}>
                        {marketingInsights.recommendations.map((item) => (
                            <RecommendationCard key={item.title} item={item} />
                        ))}
                    </div>
                </div>

                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Cobranças pendentes</h3>
                    </div>

                    <div style={styles.pendingList}>
                        {pendingCharges.length > 0 ? (
                            pendingCharges.map((transaction) => (
                                <PendingChargeCard
                                    key={transaction.id}
                                    transaction={transaction}
                                    onPay={handlePayPending}
                                    onEdit={handleEditPending}
                                    onDelete={handleDeletePending}
                                />
                            ))
                        ) : (
                            <div style={styles.emptyState}>Nenhuma cobrança pendente de marketing.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="marketing-grid-2">
                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Canais e movimentos</h3>
                        <button className="preset-button" onClick={() => navigate('/finance/transactions')} style={styles.inlineButton}>
                            Ver mais {Icons.ArrowRight}
                        </button>
                    </div>

                    <div style={styles.channelAndMovements}>
                        <div style={{ width: '100%', maxWidth: 220, height: 220 }}>
                            {channelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={channelData} innerRadius={58} outerRadius={84} paddingAngle={4} dataKey="value" stroke="none">
                                            {channelData.map((item, index) => (
                                                <Cell key={item.name} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={styles.emptyState}>Sem custo de mídia pago nesse período.</div>
                            )}
                        </div>

                        <div style={styles.channelList}>
                            {channelData.map((item, index) => (
                                <div key={item.name} style={styles.channelItem}>
                                    <span style={styles.channelName}>
                                        <span style={{ ...styles.channelDot, backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length] }} />
                                        {item.name}
                                    </span>
                                    <span style={styles.channelValue}>{formatMoney(item.value)}</span>
                                </div>
                            ))}

                            {recentMarketing.map((transaction) => (
                                <div key={transaction.id} style={styles.movementItem}>
                                    <div style={styles.movementTop}>
                                        <strong style={styles.movementTitle}>{transaction.description}</strong>
                                        <span style={styles.movementAmount}>{formatMoney(transaction.amount)}</span>
                                    </div>
                                    <div style={styles.movementMeta}>
                                        <span>{getChannelLabel(transaction)}</span>
                                        <span>{transaction.payment_method || 'Forma não definida'}</span>
                                        <span>{formatCalendarDate(transaction.displayDate)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Indicadores do tráfego</h3>
                    </div>

                    <div style={{ width: '100%', height: 290, marginBottom: 18 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Receita paga', value: marketingInsights.orderRevenue },
                                    { name: 'Custo pedido', value: marketingInsights.orderCost },
                                    { name: 'Marketing', value: marketingInsights.marketingSpend }
                                ]}
                                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={formatCompactMoney} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={styles.tooltipCard} />
                                <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={44}>
                                    <Cell fill="#2563EB" />
                                    <Cell fill="#0F766E" />
                                    <Cell fill="#FB923C" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={styles.metricStack}>
                        <div style={styles.metricRow}>
                            <span style={styles.metricLabel}>Receita paga</span>
                            <strong style={styles.metricValue}>{formatMoney(marketingInsights.orderRevenue)}</strong>
                        </div>
                        <div style={styles.metricRow}>
                            <span style={styles.metricLabel}>Lucro sobre mídia</span>
                            <strong style={{ ...styles.metricValue, color: marketingInsights.estimatedProfitRoas >= 2 ? '#16A34A' : '#EA580C' }}>
                                {marketingInsights.estimatedProfitRoas > 0 ? `${marketingInsights.estimatedProfitRoas.toFixed(1)}x` : 'Sem base'}
                            </strong>
                        </div>
                        <div style={styles.metricRow}>
                            <span style={styles.metricLabel}>Média atual por dia</span>
                            <strong style={styles.metricValue}>{formatMoney(marketingInsights.currentDailyMarketing)}</strong>
                        </div>
                        <div style={styles.metricRow}>
                            <span style={styles.metricLabel}>Resultado do recorte</span>
                            <strong style={{ ...styles.metricValue, color: rangeInsights.saldo >= 0 ? '#16A34A' : '#EA580C' }}>
                                {formatMoney(rangeInsights.saldo)}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    mainContainer: {
        fontFamily: "'Inter', sans-serif",
        maxWidth: '1460px',
        margin: '0 auto',
        paddingBottom: '40px',
        color: '#0F172A'
    },
    loadingState: {
        padding: '60px',
        textAlign: 'center',
        color: '#64748B'
    },
    heroCard: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '30px',
        padding: '26px',
        marginBottom: '24px',
        color: '#FFFFFF',
        boxShadow: '0 18px 38px rgba(15,23,42,0.14)'
    },
    heroGlow: {
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 36%)',
        pointerEvents: 'none'
    },
    heroHeader: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '18px',
        flexWrap: 'wrap',
        marginBottom: '18px'
    },
    heroTitle: {
        margin: '0 0 8px 0',
        fontSize: '2.15rem',
        lineHeight: 1.08,
        letterSpacing: '-0.05em'
    },
    heroSubtitle: {
        margin: 0,
        fontSize: '1rem',
        color: 'rgba(255,255,255,0.82)',
        lineHeight: 1.5
    },
    heroActions: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
    },
    heroGhostButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: '#FFFFFF',
        padding: '12px 16px',
        fontWeight: '700',
        cursor: 'pointer'
    },
    heroPrimaryButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        borderRadius: '14px',
        border: 'none',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        padding: '12px 16px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    themePanel: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        padding: '16px',
        borderRadius: '18px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.14)',
        marginBottom: '18px'
    },
    themeField: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    themeLabel: {
        fontSize: '0.76rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'rgba(255,255,255,0.78)',
        fontWeight: '800'
    },
    colorInput: {
        width: '100%',
        height: '42px',
        border: 'none',
        borderRadius: '12px',
        backgroundColor: 'transparent',
        cursor: 'pointer'
    },
    themeActions: {
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
    },
    themeSecondaryButton: {
        border: '1px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: '#FFFFFF',
        borderRadius: '12px',
        padding: '10px 14px',
        fontWeight: '700',
        cursor: 'pointer'
    },
    themePrimaryButton: {
        border: 'none',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        borderRadius: '12px',
        padding: '10px 14px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    heroMetaRow: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
    },
    heroPill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.88)',
        padding: '10px 12px',
        borderRadius: '999px',
        fontSize: '0.84rem',
        fontWeight: '700'
    },
    errorBanner: {
        backgroundColor: '#FEF2F2',
        border: '1px solid #FECACA',
        color: '#B91C1C',
        borderRadius: '16px',
        padding: '14px 18px',
        marginBottom: '16px',
        fontWeight: '700'
    },
    successBanner: {
        backgroundColor: '#F0FDF4',
        border: '1px solid #BBF7D0',
        color: '#166534',
        borderRadius: '16px',
        padding: '14px 18px',
        marginBottom: '24px',
        fontWeight: '700'
    },
    filterCard: {
        borderRadius: '24px',
        padding: '20px',
        marginBottom: '24px'
    },
    filterHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '14px'
    },
    filterTitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: '800',
        color: '#0F172A'
    },
    inlineButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '12px',
        border: '1px solid rgba(148,163,184,0.22)',
        backgroundColor: 'rgba(255,255,255,0.58)',
        color: '#0F172A',
        padding: '10px 12px',
        fontWeight: '700',
        cursor: 'pointer'
    },
    presetGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '10px',
        marginBottom: '14px'
    },
    presetButton: {
        borderRadius: '16px',
        border: '1px solid rgba(226,232,240,0.86)',
        backgroundColor: '#FFFFFF',
        padding: '14px 12px',
        fontWeight: '800',
        color: '#0F172A',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.04)'
    },
    customRangeGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
    },
    dateButton: {
        position: 'relative',
        borderRadius: '14px',
        border: '1px solid rgba(203,213,225,0.9)',
        backgroundColor: 'rgba(255,255,255,0.68)',
        color: '#0F172A',
        padding: '12px 14px',
        fontWeight: '700',
        minHeight: '74px',
        cursor: 'pointer',
        textAlign: 'left'
    },
    dateButtonLabel: {
        display: 'block',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontSize: '0.72rem',
        fontWeight: '800',
        marginBottom: '6px'
    },
    dateButtonValue: {
        display: 'block',
        color: '#0F172A',
        fontSize: '1rem',
        fontWeight: '800'
    },
    statCard: {
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.04)'
    },
    statTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px'
    },
    statHeading: {
        flex: 1,
        minWidth: 0,
        paddingRight: '14px'
    },
    statIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statAccent: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        marginBottom: '12px',
        fontSize: '0.76rem',
        fontWeight: '800',
        padding: '8px 12px',
        borderRadius: '10px'
    },
    statLabel: {
        margin: '0 0 6px 0',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: '0.8rem',
        fontWeight: '800'
    },
    statValue: {
        margin: 0,
        fontSize: '1.95rem',
        lineHeight: 1.14,
        letterSpacing: '-0.02em',
        color: '#0F172A'
    },
    statHelper: {
        margin: 0,
        lineHeight: 1.58,
        fontSize: '0.9rem'
    },
    sectionCard: {
        borderRadius: '24px',
        padding: '22px'
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        marginBottom: '18px'
    },
    sectionTitle: {
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: '800',
        color: '#0F172A'
    },
    tooltipCard: {
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 16px 30px rgba(15, 23, 42, 0.08)'
    },
    emptyState: {
        minHeight: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#94A3B8',
        fontStyle: 'italic',
        padding: '12px'
    },
    controlGrid: {
        display: 'grid',
        gap: '16px'
    },
    inputCard: {
        borderRadius: '18px',
        padding: '16px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(248,250,252,0.78))',
        border: '1px solid rgba(226,232,240,0.84)'
    },
    inputLabel: {
        display: 'block',
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#64748B',
        fontWeight: '800',
        marginBottom: '10px'
    },
    inputRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    inputPrefix: {
        fontSize: '1.4rem',
        fontWeight: '800',
        color: '#0F172A'
    },
    budgetInput: {
        width: '100%',
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: '1.9rem',
        fontWeight: '800',
        color: '#0F172A',
        outline: 'none'
    },
    quickBudgetRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '10px'
    },
    quickBudgetButton: {
        borderRadius: '14px',
        border: '1px solid rgba(226,232,240,0.86)',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        padding: '12px 10px',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.04)'
    },
    formGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px'
    },
    fieldWrap: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    fieldLabel: {
        color: '#64748B',
        fontSize: '0.76rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: '800'
    },
    fieldInput: {
        borderRadius: '14px',
        border: '1px solid rgba(203,213,225,0.9)',
        backgroundColor: 'rgba(255,255,255,0.68)',
        color: '#0F172A',
        padding: '12px 14px',
        fontWeight: '700',
        outline: 'none'
    },
    chargePreview: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px',
        padding: '16px',
        borderRadius: '18px',
        background: 'linear-gradient(180deg, rgba(239,246,255,0.92), rgba(219,234,254,0.72))',
        border: '1px solid rgba(147,197,253,0.5)'
    },
    previewLabel: {
        display: 'block',
        color: '#1E40AF',
        fontSize: '0.76rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: '800',
        marginBottom: '8px'
    },
    previewValue: {
        display: 'block',
        color: '#0F172A',
        fontSize: '1.4rem',
        fontWeight: '800'
    },
    previewMethod: {
        display: 'block',
        color: '#0F172A',
        fontSize: '1rem',
        fontWeight: '800'
    },
    controlActions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
    },
    secondaryButton: {
        borderRadius: '12px',
        border: '1px solid rgba(148,163,184,0.26)',
        backgroundColor: 'rgba(255,255,255,0.64)',
        color: '#0F172A',
        padding: '12px 14px',
        fontWeight: '700',
        cursor: 'pointer'
    },
    ghostButton: {
        borderRadius: '12px',
        border: '1px solid rgba(30,64,175,0.18)',
        backgroundColor: 'rgba(219,234,254,0.68)',
        color: '#1D4ED8',
        padding: '12px 14px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    primaryButton: {
        borderRadius: '12px',
        border: 'none',
        background: PRIMARY_ACTION_GRADIENT,
        color: '#FFFFFF',
        padding: '12px 16px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    scenarioGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px',
        marginBottom: '18px'
    },
    scenarioCard: {
        borderRadius: '20px',
        padding: '16px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(248,250,252,0.82))',
        border: '1px solid rgba(226,232,240,0.84)'
    },
    scenarioLabel: {
        display: 'block',
        color: '#64748B',
        fontSize: '0.76rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: '800',
        marginBottom: '8px'
    },
    scenarioValue: {
        display: 'block',
        fontSize: '1.26rem',
        lineHeight: 1.1,
        fontWeight: '800',
        marginBottom: '8px'
    },
    scenarioHelper: {
        display: 'block',
        color: '#64748B',
        fontSize: '0.88rem',
        lineHeight: 1.5
    },
    recommendationsGrid: {
        display: 'grid',
        gap: '14px'
    },
    recommendationCard: {
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start'
    },
    recommendationIcon: {
        width: '42px',
        height: '42px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.74)',
        flexShrink: 0
    },
    recommendationTitle: {
        display: 'block',
        color: '#0F172A',
        fontSize: '0.98rem',
        marginBottom: '6px'
    },
    recommendationText: {
        margin: 0,
        color: '#334155',
        lineHeight: 1.58
    },
    pendingList: {
        display: 'grid',
        gap: '12px'
    },
    pendingCard: {
        borderRadius: '18px',
        padding: '16px',
        background: 'linear-gradient(180deg, rgba(255,247,237,0.96), rgba(255,237,213,0.82))',
        border: '1px solid rgba(249,115,22,0.16)'
    },
    pendingTop: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '12px'
    },
    pendingTitle: {
        display: 'block',
        color: '#0F172A',
        marginBottom: '6px'
    },
    pendingMeta: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        color: '#9A3412',
        fontSize: '0.84rem'
    },
    pendingAmount: {
        color: '#EA580C',
        whiteSpace: 'nowrap'
    },
    pendingActions: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
    },
    pendingSecondaryButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '12px',
        border: '1px solid rgba(30,64,175,0.14)',
        backgroundColor: 'rgba(219,234,254,0.68)',
        color: '#1D4ED8',
        padding: '12px 14px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    pendingDeleteButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '12px',
        border: '1px solid rgba(239,68,68,0.14)',
        backgroundColor: 'rgba(254,226,226,0.8)',
        color: '#DC2626',
        padding: '12px 14px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    payButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: '#F97316',
        color: '#FFFFFF',
        padding: '12px 14px',
        fontWeight: '800',
        cursor: 'pointer'
    },
    channelAndMovements: {
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        flexWrap: 'wrap'
    },
    channelList: {
        flex: 1,
        minWidth: '240px',
        display: 'grid',
        gap: '12px'
    },
    channelItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(241,245,249,0.84)'
    },
    channelName: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        color: '#0F172A',
        fontWeight: '700'
    },
    channelDot: {
        width: '10px',
        height: '10px',
        borderRadius: '999px',
        display: 'inline-block'
    },
    channelValue: {
        color: '#0F172A',
        fontWeight: '800'
    },
    movementItem: {
        borderRadius: '16px',
        padding: '14px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(248,250,252,0.78))',
        border: '1px solid rgba(226,232,240,0.84)'
    },
    movementTop: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '6px'
    },
    movementTitle: {
        color: '#0F172A',
        lineHeight: 1.5
    },
    movementAmount: {
        color: '#F97316',
        fontWeight: '800',
        whiteSpace: 'nowrap'
    },
    movementMeta: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        color: '#64748B',
        fontSize: '0.84rem'
    },
    metricStack: {
        display: 'grid',
        gap: '12px'
    },
    metricRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(241,245,249,0.84)'
    },
    metricLabel: {
        color: '#64748B',
        fontWeight: '700'
    },
    metricValue: {
        color: '#0F172A',
        fontWeight: '800'
    }
};

export default FinanceMarketing;
