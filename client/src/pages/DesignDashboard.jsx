import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2'; 
import Modal from '../components/Modal';

// --- CONFIGURAÇÃO VISUAL PREMIUM SaaS ---
const THEME = {
    colors: {
        background: '#F8FAFC', 
        card: '#FFFFFF', 
        border: '#E2E8F0',
        text: { primary: '#0F172A', secondary: '#475569', disabled: '#94A3B8' },
        brand: { primary: '#2563EB', light: '#EFF6FF' }
    },
    shadows: {
        sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.03)',
        drag: '0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 10px 10px -5px rgba(15, 23, 42, 0.05)'
    }
};

const DESIGN_FLOW_KEYS = ['Criação de Arte', 'Em Criação', 'Ajustes', 'Aguardando Aprovação', 'Arte Aprovada/Liberada'];

const STATUS_CONFIG = [
    { id: 'Criação de Arte', label: 'Novas Solicitações', color: '#0284C7' },
    { id: 'Em Criação', label: 'Em Criação', color: '#3B82F6' },
    { id: 'Ajustes', label: 'Ajustes', color: '#F59E0B' },
    { id: 'Aguardando Aprovação', label: 'Aguardando Aprovação', color: '#8B5CF6' },
    { id: 'Arte Aprovada/Liberada', label: 'Aprovadas', color: '#10B981' }
];

const Icons = {
    Pen: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    Plus: () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
    Archive: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    Link: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Check: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
    Dollar: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Info: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Eye: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    User: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Bell: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
};

const formatDateSimple = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0)).toLocaleDateString('pt-BR');
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const Pill = ({ children, colorClass }) => {
    const colorMap = {
        blue: { bg: '#EFF6FF', text: '#1D4ED8' },
        orange: { bg: '#FFF7ED', text: '#C2410C' },
        gray: { bg: '#F1F5F9', text: '#475569' }
    };
    const style = colorMap[colorClass] || colorMap.gray;
    return (
        <span style={{ fontSize: '0.65rem', backgroundColor: style.bg, color: style.text, padding: '3px 8px', borderRadius: '4px', fontWeight: '600', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
            {children}
        </span>
    );
};

const ClientAutocomplete = ({ value, onChange, onAddNew, clients }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = (e) => {
        const userInput = e.target.value;
        onChange(userInput);
        setIsSuccess(false);
        if (userInput.length > 0) {
            setSuggestions(clients.filter(c => c.name.toLowerCase().includes(userInput.toLowerCase())));
            setShowSuggestions(true);
        } else { setShowSuggestions(false); }
    };

    const triggerSuccessEffect = () => { setIsSuccess(true); setTimeout(() => setIsSuccess(false), 2000); };
    const handleSelect = (name) => { onChange(name); setShowSuggestions(false); triggerSuccessEffect(); };
    const handleCreate = () => { 
        if (value?.trim()) { 
            onAddNew(value); 
            setShowSuggestions(false); 
            triggerSuccessEffect(); 
        } 
    };

    const exactMatch = clients.some(c => c.name.toLowerCase() === (value || '').toLowerCase());

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <input 
                    type="text" 
                    value={value || ''} 
                    onChange={handleChange} 
                    onFocus={() => value && setShowSuggestions(true)} 
                    placeholder="Nome do cliente..." 
                    style={{ ...styles.input, width: '100%', boxSizing: 'border-box', borderColor: isSuccess ? '#10B981' : '#cbd5e1', backgroundColor: isSuccess ? '#ECFDF5' : '#fff' }} 
                    required 
                    autoComplete="off" 
                />
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: isSuccess ? '#10B981' : '#94a3b8', pointerEvents: 'none' }}>
                    {isSuccess ? <Icons.Check /> : null}
                </div>
            </div>
            
            {showSuggestions && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, listStyle: 'none', padding: 0, margin: '4px 0 0 0', boxShadow: THEME.shadows.md }}>
                    {suggestions.map(s => (
                        <li key={s.id} onClick={() => handleSelect(s.name)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: THEME.colors.text.primary }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <Icons.User /> {s.name}
                        </li>
                    ))}
                    {!exactMatch && value?.trim() && (
                        <li onClick={handleCreate} style={{ padding: '10px 12px', cursor: 'pointer', color: THEME.colors.brand.primary, fontWeight: '600', backgroundColor: THEME.colors.brand.light, borderTop: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DBEAFE'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME.colors.brand.light}>
                            <Icons.Plus /> Cadastrar novo: "{value}"
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

const OrderCard = ({ 
    order, index, onDragStart, onDragEndGlobal, onDropOnCard, onDragEnterCard, dragTargetId, isDragging,
    onArchive, onSendToProduction, onGenerateQuote, isAdmin, isArchivedView, onRestore, onViewDetails, onDelete, selectedIds, onCheckboxChange, onEdit 
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const statusColor = STATUS_CONFIG.find(s => s.id === order.status)?.color || '#CBD5E1';
    const isApproved = order.status === 'Arte Aprovada/Liberada';
    const canDrag = isAdmin || !isApproved;
    
    // Identifica se este card é o alvo (onde o arrasto vai cair)
    const isDragTarget = dragTargetId === order.id;
    const isTopPriority = !isArchivedView && index <= 2;

    let badgeBg = '#F1F5F9';
    let badgeColor = '#64748B';
    if (!isArchivedView) {
        if (index === 0) { badgeBg = '#FEE2E2'; badgeColor = '#DC2626'; } 
        else if (index === 1) { badgeBg = '#FEF3C7'; badgeColor = '#D97706'; } 
        else if (index === 2) { badgeBg = '#DCFCE7'; badgeColor = '#16A34A'; } 
    }

    const handleDragStartLocal = (e) => {
        if (!canDrag || isArchivedView) { e.preventDefault(); return; }

        onDragStart(order.id, order.status);
        e.dataTransfer.setData("orderId", order.id.toString());
        e.dataTransfer.setData("currentStatus", order.status);

        // Gera a foto fantasma (Clone 3D) do card que está sendo puxado
        const cardNode = e.currentTarget; 
        const rect = cardNode.getBoundingClientRect();
        
        const cloneWrapper = document.createElement('div');
        cloneWrapper.style.position = 'absolute';
        cloneWrapper.style.top = '-9999px';
        cloneWrapper.style.left = '-9999px';
        cloneWrapper.style.padding = '40px'; 
        cloneWrapper.style.pointerEvents = 'none';

        const clone = cardNode.cloneNode(true);
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.transform = 'rotate(3deg) scale(1.02)'; 
        clone.style.boxShadow = THEME.shadows.drag; 
        clone.style.backgroundColor = THEME.colors.card;
        clone.style.borderRadius = '6px';
        clone.style.opacity = '1';
        
        clone.style.border = `1px solid ${THEME.colors.brand.primary}`; 
        if (isTopPriority || isArchivedView) {
            clone.style.borderLeft = `4px solid ${isArchivedView ? '#94A3B8' : statusColor}`;
        }

        clone.style.margin = '0';
        clone.style.transition = 'none'; 
        
        const actionButtons = clone.querySelector('.card-actions-container');
        if (actionButtons) actionButtons.style.opacity = '0';

        cloneWrapper.appendChild(clone);
        document.body.appendChild(cloneWrapper);
        
        e.dataTransfer.setDragImage(cloneWrapper, (e.clientX - rect.left) + 40, (e.clientY - rect.top) + 40);
        e.dataTransfer.effectAllowed = 'move';

        setTimeout(() => {
            if(document.body.contains(cloneWrapper)) document.body.removeChild(cloneWrapper);
        }, 0);
    };

    return (
        // ⭐ ENVOLTÓRIO INVISÍVEL (O Segredo para empurrar os cards fisicamente para baixo sem travar o mouse) ⭐
        <div 
            onDragEnter={(e) => {
                if (canDrag && !isArchivedView) {
                    e.preventDefault(); e.stopPropagation();
                    onDragEnterCard(order.id);
                }
            }}
            onDragOver={(e) => { 
                if (canDrag && !isArchivedView) { 
                    e.preventDefault(); e.stopPropagation(); 
                } 
            }}
            onDrop={(e) => { 
                if (canDrag && !isArchivedView) { 
                    e.preventDefault(); e.stopPropagation(); 
                    onDropOnCard(order.id, order.status); 
                }
            }}
            style={{
                // Quando o mouse passa aqui, ele aumenta o padding-top. 
                // Isso empurra fisicamente o card para baixo e abre o espaço que você quer!
                paddingTop: (isDragTarget && !isDragging) ? '80px' : '0px',
                transition: 'padding-top 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                position: 'relative'
            }}
        >
            {/* O TRACEJADO SUTIL QUE FICA NO ESPAÇO VAZIO (Fica invisível pro mouse para não atrapalhar) */}
            {(isDragTarget && !isDragging) && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '70px',
                    border: `2px dashed ${THEME.colors.brand.primary}`,
                    borderRadius: '6px',
                    backgroundColor: THEME.colors.brand.light,
                    opacity: 0.6,
                    pointerEvents: 'none'
                }} />
            )}

            {/* O CARD DE VERDADE */}
            <div 
                className="draggable-card"
                draggable={canDrag && !isArchivedView} 
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onDragStart={handleDragStartLocal}
                onDragEnd={() => { onDragEndGlobal(); }}
                style={{
                    backgroundColor: isDragging ? '#F1F5F9' : THEME.colors.card, 
                    padding: (isTopPriority || isArchivedView || isDragging) ? '10px 12px' : '10px 12px 10px 15px', 
                    borderRadius: '6px', 
                    border: isDragging ? '2px dashed #CBD5E1' : `1px solid ${THEME.colors.border}`, 
                    borderLeft: isDragging ? '2px dashed #CBD5E1' : (isTopPriority || isArchivedView ? `4px solid ${isArchivedView ? '#94A3B8' : statusColor}` : `1px solid ${THEME.colors.border}`), 
                    transform: (isHovered && canDrag && !isArchivedView && !isDragging) ? 'translateY(-2px)' : 'none',
                    boxShadow: isDragging ? 'none' : (isHovered && canDrag && !isArchivedView && !isDragging ? THEME.shadows.md : THEME.shadows.sm),
                    cursor: (canDrag && !isArchivedView) ? (isDragging ? 'grabbing' : 'grab') : 'default', 
                    
                    // Se estiver arrastando ele, o card original fica "apagadinho" na lista
                    opacity: isArchivedView ? 0.8 : (isDragging ? 0.3 : 1), 
                    
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease'
                }}
            >
                <div style={{ visibility: isDragging ? 'hidden' : 'visible', opacity: isDragging ? 0 : 1, transition: 'opacity 0.15s ease', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {isArchivedView && (
                            <input type="checkbox" checked={selectedIds?.includes(order.id) || false} onChange={() => onCheckboxChange(order.id)} style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: THEME.colors.brand.primary }} />
                        )}
                        {!isArchivedView && (
                            <span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>
                                {index + 1}º
                            </span>
                        )}
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: THEME.colors.text.disabled, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {order.tracking_code}
                        </span>
                    </div>

                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: THEME.colors.text.primary, fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.client_name}>
                        {order.client_name}
                    </h4>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '24px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', overflow: 'hidden' }}>
                            {order.product_type && <Pill colorClass="gray">{order.product_type}</Pill>}
                            {order.cor && <Pill colorClass="blue">{order.cor}</Pill>}
                            {order.tipo_estampa && <Pill colorClass="orange">{order.tipo_estampa}</Pill>}
                        </div>

                        <div className="card-actions-container" style={{ display: 'flex', gap: '2px', opacity: (isHovered || isArchivedView) ? 1 : 0, transition: 'opacity 0.2s ease', paddingLeft: '4px', backgroundColor: 'rgba(255,255,255,0.8)' }}>
                            <button onClick={() => onViewDetails(order)} style={styles.iconButton} title="Ver Detalhes"><Icons.Eye /></button>
                            {!isArchivedView && <button onClick={() => onEdit(order)} style={styles.iconButton} title="Editar"><Icons.Edit /></button>}
                            {!isApproved && !isArchivedView && <button onClick={() => onArchive(order)} style={{...styles.iconButton, color: '#EF4444'}} title="Arquivar Arte Abandonada"><Icons.Archive /></button>}
                        </div>
                    </div>

                    {(order.observacao || order.url_referencia) && (
                        <div style={{ display: 'flex', gap: '8px', borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '4px', marginTop: '2px' }}>
                            {order.url_referencia && <a href={order.url_referencia} target="_blank" rel="noreferrer" style={{ fontSize:'0.65rem', color: THEME.colors.brand.primary, display: 'flex', alignItems: 'center', gap: '2px', textDecoration: 'none', fontWeight: '600' }}><Icons.Link /> Referência</a>}
                            {order.observacao && <span title={order.observacao} style={{ fontSize:'0.65rem', color: THEME.colors.text.secondary, display: 'flex', alignItems: 'center', gap: '2px', cursor:'help', fontWeight: '500' }}><Icons.Info /> Obs</span>}
                        </div>
                    )}

                    {isApproved && !isArchivedView && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px' }}>
                            <button onClick={() => onGenerateQuote(order)} style={{ ...styles.actionBtn, backgroundColor: THEME.colors.brand.light, color: THEME.colors.brand.primary }}><Icons.Dollar /> Gerar Orçamento</button>
                            <button onClick={() => onSendToProduction(order)} style={{ ...styles.actionBtn, backgroundColor: '#DCFCE7', color: '#16A34A' }}><Icons.Check /> Enviar p/ Produção</button>
                            <button onClick={() => onArchive(order)} style={{ ...styles.actionBtn, backgroundColor: '#FEE2E2', color: '#DC2626' }}><Icons.Archive /> Desistiu</button>
                        </div>
                    )}

                    {isArchivedView && isAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '8px' }}>
                            <button onClick={() => onRestore(order)} style={{ ...styles.actionBtn, backgroundColor: THEME.colors.brand.light, color: THEME.colors.brand.primary }}>Restaurar Arte</button>
                            <button onClick={() => onDelete(order)} style={{ ...styles.actionBtn, backgroundColor: '#FEE2E2', color: '#DC2626' }}><Icons.Trash /> Excluir Definitivamente</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DesignShelf = ({ stage, orders, onDragOver, onDropOnShelf, onDropOnCard, onDragStart, onDragEndGlobal, draggedOrderId, onDragEnterCard, dragTargetId, actions, isAdmin }) => {
    const stageOrders = orders.filter(o => o.status === stage.id);
    const isEmpty = stageOrders.length === 0;

    return (
        <div 
            onDragOver={onDragOver} 
            onDragEnter={(e) => {
                if (e.target === e.currentTarget) {
                    onDragEnterCard(null);
                }
            }}
            onDrop={(e) => {
                e.preventDefault();
                if (!dragTargetId) {
                    onDropOnShelf(stage.id);
                }
            }}
            style={{ 
                backgroundColor: isEmpty ? '#F8FAFC' : '#F1F5F9', 
                borderRadius: '8px', 
                border: isEmpty ? `1px dashed #CBD5E1` : `1px solid transparent`,
                padding: '12px 10px', display: 'flex', flexDirection: 'column', minHeight: '500px',
                height: '100%', 
                boxSizing: 'border-box',
                transition: 'all 0.2s ease'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px', paddingLeft: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stage.color }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: THEME.colors.text.primary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.label}</h4>
                <span style={{ backgroundColor: 'white', color: THEME.colors.text.secondary, borderRadius: '9999px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: '700', boxShadow: THEME.shadows.sm }}>{stageOrders.length}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {stageOrders.map((order, index) => (
                    <OrderCard 
                        key={order.id} order={order} index={index}
                        isDragging={draggedOrderId === order.id}
                        onDragStart={onDragStart} onDragEndGlobal={onDragEndGlobal} onDropOnCard={onDropOnCard} 
                        onDragEnterCard={onDragEnterCard} dragTargetId={dragTargetId}
                        {...actions} isAdmin={isAdmin} isArchivedView={false} 
                    />
                ))}
                {isEmpty && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', color: '#94A3B8', fontSize: '0.8rem', fontWeight: '500' }}>
                        <span style={{ opacity: 0.6 }}>Nenhuma solicitação</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const DesignDashboard = () => {
    const { token, API_BASE_URL, user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState('active'); 
    
    // DRAG AND DROP GLOBALS
    const [draggedOrderId, setDraggedOrderId] = useState(null);
    const [draggedSourceStatus, setDraggedSourceStatus] = useState(null);
    const [dragTargetId, setDragTargetId] = useState(null);
    
    // TRAVAS ANTI-QUEBRA
    const syncLockRef = useRef(false);
    const prevOrdersRef = useRef([]);

    // ESTADOS DA CENTRAL DE NOTIFICAÇÃO
    const [notifications, setNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef(null);
    
    const [selectedArchivedIds, setSelectedArchivedIds] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    
    const [reqData, setReqData] = useState({ client_name: '', product_type: '', cor: '', tipo_estampa: '', data_entrega_arte: '', observacao: '', url_referencia: '' });
    const [editData, setEditData] = useState({ id: null, tracking_code: '', client_name: '', product_type: '', cor: '', tipo_estampa: '', data_entrega_arte: '', observacao: '', url_referencia: '' });
    const [layoutFile, setLayoutFile] = useState(null);
    const [editLayoutFile, setEditLayoutFile] = useState(null);

    const isAdmin = user?.role === 'admin';
    const canCreateRequest = user?.role === 'admin' || user?.role?.includes('gerente');

    // Fechar notificação ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchData = async (silent = false, isBackgroundCheck = false) => {
        try {
            if (!silent && !isBackgroundCheck) setLoading(true);
            const [ordersRes, clientsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/orders`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            
            let fetchedOrders = ordersRes.data.orders.filter(o => DESIGN_FLOW_KEYS.includes(o.status) || o.status === 'Arte Arquivada');

            fetchedOrders.sort((a, b) => {
                const orderA = typeof a.board_order === 'number' ? a.board_order : 0;
                const orderB = typeof b.board_order === 'number' ? b.board_order : 0;
                if (orderA !== orderB) return orderA - orderB;
                return a.id - b.id; 
            });

            if (isBackgroundCheck && prevOrdersRef.current.length > 0) {
                const oldOrdersMap = prevOrdersRef.current;
                
                const newlyArrived = fetchedOrders.filter(newOrder => {
                    if (newOrder.status !== 'Criação de Arte') return false;
                    const oldOrder = oldOrdersMap.find(old => old.id === newOrder.id);
                    return !oldOrder || oldOrder.status !== 'Criação de Arte';
                });

                if (newlyArrived.length > 0) {
                    Swal.fire({
                        title: '🔔 Nova Arte na Fila!',
                        text: newlyArrived.length === 1 ? `Cliente: ${newlyArrived[0].client_name}` : `${newlyArrived.length} novas artes aguardando criação.`,
                        icon: 'info', toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, background: '#EFF6FF', color: '#1D4ED8', iconColor: '#2563EB',
                    });

                    const newNotifs = newlyArrived.map(newOrder => ({
                        id: newOrder.id, 
                        client: newOrder.client_name,
                        tracking: newOrder.tracking_code,
                        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        orderData: newOrder 
                    }));
                    
                    setNotifications(prev => [...newNotifs, ...prev].slice(0, 15));
                }
            }

            prevOrdersRef.current = fetchedOrders.map(o => ({ id: o.id, status: o.status }));
            
            if (isBackgroundCheck && (draggedOrderId || syncLockRef.current)) {
                return; 
            }

            setOrders(fetchedOrders);
            if (!isBackgroundCheck) setClients(clientsRes.data.clients || []);

        } catch (error) { 
            console.error("Erro no fetch:", error); 
        } finally { 
            if (!silent && !isBackgroundCheck) setLoading(false); 
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => { fetchData(true, true); }, 3000); 
        return () => clearInterval(interval);
    }, [token, API_BASE_URL]);

    const activeOrders = orders.filter(o => o.status !== 'Arte Arquivada');
    const archivedOrders = orders.filter(o => o.status === 'Arte Arquivada');

    const toggleNotificationMenu = () => {
        setIsNotifOpen(!isNotifOpen);
    };

    const handleNotificationClick = (notif) => {
        setIsNotifOpen(false); 
        setNotifications(prev => prev.filter(n => n.id !== notif.id)); 
        
        const orderToOpen = orders.find(o => o.id === notif.id) || notif.orderData;
        if (orderToOpen) {
            const safeOrder = {
                ...orderToOpen,
                sizes_json: typeof orderToOpen.sizes_json === 'string' ? JSON.parse(orderToOpen.sizes_json || '{}') : orderToOpen.sizes_json
            };
            handleViewDetails(safeOrder);
        }
    };

    const handleFileChange = (e, setFile) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { 
                Swal.fire('Arquivo muito grande', 'A imagem deve ter no máximo 1MB.', 'warning');
                e.target.value = ''; 
                setFile(null);
            } else { setFile(file); }
        } else { setFile(null); }
    };

    const handleQuickClientAdd = async (clientName) => {
        try {
            await axios.post(`${API_BASE_URL}/api/clients`, { name: clientName }, { headers: { Authorization: `Bearer ${token}` } });
            const clientsRes = await axios.get(`${API_BASE_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
            setClients(clientsRes.data.clients || []);
            Swal.fire({ title: 'Cliente Cadastrado!', text: `O cliente ${clientName} foi adicionado.`, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        } catch (error) {
            Swal.fire('Erro', 'Não foi possível cadastrar o cliente.', 'error');
        }
    };
    
    const handleDragStart = (orderId, currentStatus) => {
        setDraggedOrderId(orderId);
        setDraggedSourceStatus(currentStatus);
    };
    
    const handleDragEndGlobal = () => {
        setDraggedOrderId(null);
        setDraggedSourceStatus(null);
        setDragTargetId(null);
    };

    const handleDragOver = (e) => e.preventDefault();
    const handleDragEnterCard = (targetOrderId) => { if (dragTargetId !== targetOrderId) setDragTargetId(targetOrderId); };

    const moveCardToNewPosition = async (targetStatus, targetOrderId = null) => {
        if (!draggedOrderId) return;
        
        const orderToMove = orders.find(o => o.id === draggedOrderId);
        if (!orderToMove) return;

        syncLockRef.current = true;

        const isChangingColumn = draggedSourceStatus !== targetStatus;

        if (isChangingColumn && !isAdmin) {
            const currentIndex = DESIGN_FLOW_KEYS.indexOf(draggedSourceStatus);
            const newIndex = DESIGN_FLOW_KEYS.indexOf(targetStatus);
            if (newIndex !== currentIndex + 1) {
                Swal.fire({ title: 'Bloqueado', text: 'Avance apenas uma etapa por vez.', icon: 'warning' });
                handleDragEndGlobal();
                syncLockRef.current = false;
                return;
            }
        }

        let currentOrders = [...orders];
        let targetColumn = currentOrders.filter(o => o.status === targetStatus);

        if (!isChangingColumn) {
            // ⭐ MATEMÁTICA PURA DA ARRAY PARA EMPURRAR (Sobe e Desce perfeitamente) ⭐
            const oldIndex = targetColumn.findIndex(o => o.id === draggedOrderId);
            let newIndex = targetOrderId ? targetColumn.findIndex(o => o.id === targetOrderId) : targetColumn.length;
            
            if (newIndex === -1) newIndex = targetColumn.length; 
            if (oldIndex === newIndex) {
                handleDragEndGlobal();
                syncLockRef.current = false;
                return;
            }

            const [movedItem] = targetColumn.splice(oldIndex, 1);
            
            // Compensação natural: Se você moveu para baixo, o item que estava lá já "subiu" uma posição!
            if (newIndex > oldIndex) {
                newIndex--; 
            }
            targetColumn.splice(newIndex, 0, movedItem);

        } else {
            currentOrders = currentOrders.filter(o => o.id !== draggedOrderId);
            targetColumn = currentOrders.filter(o => o.status === targetStatus);
            
            let insertIndex = targetColumn.length; 
            if (targetOrderId) {
                insertIndex = targetColumn.findIndex(o => o.id === targetOrderId);
                if (insertIndex === -1) insertIndex = targetColumn.length;
            }

            const updatedOrder = { ...orderToMove, status: targetStatus };
            targetColumn.splice(insertIndex, 0, updatedOrder);
        }

        targetColumn.forEach((item, index) => {
            item.board_order = index;
        });

        const otherOrders = currentOrders.filter(o => o.id !== draggedOrderId && o.status !== targetStatus);
        const finalOrders = [...otherOrders, ...targetColumn];

        setOrders(finalOrders);
        prevOrdersRef.current = finalOrders.map(o => ({ id: o.id, status: o.status }));
        
        handleDragEndGlobal(); 

        try {
            if (isChangingColumn) {
                await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderToMove.tracking_code)}/status`, { new_status: targetStatus }, { headers: { Authorization: `Bearer ${token}` } });
            }
            const orderedIds = targetColumn.map(o => o.id);
            await axios.put(`${API_BASE_URL}/api/orders/reorder`, { orderedIds }, { headers: { Authorization: `Bearer ${token}` } });
            
        } catch (error) {
            Swal.fire('Erro', 'Ocorreu um erro ao salvar a posição no banco.', 'error');
            fetchData(true); 
        } finally {
            setTimeout(() => { syncLockRef.current = false; }, 3500);
        }
    };

    const handleDropOnCard = (targetOrderId, targetStatus) => {
        moveCardToNewPosition(targetStatus, targetOrderId);
    };

    const handleDropOnShelf = (targetStatus) => {
        moveCardToNewPosition(targetStatus, null); 
    };

    const handleCheckboxChange = (id) => setSelectedArchivedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleBulkDelete = async () => {
        if (selectedArchivedIds.length === 0) return;
        const res = await Swal.fire({ title: 'Excluir em Massa?', text: `Apagar ${selectedArchivedIds.length} solicitações do sistema?`, icon: 'error', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sim, Apagar' });
        if (res.isConfirmed) {
            try {
                await Promise.all(selectedArchivedIds.map(id => axios.delete(`${API_BASE_URL}/api/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })));
                Swal.fire('Excluídos!', 'As artes selecionadas foram apagadas.', 'success');
                setSelectedArchivedIds([]);
                fetchData(true);
            } catch(e) { Swal.fire('Erro', 'Erro ao excluir.', 'error'); }
        }
    };

    const handleViewDetails = (order) => { setSelectedOrderDetails(order); setIsDetailsModalOpen(true); };

    const openEditModal = (order) => {
        setEditData({ id: order.id, tracking_code: order.tracking_code, client_name: order.client_name, product_type: order.product_type || '', cor: order.cor || '', tipo_estampa: order.tipo_estampa || '', data_entrega_arte: order.data_entrega_arte ? order.data_entrega_arte.split('T')[0] : '', url_referencia: order.url_referencia || '', observacao: order.observacao || '' });
        setEditLayoutFile(null);
        setIsEditModalOpen(true);
    };

    const handleDeletePermanently = async (order) => {
        const res = await Swal.fire({ title: 'Excluir Definitivamente?', text: 'Esta ação não pode ser desfeita.', icon: 'error', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sim, Apagar' });
        if(res.isConfirmed) {
            try {
                await axios.delete(`${API_BASE_URL}/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
                Swal.fire('Excluído!', 'A solicitação foi apagada.', 'success'); fetchData(true);
            } catch(e) { Swal.fire('Erro', 'Não foi possível excluir.', 'error'); }
        }
    };

    const handleArchive = async (order) => {
        const res = await Swal.fire({ title: 'Arquivar Arte?', text: 'Ela sairá do Kanban.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, Arquivar' });
        if(res.isConfirmed) { 
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Arte Arquivada' } : o));
            await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/status`, { new_status: 'Arte Arquivada' }, { headers: { Authorization: `Bearer ${token}` } }); 
        }
    };

    const handleRestore = async (order) => {
        const res = await Swal.fire({ title: 'Restaurar Arte?', text: 'Ela voltará para Novas Solicitações.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sim, Restaurar' });
        if(res.isConfirmed) {
            try {
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Criação de Arte' } : o));
                await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/status`, { new_status: 'Criação de Arte' }, { headers: { Authorization: `Bearer ${token}` } });
                Swal.fire('Restaurada!', 'A arte voltou para a fila inicial.', 'success');
            } catch(e) { Swal.fire('Erro', 'Não foi possível restaurar.', 'error'); fetchData(true); }
        }
    };

    const handleSendToProduction = async (order) => {
        const res = await Swal.fire({ title: 'Produção Fechada?', text: 'Essa arte será enviada para o CORTE.', icon: 'success', showCancelButton: true, confirmButtonText: 'Enviar p/ Produção' });
        if(res.isConfirmed) { 
            setOrders(prev => prev.filter(o => o.id !== order.id));
            await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/status`, { new_status: 'Corte Iniciado' }, { headers: { Authorization: `Bearer ${token}` } }); 
        }
    };

    const handleGenerateQuote = async (order) => {
        const res = await Swal.fire({ title: 'Gerar Orçamento?', text: 'Um orçamento será criado e esta solicitação será arquivada.', icon: 'question', showCancelButton: true, confirmButtonText: 'Gerar Orçamento' });
        if(res.isConfirmed) {
            try {
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Arte Arquivada' } : o));
                await axios.post(`${API_BASE_URL}/api/orders/${encodeURIComponent(order.tracking_code)}/convert-to-quote`, {}, { headers: { Authorization: `Bearer ${token}` } });
                Swal.fire('Pronto!', 'Orçamento gerado.', 'success');
            } catch(e) { Swal.fire('Erro', 'Falha ao gerar orçamento.', 'error'); fetchData(true); }
        }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(reqData).forEach(key => formData.append(key, reqData[key]));
            if (layoutFile) formData.append('layout_file', layoutFile);

            await axios.post(`${API_BASE_URL}/api/design-requests`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
            
            setIsModalOpen(false); 
            setReqData({ client_name: '', product_type: '', cor: '', tipo_estampa: '', data_entrega_arte: '', observacao: '', url_referencia: '' }); 
            setLayoutFile(null);
            
            Swal.fire({ title: 'Criado!', text: 'A arte foi para a fila.', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            
            fetchData(true);
        } catch (error) { Swal.fire('Erro', 'Não foi possível criar a solicitação.', 'error'); }
    };

    const handleEditRequest = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(editData).forEach(key => formData.append(key, editData[key]));
            if (editLayoutFile) formData.append('layout_file', editLayoutFile);

            await axios.put(`${API_BASE_URL}/api/design-requests/${editData.id}`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
            setIsEditModalOpen(false); Swal.fire('Sucesso!', 'Solicitação atualizada com sucesso.', 'success'); fetchData(true);
        } catch (error) { Swal.fire('Erro', 'Não foi possível atualizar a solicitação.', 'error'); }
    };

    if (loading) return <div style={{padding:'40px', textAlign:'center', color:'#64748B'}}>Carregando fila de arte...</div>;

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' }}>
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ backgroundColor: THEME.colors.brand.light, color: THEME.colors.brand.primary, padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                            <Icons.Pen />
                        </span> 
                        Painel de Criação (Design)
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, fontWeight: '500', marginLeft: '52px' }}>
                        Gestão de layouts, prioridades e aprovações
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    
                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button 
                            onClick={toggleNotificationMenu}
                            style={{ 
                                backgroundColor: 'white', border: `1px solid ${THEME.colors.border}`, padding: '10px', 
                                borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                                justifyContent: 'center', color: notifications.length > 0 ? THEME.colors.brand.primary : THEME.colors.text.secondary, 
                                transition: 'all 0.2s', boxShadow: THEME.shadows.sm, position: 'relative'
                            }}
                            title="Notificações"
                        >
                            <Icons.Bell />
                            {notifications.length > 0 && (
                                <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#EF4444', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                                    {notifications.length}
                                </span>
                            )}
                        </button>

                        {isNotifOpen && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '320px', backgroundColor: 'white', borderRadius: '12px', boxShadow: THEME.shadows.drag, border: `1px solid ${THEME.colors.border}`, zIndex: 1000, overflow: 'hidden' }}>
                                <div style={{ padding: '16px', borderBottom: `1px solid ${THEME.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: THEME.colors.text.primary }}>Mensagens não lidas</span>
                                    {notifications.length > 0 && (
                                        <button onClick={() => setNotifications([])} style={{ background: 'none', border: 'none', color: THEME.colors.brand.primary, fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>Limpar tudo</button>
                                    )}
                                </div>
                                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '32px 16px', textAlign: 'center', color: THEME.colors.text.disabled, fontSize: '0.85rem' }}>
                                            Tudo tranquilo por aqui. <br/>Nenhuma arte nova perdeu a sua atenção.
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div 
                                                key={n.id} 
                                                onClick={() => handleNotificationClick(n)} 
                                                style={{ padding: '16px', borderBottom: `1px solid #F1F5F9`, display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: THEME.colors.brand.primary, marginTop: '6px', flexShrink: 0 }}></div>
                                                <div>
                                                    <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: THEME.colors.text.primary, lineHeight: '1.3' }}>
                                                        Nova solicitação do cliente <b style={{color: THEME.colors.brand.primary}}>{n.client}</b> chegou na fila.
                                                    </p>
                                                    <span style={{ fontSize: '0.7rem', color: THEME.colors.text.disabled, fontWeight: '600' }}>#{n.tracking} • Hoje às {n.time}</span>
                                                    <span style={{ display: 'block', fontSize: '0.65rem', color: THEME.colors.brand.primary, marginTop: '4px', fontWeight: '600' }}>Clique para abrir</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {canCreateRequest && (
                        <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: THEME.colors.brand.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap:'8px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
                            <Icons.Plus /> Nova Solicitação
                        </button>
                    )}
                </div>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1px solid ${THEME.colors.border}` }}>
                <div style={{ display: 'flex', gap: '32px', paddingBottom: '10px' }}>
                    <button onClick={() => setCurrentTab('active')} style={currentTab === 'active' ? styles.tabActive : styles.tabInactive}>Fila de Criação</button>
                    <button onClick={() => setCurrentTab('archived')} style={currentTab === 'archived' ? styles.tabActive : styles.tabInactive}>Artes Arquivadas (Histórico)</button>
                </div>
                
                {/* Botão de Exclusão em Massa */}
                {currentTab === 'archived' && selectedArchivedIds.length > 0 && (
                    <button onClick={handleBulkDelete} style={{ marginBottom: '10px', backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap:'6px', transition: 'background 0.2s' }}>
                        <Icons.Trash /> Excluir Selecionados ({selectedArchivedIds.length})
                    </button>
                )}
            </div>

            {currentTab === 'active' ? (
                <section>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', alignItems: 'stretch', overflowX: 'auto', paddingBottom: '20px' }}>
                        {STATUS_CONFIG.map(stage => (
                            <DesignShelf 
                                key={stage.id} stage={stage} orders={activeOrders} 
                                onDragOver={handleDragOver} onDropOnShelf={handleDropOnShelf} onDropOnCard={handleDropOnCard} 
                                onDragStart={handleDragStart} onDragEndGlobal={handleDragEndGlobal} draggedOrderId={draggedOrderId}
                                onDragEnterCard={handleDragEnterCard} dragTargetId={dragTargetId}
                                actions={{ onArchive: handleArchive, onSendToProduction: handleSendToProduction, onGenerateQuote: handleGenerateQuote, onViewDetails: handleViewDetails, onEdit: openEditModal }}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                <section>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                        {archivedOrders.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: `1px dashed #CBD5E1`, color: THEME.colors.text.disabled, fontWeight: '500' }}>
                                Nenhuma arte arquivada por aqui.
                            </div>
                        ) : (
                            archivedOrders.map((order, index) => (
                                <OrderCard 
                                    key={order.id} order={order} index={index} 
                                    isDragging={false} onDragStart={() => {}} onDragEndGlobal={() => {}}
                                    onDragEnterCard={() => {}} onDragLeaveCard={() => {}} onDropOnCard={() => {}} dragTargetId={null}
                                    isAdmin={isAdmin} isArchivedView={true} onRestore={handleRestore} onViewDetails={handleViewDetails} onDelete={handleDeletePermanently}
                                    selectedIds={selectedArchivedIds} onCheckboxChange={handleCheckboxChange} onEdit={openEditModal}
                                />
                            ))
                        )}
                    </div>
                </section>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setLayoutFile(null); }} title="Nova Solicitação de Arte">
                <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Cliente *</label>
                        <ClientAutocomplete 
                            value={reqData.client_name} 
                            onChange={(v) => setReqData({...reqData, client_name: v})} 
                            onAddNew={(newClientName) => { 
                                handleQuickClientAdd(newClientName); 
                                setReqData({...reqData, client_name: newClientName}); 
                            }} 
                            clients={clients} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={styles.formGroup}><label style={styles.label}>Produto / Peça</label><input type="text" placeholder="Ex: Camiseta, Caneca..." value={reqData.product_type} onChange={e => setReqData({...reqData, product_type: e.target.value})} style={styles.input} required /></div>
                        <div style={styles.formGroup}><label style={styles.label}>Cor Predominante</label><input type="text" placeholder="Ex: Preto..." value={reqData.cor} onChange={e => setReqData({...reqData, cor: e.target.value})} style={styles.input} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={styles.formGroup}><label style={styles.label}>Tipo de Estampa</label><select value={reqData.tipo_estampa} onChange={e => setReqData({...reqData, tipo_estampa: e.target.value})} style={styles.input}><option value="">Selecione...</option><option value="Sublimação Total">Sublimação Total</option><option value="Silk Screen">Silk Screen</option><option value="Bordado">Bordado</option><option value="DTF">DTF / DTG</option></select></div>
                        <div style={styles.formGroup}><label style={styles.label}>Prazo da Arte</label><input type="date" value={reqData.data_entrega_arte} onChange={e => setReqData({...reqData, data_entrega_arte: e.target.value})} style={styles.input} /></div>
                    </div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Anexar Imagem (Máx 1MB)</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLayoutFile)} style={{ ...styles.input, backgroundColor: 'white' }} />
                    </div>

                    <div style={styles.formGroup}><label style={styles.label}>Link de Referência</label><input type="url" placeholder="https://..." value={reqData.url_referencia} onChange={e => setReqData({...reqData, url_referencia: e.target.value})} style={styles.input} /></div>
                    <div style={styles.formGroup}><label style={styles.label}>Observações para o Designer</label><textarea rows="3" value={reqData.observacao} onChange={e => setReqData({...reqData, observacao: e.target.value})} style={{...styles.input, resize: 'vertical'}} placeholder="Descreva os detalhes..."></textarea></div>
                    <button type="submit" style={{ padding: '12px', backgroundColor: THEME.colors.brand.primary, color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' }}>Enviar Solicitação</button>
                </form>
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditLayoutFile(null); }} title={`Editar: ${editData.tracking_code}`}>
                <form onSubmit={handleEditRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Cliente *</label>
                        <ClientAutocomplete 
                            value={editData.client_name} 
                            onChange={(v) => setEditData({...editData, client_name: v})} 
                            onAddNew={(newClientName) => { 
                                handleQuickClientAdd(newClientName); 
                                setEditData({...editData, client_name: newClientName}); 
                            }} 
                            clients={clients} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={styles.formGroup}><label style={styles.label}>Produto / Peça</label><input type="text" value={editData.product_type} onChange={e => setEditData({...editData, product_type: e.target.value})} style={styles.input} required /></div>
                        <div style={styles.formGroup}><label style={styles.label}>Cor Predominante</label><input type="text" value={editData.cor} onChange={e => setEditData({...editData, cor: e.target.value})} style={styles.input} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={styles.formGroup}><label style={styles.label}>Tipo de Estampa</label><select value={editData.tipo_estampa} onChange={e => setEditData({...editData, tipo_estampa: e.target.value})} style={styles.input}><option value="">Selecione...</option><option value="Sublimação Total">Sublimação Total</option><option value="Silk Screen">Silk Screen</option><option value="Bordado">Bordado</option><option value="DTF">DTF / DTG</option></select></div>
                        <div style={styles.formGroup}><label style={styles.label}>Prazo da Arte</label><input type="date" value={editData.data_entrega_arte} onChange={e => setEditData({...editData, data_entrega_arte: e.target.value})} style={styles.input} /></div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Atualizar Imagem (Opcional - Máx 1MB)</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setEditLayoutFile)} style={{ ...styles.input, backgroundColor: 'white' }} />
                    </div>

                    <div style={styles.formGroup}><label style={styles.label}>Link de Referência</label><input type="url" value={editData.url_referencia} onChange={e => setEditData({...editData, url_referencia: e.target.value})} style={styles.input} /></div>
                    <div style={styles.formGroup}><label style={styles.label}>Observações</label><textarea rows="3" value={editData.observacao} onChange={e => setEditData({...editData, observacao: e.target.value})} style={{...styles.input, resize: 'vertical'}}></textarea></div>
                    <button type="submit" style={{ padding: '12px', backgroundColor: THEME.colors.brand.primary, color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' }}>Salvar Alterações</button>
                </form>
            </Modal>

            <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes da Solicitação">
                {selectedOrderDetails && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ borderBottom: `1px solid ${THEME.colors.border}`, paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', color: THEME.colors.text.primary }}>{selectedOrderDetails.client_name}</h3>
                                <span style={{ fontSize: '0.8rem', color: THEME.colors.text.secondary, fontWeight: '600' }}>{selectedOrderDetails.tracking_code}</span>
                            </div>
                            <span style={{ backgroundColor: THEME.colors.brand.light, color: THEME.colors.brand.primary, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>{selectedOrderDetails.status}</span>
                        </div>
                        
                        {selectedOrderDetails.layout_path && (
                            <div style={{ marginBottom: '10px' }}>
                                <strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase', marginBottom: '6px' }}>Imagem em Anexo</strong>
                                <img src={`${API_BASE_URL}/uploads/${selectedOrderDetails.layout_path}`} alt="Arte Anexada" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${THEME.colors.border}`, backgroundColor: '#f1f5f9' }} />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                            <div><strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase' }}>Produto</strong> <span style={{ fontWeight:'600', color:'#0f172a' }}>{selectedOrderDetails.product_type || '-'}</span></div>
                            <div><strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase' }}>Cor Predominante</strong> <span style={{ fontWeight:'600', color:'#0f172a' }}>{selectedOrderDetails.cor || '-'}</span></div>
                            <div><strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase' }}>Tipo de Estampa</strong> <span style={{ fontWeight:'600', color:'#0f172a' }}>{selectedOrderDetails.tipo_estampa || '-'}</span></div>
                            <div><strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase' }}>Prazo da Arte</strong> <span style={{ fontWeight:'600', color:'#dc2626' }}>{formatDateSimple(selectedOrderDetails.data_entrega_arte) || '-'}</span></div>
                        </div>

                        {selectedOrderDetails.url_referencia && (
                            <div>
                                <strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase', marginBottom: '4px' }}>Link de Referência</strong>
                                <a href={selectedOrderDetails.url_referencia} target="_blank" rel="noreferrer" style={{ color: THEME.colors.brand.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', backgroundColor: THEME.colors.brand.light, padding: '8px 12px', borderRadius: '6px' }}><Icons.Link /> Abrir Link</a>
                            </div>
                        )}

                        <div>
                            <strong style={{ display:'block', fontSize:'0.75rem', color:'#64748b', textTransform:'uppercase', marginBottom: '4px' }}>Observações / Instruções</strong>
                            <div style={{ backgroundColor: 'white', border: `1px solid ${THEME.colors.border}`, padding: '12px', borderRadius: '6px', fontSize: '0.9rem', color: '#334155', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                                {selectedOrderDetails.observacao || 'Nenhuma observação informada.'}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const styles = {
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' },
    input: { padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', fontFamily: "'Inter', sans-serif" },
    iconButton: { backgroundColor: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s', borderRadius: '4px' },
    actionBtn: { width: '100%', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'opacity 0.2s' },
    tabsContainer: { display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: `1px solid ${THEME.colors.border}`, paddingBottom: '10px' },
    tabActive: { padding: '8px 0', border: 'none', borderBottom: `2px solid ${THEME.colors.brand.primary}`, backgroundColor: 'transparent', color: THEME.colors.brand.primary, fontWeight: '700', cursor: 'pointer', fontSize:'0.95rem' },
    tabInactive: { padding: '8px 0', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: THEME.colors.text.disabled, fontWeight: '500', cursor: 'pointer', fontSize:'0.95rem' }
};

export default DesignDashboard;