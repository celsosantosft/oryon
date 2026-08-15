import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// Custom Hooks e Serviços
import { usePortalOrder } from '../hooks/usePortalOrder';
import { useOrderItems } from '../hooks/useOrderItems';
import { trackingService } from '../services/trackingService';

// Utilitários
import { Icons } from '../components/Icons'; 
import { styles, injectGlobalStyles } from '../utils/ClientPortalStyles';
import { formatMoney, parseNull, getAsArray, generateId } from '../utils/helpers';
import { showToastSuccess, showToastEdit, confirmSubmitListAlert, confirmBulkSubmitAlert, confirmApproveArtAlert } from '../utils/alerts';

// Componentes / Abas
import { HomeTab } from '../components/tabs/HomeTab';
import { TrackingTab } from '../components/tabs/TrackingTab';
import { FinanceTab } from '../components/tabs/FinanceTab';
import { BulkTab } from '../components/tabs/BulkTab';
import { ListTab } from '../components/tabs/ListTab';

const API_BASE_URL = 'https://atosfardamentos.com.br/api';

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

const ClientPortal = () => {
    const { code } = useParams();
    const [searchParams] = useSearchParams();
    const portalToken = searchParams.get('token') || '';
    const { order, loading, updateOrderStatus } = usePortalOrder(code, portalToken);
    const { items, setItems, removeItem, updateItem, confirmItem, saveEditedItem } = useOrderItems([]);
    
    const [activeTab, setActiveTab] = useState('home');
    const [bulkSizes, setBulkSizes] = useState({});
    const [editingItem, setEditingItem] = useState(null);

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
        saveEditedItem(editingItem);
        setEditingItem(null);
        handleSaveDraft(items.map(item => item.id === editingItem.id ? editingItem : item));
        showToastEdit('Alteração salva!');
    };

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.confirmed || (i.player_name.trim() !== '' && i.size !== ''));
        if (validItems.length === 0) return fireAlert({ title: 'Atenção', text: 'Preencha pelo menos uma camisa.', icon: 'warning', confirmButtonColor: '#2563EB' });
        
        const result = await confirmSubmitListAlert(validItems.length);
        if (result.isConfirmed) {
            try {
                const finalItemsToSubmit = validItems.map(i => ({ ...i, confirmed: true }));
                await trackingService.submitItems(code, portalToken, finalItemsToSubmit);
                fireAlert('Sucesso!', 'Lista enviada.', 'success').then(() => window.location.reload());
            } catch { fireAlert('Erro', 'Erro ao enviar.', 'error'); }
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

        const result = await confirmBulkSubmitAlert(finalItemsToSubmit.length);
        if (result.isConfirmed) {
            try {
                await trackingService.submitItems(code, portalToken, finalItemsToSubmit);
                fireAlert('Sucesso!', 'Grade enviada.', 'success').then(() => window.location.reload());
            } catch { fireAlert('Erro', 'Erro ao enviar.', 'error'); }
        }
    };

    const handleApproveArt = async () => {
        const result = await confirmApproveArtAlert();
        if (result.isConfirmed) {
            try {
                await trackingService.approveArt(code, portalToken);
                fireAlert('Arte Aprovada!', 'Produção ciente.', 'success');
                updateOrderStatus('Arte Aprovada/Liberada');
            } catch { fireAlert('Erro', 'Não foi possível aprovar.', 'error'); }
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
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
                <style>{`@keyframes spin-premium { to { transform: rotate(360deg); } }`}</style>
                <div style={{ width: '36px', height: '36px', border: '3px solid rgba(37, 99, 235, 0.15)', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin-premium 1s linear infinite', marginBottom: '16px' }}></div>
                <div style={{ color: '#0F172A', fontWeight: '800', fontSize: '1.1rem', letterSpacing: '0.02em', marginBottom: '6px' }}>Preparando seu portal...</div>
                <div style={{ color: '#64748B', fontWeight: '500', fontSize: '0.85rem' }}>Buscando as informações do pedido</div>
            </div>
        );
    }

    if (!order) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: '20px', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <div style={{ color: '#EF4444', marginBottom: '16px' }}>
                        <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ margin: '0 auto' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 style={{ color: '#0F172A', fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px' }}>Pedido não encontrado</h2>
                    <p style={{ color: '#64748B', marginBottom: '24px' }}>Verifique se o código <strong>{code}</strong> está correto e tente novamente.</p>
                    <button onClick={() => window.location.href = '/portal'} style={{ padding: '12px 24px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', width: '100%', fontSize: '1rem' }}>Fazer Nova Busca</button>
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
        <div style={styles.container}>
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
                <div style={styles.modalOverlay}>
                    <div className="animate-fade-in" style={styles.modalContent}>
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
                                    <input type="number" value={editingItem.player_number} onChange={(e) => setEditingItem({...editingItem, player_number: e.target.value})} style={{ ...styles.input, width: '100%', textAlign: 'center' }} />
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

            <div style={{ ...styles.header, padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
                <div style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                        src="/logo-120.png" 
                        srcSet="/logo-120.png 120w, /logo-240.png 240w, /logo.png 580w"
                        sizes="56px"
                        alt="ATOS" 
                        width="120"
                        height="120"
                        decoding="async"
                        style={{ width: '56px', height: '56px', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        onError={(e) => { 
                            e.target.onerror = null; 
                            e.target.style.display = 'none'; 
                            e.target.parentNode.innerHTML = '<span style="color:white; font-weight:800; font-size:1.1rem; letter-spacing:1px;">ATOS</span>'; 
                        }}
                    />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

            <div style={styles.tabBody}>
                {activeTab === 'home' && <HomeTab order={order} API_BASE_URL={API_BASE_URL} needsArtApproval={derivedData.needsArtApproval} artIsApproved={derivedData.artIsApproved} onApproveArt={handleApproveArt} />}
                {activeTab === 'tracking' && <TrackingTab order={order} currentStepIndex={derivedData.currentStepIndex} STATUS_STEPS_CONFIG={STATUS_STEPS_CONFIG} />}
                {activeTab === 'finance' && <FinanceTab remainingOrder={derivedData.remainingOrder} percentPaid={derivedData.percentPaid} totalOrder={derivedData.totalOrder} paidOrder={derivedData.paidOrder} formatMoney={formatMoney} />}
                {activeTab === 'bulk' && <BulkTab isQuote={order.tracking_code?.startsWith('#ORC-')} isLocked={derivedData.isLocked} isUsingNominalList={derivedData.isUsingNominalList} hasAdminSizes={derivedData.hasAdminSizes} availableSizes={derivedData.availableSizes} summaryCounts={derivedData.summaryCounts} totalConfirmed={derivedData.totalConfirmed} bulkSizes={bulkSizes} setBulkSizes={setBulkSizes} handleBulkSubmit={handleBulkSubmit} />}
                {activeTab === 'list' && <ListTab isLocked={derivedData.isLocked} items={derivedData.nominalItemsForTab} activeItems={derivedData.activeItems} confirmedItems={derivedData.nominalConfirmedItems} availableSizes={derivedData.availableSizes} summaryCounts={derivedData.summaryCounts} lastAddedItem={derivedData.lastAddedNominalItem} handleRemoveItem={handleRemoveItem} handleItemChange={updateItem} handleConfirmItem={handleConfirmItem} handleSubmit={handleSubmit} handleEditItem={setEditingItem} />}
            </div>
            
            <div style={styles.bottomNav}>
                <div style={{ ...styles.navPill, left: `calc(${navItems.findIndex(i => i.id === activeTab) * 20}% + 1%)`, width: '18%' }} />
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <div key={item.id} onClick={() => !item.disabled && setActiveTab(item.id)} style={{ ...styles.navItem, opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? 'default' : 'pointer' }}>
                            <div style={{ color: isActive ? '#60A5FA' : '#9CA3AF', filter: isActive ? 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.4))' : 'none', transition: 'all 0.4s' }}><item.icon /></div>
                            <span style={{ fontSize: '0.65rem', fontWeight: isActive ? '700' : '500', color: isActive ? '#60A5FA' : '#9CA3AF', marginTop: '4px', transition: 'all 0.4s' }}>{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClientPortal;
