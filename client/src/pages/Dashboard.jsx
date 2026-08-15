import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const THEME = {
    colors: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: { primary: '#0F172A', secondary: '#64748B', disabled: '#94A3B8' },
        brand: { primary: '#2563EB', primaryHover: '#1D4ED8' },
        status: {
            artCreation: '#0284C7', artApproved: '#2563EB', cutting: '#D97706',     
            printing: '#DC2626', sewing: '#7C3AED', quality: '#16A34A',     
            ready: '#059669', zero: '#CBD5E1'         
        }
    }
};

const Icons = {
    Money: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
    Alert: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
    Box: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
    Check: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
};

const getRelativeLabel = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]); 
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays === -1) return 'Ontem';
    const weekDay = targetDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    return weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
};

const Dashboard = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);

    useEffect(() => {
        const handleResize = () => { setIsMobile(window.innerWidth < 1000); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(response.data);
            } catch (error) { console.error("Erro dashboard:", error); } 
            finally { setLoading(false); }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading || !data) return <div style={{padding:'60px', textAlign:'center', color: THEME.colors.text.secondary}}>Carregando sistema...</div>;

    const getCount = (statusName) => {
        const found = data.statusCounts.find(item => item.status === statusName);
        return found ? found.count : 0;
    };

    const goToStatus = (statusName) => {
        navigate('/orders', { state: { filterBy: statusName } });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
            return date.toLocaleDateString('pt-BR');
        }
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: '1600px', margin: '0 auto', color: THEME.colors.text.primary, paddingBottom: '40px' }}>
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center' }}>
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </span>
                        Painel de Controle
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: '400', marginLeft: '38px' }}>
                        Visão geral das operações
                    </p>
                </div>
            </header>

            <div style={styles.topGrid}>
                <KPICard title="Total dos Pedidos" value={`R$ ${(data.totals.active_value || 0).toFixed(2)}`} icon={<Icons.Money />} color="#3B82F6" />
                <KPICard title="Falta Receber" value={`R$ ${Math.max(0, (data.totals.active_value || 0) - (data.totals.active_paid || 0)).toFixed(2)}`} icon={<Icons.Alert />} color="#EF4444" />
                <KPICard title="Em Produção" value={data.totals.active_count || 0} icon={<Icons.Box />} color="#F59E0B" />
                <KPICard title="Pedidos Concluídos" value={data.totals.completed_count || 0} icon={<Icons.Check />} color="#10B981" />
            </div>

            <section style={{ marginBottom: '40px' }}>
                <h3 style={styles.sectionTitle}>Fluxo de Produção</h3>
                <div style={{...styles.statusGrid, justifyContent: isMobile ? 'space-around' : 'center', gap: isMobile ? '20px' : '32px'}}>
                    <ProductionCircle title="Criação de Arte" count={getCount('Criação de Arte')} color={THEME.colors.status.artCreation} onClick={() => goToStatus('Criação de Arte')} />
                    <ProductionCircle title="Arte Aprovada" count={getCount('Arte Aprovada/Liberada')} color={THEME.colors.status.artApproved} onClick={() => goToStatus('Arte Aprovada/Liberada')} />
                    <ProductionCircle title="Corte" count={getCount('Corte Iniciado')} color={THEME.colors.status.cutting} onClick={() => goToStatus('Corte Iniciado')} />
                    <ProductionCircle title="Estampa / Sublim." count={getCount('Impressão/Estampa Iniciada')} color={THEME.colors.status.printing} onClick={() => goToStatus('Impressão/Estampa Iniciada')} />
                    <ProductionCircle title="Costura" count={getCount('Costura Iniciada')} color={THEME.colors.status.sewing} onClick={() => goToStatus('Costura Iniciada')} />
                    <ProductionCircle title="Controle Qualidade" count={getCount('Controle de Qualidade')} color={THEME.colors.status.quality} onClick={() => goToStatus('Controle de Qualidade')} />
                    <ProductionCircle title="Pronto p/ Envio" count={getCount('Pronto para Envio')} color={THEME.colors.status.ready} onClick={() => goToStatus('Pronto para Envio')} />
                </div>
            </section>

            <div style={isMobile ? styles.bottomGridMobile : styles.bottomGrid}>
                <div style={styles.cardContainer}>
                    <div style={styles.cardHeader}><h3 style={styles.cardTitle}>Produtos em Produção</h3></div>
                    <div style={styles.listContainer}>
                        {data.productCounts.length === 0 ? <p style={{color: THEME.colors.text.secondary, textAlign:'center'}}></p> : 
                            data.productCounts.map((item, index) => (
                                <div key={index} style={styles.listItem}>
                                    <div style={styles.listLabel}>{item.product_type}</div>
                                    <div style={styles.listBarBg}><div style={{ width: `${Math.min(item.count * 15, 100)}%`, backgroundColor: '#2563EB', height: '100%', borderRadius: '4px' }}></div></div>
                                    <div style={styles.listValue}>{item.count}</div>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                    {data.overdueList && (
                        <div style={{...styles.cardContainer, borderLeft: '4px solid #DC2626'}}>
                            <div style={styles.cardHeader}>
                                <div style={{display:'flex', alignItems:'center', gap:'8px', color:'#DC2626'}}>
                                    <Icons.Alert /> <h3 style={{...styles.cardTitle, color:'#DC2626'}}>Pedidos Atrasados</h3>
                                </div>
                            </div>
                            {data.overdueList.length === 0 ? (
                                <div style={{padding:'20px', textAlign:'center', color:'#059669', fontSize:'0.9rem'}}>Nenhum pedido atrasado! 🎉</div>
                            ) : (
                                <div>
                                    {data.overdueList.map((order, idx) => (
                                        <div 
                                            key={idx} 
                                            style={styles.overdueItem}
                                            onClick={() => navigate('/orders')} 
                                        >
                                            <div><strong style={{display:'block', color:'#1e293b'}}>{order.tracking_code}</strong><span style={{fontSize:'0.75rem', color:'#64748b'}}>{order.client_name}</span></div>
                                            <div style={{textAlign:'right', color:'#DC2626', fontWeight:'700', fontSize:'0.85rem'}}>
                                                {formatDate(order.delivery_date)}
                                                <span style={{display:'block', fontSize:'0.65rem', fontWeight:'400'}}>Vencido</span>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => navigate('/orders')} style={styles.viewAllButton}>Visualizar Todos</button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div style={{...styles.cardContainer, borderLeft: '4px solid #F59E0B', display: 'flex', flexDirection: 'column'}}>
                        <div style={styles.cardHeader}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px', color:'#F59E0B'}}>
                                <Icons.Clock /> <h3 style={{...styles.cardTitle, color:'#B45309'}}>Entregas da Semana</h3>
                            </div>
                        </div>
                        
                        {data.upcomingList && data.upcomingList.length > 0 ? (
                            <div>
                                {data.upcomingList.map((order, idx) => (
                                    <DeliveryCard 
                                        key={idx}
                                        order={order}
                                        onClick={() => navigate('/orders')}
                                        formatDate={formatDate}
                                    />
                                ))}
                                <button onClick={() => navigate('/orders')} style={styles.viewAllButton}>Ver Todos <span style={{marginLeft: '4px'}}><Icons.ArrowRight /></span></button>
                            </div>
                        ) : (
                            <div style={{flex: 1, padding: '20px', textAlign: 'center'}}>
                                <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '15px'}}>Nenhuma entrega urgente para esta semana.</p>
                                <button 
                                    onClick={() => navigate('/orders')} 
                                    style={{...styles.viewAllButton, backgroundColor: '#FFF7ED', color: '#B45309', border: '1px solid #FED7AA', borderRadius: '6px'}}
                                >
                                    Ver Cronograma Completo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DeliveryCard = ({ order, onClick, formatDate }) => {
    const [hover, setHover] = useState(false);
    const relativeTime = getRelativeLabel(order.delivery_date);

    return (
        <div 
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                ...styles.alertItem,
                cursor: 'pointer',
                backgroundColor: hover ? '#FFF7ED' : 'transparent',
                transition: 'all 0.2s',
                borderLeft: hover ? '4px solid #F59E0B' : '4px solid transparent',
                paddingLeft: hover ? '16px' : '20px'
            }}
        >
            <div>
                <strong style={{display:'block', color:'#1e293b'}}>{order.tracking_code}</strong>
                <span style={{fontSize:'0.75rem', color:'#64748b'}}>{order.client_name}</span>
            </div>
            <div style={{textAlign:'right', color:'#B45309', fontWeight:'700', fontSize:'0.85rem'}}>
                {formatDate(order.delivery_date)}
                <span style={{display:'block', fontSize:'0.65rem', fontWeight:'600', textTransform: 'uppercase', color: '#EA580C'}}>
                    {relativeTime}
                </span>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon, color }) => {
    const [hover, setHover] = useState(false);

    return (
        <div 
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                ...styles.kpiCard,
                border: hover ? `1px solid ${color}` : `1px solid ${THEME.colors.border}`,
                boxShadow: hover ? `0 6px 15px -3px ${color}33` : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transform: hover ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'all 0.3s ease-out'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{ color: THEME.colors.text.secondary, fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {title}
                </span>
                <div style={{ color: color, opacity: 0.8 }}>{icon}</div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: THEME.colors.text.primary, letterSpacing: '-0.03em' }}>
                {value}
            </div>
        </div>
    );
};

const ProductionCircle = ({ title, count, color, onClick }) => {
    const [hover, setHover] = useState(false);
    const isZero = count === 0;
    const finalColor = isZero ? THEME.colors.status.zero : color;
    const textColor = isZero ? THEME.colors.text.disabled : color;

    return (
        <div 
            onClick={!isZero ? onClick : undefined}
            onMouseEnter={() => setHover(true)} 
            onMouseLeave={() => setHover(false)}
            style={{ 
                ...styles.productionCircleContainer,
                cursor: isZero ? 'default' : 'pointer',
                transform: hover && !isZero ? 'translateY(-4px)' : 'translateY(0)',
                opacity: isZero ? 0.8 : 1
            }}
        >
            <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                border: `2px solid ${finalColor}`,
                backgroundColor: hover && !isZero ? `${finalColor}1A` : 'transparent', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                transition: 'all 0.2s ease-out',
                boxShadow: hover && !isZero ? `0 4px 12px ${finalColor}33` : 'none'
            }}>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: textColor, letterSpacing: '-0.02em' }}>
                    {count}
                </span>
            </div>
            <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600', 
                color: isZero ? THEME.colors.text.disabled : THEME.colors.text.secondary,
                textAlign: 'center',
                maxWidth: '100px',
                lineHeight: '1.2'
            }}>
                {title}
            </span>
        </div>
    );
};

const styles = {
    topGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '48px' },
    statusGrid: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }, 
    bottomGrid: { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '24px', alignItems: 'start' },
    bottomGridMobile: { display: 'flex', flexDirection: 'column', gap: '24px' },
    sectionTitle: { fontSize: '1rem', color: THEME.colors.text.primary, marginBottom: '24px', fontWeight: '600' },
    kpiCard: { 
        backgroundColor: THEME.colors.card, 
        padding: '24px', 
        borderRadius: '8px', 
        border: `1px solid ${THEME.colors.border}`,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
    },
    cardContainer: { 
        backgroundColor: THEME.colors.card, 
        borderRadius: '8px', 
        border: `1px solid ${THEME.colors.border}`,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
    },
    cardHeader: { padding: '20px 24px', borderBottom: `1px solid ${THEME.colors.border}` },
    cardTitle: { fontSize: '0.95rem', color: THEME.colors.text.primary, fontWeight: '600', margin: 0 },
    productionCircleContainer: { 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        transition: 'all 0.2s ease-out' 
    },
    listContainer: { padding: '24px' },
    listItem: { display: 'flex', alignItems: 'center', marginBottom: '16px' },
    listLabel: { width: '140px', fontSize: '0.875rem', color: THEME.colors.text.secondary, fontWeight: '500' },
    listBarBg: { flex: 1, height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', margin: '0 16px' },
    listValue: { fontSize: '0.875rem', fontWeight: '600', color: THEME.colors.text.primary, width: '30px', textAlign: 'right' },
    
    overdueItem: { 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${THEME.colors.border}`, cursor: 'pointer' 
    },
    alertItem: { 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${THEME.colors.border}` 
    },
    
    viewAllButton: { 
        width: '100%', 
        padding: '14px', 
        backgroundColor: THEME.colors.card, 
        color: THEME.colors.text.secondary, 
        border: 'none', 
        borderTop: `1px solid ${THEME.colors.border}`, 
        cursor: 'pointer', 
        fontWeight: '500', 
        fontSize: '0.875rem', 
        transition: 'background 0.2s', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
};

export default Dashboard;