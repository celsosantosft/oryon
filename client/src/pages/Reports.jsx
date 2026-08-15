import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ============================================================================
// --- /assets/Icons.js ---
// ============================================================================
const Icons = {
    Chart: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
    Money: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
    TrendingUp: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
    TrendingDown: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
};

// ============================================================================
// --- /utils/formatUtils.js ---
// ============================================================================
export const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const getProfitAnalysis = (profit) => {
    if (profit > 0) return { color: '#10B981', iconKey: 'TrendingUp', text: "Indica Lucro Líquido Positivo." };
    if (profit < 0) return { color: '#EF4444', iconKey: 'TrendingDown', text: "Indica Lucro Líquido Negativo (Prejuízo)." };
    return { color: '#F59E0B', iconKey: 'Money', text: "Resultado Financeiro Zero." };
};

// ============================================================================
// --- /services/reportService.js ---
// ============================================================================
const ReportService = {
    getHeaders: (token) => ({ headers: { Authorization: `Bearer ${token}` } }),
    fetchProfit: (api, token) => axios.get(`${api}/api/reports/profit`, ReportService.getHeaders(token))
};

// ============================================================================
// --- /hooks/useReports.js ---
// ============================================================================
const useReports = (API_BASE_URL, token) => {
    const [state, setState] = useState({ data: { revenue: 0, cost: 0, profit: 0 }, loading: true, error: null });

    const loadReportData = useCallback(async () => {
        if (!token) return;
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            const response = await ReportService.fetchProfit(API_BASE_URL, token);
            const r = response.data.revenue || 0;
            const c = response.data.cost || 0;
            
            setState({
                data: { revenue: r, cost: c, profit: r - c },
                loading: false,
                error: null
            });
        } catch (error) {
            console.error("Erro ao carregar relatórios:", error);
            setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar dados financeiros. Verifique o console.' }));
        }
    }, [API_BASE_URL, token]);

    useEffect(() => { loadReportData(); }, [loadReportData]);

    return { ...state, refreshReports: loadReportData };
};

// ============================================================================
// --- /components/reports/FinancialCard.jsx ---
// ============================================================================
const FinancialCard = React.memo(({ title, value, icon, color, footerText }) => (
    <div style={{ ...styles.card, borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.cardTitle}>{title}</span>
            <div style={{ color: color, opacity: 0.9 }}>{icon}</div>
        </div>
        <div style={styles.cardValue}>{value}</div>
        <p style={styles.cardFooter}>{footerText}</p>
    </div>
));

// ============================================================================
// --- /components/reports/Reports.jsx (Main Component) ---
// ============================================================================
const Reports = () => {
    const { token, API_BASE_URL } = useAuth();
    const { data, loading, error } = useReports(API_BASE_URL, token);
    
    // Memoizamos a análise de lucro para evitar recálculos em re-renders
    const profitStatus = useMemo(() => getProfitAnalysis(data.profit), [data.profit]);

    if (loading) return <div style={styles.loading}>Carregando Relatórios Financeiros...</div>;
    if (error) return <div style={styles.error}>{error}</div>;

    return (
        <div style={styles.mainContainer}>
            
            {/* CABEÇALHO */}
            <header style={styles.header}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={{padding:'12px', background:'#E0F2FE', borderRadius:'10px', color:'#0284C7', display:'flex'}}>
                        {Icons.Chart()}
                    </div>
                    <div>
                        <h2 style={styles.title}>Relatórios Financeiros</h2>
                        <p style={styles.subtitle}>Visão consolidada do resultado de pedidos <b>concluídos</b>.</p>
                    </div>
                </div>
            </header>

            {/* GRID DE KPIS FINANCEIROS */}
            <div style={styles.grid}>
                <FinancialCard
                    title="Receita (Venda Total)"
                    value={formatCurrency(data.revenue)}
                    icon={Icons.Money()}
                    color="#2563EB"
                    footerText="Soma do Preço Total de pedidos concluídos."
                />

                <FinancialCard
                    title="Custo (Estimado)"
                    value={formatCurrency(data.cost)}
                    icon={Icons.Money()}
                    color="#D97706"
                    footerText="Soma do Custo Estimado de pedidos concluídos."
                />

                <FinancialCard
                    title="Lucro Líquido"
                    value={formatCurrency(data.profit)}
                    icon={Icons[profitStatus.iconKey]()} // Renderiza o ícone dinamicamente baseado na chave
                    color={profitStatus.color}
                    footerText={profitStatus.text}
                />
            </div>

            {/* SEÇÃO FUTURA PARA GRÁFICOS */}
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Análise Histórica (Funcionalidade Futura)</h3>
                <div style={styles.placeholder}>
                    Gráficos de Receita vs. Custo ao longo do tempo serão adicionados aqui.
                </div>
            </section>

        </div>
    );
};

// ============================================================================
// --- Global Styles ---
// ============================================================================
const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' },
    loading: { padding: '40px', textAlign: 'center', color: '#64748b', fontFamily: "'Inter', sans-serif" },
    error: { padding: '20px', color: '#EF4444', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', textAlign: 'center', fontWeight: '600' },
    
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    title: { color: '#0f172a', fontSize: '1.5rem', fontWeight: '700', margin: 0, marginBottom: '4px' },
    subtitle: { margin:0, color:'#64748b', fontSize:'0.9rem' },
    
    // GRID e Responsividade
    grid: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px', 
        marginBottom: '40px' 
    },
    
    // Cards Financeiros
    card: { 
        backgroundColor: '#FFFFFF', 
        padding: '24px', 
        borderRadius: '8px', 
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'transform 0.3s, box-shadow 0.3s'
    },
    cardTitle: { 
        fontSize: '0.85rem', 
        fontWeight: '600', 
        color: '#64748B', 
        textTransform: 'uppercase', 
        letterSpacing: '0.05em' 
    },
    cardValue: { 
        fontSize: '2.5rem', 
        fontWeight: '700', 
        color: '#0F172A', 
        margin: '10px 0 15px 0' 
    },
    cardFooter: { 
        fontSize: '0.8rem', 
        color: '#94A3B8', 
        margin: 0, 
        paddingTop: '10px',
        borderTop: '1px solid #F1F5F9'
    },
    
    section: { marginBottom: '30px' },
    sectionTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#0F172A', marginBottom: '15px' },
    placeholder: { 
        backgroundColor: '#E2E8F0', 
        color: '#64748B', 
        padding: '40px', 
        borderRadius: '8px', 
        textAlign: 'center',
        fontSize: '1rem'
    }
};

export default Reports;