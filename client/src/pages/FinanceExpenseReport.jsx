import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts';
import { useAuth } from '../context/AuthContext';

const Icons = {
    Statement: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6M9 10h6M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    Filter: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.5a1 1 0 01-.3.7L14 13.9V19l-4 2v-7.1L3.3 7.2A1 1 0 013 6.5V4z" /></svg>,
    Search: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.8-5.8m1.8-4.7a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>,
    Download: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3M7 10l5 5m0 0l5-5m-5 5V3" /></svg>,
    Wallet: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5a2 2 0 00-2-2h-2zm0 0h2a2 2 0 012 2v1h-4a2 2 0 010-4z" /></svg>,
    Trend: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" /></svg>,
    Card: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h5M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    ArrowDown: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
};

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const todayStr = today.toISOString().slice(0, 10);

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const formatShortMoney = (value) => {
    const parsed = Number(value) || 0;
    if (parsed >= 1000) return `R$ ${(parsed / 1000).toFixed(1)}k`;
    return `R$ ${parsed.toFixed(0)}`;
};
const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'Sem data') return 'Sem data';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const FinanceExpenseReport = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [accounts, setAccounts] = useState([]);
    const [report, setReport] = useState({ summary: {}, categoryData: [], methodData: [], dailyData: [], transactions: [] });
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: todayStr,
        account_id: 'all',
        status: 'all',
        payment_method: 'all',
        search: ''
    });

    const expenseAccounts = useMemo(() => accounts.filter(account => account.type === 'Despesa'), [accounts]);

    const selectedCategoryName = useMemo(() => {
        if (filters.account_id === 'all') return 'Todas as categorias';
        if (filters.account_id === 'uncategorized') return 'Geral/Sem Categoria';
        const account = expenseAccounts.find(item => String(item.id) === String(filters.account_id));
        return account?.name || 'Categoria selecionada';
    }, [expenseAccounts, filters.account_id]);

    const fetchAccounts = useCallback(async () => {
        const response = await axios.get(`${API_BASE_URL}/api/finance/accounts`, { headers: { Authorization: `Bearer ${token}` } });
        setAccounts(response.data || []);
    }, [API_BASE_URL, token]);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value && value !== 'all') params[key] = value;
            });

            const response = await axios.get(`${API_BASE_URL}/api/finance/expense-report`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            setReport(response.data || { summary: {}, categoryData: [], methodData: [], dailyData: [], transactions: [] });
        } catch (error) {
            console.error('Erro ao carregar relatório de saídas', error);
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, token, filters]);

    useEffect(() => {
        fetchAccounts();
        fetchReport();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    const setPeriod = (period) => {
        const base = new Date();
        if (period === 'today') {
            setFilters(prev => ({ ...prev, start_date: todayStr, end_date: todayStr }));
            return;
        }

        if (period === 'month') {
            setFilters(prev => ({ ...prev, start_date: firstDayOfMonth, end_date: todayStr }));
            return;
        }

        if (period === '90') {
            base.setDate(base.getDate() - 90);
            setFilters(prev => ({ ...prev, start_date: base.toISOString().slice(0, 10), end_date: todayStr }));
        }
    };

    const clearFilters = () => {
        setFilters({
            start_date: '',
            end_date: '',
            account_id: 'all',
            status: 'all',
            payment_method: 'all',
            search: ''
        });
    };

    const exportCsv = () => {
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const headers = ['Data', 'Descricao', 'Categoria', 'Forma', 'Status', 'Valor'];
        const rows = report.transactions.map(item => [
            formatDate(item.movement_date),
            item.description,
            item.account_name || 'Geral/Sem Categoria',
            item.payment_method || 'Sem forma definida',
            item.status,
            Number(item.amount || 0).toFixed(2).replace('.', ',')
        ]);
        const csv = [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio-saidas-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const summary = report.summary || {};
    const transactions = report.transactions || [];
    const categoryData = report.categoryData || [];
    const methodData = report.methodData || [];
    const dailyData = report.dailyData || [];
    const currentMethodOptions = methodData.map(item => item.name).filter(Boolean);

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div style={styles.headerTitleGroup}>
                    <div style={styles.iconBox}>{Icons.Statement}</div>
                    <div>
                        <h1 style={styles.title}>Relatório de Saídas</h1>
                        <p style={styles.subtitle}>Extrato gerencial por categoria, forma de pagamento e período</p>
                    </div>
                </div>

                <div style={styles.headerActions}>
                    <button onClick={() => navigate('/finance/transactions')} style={styles.secondaryButton}>Lançar despesa</button>
                    <button onClick={exportCsv} style={styles.primaryButton}>{Icons.Download} Exportar CSV</button>
                </div>
            </div>

            <div style={styles.filterPanel}>
                <div style={styles.filterTitle}>{Icons.Filter} Filtros de análise</div>
                <div style={styles.quickPeriods}>
                    <button onClick={() => setPeriod('today')} style={styles.chipButton}>Hoje</button>
                    <button onClick={() => setPeriod('month')} style={styles.chipButton}>Mês atual</button>
                    <button onClick={() => setPeriod('90')} style={styles.chipButton}>Últimos 90 dias</button>
                    <button onClick={clearFilters} style={styles.clearButton}>Limpar</button>
                </div>

                <div style={styles.filtersGrid}>
                    <label style={styles.fieldLabel}>
                        Início
                        <input type="date" value={filters.start_date} onChange={(event) => updateFilter('start_date', event.target.value)} style={styles.input} />
                    </label>
                    <label style={styles.fieldLabel}>
                        Fim
                        <input type="date" value={filters.end_date} onChange={(event) => updateFilter('end_date', event.target.value)} style={styles.input} />
                    </label>
                    <label style={styles.fieldLabel}>
                        Categoria
                        <select value={filters.account_id} onChange={(event) => updateFilter('account_id', event.target.value)} style={styles.input}>
                            <option value="all">Todas as categorias</option>
                            <option value="uncategorized">Geral/Sem Categoria</option>
                            {expenseAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                    </label>
                    <label style={styles.fieldLabel}>
                        Status
                        <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} style={styles.input}>
                            <option value="all">Todos</option>
                            <option value="Pago">Pago</option>
                            <option value="Pendente">Pendente</option>
                        </select>
                    </label>
                    <label style={styles.fieldLabel}>
                        Forma
                        <select value={filters.payment_method} onChange={(event) => updateFilter('payment_method', event.target.value)} style={styles.input}>
                            <option value="all">Todas</option>
                            <option value="uncategorized">Sem forma definida</option>
                            {currentMethodOptions.map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                    </label>
                    <label style={styles.fieldLabel}>
                        Buscar
                        <div style={styles.searchBox}>
                            {Icons.Search}
                            <input type="text" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Descrição, categoria ou forma" style={styles.searchInput} />
                        </div>
                    </label>
                </div>

                <button onClick={fetchReport} disabled={loading} style={styles.applyButton}>
                    {loading ? 'Carregando...' : 'Atualizar relatório'}
                </button>
            </div>

            <div style={styles.heroGrid}>
                <div style={styles.mainMetric}>
                    <div style={styles.metricTopline}>Saídas filtradas</div>
                    <div style={styles.bigValue}>{formatMoney(summary.total)}</div>
                    <div style={styles.metricMeta}>{selectedCategoryName} · {summary.count || 0} lançamento(s)</div>
                </div>
                <MetricCard icon={Icons.Wallet} label="Pago" value={formatMoney(summary.paid)} accent="#047857" />
                <MetricCard icon={Icons.Trend} label="Pendente" value={formatMoney(summary.pending)} accent="#B45309" />
                <MetricCard icon={Icons.Card} label="Ticket médio" value={formatMoney(summary.average)} accent="#2563EB" />
            </div>

            <div style={styles.insightsGrid}>
                <InsightCard label="Maior saída" value={summary.highest ? formatMoney(summary.highest.amount) : formatMoney(0)} detail={summary.highest?.description || 'Nenhum lançamento'} />
                <InsightCard label="Categoria principal" value={summary.top_category?.name || 'Sem dados'} detail={summary.top_category ? `${summary.top_category.percent}% do total` : 'Sem categoria dominante'} />
                <InsightCard label="Forma mais usada" value={summary.top_method?.name || 'Sem dados'} detail={summary.top_method ? `${summary.top_method.count} lançamento(s)` : 'Sem forma definida'} />
            </div>

            <div style={styles.contentGrid}>
                <section style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.sectionTitle}>Segmentação por Categoria</h2>
                        <span style={styles.smallMuted}>Clique para filtrar</span>
                    </div>

                    <div style={styles.categoryList}>
                        {categoryData.length === 0 && <div style={styles.emptyState}>Nenhuma saída no filtro atual.</div>}
                        {categoryData.map(item => {
                            const value = item.id ? String(item.id) : 'uncategorized';
                            const active = String(filters.account_id) === value;
                            return (
                                <button key={item.name} onClick={() => updateFilter('account_id', active ? 'all' : value)} style={{ ...styles.categoryButton, ...(active ? styles.categoryButtonActive : {}) }}>
                                    <div style={styles.categoryButtonTop}>
                                        <span>{item.name}</span>
                                        <strong>{formatMoney(item.total)}</strong>
                                    </div>
                                    <div style={styles.progressTrack}>
                                        <div style={{ ...styles.progressFill, width: `${Math.min(item.percent, 100)}%` }} />
                                    </div>
                                    <div style={styles.categoryButtonBottom}>{item.count} lançamento(s) · {item.percent}%</div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.sectionTitle}>Evolução de Saídas</h2>
                        <span style={styles.smallMuted}>Base caixa/vencimento</span>
                    </div>
                    <div style={styles.chartBox}>
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tickFormatter={formatDate} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={formatShortMoney} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                    <Tooltip formatter={(value) => formatMoney(value)} labelFormatter={formatDate} contentStyle={styles.tooltip} />
                                    <Area type="monotone" dataKey="total" stroke="#DC2626" fill="#FEE2E2" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <div style={styles.emptyState}>Sem dados para o gráfico.</div>}
                    </div>
                </section>
            </div>

            <div style={styles.contentGrid}>
                <section style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.sectionTitle}>Formas de Pagamento</h2>
                        <span style={styles.smallMuted}>Pix, dinheiro, máquina</span>
                    </div>
                    <div style={styles.chartBox}>
                        {methodData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={methodData} layout="vertical" margin={{ top: 10, right: 12, left: 15, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                    <XAxis type="number" tickFormatter={formatShortMoney} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: '#334155', fontSize: 11 }} axisLine={false} tickLine={false} width={105} />
                                    <Tooltip formatter={(value) => formatMoney(value)} contentStyle={styles.tooltip} cursor={{ fill: '#F8FAFC' }} />
                                    <Bar dataKey="total" fill="#0EA5E9" radius={[0, 6, 6, 0]} barSize={18} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div style={styles.emptyState}>Nenhuma forma registrada.</div>}
                    </div>
                </section>

                <section style={styles.statementCard}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.sectionTitle}>Extrato de Saídas</h2>
                        <span style={styles.smallMuted}>{transactions.length} movimento(s)</span>
                    </div>

                    <div style={styles.statementList}>
                        {transactions.length === 0 && <div style={styles.emptyState}>Nenhuma saída encontrada.</div>}
                        {transactions.map(item => (
                            <div key={item.id} style={styles.statementRow}>
                                <div style={styles.datePill}>{formatDate(item.movement_date)}</div>
                                <div style={styles.rowIcon}>{Icons.ArrowDown}</div>
                                <div style={styles.rowContent}>
                                    <div style={styles.rowTitle}>{item.description}</div>
                                    <div style={styles.rowMeta}>
                                        <span>{item.account_name || 'Geral/Sem Categoria'}</span>
                                        <span>{item.payment_method || 'Sem forma definida'}</span>
                                        <span style={item.status === 'Pago' ? styles.statusPaid : styles.statusPending}>{item.status}</span>
                                    </div>
                                </div>
                                <div style={styles.amountOut}>- {formatMoney(item.amount)}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

const MetricCard = ({ icon, label, value, accent }) => (
    <div style={{ ...styles.metricCard, borderTopColor: accent }}>
        <div style={{ ...styles.metricIcon, color: accent }}>{icon}</div>
        <div>
            <div style={styles.metricLabel}>{label}</div>
            <div style={styles.metricValue}>{value}</div>
        </div>
    </div>
);

const InsightCard = ({ label, value, detail }) => (
    <div style={styles.insightCard}>
        <div style={styles.insightLabel}>{label}</div>
        <div style={styles.insightValue}>{value}</div>
        <div style={styles.insightDetail}>{detail}</div>
    </div>
);

const styles = {
    page: { fontFamily: "'Inter', sans-serif", maxWidth: '1500px', margin: '0 auto', paddingBottom: '44px', color: '#0F172A' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' },
    headerTitleGroup: { display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 },
    iconBox: { width: '52px', height: '52px', borderRadius: '8px', backgroundColor: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    title: { fontSize: '1.8rem', fontWeight: '800', margin: 0, color: '#0F172A' },
    subtitle: { margin: '4px 0 0', color: '#64748B', fontSize: '0.92rem', fontWeight: '500' },
    headerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    primaryButton: { display: 'flex', alignItems: 'center', gap: '8px', border: 'none', backgroundColor: '#0F766E', color: 'white', padding: '11px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' },
    secondaryButton: { border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#0F172A', padding: '11px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' },
    filterPanel: { backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' },
    filterTitle: { display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: '800', marginBottom: '12px' },
    quickPeriods: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
    chipButton: { border: '1px solid #D9E2EC', backgroundColor: '#F8FAFC', color: '#334155', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' },
    clearButton: { border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' },
    filtersGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'end' },
    fieldLabel: { display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase' },
    input: { width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', padding: '10px 11px', borderRadius: '8px', outline: 'none', fontSize: '0.92rem', fontWeight: '650' },
    searchBox: { display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#64748B', padding: '0 10px', borderRadius: '8px', minHeight: '40px' },
    searchInput: { width: '100%', border: 'none', outline: 'none', color: '#0F172A', fontSize: '0.92rem', fontWeight: '650' },
    applyButton: { marginTop: '14px', width: '100%', border: 'none', backgroundColor: '#2563EB', color: 'white', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' },
    heroGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' },
    mainMetric: { backgroundColor: '#111827', color: 'white', borderRadius: '8px', padding: '22px', minHeight: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    metricTopline: { color: '#A7F3D0', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px' },
    bigValue: { fontSize: '2.35rem', fontWeight: '900', lineHeight: 1.1, wordBreak: 'break-word' },
    metricMeta: { color: '#CBD5E1', fontSize: '0.88rem', fontWeight: '600', marginTop: '8px' },
    metricCard: { backgroundColor: 'white', border: '1px solid #E2E8F0', borderTop: '4px solid #CBD5E1', borderRadius: '8px', padding: '18px', display: 'flex', alignItems: 'center', gap: '12px' },
    metricIcon: { width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    metricLabel: { color: '#64748B', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' },
    metricValue: { color: '#0F172A', fontSize: '1.22rem', fontWeight: '900', wordBreak: 'break-word' },
    insightsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' },
    insightCard: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' },
    insightLabel: { color: '#64748B', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase' },
    insightValue: { marginTop: '6px', color: '#0F172A', fontSize: '1.1rem', fontWeight: '900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    insightDetail: { marginTop: '4px', color: '#64748B', fontSize: '0.84rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    contentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' },
    card: { backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' },
    statementCard: { backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)' },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' },
    sectionTitle: { margin: 0, color: '#0F172A', fontSize: '1.05rem', fontWeight: '900' },
    smallMuted: { color: '#64748B', fontSize: '0.78rem', fontWeight: '700' },
    categoryList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '390px', overflowY: 'auto', paddingRight: '2px' },
    categoryButton: { textAlign: 'left', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '12px', cursor: 'pointer' },
    categoryButtonActive: { borderColor: '#0EA5E9', backgroundColor: '#F0F9FF' },
    categoryButtonTop: { display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#0F172A', fontSize: '0.9rem', fontWeight: '850' },
    categoryButtonBottom: { color: '#64748B', fontSize: '0.78rem', fontWeight: '700', marginTop: '7px' },
    progressTrack: { height: '7px', backgroundColor: '#E2E8F0', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' },
    progressFill: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: '8px' },
    chartBox: { width: '100%', height: '305px' },
    tooltip: { borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.08)' },
    statementList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' },
    statementRow: { display: 'grid', gridTemplateColumns: '88px 36px minmax(0, 1fr) auto', gap: '10px', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', backgroundColor: '#FFFFFF' },
    datePill: { color: '#475569', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '7px 8px', fontSize: '0.75rem', fontWeight: '800', textAlign: 'center' },
    rowIcon: { width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    rowContent: { minWidth: 0 },
    rowTitle: { color: '#0F172A', fontWeight: '850', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    rowMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', color: '#64748B', fontSize: '0.76rem', fontWeight: '700', marginTop: '4px' },
    statusPaid: { color: '#047857', backgroundColor: '#ECFDF5', padding: '2px 7px', borderRadius: '8px' },
    statusPending: { color: '#B45309', backgroundColor: '#FFFBEB', padding: '2px 7px', borderRadius: '8px' },
    amountOut: { color: '#DC2626', fontWeight: '900', whiteSpace: 'nowrap' },
    emptyState: { minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: '700', textAlign: 'center' }
};

export default FinanceExpenseReport;
