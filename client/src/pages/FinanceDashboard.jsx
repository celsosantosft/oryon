import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    INITIAL_DRE,
    PRESET_OPTIONS,
    buildFinanceGradient,
    buildPresetRange,
    calculateRangeInsights,
    clampPercentage,
    formatCalendarDate,
    formatCompactMoney,
    formatMoney,
    formatPercent,
    getCurrentMonthKey,
    getDaysBetweenInclusive,
    getPeriodLabel,
    getStoredFinanceTheme,
    normalizeNumber,
    saveFinanceTheme,
    sanitizeCustomRange
} from '../utils/financeIntelligence';

const DONUT_COLORS = ['#3B82F6', '#FDBA74', '#CBD5E1'];
const ACTIVE_FILTER_GRADIENT = 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.94) 100%)';
const CHART_COLORS = {
    income: '#3B82F6',
    incomeFill: '#60A5FA',
    expense: '#FB923C',
    result: '#1E3A8A',
    goal: '#334155',
    annual: '#0F766E'
};

const KPI_THEMES = {
    income: {
        surface: '#FAFAFA',
        border: '#BFDBFE',
        iconBackground: '#EFF6FF',
        iconColor: '#2563EB',
        labelColor: '#64748B',
        helperColor: '#475569',
        accentBackground: '#DBEAFE'
    },
    expense: {
        surface: '#FAFAFA',
        border: '#FED7AA',
        iconBackground: '#FFF7ED',
        iconColor: '#EA580C',
        labelColor: '#64748B',
        helperColor: '#475569',
        accentBackground: '#FFEDD5'
    },
    result: {
        surface: '#FAFAFA',
        border: '#DBEAFE',
        iconBackground: '#EFF6FF',
        iconColor: '#1D4ED8',
        labelColor: '#64748B',
        helperColor: '#475569',
        accentBackground: '#DBEAFE'
    },
    goal: {
        surface: '#FAFAFA',
        border: '#CBD5E1',
        iconBackground: '#F8FAFC',
        iconColor: '#0F172A',
        labelColor: '#64748B',
        helperColor: '#475569',
        accentBackground: '#E2E8F0'
    }
};

const Icons = {
    Dashboard: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4v9Zm10 7h6V4h-6v16Zm-10 0h6v-3H4v3Z" />
        </svg>
    ),
    Calendar: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    ),
    Refresh: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
    ),
    TrendUp: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m22 7-8.5 8.5-5-5L2 17" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7h6v6" />
        </svg>
    ),
    TrendDown: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m22 17-8.5-8.5-5 5L2 7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 17h6v-6" />
        </svg>
    ),
    Balance: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M5 7h14M7 7l-4 6h8l-4-6Zm10 0-4 6h8l-4-6Z" />
        </svg>
    ),
    Target: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
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
    ArrowRight: (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
    ),
    Settings: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364-2.12 2.12M7.757 16.243l-2.12 2.12m0-12.727 2.12 2.12m8.486 8.487 2.12 2.12" />
        </svg>
    )
};

const GlassStatCard = ({ icon, label, value, helper, accent, tone = 'result' }) => {
    const visual = KPI_THEMES[tone] || KPI_THEMES.result;

    return (
    <div className="liquid-kpi" style={{ ...styles.kpiCard, background: visual.surface, border: `1px solid ${visual.border}` }}>
        <div style={styles.kpiTop}>
            <div style={styles.kpiHeading}>
                <p style={{ ...styles.kpiLabel, color: visual.labelColor }}>{label}</p>
                <h3 style={styles.kpiValue}>{value}</h3>
            </div>
            <div style={{ ...styles.kpiIcon, backgroundColor: visual.iconBackground, color: visual.iconColor }}>{icon}</div>
        </div>
        {accent ? <span style={{ ...styles.kpiAccent, backgroundColor: visual.accentBackground, color: visual.iconColor }}>{accent}</span> : null}
        <p style={{ ...styles.kpiHelper, color: visual.helperColor }}>{helper}</p>
    </div>
    );
};

const MetricRow = ({ label, value, tone = '#0F172A' }) => (
    <div style={styles.metricRow}>
        <span style={styles.metricLabel}>{label}</span>
        <strong style={{ ...styles.metricValue, color: tone }}>{value}</strong>
    </div>
);

const MovementItem = ({ item }) => {
    const isIncome = item.type === 'Receita';

    return (
        <div className="movement-row">
            <div style={{
                ...styles.movementIcon,
                backgroundColor: isIncome ? 'rgba(59, 130, 246, 0.14)' : 'rgba(251, 146, 60, 0.14)',
                color: isIncome ? CHART_COLORS.income : CHART_COLORS.expense
            }}>
                {isIncome ? Icons.TrendUp : Icons.TrendDown}
            </div>

            <div style={styles.movementBody}>
                <div style={styles.movementHeader}>
                    <span style={styles.movementTitle}>{item.description}</span>
                    <span style={{ ...styles.movementAmount, color: isIncome ? CHART_COLORS.income : CHART_COLORS.expense }}>
                        {isIncome ? '' : '- '}{formatMoney(item.amount)}
                    </span>
                </div>
                <div style={styles.movementMeta}>
                    <span>{item.account_name || (isIncome ? 'Receita' : 'Despesa')}</span>
                    <span>{formatCalendarDate(item.displayDate)}</span>
                </div>
            </div>
        </div>
    );
};

const FinanceDashboard = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const customStartDateRef = useRef(null);
    const customEndDateRef = useRef(null);

    const [annualDre, setAnnualDre] = useState(INITIAL_DRE);
    const [transactions, setTransactions] = useState([]);
    const [loadingAnnual, setLoadingAnnual] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(true);
    const [annualError, setAnnualError] = useState('');
    const [transactionsError, setTransactionsError] = useState('');
    const [lastUpdated, setLastUpdated] = useState('');
    const [metaMensal, setMetaMensal] = useState(15000);
    const [metaAnual, setMetaAnual] = useState(180000);
    const [metaYear, setMetaYear] = useState(String(new Date().getFullYear()));
    const [selectedPreset, setSelectedPreset] = useState('current-month');
    const [customRange, setCustomRange] = useState(buildPresetRange('current-month'));
    const [relativeNow, setRelativeNow] = useState(Date.now());
    const [theme, setTheme] = useState(() => getStoredFinanceTheme());
    const [themeDraft, setThemeDraft] = useState(() => getStoredFinanceTheme());
    const [showThemePanel, setShowThemePanel] = useState(false);

    useEffect(() => {
        const loadGoalSettings = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/finance/goal-settings`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data?.revenue) setMetaMensal(Number(response.data.revenue));
                if (response.data?.revenue_annual) setMetaAnual(Number(response.data.revenue_annual));
            } catch (error) {
                const savedGoals = localStorage.getItem('production_goals');
                if (!savedGoals) return;

                try {
                    const parsed = JSON.parse(savedGoals);
                    if (parsed.revenue) setMetaMensal(parsed.revenue);
                    if (parsed.revenue_annual) setMetaAnual(parsed.revenue_annual);
                } catch (storageError) {
                    console.error('Erro ao ler metas', storageError);
                }
            }
        };

        loadGoalSettings();
    }, [API_BASE_URL, token]);

    useEffect(() => {
        if (selectedPreset === 'custom') return undefined;
        const interval = setInterval(() => setRelativeNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [selectedPreset]);

    const activeRange = useMemo(() => (
        selectedPreset === 'custom'
            ? sanitizeCustomRange(customRange)
            : buildPresetRange(selectedPreset, new Date(relativeNow))
    ), [selectedPreset, customRange, relativeNow]);

    const rangeDays = useMemo(
        () => getDaysBetweenInclusive(activeRange.startDate, activeRange.endDate),
        [activeRange]
    );

    const periodLabel = useMemo(
        () => getPeriodLabel(selectedPreset, activeRange),
        [selectedPreset, activeRange]
    );

    useEffect(() => {
        let cancelled = false;

        const fetchAnnual = async () => {
            setLoadingAnnual(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/finance/dre`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!cancelled) {
                    setAnnualDre(response.data || INITIAL_DRE);
                    setAnnualError('');
                }
            } catch (error) {
                console.error('Erro ao carregar visão anual', error);
                if (!cancelled) setAnnualError('Não foi possível carregar a visão anual.');
            } finally {
                if (!cancelled) setLoadingAnnual(false);
            }
        };

        fetchAnnual();

        return () => {
            cancelled = true;
        };
    }, [API_BASE_URL, token]);

    useEffect(() => {
        let cancelled = false;

        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/finance/transactions`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        status: 'Pago',
                        start_date: activeRange.startDate,
                        end_date: activeRange.endDate
                    }
                });

                if (!cancelled) {
                    setTransactions(response.data || []);
                    setTransactionsError('');
                    setLastUpdated(new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).format(new Date()));
                }
            } catch (error) {
                console.error('Erro ao carregar transações do período', error);
                if (!cancelled) setTransactionsError('Não foi possível carregar o período selecionado.');
            } finally {
                if (!cancelled) setLoadingTransactions(false);
            }
        };

        fetchTransactions();

        return () => {
            cancelled = true;
        };
    }, [API_BASE_URL, token, activeRange]);

    const handleRefresh = async () => {
        setLoadingAnnual(true);
        setLoadingTransactions(true);

        try {
            const [annualResponse, transactionsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/finance/dre`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/api/finance/transactions`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        status: 'Pago',
                        start_date: activeRange.startDate,
                        end_date: activeRange.endDate
                    }
                })
            ]);

            setAnnualDre(annualResponse.data || INITIAL_DRE);
            setTransactions(transactionsResponse.data || []);
            setAnnualError('');
            setTransactionsError('');
            setLastUpdated(new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date()));
        } catch (error) {
            console.error('Erro ao atualizar dashboard', error);
            setTransactionsError('Não foi possível atualizar o dashboard agora.');
        } finally {
            setLoadingAnnual(false);
            setLoadingTransactions(false);
        }
    };

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

    const rangeInsights = useMemo(
        () => calculateRangeInsights(transactions, rangeDays),
        [transactions, rangeDays]
    );

    const annualYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = new Set();

        annualDre.monthlyData.forEach((item) => {
            if (item?.name) years.add(item.name.slice(0, 4));
        });

        for (let year = currentYear - 1; year <= currentYear + 2; year += 1) {
            years.add(String(year));
        }

        return Array.from(years).sort();
    }, [annualDre.monthlyData]);

    const annualChartData = useMemo(() => {
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return monthNames.map((monthLabel, index) => {
            const monthNumber = String(index + 1).padStart(2, '0');
            const monthKey = `${metaYear}-${monthNumber}`;
            const found = annualDre.monthlyData.find((item) => item.name === monthKey);
            const receitas = normalizeNumber(found?.Receitas);
            const despesas = normalizeNumber(found?.Despesas);

            return {
                name: monthLabel,
                key: monthKey,
                Receitas: receitas,
                Despesas: despesas,
                Resultado: receitas - despesas,
                Meta: metaMensal
            };
        });
    }, [annualDre.monthlyData, metaMensal, metaYear]);

    const annualRevenue = useMemo(
        () => annualChartData.reduce((total, item) => total + item.Receitas, 0),
        [annualChartData]
    );

    const annualResult = useMemo(
        () => annualChartData.reduce((total, item) => total + item.Resultado, 0),
        [annualChartData]
    );

    const targetForPeriod = selectedPreset === 'current-month'
        ? metaMensal
        : metaMensal * (rangeDays / 30);
    const progressPeriod = targetForPeriod > 0 ? (rangeInsights.receitas / targetForPeriod) * 100 : 0;
    const annualProgress = metaAnual > 0 ? (annualRevenue / metaAnual) * 100 : 0;
    const remainingPeriod = Math.max(targetForPeriod - rangeInsights.receitas, 0);
    const remainingAnnual = Math.max(metaAnual - annualRevenue, 0);

    const donutData = rangeInsights.volume > 0
        ? [
            { name: 'Entradas', value: rangeInsights.receitas },
            { name: 'Saídas', value: rangeInsights.despesas }
        ]
        : [{ name: 'Sem dados', value: 1 }];

    const loading = (loadingAnnual || loadingTransactions) && annualDre.monthlyData.length === 0 && transactions.length === 0;
    const errorMessage = annualError || transactionsError;
    const topGradient = buildFinanceGradient(theme);

    if (loading) {
        return <div style={styles.loadingState}>Carregando dashboard financeiro...</div>;
    }

    return (
        <div style={styles.mainContainer}>
            <style>{`
                .liquid-card {
                    background: linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.58) 100%);
                    border: 1px solid rgba(255,255,255,0.42);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
                    transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
                }

                .liquid-card:hover {
                    box-shadow: 0 20px 38px rgba(15, 23, 42, 0.1);
                    border-color: rgba(255,255,255,0.7);
                }

                .hero-shell::before {
                    content: '';
                    position: absolute;
                    inset: 1px;
                    border-radius: 28px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04));
                    pointer-events: none;
                }

                .liquid-kpi {
                    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
                }

                .liquid-kpi:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);
                }

                .preset-button {
                    transition: all 0.22s ease;
                }

                .preset-button:hover {
                    transform: translateY(-1px);
                    background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,246,255,0.82));
                    border-color: rgba(96,165,250,0.32) !important;
                }

                .preset-button.active {
                    color: #1D4ED8 !important;
                    box-shadow: 0 10px 24px rgba(59, 130, 246, 0.14), inset 0 1px 0 rgba(255,255,255,0.9);
                }

                .finance-input:focus {
                    outline: none;
                    border-color: rgba(37,99,235,0.38) !important;
                    box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
                }

                .finance-hidden-date {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                }

                .movement-row {
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                    padding: 14px;
                    border-radius: 18px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(248,250,252,0.76) 100%);
                    border: 1px solid rgba(226,232,240,0.9);
                    transition: transform 0.22s ease, box-shadow 0.22s ease;
                }

                .movement-row:hover {
                    transform: translateX(4px);
                    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
                }

                .finance-grid-4 {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 18px;
                }

                .finance-grid-2 {
                    display: grid;
                    grid-template-columns: 1.45fr 1fr;
                    gap: 24px;
                }

                @media (max-width: 1180px) {
                    .finance-grid-4,
                    .finance-grid-2 {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            <div className="liquid-card hero-shell" style={{ ...styles.heroCard, background: topGradient }}>
                <div style={styles.heroGlow} />
                <div style={styles.heroHeader}>
                    <div>
                        <h1 style={styles.heroTitle}>Visão executiva do caixa</h1>
                        <p style={styles.heroSubtitle}>{periodLabel}</p>
                    </div>

                    <div style={styles.heroActions}>
                        <button className="preset-button" onClick={handleThemeToggle} style={styles.heroGhostButton}>
                            {Icons.Palette} Cor
                        </button>
                        <button className="preset-button" onClick={() => navigate('/finance/transactions')} style={styles.heroGhostButton}>
                            Movimentos {Icons.ArrowRight}
                        </button>
                        <button className="preset-button" onClick={handleRefresh} style={styles.heroPrimaryButton}>
                            {Icons.Refresh} {loadingAnnual || loadingTransactions ? 'Atualizando...' : 'Atualizar'}
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

            {errorMessage ? <div style={styles.errorBanner}>{errorMessage}</div> : null}

            <div className="liquid-card" style={styles.filterCard}>
                <div style={styles.filterHeader}>
                    <h2 style={styles.filterTitle}>Período</h2>
                    <button className="preset-button" onClick={() => navigate('/finance/marketing')} style={styles.inlineButton}>
                        Marketing & Tráfego {Icons.ArrowRight}
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
                        <button
                            type="button"
                            onClick={() => {
                                customStartDateRef.current?.showPicker?.();
                                customStartDateRef.current?.focus?.();
                            }}
                            style={styles.dateButton}
                        >
                            <span style={styles.dateButtonLabel}>De</span>
                            <strong style={styles.dateButtonValue}>{formatCalendarDate(customRange.startDate)}</strong>
                            <input
                                ref={customStartDateRef}
                                className="finance-input finance-hidden-date"
                                type="date"
                                value={customRange.startDate}
                                onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
                                style={styles.hiddenDateInput}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                customEndDateRef.current?.showPicker?.();
                                customEndDateRef.current?.focus?.();
                            }}
                            style={styles.dateButton}
                        >
                            <span style={styles.dateButtonLabel}>Até</span>
                            <strong style={styles.dateButtonValue}>{formatCalendarDate(customRange.endDate)}</strong>
                            <input
                                ref={customEndDateRef}
                                className="finance-input finance-hidden-date"
                                type="date"
                                value={customRange.endDate}
                                onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
                                style={styles.hiddenDateInput}
                            />
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="finance-grid-4" style={{ marginBottom: 24 }}>
                <GlassStatCard
                    icon={Icons.TrendUp}
                    label="Entradas"
                    value={formatMoney(rangeInsights.receitas)}
                    helper={`${rangeInsights.revenueCount} lançamento(s) confirmados`}
                    tone="income"
                />
                <GlassStatCard
                    icon={Icons.TrendDown}
                    label="Saídas"
                    value={formatMoney(rangeInsights.despesas)}
                    helper={`${rangeInsights.expenseCount} lançamento(s) pagos`}
                    tone="expense"
                />
                <GlassStatCard
                    icon={Icons.Balance}
                    label="Resultado operacional"
                    value={formatMoney(rangeInsights.saldo)}
                    helper={rangeInsights.saldo >= 0 ? 'Caixa positivo no período' : 'Saídas acima das entradas no período'}
                    tone="result"
                />
                <GlassStatCard
                    icon={Icons.Target}
                    label="Meta do período"
                    value={formatPercent(progressPeriod)}
                    helper={progressPeriod >= 100 ? 'Meta alcançada' : `Faltam ${formatMoney(remainingPeriod)}`}
                    accent={formatMoney(targetForPeriod)}
                    tone="goal"
                />
            </div>

            <div className="finance-grid-2" style={{ marginBottom: 24 }}>
                <div className="liquid-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Pulso financeiro</h3>
                    </div>

                    <div style={{ width: '100%', height: 340 }}>
                        {rangeInsights.trendData.length > 0 ? (
                            rangeInsights.trendMode === 'daily' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={rangeInsights.trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="dashIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.incomeFill} stopOpacity={0.24} />
                                                <stop offset="95%" stopColor={CHART_COLORS.incomeFill} stopOpacity={0.02} />
                                            </linearGradient>
                                            <linearGradient id="dashExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.16} />
                                            <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0.02} />
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
                                        <Area type="monotone" dataKey="Receitas" stroke={CHART_COLORS.income} strokeWidth={2.5} fill="url(#dashIncome)" />
                                        <Area type="monotone" dataKey="Despesas" stroke={CHART_COLORS.expense} strokeWidth={2.5} fill="url(#dashExpense)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={rangeInsights.trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={formatCompactMoney} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(value) => formatMoney(value)}
                                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                                            contentStyle={styles.tooltipCard}
                                        />
                                        <Bar dataKey="Receitas" fill={CHART_COLORS.income} radius={[10, 10, 0, 0]} barSize={24} />
                                        <Bar dataKey="Despesas" fill={CHART_COLORS.expense} radius={[10, 10, 0, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )
                        ) : (
                            <div style={styles.emptyState}>Sem dados pagos neste recorte.</div>
                        )}
                    </div>
                </div>

                <div className="liquid-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Resumo</h3>
                    </div>

                    <div style={styles.summaryLayout}>
                        <div style={{ width: '100%', maxWidth: 240, height: 220, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={donutData} innerRadius={62} outerRadius={86} paddingAngle={4} dataKey="value" stroke="none">
                                        {donutData.map((entry, index) => (
                                            <Cell key={`${entry.name}-${index}`} fill={rangeInsights.volume > 0 ? DONUT_COLORS[index] : '#CBD5E1'} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={styles.donutCenter}>
                                <span style={styles.donutLabel}>Margem</span>
                                <strong style={styles.donutValue}>{formatPercent(rangeInsights.margem)}</strong>
                            </div>
                        </div>

                        <div style={styles.metricsStack}>
                            <MetricRow label="Ticket médio de entrada" value={formatMoney(rangeInsights.averageRevenue)} tone={CHART_COLORS.income} />
                            <MetricRow label="Ticket médio de saída" value={formatMoney(rangeInsights.averageExpense)} tone={CHART_COLORS.expense} />
                            <MetricRow label="Maior entrada" value={rangeInsights.topRevenue ? formatMoney(rangeInsights.topRevenue.amount) : 'Sem entrada'} tone={CHART_COLORS.income} />
                            <MetricRow label="Maior saída" value={rangeInsights.topExpense ? formatMoney(rangeInsights.topExpense.amount) : 'Sem saída'} tone={CHART_COLORS.expense} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="finance-grid-2" style={{ marginBottom: 24 }}>
                <div className="liquid-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Saídas por categoria</h3>
                    </div>

                    <div style={{ width: '100%', height: 320 }}>
                        {rangeInsights.expenseCategoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rangeInsights.expenseCategoryData} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                    <XAxis type="number" tickFormatter={formatCompactMoney} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} width={150} />
                                    <Tooltip formatter={(value) => formatMoney(value)} contentStyle={styles.tooltipCard} />
                                    <Bar dataKey="total" fill={CHART_COLORS.expense} radius={[0, 10, 10, 0]} barSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={styles.emptyState}>Nenhuma saída categorizada neste período.</div>
                        )}
                    </div>
                </div>

                <div className="liquid-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Movimentos recentes</h3>
                        <button className="preset-button" onClick={() => navigate('/finance/transactions')} style={styles.inlineButton}>
                            Ver mais {Icons.ArrowRight}
                        </button>
                    </div>

                    <div style={styles.movementList}>
                        {rangeInsights.recentMovements.length > 0 ? (
                            rangeInsights.recentMovements.map((item) => (
                                <MovementItem key={item.id} item={item} />
                            ))
                        ) : (
                            <div style={styles.emptyState}>Nenhuma entrada ou saída recente neste período.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="liquid-card" style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Painel anual</h3>
                    <div style={styles.yearSelectWrap}>
                        <span style={styles.yearLabel}>Ano</span>
                        <select value={metaYear} onChange={(event) => setMetaYear(event.target.value)} style={styles.yearSelect}>
                            {annualYears.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ width: '100%', height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={annualChartData} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={formatCompactMoney} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value) => formatMoney(value)} contentStyle={styles.tooltipCard} />
                            <ReferenceLine y={0} stroke="#CBD5E1" strokeDasharray="4 4" />
                            <Line type="monotone" dataKey="Meta" stroke={CHART_COLORS.goal} strokeWidth={2} strokeDasharray="6 6" dot={false} />
                            <Line type="monotone" dataKey="Receitas" stroke={CHART_COLORS.income} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.income }} />
                            <Line type="monotone" dataKey="Despesas" stroke={CHART_COLORS.expense} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.expense }} />
                            <Line type="monotone" dataKey="Resultado" stroke={CHART_COLORS.result} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.result }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="finance-grid-2" style={{ marginTop: 24 }}>
                    <div style={{ ...styles.goalCard, ...styles.goalCardPeriod }}>
                        <div style={styles.goalHeader}>
                            <div>
                                <span style={styles.goalLabel}>Meta do período</span>
                                <strong style={styles.goalValue}>
                                    {formatMoney(rangeInsights.receitas)} <span style={styles.goalMuted}>de {formatMoney(targetForPeriod)}</span>
                                </strong>
                            </div>
                            <span style={{ ...styles.goalPercent, color: progressPeriod >= 100 ? '#16A34A' : CHART_COLORS.result }}>
                                {formatPercent(progressPeriod)}
                            </span>
                        </div>
                        <div style={styles.goalTrack}>
                            <div style={{ ...styles.goalFill, width: `${clampPercentage(progressPeriod)}%`, background: 'linear-gradient(90deg, #1D4ED8 0%, #38BDF8 100%)' }} />
                        </div>
                        <p style={styles.goalHelper}>
                            {progressPeriod >= 100 ? 'Meta do período alcançada.' : `Faltam ${formatMoney(remainingPeriod)} para atingir a referência.`}
                        </p>
                    </div>

                    <div style={{ ...styles.goalCard, ...styles.goalCardAnnual }}>
                        <div style={styles.goalHeader}>
                            <div>
                                <span style={styles.goalLabel}>Meta anual</span>
                                <strong style={styles.goalValue}>
                                    {formatMoney(annualRevenue)} <span style={styles.goalMuted}>de {formatMoney(metaAnual)}</span>
                                </strong>
                            </div>
                            <span style={{ ...styles.goalPercent, color: annualProgress >= 100 ? '#16A34A' : '#1D4ED8' }}>
                                {formatPercent(annualProgress)}
                            </span>
                        </div>
                        <div style={styles.goalTrack}>
                            <div style={{ ...styles.goalFill, width: `${clampPercentage(annualProgress)}%`, background: 'linear-gradient(90deg, #1D4ED8 0%, #38BDF8 100%)' }} />
                        </div>
                        <p style={styles.goalHelper}>
                            {annualProgress >= 100 ? `Meta anual atingida. Resultado acumulado: ${formatMoney(annualResult)}.` : `Faltam ${formatMoney(remainingAnnual)} para a meta anual.`}
                        </p>
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
        color: '#FFFFFF'
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
    themeActions: {
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
    },
    themeLabel: {
        fontSize: '0.76rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'rgba(255,255,255,0.78)',
        fontWeight: '800'
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
    colorInput: {
        width: '100%',
        height: '42px',
        border: 'none',
        borderRadius: '12px',
        backgroundColor: 'transparent',
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
    hiddenDateInput: {
        position: 'absolute',
        inset: 0,
        opacity: 0
    },
    kpiCard: {
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.04)'
    },
    kpiTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px'
    },
    kpiHeading: {
        flex: 1,
        minWidth: 0,
        paddingRight: '14px'
    },
    kpiIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0F172A'
    },
    kpiAccent: {
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        marginBottom: '12px',
        fontSize: '0.76rem',
        fontWeight: '800',
        padding: '8px 12px',
        borderRadius: '10px',
        color: '#0F172A'
    },
    kpiLabel: {
        margin: '0 0 6px 0',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: '0.8rem',
        fontWeight: '800',
        color: '#64748B'
    },
    kpiValue: {
        margin: 0,
        fontSize: '1.95rem',
        lineHeight: 1.14,
        letterSpacing: '-0.02em',
        color: '#0F172A'
    },
    kpiHelper: {
        margin: 0,
        color: '#64748B',
        lineHeight: 1.58,
        fontSize: '0.92rem'
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
    summaryLayout: {
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap'
    },
    donutCenter: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
    },
    donutLabel: {
        display: 'block',
        fontSize: '0.78rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#64748B',
        marginBottom: '4px'
    },
    donutValue: {
        display: 'block',
        fontWeight: '800',
        fontSize: '1.3rem',
        color: '#0F172A'
    },
    metricsStack: {
        flex: 1,
        minWidth: '240px'
    },
    metricRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(241,245,249,0.8)'
    },
    metricLabel: {
        color: '#64748B',
        fontSize: '0.88rem',
        fontWeight: '600'
    },
    metricValue: {
        fontWeight: '800',
        fontSize: '0.92rem',
        textAlign: 'right'
    },
    movementList: {
        display: 'grid',
        gap: '12px'
    },
    movementIcon: {
        width: '42px',
        height: '42px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    movementBody: {
        flex: 1,
        minWidth: 0
    },
    movementHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '6px'
    },
    movementTitle: {
        color: '#0F172A',
        fontWeight: '700',
        lineHeight: 1.5
    },
    movementAmount: {
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
    yearSelectWrap: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '12px',
        padding: '10px 12px',
        border: '1px solid rgba(226,232,240,0.86)',
        backgroundColor: 'rgba(255,255,255,0.58)'
    },
    yearLabel: {
        fontSize: '0.84rem',
        color: '#64748B',
        fontWeight: '700'
    },
    yearSelect: {
        border: 'none',
        backgroundColor: 'transparent',
        color: '#0F172A',
        fontWeight: '800',
        outline: 'none',
        cursor: 'pointer'
    },
    goalCard: {
        borderRadius: '20px',
        padding: '18px',
        border: '1px solid rgba(255,255,255,0.52)',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px rgba(15, 23, 42, 0.04)'
    },
    goalCardPeriod: {
        background: 'linear-gradient(180deg, rgba(239,246,255,0.98), rgba(219,234,254,0.82))'
    },
    goalCardAnnual: {
        background: 'linear-gradient(180deg, rgba(240,253,250,0.98), rgba(204,251,241,0.82))'
    },
    goalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '14px',
        marginBottom: '12px'
    },
    goalLabel: {
        display: 'block',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontSize: '0.78rem',
        color: '#64748B',
        marginBottom: '6px',
        fontWeight: '800'
    },
    goalValue: {
        display: 'block',
        color: '#0F172A',
        fontSize: '1.1rem',
        fontWeight: '800'
    },
    goalMuted: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: '0.88rem'
    },
    goalPercent: {
        fontSize: '0.98rem',
        fontWeight: '800'
    },
    goalTrack: {
        width: '100%',
        height: '10px',
        borderRadius: '999px',
        overflow: 'hidden',
        backgroundColor: 'rgba(226,232,240,0.92)',
        marginBottom: '12px'
    },
    goalFill: {
        height: '100%',
        borderRadius: '999px',
        transition: 'width 0.45s ease'
    },
    goalHelper: {
        margin: 0,
        color: '#64748B',
        lineHeight: 1.55,
        fontSize: '0.9rem'
    }
};

export default FinanceDashboard;
