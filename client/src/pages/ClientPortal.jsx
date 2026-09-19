import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// Custom Hooks e Serviços
import { usePortalOrder } from '../hooks/usePortalOrder';
import { useOrderItems } from '../hooks/useOrderItems';
import { trackingService } from '../services/trackingService';
import { appConfig } from '../config/appConfig';

// Utilitários
import { Icons } from '../components/Icons'; 
import { styles, injectGlobalStyles } from '../utils/ClientPortalStyles';
import { formatMoney, parseNull, getAsArray, generateId } from '../utils/helpers';
import { showToastSuccess, showToastEdit, confirmSubmitListAlert, confirmBulkSubmitAlert, confirmApproveArtAlert } from '../utils/alerts';
import { PLAYER_NUMBER_MAX_LENGTH, isValidPlayerNumber, normalizePlayerNumberInput } from '../utils/playerNumber';
import { getPortalErrorContent } from '../utils/portalRequestState';

// Componentes / Abas
import { HomeTab } from '../components/tabs/HomeTab';
import { TrackingTab } from '../components/tabs/TrackingTab';
import { FinanceTab } from '../components/tabs/FinanceTab';
import { BulkTab } from '../components/tabs/BulkTab';
import { ListTab } from '../components/tabs/ListTab';
import '../styles/PortalPreview.css';

const API_BASE_URL = appConfig.apiBaseUrl;

const fireAlert = async (...args) => {
    const Swal = (await import('sweetalert2')).default;
    return Swal.fire(...args);
};

const STATUS_STEPS_CONFIG = [
    { name: 'Criação de Arte', icon: Icons.Palette },
    { name: 'Aguardando Aprovação', icon: Icons.Clock },
    { name: 'Arte Aprovada/Liberada', icon: Icons.ThumbsUp },
    { name: 'Corte Iniciado', icon: Icons.Scissors },
    { name: 'Impressão/Estampa Iniciada', icon: Icons.Printer },
    { name: 'Costura Iniciada', icon: Icons.Layers },
    { name: 'Controle de Qualidade', icon: Icons.ShieldCheck },
    { name: 'Pronto para Envio', icon: Icons.Package },
    { name: 'Entregue/Concluído', icon: Icons.Truck }
];

const formatDeliveryDate = (dateString) => {
    if (!dateString) return 'A definir';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const ClientPortal = ({ preview = false }) => {
    const { code } = useParams();
    const [searchParams] = useSearchParams();
    const portalToken = searchParams.get('token') || '';
    const { order, loading, error, updateOrderStatus } = usePortalOrder(code, portalToken, { showAlert: !preview });
    const { items, setItems, removeItem, updateItem, confirmItem, saveEditedItem } = useOrderItems([]);
    
    const [activeTab, setActiveTab] = useState('home');
    const [bulkSizes, setBulkSizes] = useState({});
    const [editingItem, setEditingItem] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const pendingActionRef = useRef(null);

    const beginAction = (action) => {
        if (pendingActionRef.current) return false;
        pendingActionRef.current = action;
        setPendingAction(action);
        return true;
    };

    const endAction = () => {
        pendingActionRef.current = null;
        setPendingAction(null);
    };

    useEffect(() => {
        injectGlobalStyles();
        if (order) {
            let adminSizes = {};
            if (order.sizes) {
                try { adminSizes = typeof order.sizes === 'string' ? JSON.parse(order.sizes) : order.sizes; } 
                catch (e) { console.error('Erro ao ler tamanhos do painel:', e); }
            }
            
            // ⭐ A CORREÇÃO DA ABERTURA ESTÁ AQUI ⭐
            // Agora ele usa apenas a informação oficial do banco de dados para abrir ou fechar os campos
            const isLockedDb = order.is_locked_by_client === 1 || order.is_locked_by_client === true;

            if (order.items && order.items.length > 0) {
                const loadedItems = order.items.map(i => ({ 
                    ...i, 
                    player_name: parseNull(i.player_name), 
                    player_number: parseNull(i.player_number), 
                    confirmed: true 
                }));
                
                // Se estiver destrancado no Admin, forçamos a criação do campo vazio!
                if (!isLockedDb) {
                    loadedItems.push({ id: generateId(), player_name: '', player_number: '', size: '', confirmed: false });
                }
                setItems(loadedItems);

                const counts = {};
                loadedItems.forEach(item => { if (item.size && item.confirmed) counts[item.size] = (counts[item.size] || 0) + 1; });
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setBulkSizes(Object.keys(counts).length > 0 ? counts : adminSizes);
            } else {
                if (!isLockedDb) {
                    setItems([{ id: generateId(), player_name: '', player_number: '', size: '', confirmed: false }]);
                } else {
                    setItems([]);
                }
                setBulkSizes(adminSizes);
            }
        }
    }, [order, setItems]);

    const handleSaveDraft = async (itemsToSave) => {
        try { await trackingService.saveDraft(code, portalToken, itemsToSave.filter(i => i.confirmed)); } 
        catch (err) { console.error('Erro ao salvar rascunho', err); }
    };

    const handleConfirmItem = (id) => {
        confirmItem(id);
        const newItems = items.map(item => item.id === id ? { ...item, confirmed: true } : item);
        handleSaveDraft(newItems);
        showToastSuccess('Adicionado com sucesso!');
    };

    const handleRemoveItem = (id) => {
        removeItem(id);
        handleSaveDraft(items.filter(item => item.id !== id));
    };

    const saveEdit = async () => {
        if (!editingItem.size) return fireAlert('Atenção', 'Selecione o tamanho.', 'warning');
        if (!isValidPlayerNumber(editingItem.player_number)) return fireAlert('Atenção', 'Use apenas números ou √ seguido de números.', 'warning');
        saveEditedItem(editingItem);
        setEditingItem(null);
        handleSaveDraft(items.map(item => item.id === editingItem.id ? editingItem : item));
        showToastEdit('Alteração salva!');
    };

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.confirmed || (i.player_name.trim() !== '' && i.size !== ''));
        if (validItems.length === 0) return fireAlert({ title: 'Atenção', text: 'Preencha pelo menos uma camisa.', icon: 'warning', confirmButtonColor: '#2563EB' });

        if (!beginAction('submit-list')) return;
        try {
            const result = await confirmSubmitListAlert(validItems.length);
            if (result.isConfirmed) {
                const finalItemsToSubmit = validItems.map(i => ({ ...i, confirmed: true }));
                await trackingService.submitItems(code, portalToken, finalItemsToSubmit);
                fireAlert('Sucesso!', 'Lista enviada.', 'success').then(() => window.location.reload());
            }
        } catch {
            fireAlert('Erro', 'Erro ao enviar.', 'error');
        } finally {
            endAction();
        }
    };

    const handleBulkSubmit = async () => {
        const hasQty = Object.values(bulkSizes).some(qty => parseInt(qty) > 0);
        if (!hasQty) return fireAlert({ title: 'Atenção', text: 'Preencha a quantidade.', icon: 'warning', confirmButtonColor: '#2563EB' });

        const finalItemsToSubmit = [];
        for (const [size, qty] of Object.entries(bulkSizes)) {
            for (let i = 0; i < parseInt(qty); i++) {
                finalItemsToSubmit.push({ id: generateId(), player_name: '', player_number: '', size: size, confirmed: true });
            }
        }

        if (!beginAction('submit-bulk')) return;
        try {
            const result = await confirmBulkSubmitAlert(finalItemsToSubmit.length);
            if (result.isConfirmed) {
                await trackingService.submitItems(code, portalToken, finalItemsToSubmit);
                fireAlert('Sucesso!', 'Grade enviada.', 'success').then(() => window.location.reload());
            }
        } catch {
            fireAlert('Erro', 'Erro ao enviar.', 'error');
        } finally {
            endAction();
        }
    };

    const handleApproveArt = async () => {
        if (!beginAction('approve-art')) return;
        try {
            const result = await confirmApproveArtAlert();
            if (result.isConfirmed) {
                await trackingService.approveArt(code, portalToken);
                fireAlert('Arte Aprovada!', 'Produção ciente.', 'success');
                updateOrderStatus('Arte Aprovada/Liberada');
            }
        } catch {
            fireAlert('Erro', 'Não foi possível aprovar.', 'error');
        } finally {
            endAction();
        }
    };

    const derivedData = useMemo(() => {
        if (!order) return null;
        
        let adminSizes = {};
        if (order.sizes) {
            try { adminSizes = typeof order.sizes === 'string' ? JSON.parse(order.sizes) : order.sizes; } 
            catch { adminSizes = {}; }
        }
        const totalAdminPieces = Object.values(adminSizes).reduce((acc, val) => acc + (Number(val) || 0), 0);
        const hasAdminSizes = totalAdminPieces > 0;

        // ⭐ A CORREÇÃO DO BLOQUEIO GERAL ESTÁ AQUI ⭐
        // Não usamos mais o hasAdminSizes para trancar a tela de forma autônoma
        const isLocked = order.is_locked_by_client === 1 || order.is_locked_by_client === true;

        let availableSizes = getAsArray(order.allowed_sizes, [
            "PP", "P", "M", "G", "GG", "XG", "XXG",
            "2 ANOS", "4 ANOS", "6 ANOS", "8 ANOS", "10 ANOS", "12 ANOS", "14 ANOS"
        ]);

        if (hasAdminSizes) {
            Object.keys(adminSizes).forEach(k => {
                if (!availableSizes.includes(k)) availableSizes.push(k);
            });
        }

        const hasNamesOrNumbers = items.some(item => (item.player_name && item.player_name !== '') || (item.player_number && item.player_number !== ''));
        
        // Mantém a aba Nomes desativada APENAS se for um pedido de Grade Fechada pura (sem nomes e trancada)
        const isBulkOnly = (hasAdminSizes || isLocked) && !hasNamesOrNumbers;
        
        const confirmedItemsAll = items.filter(i => isLocked ? true : i.confirmed);
        let summaryCounts = confirmedItemsAll.reduce((acc, item) => { if (item.size) acc[item.size] = (acc[item.size] || 0) + 1; return acc; }, {});

        if (Object.keys(summaryCounts).length === 0 && hasAdminSizes) {
            summaryCounts = adminSizes;
        }

        const totalConfirmed = Object.values(summaryCounts).reduce((a, b) => a + b, 0);

        const nominalConfirmedItems = confirmedItemsAll
            .filter(i => (i.player_name && i.player_name !== '') || (i.player_number && i.player_number !== ''))
            .sort((a, b) => availableSizes.indexOf(a.size) - availableSizes.indexOf(b.size));

        const activeItems = isLocked ? [] : items.filter(i => !i.confirmed);
        const nominalItemsForTab = [...nominalConfirmedItems, ...activeItems];
        
        const lastAddedNominalItem = items.slice().reverse().find(i => i.confirmed && ((i.player_name && i.player_name !== '') || (i.player_number && i.player_number !== '')));

        let currentStepIndex = STATUS_STEPS_CONFIG.findIndex(s => s.name === order.status);
        if (currentStepIndex === -1 && order.status !== 'Cancelado') currentStepIndex = 0; 
        
        const totalOrder = parseFloat(order.total_price) || 0;
        const paidOrder = parseFloat(order.amount_paid) || 0;

        return {
            isLocked, isBulkOnly, isUsingNominalList: hasNamesOrNumbers, hasAdminSizes, availableSizes, 
            summaryCounts, totalConfirmed, nominalConfirmedItems, nominalItemsForTab, activeItems, 
            lastAddedNominalItem, currentStepIndex,
            needsArtApproval: order.layout_path && currentStepIndex < 2 && order.status !== 'Cancelado',
            artIsApproved: currentStepIndex >= 2,
            remainingOrder: Math.max(0, totalOrder - paidOrder),
            percentPaid: totalOrder > 0 ? (paidOrder / totalOrder) * 100 : 0,
            totalOrder, paidOrder
        };
    }, [order, items]);

    if (loading) {
        return (
            <div className={preview ? 'portal-preview portal-state-screen' : undefined} style={{ height: preview ? '100dvh' : '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
                <style>{`@keyframes spin-premium { to { transform: rotate(360deg); } }`}</style>
                <div style={{ width: '36px', height: '36px', border: '3px solid rgba(37, 99, 235, 0.15)', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin-premium 1s linear infinite', marginBottom: '16px' }}></div>
                <div style={{ color: '#0F172A', fontWeight: '800', fontSize: '1.1rem', letterSpacing: '0.02em', marginBottom: '6px' }}>Preparando seu portal...</div>
                <div style={{ color: '#64748B', fontWeight: '500', fontSize: '0.85rem' }}>Buscando as informações do pedido</div>
            </div>
        );
    }

    if (!order) {
        const errorContent = getPortalErrorContent(error);
        return (
            <div className={preview ? 'portal-preview portal-state-screen' : undefined} style={{ height: preview ? '100dvh' : '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: '20px', boxSizing: 'border-box' }}>
                <div className={preview ? 'portal-state-card' : undefined} style={{ backgroundColor: '#fff', padding: '40px', borderRadius: preview ? '8px' : '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <div style={{ color: '#EF4444', marginBottom: '16px' }}>
                        <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ margin: '0 auto' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 style={{ color: '#0F172A', fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>{errorContent.title}</h2>
                    <p style={{ color: '#64748B', marginBottom: '24px' }}>{errorContent.message}</p>
                    <button onClick={() => window.location.href = preview ? '/portal-preview' : '/portal'} style={{ padding: '12px 24px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', width: '100%', fontSize: '1rem' }}>Fazer Nova Busca</button>
                </div>
            </div>
        );
    }

    const navItems = [
        { id: 'home', label: 'Inicio', icon: Icons.Home },
        { id: 'tracking', label: 'Rastreio', icon: Icons.MapPin },
        { id: 'finance', label: 'Financeiro', icon: Icons.Dollar },
        { id: 'bulk', label: 'Grade', icon: Icons.Box },
        { id: 'list', label: 'Nomes', icon: Icons.List, disabled: derivedData.isBulkOnly }
    ];

    return (
        <div className={preview ? 'portal-preview portal-shell' : undefined} style={styles.container}>
            <style>{`
                select {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563EB' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                    background-repeat: no-repeat !important;
                    background-position: right 14px center !important;
                    background-size: 16px !important;
                    padding: 12px 44px 12px 16px !important;
                    border: 2px solid #E2E8F0 !important;
                    border-radius: 12px !important;
                    background-color: #F8FAFC !important;
                    color: #0F172A !important;
                    font-size: 0.95rem !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                }
                select:focus {
                    border-color: #3B82F6 !important;
                    background-color: #FFFFFF !important;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
                    outline: none !important;
                }
                select:hover { border-color: #CBD5E1 !important; }
                select option { font-weight: 600; color: #0F172A; padding: 10px; }
            `}</style>

            {editingItem && (
                <div className={preview ? 'portal-modal-overlay' : undefined} style={styles.modalOverlay}>
                    <div className={`animate-fade-in${preview ? ' portal-modal-content' : ''}`} style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: '800' }}>Editar Camisa</h3>
                            <button onClick={() => setEditingItem(null)} style={styles.modalCloseBtn}><Icons.Close /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={styles.label}>Nome</label>
                                <input type="text" value={editingItem.player_name} onChange={(e) => setEditingItem({...editingItem, player_name: e.target.value.toUpperCase().replace(/,/g, '')})} style={{ ...styles.input, width: '100%' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>Número</label>
                                    <input type="text" inputMode="text" maxLength={PLAYER_NUMBER_MAX_LENGTH} autoComplete="off" placeholder="10 ou √9" value={editingItem.player_number} onChange={(e) => setEditingItem({...editingItem, player_number: normalizePlayerNumberInput(e.target.value)})} style={{ ...styles.input, width: '100%', textAlign: 'center' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={styles.label}>Tamanho</label>
                                    <select value={editingItem.size} onChange={(e) => setEditingItem({...editingItem, size: e.target.value})} style={{ width: '100%' }}>
                                        <option value="">...</option>{derivedData.availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={saveEdit} className="btn-primary" style={{ marginTop: '8px' }}><Icons.Check /> Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className={preview ? 'portal-header' : undefined} style={{ ...styles.header, padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
                <div style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                        src={appConfig.theme === 'monochrome' ? appConfig.logoWhiteUrl : appConfig.logoSmallUrl}
                        srcSet={appConfig.theme === 'monochrome' ? undefined : `${appConfig.logoSmallUrl} 120w, ${appConfig.logoMediumUrl} 240w, ${appConfig.logoUrl} 580w`}
                        sizes={appConfig.theme === 'monochrome' ? undefined : "56px"}
                        alt={appConfig.brandName}
                        width="120"
                        height="120"
                        decoding="async"
                        style={{ width: '56px', height: '56px', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        onError={(e) => { 
                            e.target.onerror = null; 
                            e.target.style.display = 'none'; 
                            e.target.parentNode.innerHTML = `<span style="color:white; font-weight:800; font-size:1.1rem; letter-spacing:1px;">${appConfig.orderPrefix}</span>`;
                        }}
                    />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {preview && (
                        <span className="portal-preview-badge portal-preview-badge-header">Ambiente de teste</span>
                    )}
                    <h1 style={{ ...styles.title, fontSize: '1.15rem', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'break-word', margin: 0 }}>
                        Olá, {order.client_name}!
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <p style={{ ...styles.subtitle, margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
                            Pedido <strong>{order.tracking_code}</strong>
                        </p>
                        <div style={{ width: '4px', height: '4px', backgroundColor: '#94A3B8', borderRadius: '50%', opacity: 0.6 }}></div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6EE7B7', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'flex' }}><Icons.Clock /></span> 
                            Entrega: {formatDeliveryDate(order.delivery_date)}
                        </p>
                    </div>
                </div>
            </div>

            <div className={preview ? 'portal-tab-body' : undefined} style={styles.tabBody}>
                {activeTab === 'home' && <HomeTab preview={preview} order={order} API_BASE_URL={API_BASE_URL} needsArtApproval={derivedData.needsArtApproval} artIsApproved={derivedData.artIsApproved} onApproveArt={handleApproveArt} pendingAction={pendingAction} />}
                {activeTab === 'tracking' && <TrackingTab preview={preview} order={order} currentStepIndex={derivedData.currentStepIndex} STATUS_STEPS_CONFIG={STATUS_STEPS_CONFIG} />}
                {activeTab === 'finance' && <FinanceTab preview={preview} remainingOrder={derivedData.remainingOrder} percentPaid={derivedData.percentPaid} totalOrder={derivedData.totalOrder} paidOrder={derivedData.paidOrder} formatMoney={formatMoney} />}
                {activeTab === 'bulk' && <BulkTab preview={preview} isQuote={order.tracking_code?.startsWith('#ORC-')} isLocked={derivedData.isLocked} isUsingNominalList={derivedData.isUsingNominalList} hasAdminSizes={derivedData.hasAdminSizes} availableSizes={derivedData.availableSizes} summaryCounts={derivedData.summaryCounts} totalConfirmed={derivedData.totalConfirmed} bulkSizes={bulkSizes} setBulkSizes={setBulkSizes} handleBulkSubmit={handleBulkSubmit} pendingAction={pendingAction} />}
                {activeTab === 'list' && <ListTab preview={preview} isLocked={derivedData.isLocked} items={derivedData.nominalItemsForTab} activeItems={derivedData.activeItems} confirmedItems={derivedData.nominalConfirmedItems} availableSizes={derivedData.availableSizes} lastAddedItem={derivedData.lastAddedNominalItem} handleRemoveItem={handleRemoveItem} handleItemChange={updateItem} handleConfirmItem={handleConfirmItem} handleSubmit={handleSubmit} handleEditItem={setEditingItem} pendingAction={pendingAction} />}
            </div>
            
            <div className={preview ? 'portal-bottom-nav' : undefined} style={styles.bottomNav}>
                {!preview && <div style={{ ...styles.navPill, left: `calc(${navItems.findIndex(i => i.id === activeTab) * 20}% + 1%)`, width: '18%' }} />}
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const activeColor = appConfig.theme === 'monochrome' ? '#FFFFFF' : '#60A5FA';
                    const navContent = (
                        <>
                            <div className={preview ? 'portal-nav-icon' : undefined} style={{ color: isActive ? activeColor : '#9CA3AF', filter: isActive ? `drop-shadow(0 0 6px ${appConfig.theme === 'monochrome' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(96, 165, 250, 0.4)'})` : 'none', transition: preview ? 'color 160ms ease' : 'all 0.4s' }}><item.icon /></div>
                            <span className={preview ? 'portal-nav-label' : undefined} style={{ fontSize: '0.65rem', fontWeight: isActive ? '700' : '500', color: isActive ? activeColor : '#9CA3AF', marginTop: '4px', transition: preview ? 'color 160ms ease' : 'all 0.4s' }}>{item.label}</span>
                        </>
                    );

                    if (preview) {
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className="portal-nav-item"
                                onClick={() => setActiveTab(item.id)}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={item.label}
                                disabled={item.disabled}
                            >
                                {navContent}
                            </button>
                        );
                    }

                    return (
                        <div key={item.id} onClick={() => !item.disabled && setActiveTab(item.id)} style={{ ...styles.navItem, opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? 'default' : 'pointer' }}>
                            {navContent}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClientPortal;
