import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

// ============================================================================
// --- ÍCONES ---
// ============================================================================
const Icons = {
    Eye: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    Clock: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    Check: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
};

// ============================================================================
// --- FUNÇÕES AUXILIARES DE DATA E STATUS ---
// ============================================================================
const parseDateSafe = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    return new Date(dateString);
};

const getRelativeDateText = (dateString) => {
    if (!dateString) return { text: 'N/A', color: '#64748B' };

    const targetDate = parseDateSafe(dateString);
    if (!targetDate || isNaN(targetDate)) return { text: 'Data Inválida', color: '#DC2626' };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const dayDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let relativeText;
    let color;

    if (dayDiff < 0) {
        relativeText = "Atrasado";
        color = '#DC2626';
    } else if (dayDiff === 0) {
        relativeText = "Hoje";
        color = '#DC2626';
    } else if (dayDiff === 1) {
        relativeText = "Amanhã";
        color = '#F59E0B';
    } else if (dayDiff > 1 && dayDiff <= 7) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        relativeText = dayNames[targetDate.getDay()];
        color = '#10B981';
    } else {
        const d = targetDate.getDate().toString().padStart(2, '0');
        const m = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const y = targetDate.getFullYear();
        relativeText = `${d}/${m}/${y}`;
        color = '#64748B'; 
    }
    
    return { text: relativeText, color: color }; 
};

const formatDateSafe = (dateString) => {
    const date = parseDateSafe(dateString);
    if (!date) return '-';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

const formatDateTime = (dateString) => { 
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date) ? dateString : date.toLocaleString('pt-BR');
};

const getStatusStyle = (s) => { 
    const stylesMap = {
        'Criação de Arte': {bg:'#fff7ed', color:'#c2410c', border:'1px solid #ffedd5'},
        'Arte Aprovada/Liberada': {bg:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd'},
        'Corte Iniciado': {bg:'#fef3c7', color:'#b45309', border:'1px solid #fde68a'},
        'Impressão/Estampa Iniciada': {bg:'#fce7f3', color:'#be185d', border:'1px solid #fbcfe8'},
        'Costura Iniciada': {bg:'#f3e8ff', color:'#7e22ce', border:'1px solid #d8b4fe'},
        'Controle de Qualidade': {bg:'#ccfbf1', color:'#0f766e', border:'1px solid #99f6e4'},
        'Pronto para Envio': {bg:'#ecfccb', color:'#3f6212', border:'1px solid #d9f99d'},
        'Entregue/Concluído': {bg:'#dcfce7', color:'#15803d', border:'1px solid #86efac'},
        'Cancelado': {bg:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5'}
    };
    return stylesMap[s] || {bg:'#f1f5f9',color:'#475569', border:'1px solid #e2e8f0'}; 
};

// ============================================================================
// --- COMPONENTES SECUNDÁRIOS ---
// ============================================================================
const DeliveryRow = React.memo(({ order, onMarkDelivered, onViewDetails }) => {
    const [isHovered, setIsHovered] = useState(false);
    const statusStyle = getStatusStyle(order.status);
    const relativeDate = getRelativeDateText(order.delivery_date); 

    return (
        <tr 
            onClick={() => onViewDetails(order.tracking_code)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ ...styles.tr, ...(isHovered ? styles.trHover : {}), cursor: 'pointer' }}
        >
            <td style={{...styles.td, textAlign:'center', padding: styles.reducedPadding}} onClick={(e) => e.stopPropagation()}>
                <button 
                    onClick={(e) => onMarkDelivered(order.tracking_code, e)} 
                    className="markDeliveredButton" 
                    style={styles.markDeliveredButton}
                    title="Marcar como Entregue"
                    aria-label="Marcar como Entregue"
                >
                    {Icons.Check}
                </button>
            </td>
            
            <td style={{...styles.td, fontWeight:'700', color: relativeDate.color, fontSize:'0.95rem', padding: styles.reducedPadding}}>
                {relativeDate.text}
                <span style={{display:'block', fontSize:'0.8rem', textTransform:'uppercase', color: '#64748B', fontWeight:'600', marginTop: '2px'}}>
                    {formatDateSafe(order.delivery_date)}
                </span>
            </td>
            
            <td style={{ ...styles.td, fontWeight: '600', padding: styles.reducedPadding }}>{order.client_name}</td>
            <td style={{...styles.td, padding: styles.reducedPadding}}>{order.tracking_code}</td>
            <td style={{...styles.td, padding: styles.reducedPadding}}>{order.product_type}</td>
            <td style={{...styles.td, padding: styles.reducedPadding}}>
                <span style={{ ...styles.statusBadge, ...statusStyle }}>{order.status}</span>
            </td>
            <td style={{...styles.td, textAlign:'right', padding: styles.reducedPadding}} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => onViewDetails(order.tracking_code)} style={styles.iconButton} title="Detalhes" aria-label="Ver Detalhes">{Icons.Eye}</button>
                </div>
            </td>
        </tr>
    );
});

// ============================================================================
// --- MAIN COMPONENT ---
// ============================================================================
const WeeklyDeliveries = () => {
    const { token, API_BASE_URL } = useAuth(); 
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const fetchOrders = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/orders/upcoming`, { headers: { Authorization: `Bearer ${token}` } });
            setOrders(response.data.orders);
        } catch (err) { 
            console.error('Erro ao carregar entregas:', err); 
        } finally { 
            setLoading(false); 
        }
    }, [API_BASE_URL, token]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // ⭐ O ALERTA PREMIUM PARA CONFIRMAR ENTREGA (TAMANHO E BOTÕES CORRIGIDOS) ⭐
    const handleMarkAsDelivered = async (trackingCode, e) => {
        if (e) e.stopPropagation();
        
        const result = await Swal.fire({
            title: 'Confirmar Entrega?',
            html: `<p style="color: #64748B; font-size: 1.05rem; margin-top: 12px;">Marcar o pedido <b>${trackingCode}</b> como Entregue/Concluído?</p>`,
            icon: 'question',
            width: '540px', // Largura ideal para 2 botões
            padding: '32px', // Espaço interno luxuoso
            showCancelButton: true,
            reverseButtons: true, // Confirma na direita, cancela na esquerda
            buttonsStyling: false, 
            confirmButtonText: `<div style="display:flex; align-items:center; justify-content:center;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> Confirmar Entrega</div>`,
            cancelButtonText: `Cancelar`,
            customClass: {
                popup: 'premium-swal-popup',
                title: 'premium-swal-title',
                actions: 'premium-swal-actions',
                confirmButton: 'premium-btn-outline-green', 
                cancelButton: 'premium-btn-outline-gray'    
            }
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(trackingCode)}/status`, 
                    { new_status: 'Entregue/Concluído' }, 
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchOrders();
                Swal.fire({
                    title: 'Tudo certo!',
                    text: `Pedido ${trackingCode} marcado como entregue.`,
                    icon: 'success',
                    timer: 2500,
                    showConfirmButton: false,
                    customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' }
                });
            } catch (error) {
                Swal.fire('Falha na atualização', 'Houve um erro ao marcar como entregue.', 'error');
                setLoading(false);
            }
        }
    };

    const finalOrdersList = useMemo(() => {
        return [...orders].sort((a, b) => parseDateSafe(a.delivery_date) - parseDateSafe(b.delivery_date));
    }, [orders]);

    const handleViewDetails = async (code) => { 
        if(!detailsModalOpen) setLoading(true); 
        try { 
            const res = await axios.get(`${API_BASE_URL}/api/orders/${encodeURIComponent(code)}/history`, {headers:{Authorization:`Bearer ${token}`}}); 
            const d = res.data; 
            if(d.history?.length) d.status = d.history[d.history.length-1].status_text; 
            d.sizes_json = {...d.sizes_json}; 
            setSelectedOrder(d); 
            setDetailsModalOpen(true); 
        } catch(e){
            Swal.fire('Erro', 'Não foi possível carregar os detalhes.', 'error');
        } finally{
            setLoading(false);
        } 
    };

    if (loading && !detailsModalOpen) return <div style={{padding:'40px', textAlign:'center', color:'#64748b', fontFamily:"'Inter', sans-serif"}}>Buscando entregas urgentes...</div>;

    return (
        <div style={{ ...styles.mainContainer, fontFamily: "'Inter', sans-serif", color: '#0f172a', maxWidth: '1600px', margin: '0 auto' }}>
            
            {/* INJEÇÃO DE MICROINTERAÇÕES E ESTILOS PREMIUM */}
            <style>{`
                .premium-swal-popup { border-radius: 24px !important; font-family: 'Inter', sans-serif !important; }
                .premium-swal-title { font-size: 1.6rem !important; color: #0F172A !important; font-weight: 800 !important; }
                
                .premium-swal-actions {
                    display: flex !important; 
                    flex-direction: row !important; 
                    flex-wrap: wrap !important;
                    gap: 16px !important; 
                    width: 100% !important; 
                    justify-content: center !important; 
                    margin-top: 36px !important;
                }

                .premium-btn-outline-green, .premium-btn-outline-blue, .premium-btn-outline-gray {
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important;
                    padding: 14px 32px !important; /* ⭐ Tamanho fixo para não esticar demais! */
                    border-radius: 10px !important; 
                    font-weight: 600 !important;
                    font-size: 0.95rem !important; 
                    background-color: transparent !important; 
                    transition: all 0.2s ease !important;
                    white-space: nowrap !important; 
                    cursor: pointer !important; 
                    outline: none !important;
                }

                .premium-btn-outline-green { border: 1.5px solid #10B981 !important; color: #10B981 !important; }
                .premium-btn-outline-green:hover { background-color: #ECFDF5 !important; }
                
                .premium-btn-outline-gray { border: 1.5px solid #CBD5E1 !important; color: #64748B !important; }
                .premium-btn-outline-gray:hover { background-color: #F8FAFC !important; color: #0F172A !important; border-color: #94A3B8 !important; }
                
                .markDeliveredButton { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                .markDeliveredButton:hover { background: #10B981 !important; color: #FFFFFF !important; border-color: #059669 !important; transform: scale(1.05); }
                .statusBadge { padding: 6px 12px !important; font-size: 0.75rem !important; white-space: nowrap; letter-spacing: 0.02em !important; }
                @media (max-width: 1000px) { .th, .td { padding: 10px 12px !important; } }
            `}</style>

            <header style={styles.header}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={{padding:'12px', background:'#FFF7ED', borderRadius:'10px', color:'#B45309', display:'flex'}}>
                        {Icons.Clock}
                    </div>
                    <div>
                        <h2 style={styles.title}>Entregas da Semana</h2>
                        <p style={{margin:0, color:'#64748b', fontSize:'0.9rem', fontWeight: '500'}}>Pedidos com prazo de entrega nos próximos 7 dias</p>
                    </div>
                </div>
            </header>

            <div style={styles.tableContainer}>
                <div style={styles.responsiveTableWrapper}>
                    <table style={styles.table} aria-label="Tabela de Entregas">
                        <thead>
                            <tr>
                                <th scope="col" style={{...styles.th, width:'80px', textAlign:'center'}}>Entregue</th>
                                <th scope="col" style={styles.th}>Prazo</th> 
                                <th scope="col" style={styles.th}>Cliente</th> 
                                <th scope="col" style={styles.th}>Código</th> 
                                <th scope="col" style={styles.th}>Produto</th>
                                <th scope="col" style={styles.th}>Status</th>
                                <th scope="col" style={{...styles.th, textAlign:'right'}}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalOrdersList.map((order) => (
                                <DeliveryRow 
                                    key={order.id} 
                                    order={order} 
                                    onViewDetails={handleViewDetails}
                                    onMarkDelivered={handleMarkAsDelivered}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE DETALHES PADRONIZADO (Igual ao Orçamentos/Pedidos) */}
            <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Detalhes da Entrega">
                {selectedOrder ? (
                    <div style={styles.detailsContainer}>
                        <h4 style={{fontSize:'1.1rem', fontWeight:'700', marginBottom:'15px'}}>{selectedOrder.client_name} - {selectedOrder.tracking_code}</h4>
                        
                        <div style={{marginBottom:'20px', padding:'16px', background:'#FFF7ED', borderRadius:'8px', border:'1px solid #FED7AA', display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span style={{color: '#B45309'}}>{Icons.Clock}</span>
                            <p style={{fontWeight:'700', color:'#B45309', margin:0}}>PRAZO OFICIAL: {formatDateSafe(selectedOrder.delivery_date)}</p>
                        </div>

                        {selectedOrder.layout_path && (
                            <div style={{marginBottom:'20px', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px'}}>
                                <p style={{fontWeight:'600', color:'#475569', marginBottom:'5px', fontSize:'0.8rem'}}>LAYOUT EM ANEXO:</p>
                                <img src={`${API_BASE_URL}/uploads/${selectedOrder.layout_path}`} alt="Layout" style={{maxWidth:'100%', borderRadius:'4px', maxHeight:'300px', objectFit:'contain'}} />
                                <a href={`${API_BASE_URL}/uploads/${selectedOrder.layout_path}`} target="_blank" rel="noreferrer" style={{display:'block', marginTop:'5px', color:'#2563EB', fontSize:'0.8rem', fontWeight: '600'}}>Ver imagem original</a>
                            </div>
                        )}
                        
                        <div style={{marginBottom:'20px'}}>
                            <p style={{fontWeight:'600', marginBottom:'5px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase'}}>Grade Solicitada:</p>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'6px'}}>
                                {Object.entries(selectedOrder.sizes_json).map(([key, val]) => (val > 0 && <span key={key} style={{padding:'6px 12px', backgroundColor:'#f1f5f9', borderRadius:'6px', fontSize:'0.85rem', border:'1px solid #e2e8f0', color: '#0F172A'}}><b>{key}:</b> {val}</span>))}
                            </div>
                        </div>
                        
                        <h5 style={{fontSize:'0.85rem', fontWeight:'700', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'15px', borderBottom:'1px solid #E2E8F0', paddingBottom:'10px'}}>Histórico de Status</h5>
                        
                        <div style={styles.actionsContainer}>
                            <div style={styles.historyTimeline}>
                                {selectedOrder.history?.map((item, index) => (
                                    <div key={index} style={styles.historyItem}>
                                        <div style={styles.historyDot}></div>
                                        <div style={styles.historyContent}>
                                            <p style={styles.historyStatus}>{item.status_text}</p>
                                            <p style={styles.historyInfo}>{item.changed_by_name}</p>
                                            <p style={styles.historyDate}>{formatDateTime(item.change_timestamp)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : <p>Carregando...</p>}
            </Modal>
        </div>
    );
};

// --- Estilos Globais ---
const styles = {
    reducedPadding: '14px 20px',
    mainContainer: { fontFamily: "'Inter', sans-serif", paddingBottom: '40px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
    title: { color: '#0f172a', fontSize: 'clamp(1.35rem, 5vw, 1.75rem)', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '0' },
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0', maxWidth: '100%' },
    responsiveTableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' }, 
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' }, 
    th: { backgroundColor: '#f8fafc', padding: '16px 24px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.95rem' },
    tr: { transition: 'all 0.15s ease-out' },
    trHover: { backgroundColor: '#F8FAFC' },
    statusBadge: { padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-block', cursor: 'pointer', letterSpacing: '0.02em' },
    iconButton: { backgroundColor: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' },
    markDeliveredButton: { background: '#F3F4F6', color: '#64748B', border: '1px solid #E5E7EB', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    detailsContainer: { padding: '10px 0' },
    actionsContainer: { backgroundColor: '#f8fafc', padding: 'clamp(14px, 4vw, 24px)', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' },
    historyTimeline: { position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #cbd5e1', marginLeft: '10px' },
    historyItem: { marginBottom: '28px', position: 'relative' },
    historyDot: { position: 'absolute', left: '-31px', top: '4px', width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%', border: '2px solid white', boxShadow:'0 0 0 3px #bfdbfe' },
    historyStatus: { fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a', fontSize: '0.95rem' },
    historyInfo: { margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: '500' },
    historyDate: { margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }
};

export default WeeklyDeliveries;
