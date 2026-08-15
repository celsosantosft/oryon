import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2'; 

// --- 1. CONFIGURAÇÃO VISUAL ---
const THEME = {
    colors: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: {
            primary: '#0F172A',
            secondary: '#64748B',
            disabled: '#94A3B8'
        },
        brand: {
            primary: '#2563EB',
            primaryHover: '#1D4ED8'
        },
    }
};

// Mapeamento Status BD <-> Status Visual
const STATUS_CONFIG = [
    { id: 'artCreation', label: 'Criação de Arte', dbValue: 'Criação de Arte', color: '#0284C7' },
    { id: 'artApproved', label: 'Arte Aprovada', dbValue: 'Arte Aprovada/Liberada', color: '#2563EB' },
    { id: 'cutting', label: 'Corte', dbValue: 'Corte Iniciado', color: '#D97706' },
    { id: 'printing', label: 'Estampa / Sublim.', dbValue: 'Impressão/Estampa Iniciada', color: '#DC2626' },
    { id: 'sewing', label: 'Costura', dbValue: 'Costura Iniciada', color: '#7C3AED' },
    { id: 'quality', label: 'Controle Qualidade', dbValue: 'Controle de Qualidade', color: '#16A34A' },
    { id: 'ready', label: 'Pronto p/ Envio', dbValue: 'Pronto para Envio', color: '#059669' }
];

// --- 2. ÍCONES ---
const Icons = {
    Box: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
    Alert: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
    Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    Calendar: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
};

// --- FUNÇÕES DE DATA ---
const parseDateSafe = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    return new Date(dateString);
};

const getRelativeLabel = (dateObj) => {
    if (!dateObj) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const target = new Date(dateObj);
    target.setHours(0, 0, 0, 0); 
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'HOJE';
    if (diffDays === 1) return 'AMANHÃ';
    if (diffDays === -1) return 'ONTEM';
    if (diffDays > 1 && diffDays < 7) {
        const weekDay = target.toLocaleDateString('pt-BR', { weekday: 'short' });
        return weekDay.toUpperCase().replace('.', '');
    }
    return '';
};

const formatDateSimple = (dateObj) => {
    if (!dateObj) return '--/--';
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// --- 3. COMPONENTES VISUAIS ---

const KPICard = ({ title, value, icon, color, subtext, onClick }) => {
    const [hover, setHover] = useState(false);
    return (
        <div 
            onClick={onClick} 
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                backgroundColor: THEME.colors.card,
                padding: '20px',
                borderRadius: '8px',
                border: hover ? `1px solid ${color}` : `1px solid ${THEME.colors.border}`,
                boxShadow: hover ? `0 4px 12px -2px ${color}22` : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transform: hover ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'all 0.2s ease-out',
                cursor: onClick ? 'pointer' : 'default' 
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ color: THEME.colors.text.secondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
                <div style={{ color: color, opacity: 0.9 }}>{icon}</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: THEME.colors.text.primary, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
            {subtext && <div style={{ fontSize: '0.7rem', color: THEME.colors.text.secondary, marginTop: '6px' }}>{subtext}</div>}
        </div>
    );
};

const ProductionCircle = ({ title, count, color }) => {
    const [hover, setHover] = useState(false);
    const isZero = count === 0;
    const finalColor = isZero ? '#CBD5E1' : color;
    const textColor = isZero ? THEME.colors.text.disabled : color;

    return (
        <div 
            onMouseEnter={() => setHover(true)} 
            onMouseLeave={() => setHover(false)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.2s ease-out', transform: hover && !isZero ? 'translateY(-2px)' : 'translateY(0)', opacity: isZero ? 0.7 : 1, minWidth: '90px' }}
        >
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: `2px solid ${finalColor}`, backgroundColor: hover && !isZero ? `${finalColor}1A` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', transition: 'all 0.2s ease-out', boxShadow: hover && !isZero ? `0 4px 12px ${finalColor}33` : 'none' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: '700', color: textColor, letterSpacing: '-0.02em' }}>{count}</span>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: '600', color: isZero ? THEME.colors.text.disabled : THEME.colors.text.secondary, textAlign: 'center', maxWidth: '90px', lineHeight: '1.1' }}>{title}</span>
        </div>
    );
};

// ⭐ CARD OTIMIZADO COM EFEITO TRELLO (Wrapper + Clone + Moldura) ⭐
const OrderCard = ({ order, onClick, onDragStart, onDropOnCard, onDragEnterCard, onDragLeaveCard, dragTargetId }) => {
    
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    const isPriority = order.priority === 'high';
    const statusColor = STATUS_CONFIG.find(s => s.id === order.status)?.color || '#CBD5E1';
    const isDragTarget = dragTargetId === order.id;
    
    const dateObj = parseDateSafe(order.rawDate);
    const formattedDate = formatDateSimple(dateObj);
    const relativeLabel = getRelativeLabel(dateObj);

    let relativeColor = '#64748B';
    let relativeBg = 'transparent';
    
    if (relativeLabel === 'HOJE') { relativeColor = '#16A34A'; relativeBg = '#DCFCE7'; }
    else if (relativeLabel === 'AMANHÃ') { relativeColor = '#EA580C'; relativeBg = '#FFEDD5'; }
    else if (relativeLabel === 'ONTEM' || isPriority) { relativeColor = '#DC2626'; relativeBg = '#FEE2E2'; }

    const handleDragStartLocal = (e) => {
        onDragStart(e, order.id, order.status);

        const cardNode = e.currentTarget;
        const rect = cardNode.getBoundingClientRect();
        
        // Wrapper invisível gigante para a sombra não cortar
        const cloneWrapper = document.createElement('div');
        cloneWrapper.style.position = 'absolute';
        cloneWrapper.style.top = '-9999px';
        cloneWrapper.style.left = '-9999px';
        cloneWrapper.style.padding = '40px'; 
        cloneWrapper.style.pointerEvents = 'none';

        // O Clone visual inclinado
        const clone = cardNode.cloneNode(true);
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.transform = 'rotate(4deg) scale(1.03)';
        clone.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)';
        clone.style.backgroundColor = 'white';
        clone.style.borderRadius = '6px';
        clone.style.margin = '0';
        clone.style.transition = 'none'; 
        
        cloneWrapper.appendChild(clone);
        document.body.appendChild(cloneWrapper);
        
        // Define o clone como imagem de arrasto (com offset do padding)
        e.dataTransfer.setDragImage(cloneWrapper, (e.clientX - rect.left) + 40, (e.clientY - rect.top) + 40);

        // O original vira o slot vazio instantaneamente
        setTimeout(() => {
            if(document.body.contains(cloneWrapper)) document.body.removeChild(cloneWrapper);
            setIsDragging(true); 
        }, 0);
    };

    return (
        <div 
            draggable
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            
            onDragStart={handleDragStartLocal}
            onDragEnd={() => {
                setIsDragging(false);
                if(onDragLeaveCard) onDragLeaveCard();
            }}
            
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={(e) => {
                e.preventDefault(); e.stopPropagation();
                if(onDragEnterCard) onDragEnterCard(order.id);
            }}
            onDragLeave={onDragLeaveCard}
            onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                setIsDragging(false);
                if(onDropOnCard) onDropOnCard(e, order.id, order.status);
            }}
            
            onClick={() => { if(!isDragging) onClick(order); }}
            
            style={{
                // O MOLDE CINZA
                backgroundColor: isDragging ? '#f1f5f9' : 'white',
                padding: '10px 12px',
                borderRadius: '6px',
                
                border: isDragging ? '2px dashed #cbd5e1' : `1px solid ${isDragTarget ? THEME.colors.brand.primary : THEME.colors.border}`,
                borderLeft: isDragging ? '2px dashed #cbd5e1' : `4px solid ${statusColor}`, 
                
                transform: (isHovered && !isDragging) ? 'translateY(-2px)' : 'none',
                boxShadow: isDragging ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : (isHovered ? '0 10px 15px -3px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0,0,0,0.05)'),
                
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'relative',
                opacity: isDragging ? 0.4 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, background-color 0.15s ease'
            }}
        >
            {/* O ENVELOPE SOME DURANTE O ARRASTO */}
            <div style={{ visibility: isDragging ? 'hidden' : 'visible', opacity: isDragging ? 0 : 1, transition: 'opacity 0.15s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94A3B8' }}>{order.tracking_code}</span>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#0F172A', fontWeight: '700', lineHeight: '1.2' }}>{order.client}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', lineHeight: '1.2' }}>{order.items}</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontSize: '0.7rem', fontWeight: '600', marginTop: '2px' }}>
                        <Icons.Calendar />
                        <span>{formattedDate}</span>
                    </div>
                    {relativeLabel ? (
                        <span style={{ fontSize: '0.6rem', fontWeight: '700', color: relativeColor, backgroundColor: relativeBg, padding: '1px 6px', borderRadius: '4px' }}>
                            {relativeLabel}
                        </span>
                    ) : (
                        isPriority && (
                            <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#EF4444', backgroundColor: '#FEF2F2', padding: '1px 6px', borderRadius: '4px' }}>
                                URGENTE
                            </span>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

const ProductionShelf = ({ stage, orders, onDragOver, onDropOnShelf, onDropOnCard, onDragStart, onDragEnterCard, onDragLeaveCard, dragTargetId, onClickOrder }) => {
    const stageOrders = orders.filter(o => o.status === stage.id);
    const count = stageOrders.length;
    const isEmpty = count === 0;

    return (
        <div 
            onDragOver={onDragOver}
            onDrop={(e) => onDropOnShelf(e, stage.id)}
            style={{
                backgroundColor: isEmpty ? '#f8fafc' : '#f1f5f9',
                borderRadius: '8px',
                border: `1px solid ${THEME.colors.border}`,
                padding: '12px', 
                height: '100%', 
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stage.color }} />
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: THEME.colors.text.primary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{stage.label}</h4>
                <span style={{ backgroundColor: isEmpty ? '#e2e8f0' : 'white', color: THEME.colors.text.secondary, borderRadius: '10px', padding: '0 8px', fontSize: '0.7rem', fontWeight: '700', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{count}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px', alignContent: 'start', flex: 1 }}>
                {stageOrders.map(order => (
                    <OrderCard 
                        key={order.id} 
                        order={order} 
                        onClick={onClickOrder} 
                        onDragStart={onDragStart}
                        onDropOnCard={onDropOnCard} 
                        onDragEnterCard={onDragEnterCard} 
                        onDragLeaveCard={onDragLeaveCard} 
                        dragTargetId={dragTargetId}
                    />
                ))}
                {isEmpty && (
                    <div style={{ gridColumn: '1 / -1', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', height: '40px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                        Solte o card aqui
                    </div>
                )}
            </div>
        </div>
    );
};

const OrderDetailsModal = ({ order, onClose, onDeliver, onMoveStage }) => {
    if (!order) return null;
    const isReadyToShip = order.status === 'ready';

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }} onClick={onClose}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: `1px solid ${THEME.colors.border}`, paddingBottom: '12px'}}>
                    <div><span style={{fontSize:'0.8rem', color: THEME.colors.text.disabled, fontWeight:'700'}}>ORDEM #{order.id}</span><h2 style={{margin: '4px 0 0 0', fontSize: '1.5rem', color: THEME.colors.text.primary}}>{order.client}</h2></div>
                    <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', color: THEME.colors.text.secondary, cursor:'pointer'}}>&times;</button>
                </div>
                <div style={{display:'grid', gap:'16px'}}>
                    <div><strong style={{display:'block', fontSize:'0.85rem', color: THEME.colors.text.secondary}}>ITENS</strong><span style={{fontSize:'1.1rem', color: THEME.colors.text.primary}}>{order.items}</span></div>
                    <div><strong style={{display:'block', fontSize:'0.85rem', color: THEME.colors.text.secondary}}>STATUS ATUAL</strong><span style={{fontSize:'1rem', fontWeight:'600', color: THEME.colors.brand.primary}}>{STATUS_CONFIG.find(s=>s.id === order.status)?.label}</span></div>
                    {order.sizes_json && (
                        <div>
                            <strong style={{display:'block', fontSize:'0.85rem', color: THEME.colors.text.secondary, marginBottom:'4px'}}>GRADE</strong>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'5px'}}>
                                {Object.entries(order.sizes_json).map(([key, val]) => (val > 0 && <span key={key} style={{padding:'4px 8px', backgroundColor:'#f1f5f9', borderRadius:'4px', fontSize:'0.8rem', border:'1px solid #e2e8f0'}}><b>{key}:</b> {val}</span>))}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{marginTop:'24px', display:'flex', gap:'10px', flexWrap: 'wrap'}}>
                     {!isReadyToShip && <button onClick={() => onMoveStage(order)} style={{flex:1, padding:'12px', backgroundColor: THEME.colors.brand.primary, color:'white', border:'none', borderRadius:'6px', fontWeight:'600', cursor:'pointer'}}>Mover Próxima Etapa</button>}
                     {isReadyToShip && <button onClick={() => onDeliver(order.id)} style={{flex:1, padding:'12px', backgroundColor: '#16A34A', color:'white', border:'none', borderRadius:'6px', fontWeight:'600', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}><Icons.Check /> Entregue</button>}
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD ---
const ProductionDashboard = () => {
    const { token, API_BASE_URL } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);
    const navigate = useNavigate(); 

    // Fetch silencioso para a técnica Optimistic UI não piscar a tela
    const fetchOrders = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const activeOrders = response.data.orders.filter(o => o.status !== 'Entregue/Concluído' && o.status !== 'Cancelado');

            const formattedOrders = activeOrders.map(order => {
                const statusObj = STATUS_CONFIG.find(s => s.dbValue === order.status);
                const mappedStatus = statusObj ? statusObj.id : 'artCreation';
                return {
                    id: order.id,
                    tracking_code: order.tracking_code,
                    client: order.client_name,
                    items: `${order.product_type} - ${order.fabric_type || ''}`,
                    rawDate: order.delivery_date, 
                    status: mappedStatus,
                    sizes_json: order.sizes_json || {},
                    notes: 'Sem observações.',
                    priority: order.priority || 'normal'
                };
            });
            setOrders(formattedOrders);
        } catch (error) { console.error("Erro:", error); } finally { if (!silent) setLoading(false); }
    };

    useEffect(() => {
        fetchOrders();
        const handleResize = () => setIsMobile(window.innerWidth < 1000);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ========================================================================
    // ⭐ MÁGICA DO DRAG & DROP "OPTIMISTIC UI" ⭐
    // ========================================================================
    const handleDragStart = (e, orderId, currentStatus) => {
        e.dataTransfer.setData("orderId", orderId.toString());
        e.dataTransfer.setData("currentStatus", currentStatus);
    };

    const handleDragOver = (e) => e.preventDefault();
    const handleDragEnterCard = (targetOrderId) => { if (dragTargetId !== targetOrderId) setDragTargetId(targetOrderId); };
    const handleDragLeaveCard = () => { setDragTargetId(null); };

    const handleStatusChangeDrop = async (orderId, currentStatus, newStatusId) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const statusObj = STATUS_CONFIG.find(s => s.id === newStatusId);
        if (!statusObj) return;

        // OTIMISTA: Atualiza a tela antes do BD
        setOrders(prev => {
            const orderToMove = prev.find(o => o.id === orderId);
            const filtered = prev.filter(o => o.id !== orderId);
            return [...filtered, { ...orderToMove, status: newStatusId }];
        });

        try {
            await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/status`, { new_status: statusObj.dbValue }, { headers: { Authorization: `Bearer ${token}` } });
            // Deixe VAZIO aqui. Não faz reload para evitar piscar!
        } catch (error) {
            Swal.fire('Erro', 'Falha ao mover pedido.', 'error');
            fetchOrders(true); // Desfaz
        }
    };

    const reorderToTarget = async (draggedOrderId, status, targetOrderId) => {
        const columnOrders = orders.filter(o => o.status === status);
        const oldIndex = columnOrders.findIndex(o => o.id === draggedOrderId);
        let newIndex = targetOrderId ? columnOrders.findIndex(o => o.id === targetOrderId) : columnOrders.length - 1;

        if (oldIndex === newIndex || oldIndex === -1) return;

        // Recalcula local
        const newColumnOrders = Array.from(columnOrders);
        const [movedItem] = newColumnOrders.splice(oldIndex, 1);
        newColumnOrders.splice(newIndex, 0, movedItem);

        // OTIMISTA
        setOrders(prevOrders => {
            const otherOrders = prevOrders.filter(o => o.status !== status);
            return [...otherOrders, ...newColumnOrders];
        });

        const orderedIds = newColumnOrders.map(o => o.id);
        try {
            await axios.put(`${API_BASE_URL}/api/orders/reorder`, { orderedIds }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
            Swal.fire('Erro', 'Erro ao salvar ordem.', 'error');
            fetchOrders(true);
        }
    };

    const handleDropOnCard = (e, targetOrderId, targetStatus) => {
        e.preventDefault(); e.stopPropagation();
        setDragTargetId(null);

        const orderId = parseInt(e.dataTransfer.getData("orderId"));
        const currentStatus = e.dataTransfer.getData("currentStatus");

        if (currentStatus === targetStatus) {
            reorderToTarget(orderId, currentStatus, targetOrderId);
        } else {
            handleStatusChangeDrop(orderId, currentStatus, targetStatus);
        }
    };

    const handleDropOnShelf = (e, targetStatus) => {
        e.preventDefault();
        setDragTargetId(null);
        
        const orderId = parseInt(e.dataTransfer.getData("orderId"));
        const currentStatus = e.dataTransfer.getData("currentStatus");
        
        if (currentStatus === targetStatus) {
            reorderToTarget(orderId, currentStatus, null); 
        } else {
            handleStatusChangeDrop(orderId, currentStatus, targetStatus);
        }
    };

    // --- MANUAIS / BOTÕES ---
    const handleDeliver = async (orderId) => {
        const res = await Swal.fire({ title: 'Confirmar entrega?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sim' });
        if (res.isConfirmed) {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;
            try {
                await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/status`, { new_status: 'Entregue/Concluído' }, { headers: { Authorization: `Bearer ${token}` } });
                setOrders(orders.filter(o => o.id !== orderId));
                setSelectedOrder(null);
            } catch (error) { alert("Erro ao finalizar."); }
        }
    };
    
    const handleMoveStage = (order) => {
         const currentIndex = STATUS_CONFIG.findIndex(s => s.id === order.status);
         if (currentIndex < STATUS_CONFIG.length - 1) {
             const nextStatus = STATUS_CONFIG[currentIndex + 1].id;
             handleStatusChangeDrop(order.id, order.status, nextStatus); // Usa o otimista!
             setSelectedOrder(null);
         }
    };

    const getCount = (statusId) => orders.filter(o => o.status === statusId).length;
    
    const totalPieces = orders.reduce((acc, order) => {
        if (order.status === 'ready') return acc;
        const sizes = order.sizes_json || {};
        const orderQty = Object.values(sizes).reduce((sum, val) => sum + (Number(val) || 0), 0);
        return acc + orderQty;
    }, 0);

    const totalLate = orders.filter(o => {
        const today = new Date().toISOString().split('T')[0];
        return o.rawDate <= today && o.status !== 'ready';
    }).length;
    
    const totalReady = orders.filter(o => o.status === 'ready').length;

    const totalOrdersCount = orders.length;
    const efficiencyRate = totalOrdersCount > 0 ? Math.round(((totalOrdersCount - totalLate) / totalOrdersCount) * 100) : 100;

    if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#64748B'}}>Carregando Produção...</div>;

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: '1600px', margin: '0 auto', color: THEME.colors.text.primary, paddingBottom: '40px' }}>
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ 
                        fontSize: '1.5rem',      
                        fontWeight: '700',       
                        color: '#0f172a',        
                        margin: '0 0 4px 0', 
                        letterSpacing: '-0.5px',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px'
                    }}>
                        <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center' }}>
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                        </span>
                        Gerenciamento de Produção
                    </h1>
                    <p style={{ 
                        fontSize: '0.875rem',    
                        color: '#64748b',        
                        margin: 0,
                        fontWeight: '400',
                        marginLeft: '38px' 
                    }}>
                        Controle de fluxo operacional
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <KPICard title="Em Produção" value={`${totalPieces} Peças`} icon={<Icons.Box />} color="#F59E0B" subtext="No chão de fábrica" />
                <KPICard title="Atrasados" value={`${totalLate} Pedidos`} icon={<Icons.Alert />} color="#DC2626" subtext="Requer prioridade" />
                <KPICard title="Prontos" value={`${totalReady} Pedidos`} icon={<Icons.Check />} color="#10B981" subtext="Aguardando entrega" />
                
                <KPICard 
                    title="Eficiência" 
                    value={`${efficiencyRate}%`} 
                    icon={<Icons.Activity />} 
                    color="#7C3AED" 
                    subtext="Ver Objetivos (Clique aqui)" 
                    onClick={() => navigate('/finance/goals')}
                />
            </div>
            <section style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isMobile ? 'space-around' : 'center', gap: isMobile ? '16px' : '24px' }}>
                    {STATUS_CONFIG.map(status => (
                        <ProductionCircle key={status.id} title={status.label} count={getCount(status.id)} color={status.color} />
                    ))}
                </div>
            </section>
            
            {/* O KANBAN DE PRODUÇÃO COM DRAG E DROP */}
            <section>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
                    {STATUS_CONFIG.map(stage => (
                        <ProductionShelf 
                            key={stage.id} stage={stage} orders={orders} 
                            onDragOver={handleDragOver} onDropOnShelf={handleDropOnShelf} onDropOnCard={handleDropOnCard}
                            onDragStart={handleDragStart} onDragEnterCard={handleDragEnterCard} onDragLeaveCard={handleDragLeaveCard} dragTargetId={dragTargetId}
                            onClickOrder={setSelectedOrder} 
                        />
                    ))}
                </div>
            </section>

            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onDeliver={handleDeliver} onMoveStage={handleMoveStage} />}
        </div>
    );
};

export default ProductionDashboard;
