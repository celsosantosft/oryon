import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2'; 
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { printOrder } from '../utils/printUtils';

// ============================================================================
// --- ÍCONES ---
// ============================================================================
const Icons = {
    Plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    Edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    Eye: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    Close: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    Check: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
    Search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
    Image: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
    Printer: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
    Filter: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    User: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Download: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Return: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h11a4 4 0 010 8H7m-4-8l4-4m-4 4l4 4" /></svg>,
    Unlock: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v2M5 11h14v10H5z" /></svg>
};

// ============================================================================
// --- CONSTANTES E UTILS ---
// ============================================================================
export const ORDER_CONSTANTS = {
    DEFAULT_SIZES: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '14': 0, 'PP': 0, 'P': 0, 'M': 0, 'G': 0, 'GG': 0, 'XG': 0, 'XXG': 0, 'XXXG': 0, 'ESP': 0 },
    STATUS_OPTIONS: ['Criação de Arte', 'Arte Aprovada/Liberada', 'Corte Iniciado', 'Impressão/Estampa Iniciada', 'Costura Iniciada', 'Controle de Qualidade', 'Pronto para Envio', 'Entregue/Concluído', 'Cancelado']
};
export const PRINTING_TYPE_PRESETS = ['100% Sublimada', 'Com Friso', 'Bordado', 'DTF', 'Numerado', 'Silk Screen', 'Transfer', 'Estampa Localizada', 'Recorte', 'Viés'];

export const parseDateSafe = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    return new Date(dateString); 
};

export const formatDateSafe = (dateString) => {
    const date = parseDateSafe(dateString);
    if (!date) return '';
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

export const formatDateTime = (dateString) => dateString ? new Date(dateString).toLocaleString('pt-BR') : '';

export const normalizeMoneyValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return 0;

        const normalized = trimmed.includes(',')
            ? trimmed.replace(/\./g, '').replace(',', '.')
            : trimmed;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');

export const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
}).format(normalizeMoneyValue(value));

export const getOrderAmountPaid = (order) => Math.max(
    normalizeMoneyValue(order?.amount_paid),
    normalizeMoneyValue(order?.synced_amount_paid)
);

export const calculateTotals = (currentSizes, uPrice, uCost) => {
    const totalQty = Object.values(currentSizes).reduce((acc, val) => acc + (Number(val) || 0), 0);
    return { total: totalQty * uPrice, cost: totalQty * uCost, totalQty };
};

export const normalizePrintingTypes = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item || '').trim()).filter(Boolean);
            }
        } catch (error) {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }

    return [];
};

export const buildProductionLabel = (line, dbProducts = [], dbFabrics = []) => {
    const savedLabel = String(line.production_label || '').trim();
    const effectiveProduct = getEffectiveLineProduct(line);
    const selectedProduct = dbProducts.find((product) => product.name === effectiveProduct);
    const fabricName = getEffectiveLineFabric(line) || (selectedProduct ? (dbFabrics.find((fabric) => fabric.id === selectedProduct.tecido_principal_id)?.name || '') : '');
    const baseParts = [];

    if (selectedProduct?.name || effectiveProduct) {
        baseParts.push(selectedProduct?.name || effectiveProduct);
    }

    if (selectedProduct?.type_gola) {
        const lowerProductName = String(baseParts[0] || '').toLowerCase();
        const lowerCollar = String(selectedProduct.type_gola || '').toLowerCase();
        if (lowerCollar && !lowerProductName.includes(lowerCollar)) {
            baseParts.push(selectedProduct.type_gola);
        }
    }

    if (fabricName) {
        const lowerProductName = String(baseParts.join(' ')).toLowerCase();
        const lowerFabric = fabricName.toLowerCase();
        if (!lowerProductName.includes(lowerFabric)) {
            baseParts.push(fabricName);
        }
    }

    const printingTypes = normalizePrintingTypes(line.printing_types_json || selectedProduct?.printing_types_json);
    const baseLabel = baseParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!baseLabel) return savedLabel;

    return printingTypes.length ? `${baseLabel} - ${printingTypes.join(', ')}` : baseLabel;
};

export const getProductDetails = (productName, dbProducts, dbFabrics) => {
    const selectedProd = dbProducts.find(p => p.name === productName);
    if (!selectedProd) return null;
    const fabric = dbFabrics.find(f => f.id === selectedProd.tecido_principal_id);
    const fabricName = fabric?.name || '';
    return {
        fabric_type: fabricName,
        unit_price: parseFloat(selectedProd.sale_price) || 0,
        unit_cost: parseFloat(selectedProd.production_cost) || 0,
        printing_types_json: normalizePrintingTypes(selectedProd.printing_types_json),
        production_label: buildProductionLabel({ product_type: selectedProd.name, fabric_type: fabricName }, dbProducts, dbFabrics)
    };
};

export const createDefaultSizes = () => ({ ...ORDER_CONSTANTS.DEFAULT_SIZES });

export const createProductLineDraft = () => ({
    line_key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_type: '',
    custom_product_type: '',
    production_label: '',
    printing_types_json: [],
    production_notes: '',
    fabric_type: '',
    custom_fabric_type: '',
    unit_price: '',
    unit_cost: '',
    sizes_json: createDefaultSizes(),
    layout_path: null,
    layout_file: null
});

export const getEffectiveLineProduct = (line) => (
    line.product_type === 'Outro' ? (line.custom_product_type || '').trim() : (line.product_type || '').trim()
);

export const getEffectiveLineFabric = (line) => (
    line.fabric_type === 'Outro' ? (line.custom_fabric_type || '').trim() : (line.fabric_type || '').trim()
);

export const normalizeLineForForm = (line, dbProducts, dbFabrics) => {
    const knownProducts = new Set((dbProducts || []).map((product) => product.name));
    const knownFabrics = new Set((dbFabrics || []).map((fabric) => fabric.name));
    const productType = line.product_type || '';
    const fabricType = line.fabric_type || '';

    return {
        line_key: line.line_key || `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        product_type: productType && !knownProducts.has(productType) ? 'Outro' : productType,
        custom_product_type: productType && !knownProducts.has(productType) ? productType : '',
        production_label: line.production_label || '',
        printing_types_json: normalizePrintingTypes(line.printing_types_json),
        production_notes: line.production_notes || '',
        fabric_type: fabricType && !knownFabrics.has(fabricType) ? 'Outro' : fabricType,
        custom_fabric_type: fabricType && !knownFabrics.has(fabricType) ? fabricType : '',
        unit_price: line.unit_price ?? '',
        unit_cost: line.unit_cost ?? '',
        sizes_json: { ...createDefaultSizes(), ...(line.sizes_json || {}) },
        layout_path: line.layout_path || null,
        layout_file: null
    };
};

export const serializeLineForApi = (line, dbProducts = [], dbFabrics = []) => {
    const product_type = getEffectiveLineProduct(line);
    const fabric_type = getEffectiveLineFabric(line);
    const unit_price = parseFloat(line.unit_price) || 0;
    const unit_cost = parseFloat(line.unit_cost) || 0;
    const totals = calculateTotals(line.sizes_json, unit_price, unit_cost);

    return {
        line_key: line.line_key,
        product_type,
        production_label: buildProductionLabel({ ...line, product_type, fabric_type }, dbProducts, dbFabrics),
        printing_types_json: normalizePrintingTypes(line.printing_types_json),
        production_notes: String(line.production_notes || '').trim(),
        fabric_type,
        unit_price,
        unit_cost,
        sizes_json: line.sizes_json,
        total_price: totals.total,
        cost_price: totals.cost,
        existing_layout_path: line.layout_path || null
    };
};

export const isStatusActive = (btn, curr) => { 
    if(!curr) return false; 
    if(curr==='Cancelado') return btn==='Cancelado'; 
    if(btn==='Cancelado') return false; 
    return ORDER_CONSTANTS.STATUS_OPTIONS.indexOf(btn) <= ORDER_CONSTANTS.STATUS_OPTIONS.indexOf(curr); 
};

export const getStatusStyle = (s) => { 
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

const canRevertOrderToQuote = (order) => {
    const blockedStatuses = ['Corte Iniciado', 'Impressão/Estampa Iniciada', 'Costura Iniciada', 'Controle de Qualidade', 'Pronto para Envio', 'Entregue/Concluído', 'Cancelado', 'Arte Arquivada'];
    return Boolean(order?.id) && !blockedStatuses.includes(order?.status);
};

// ============================================================================
// --- SERVICES ---
// ============================================================================
export const OrderService = {
    getHeaders: (token, isMultipart = false) => ({ 
        headers: { 
            Authorization: `Bearer ${token}`, 
            ...(isMultipart && { 'Content-Type': 'multipart/form-data' }) 
        } 
    }),
    fetchOrders: (api, token) => axios.get(`${api}/api/orders`, OrderService.getHeaders(token)),
    fetchProducts: (api, token) => axios.get(`${api}/api/products`, OrderService.getHeaders(token)),
    fetchFabrics: (api, token) => axios.get(`${api}/api/fabrics`, OrderService.getHeaders(token)),
    fetchClients: (api, token) => axios.get(`${api}/api/clients`, OrderService.getHeaders(token)),
    createClient: (api, token, name) => axios.post(`${api}/api/clients`, { name }, OrderService.getHeaders(token)),
    createOrder: (api, token, formData) => axios.post(`${api}/api/orders`, formData, OrderService.getHeaders(token, true)),
    updateOrder: (api, token, id, formData) => axios.put(`${api}/api/orders/${id}`, formData, OrderService.getHeaders(token, true)),
    updateStatus: (api, token, trackingCode, status) => axios.post(`${api}/api/orders/${encodeURIComponent(trackingCode)}/status`, { new_status: status }, OrderService.getHeaders(token)),
    deleteOrder: (api, token, id) => axios.delete(`${api}/api/orders/${id}`, OrderService.getHeaders(token)),
    resetOrder: (api, token, trackingCode) => axios.post(`${api}/api/orders/${encodeURIComponent(trackingCode)}/reset`, {}, OrderService.getHeaders(token)),
    getOrderHistory: (api, token, trackingCode) => axios.get(`${api}/api/orders/${encodeURIComponent(trackingCode)}/history`, OrderService.getHeaders(token)),
    exportTxt: (api, token, id) => axios.get(`${api}/api/orders/${id}/export-txt`, { ...OrderService.getHeaders(token), responseType: 'blob' }),
    unlockOrder: (api, token, id) => axios.post(`${api}/api/orders/${id}/unlock`, {}, OrderService.getHeaders(token)),
    revertToQuote: (api, token, id) => axios.post(`${api}/orders/${id}/reverter-para-orcamento`, {}, OrderService.getHeaders(token))
};

// ============================================================================
// --- HOOKS ---
// ============================================================================
const useOrders = (API_BASE_URL, token) => {
    const [state, setState] = useState({ orders: [], dbProducts: [], dbFabrics: [], dbClients: [], loading: true, error: null });

    const normalizeOrders = useCallback((orders = []) => (
        orders.map((order) => ({
            ...order,
            total_price: normalizeMoneyValue(order.total_price),
            cost_price: normalizeMoneyValue(order.cost_price),
            synced_amount_paid: normalizeMoneyValue(order.synced_amount_paid),
            amount_paid: getOrderAmountPaid(order)
        }))
    ), []);

    const fetchAllData = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const [ordersRes, prodRes, fabRes, cliRes] = await Promise.all([
                OrderService.fetchOrders(API_BASE_URL, token),
                OrderService.fetchProducts(API_BASE_URL, token),
                OrderService.fetchFabrics(API_BASE_URL, token),
                OrderService.fetchClients(API_BASE_URL, token)
            ]);
            setState({
                orders: normalizeOrders(ordersRes.data.orders || []),
                dbProducts: prodRes.data.products || [],
                dbFabrics: fabRes.data.fabrics || [],
                dbClients: cliRes.data.clients || [],
                loading: false, error: null
            });
        } catch (err) {
            setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar dados. Verifique sua conexão.' }));
        }
    }, [API_BASE_URL, token, normalizeOrders]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const refreshOrders = useCallback(async () => {
        try {
            const res = await OrderService.fetchOrders(API_BASE_URL, token);
            setState(prev => ({ ...prev, orders: normalizeOrders(res.data.orders || []) }));
        } catch (e) { console.error(e); }
    }, [API_BASE_URL, token, normalizeOrders]);

    const quickAddClient = useCallback(async (name) => {
        const res = await OrderService.createClient(API_BASE_URL, token, name);
        const newClient = { id: res.data.id, name };
        setState(prev => ({ ...prev, dbClients: [...prev.dbClients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
        return newClient;
    }, [API_BASE_URL, token]);

    const removeOrders = useCallback(async (ids) => {
        await Promise.all(ids.map(id => OrderService.deleteOrder(API_BASE_URL, token, id)));
        await refreshOrders();
    }, [API_BASE_URL, token, refreshOrders]);

    return { ...state, refreshOrders, quickAddClient, removeOrders };
};

// ============================================================================
// --- COMPONENTES AUXILIARES DE UI ---
// ============================================================================
const ClientAutocomplete = ({ value, onChange, onSelectClient, onAddNew, clients }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const safeClients = useMemo(() => Array.isArray(clients) ? clients : [], [clients]);

    useEffect(() => {
        const handleClickOutside = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = useCallback((e) => {
        const userInput = e.target.value;
        onChange(userInput);
        setIsSuccess(false);
        if (userInput.length > 0) {
            setSuggestions(safeClients.filter(c => c.name.toLowerCase().includes(userInput.toLowerCase())));
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [onChange, safeClients]);

    const triggerSuccessEffect = useCallback(() => { setIsSuccess(true); setTimeout(() => setIsSuccess(false), 2000); }, []);
    const handleSelect = useCallback((client) => {
        onChange(client.name);
        onSelectClient?.(client);
        setShowSuggestions(false);
        triggerSuccessEffect();
    }, [onChange, onSelectClient, triggerSuccessEffect]);
    const handleCreate = useCallback(() => { if (value?.trim()) { onAddNew(value); setShowSuggestions(false); triggerSuccessEffect(); } }, [value, onAddNew, triggerSuccessEffect]);
    const exactMatch = useMemo(() => safeClients.some(c => c.name.toLowerCase() === (value || '').toLowerCase()), [safeClients, value]);
    const handleSearchClick = useCallback(() => {
        inputRef.current?.focus();
        const searchTerm = (value || '').trim().toLowerCase();
        setSuggestions(searchTerm ? safeClients.filter(c => c.name.toLowerCase().includes(searchTerm)) : safeClients);
        setShowSuggestions(true);
    }, [safeClients, value]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div className="flex flex-col gap-1 w-full">
                <label htmlFor="client_name" className="text-sm font-semibold text-slate-700">Cliente</label>
                <div className="flex w-full rounded-md shadow-sm">
                    <input ref={inputRef} id="client_name" type="text" className="flex-1 border border-slate-300 border-r-0 rounded-l-md p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={value || ''} onChange={handleChange} onFocus={() => value && setShowSuggestions(true)} placeholder="Digite o nome do cliente..." autoComplete="off" required />
                    <button type="button" className="shrink-0 px-3 border border-slate-300 rounded-r-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors" onClick={handleSearchClick} aria-label="Buscar cliente" title="Buscar cliente">
                    <span style={{ color: isSuccess ? '#10B981' : '#94A3B8' }}>{isSuccess ? Icons.Check : Icons.Search}</span>
                    </button>
                </div>
            </div>
            {showSuggestions && (
                <ul style={styles.autocompleteList} role="listbox">
                    {suggestions.map((s) => (
                        <li key={s.id} onClick={() => handleSelect(s)} style={styles.autocompleteItem} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} role="option" aria-selected="false">
                            <span style={{ color: '#94a3b8', marginRight: '8px' }}>{Icons.User}</span>{s.name}
                            {s.phone && <span style={{ marginLeft: '8px', color: '#64748B', fontSize: '0.78rem' }}>{s.phone}</span>}
                        </li>
                    ))}
                    {!exactMatch && value?.trim() && (
                        <li onClick={handleCreate} style={{ ...styles.autocompleteItem, color: '#2563EB', fontWeight: '600', backgroundColor: '#EFF6FF', borderTop: '1px solid #DBEAFE' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DBEAFE'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'} role="option" aria-selected="false">
                            <span style={{ marginRight: '8px' }}>{Icons.Plus}</span>Cadastrar novo: "{value}"
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

const OrderSizeInputs = React.memo(({ sizes, onChange }) => {
    const { totalQty } = calculateTotals(sizes, 0, 0);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Infantil (Anos)</span>
                <div style={styles.sizeGrid}>
                    {['2', '4', '6', '8', '10', '12', '14'].map(s => (
                        <div key={s} style={styles.sizeCell}>
                            <label htmlFor={`size-${s}`} style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{s}</label>
                            <input id={`size-${s}`} type="number" className="premium-input no-spin" name={s} value={sizes[s] > 0 ? sizes[s] : ''} onChange={onChange} style={{ ...styles.input, width: '100%', textAlign: 'center', padding: '10px', fontSize: '1rem', fontWeight: '600' }} min="0" />
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Adulto</span>
                <div style={styles.sizeGrid}>
                    {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'].map(s => (
                        <div key={s} style={styles.sizeCell}>
                            <label htmlFor={`size-${s}`} style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{s}</label>
                            <input id={`size-${s}`} type="number" className="premium-input no-spin" name={s} value={sizes[s] > 0 ? sizes[s] : ''} onChange={onChange} style={{ ...styles.input, width: '100%', textAlign: 'center', padding: '10px', fontSize: '1rem', fontWeight: '600' }} min="0" />
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '8px', textAlign: 'right' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#475569' }}>Total de Peças: <span style={{ color: '#2563EB', fontSize: '1.2rem', fontWeight: '800', marginLeft: '6px' }}>{totalQty}</span></span>
            </div>
        </div>
    );
});

const FinancialSummary = ({ subtotal, totalCost, discount, onDiscountChange, amountPaid, onAmountPaidChange }) => {
    const safeDiscount = parseFloat(discount) || 0;
    const finalTotal = Math.max(0, subtotal - safeDiscount);
    const safePaid = parseFloat(amountPaid) || 0;
    const remaining = Math.max(0, finalTotal - safePaid);

    let percentDisplay = '';
    if (subtotal > 0 && safeDiscount > 0) {
        const p = (safeDiscount / subtotal) * 100;
        percentDisplay = Number.isInteger(p) ? p.toString() : p.toFixed(1);
    }

    return (
        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '380px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>Subtotal</span>
                    <span style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: '500' }}>Soma de todos os produtos</span>
                </div>
                <span style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '800' }}>R$ {subtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>Custo estimado</span>
                </div>
                <span style={{ fontSize: '1rem', color: '#475569', fontWeight: '700' }}>R$ {totalCost.toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>Desconto</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '8px 12px', width: '110px', boxSizing: 'border-box' }}>
                        <span style={{ color: '#EF4444', fontWeight: '700', fontSize: '0.85rem', marginRight: '4px' }}>R$</span>
                        <input type="number" className="no-spin premium-input" value={discount === 0 ? '' : discount} onChange={(e) => onDiscountChange(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', color: '#EF4444', fontWeight: '700', width: '100%', textAlign: 'right', fontSize: '0.95rem', minWidth: '0', padding: 0 }} min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px', width: '60px', boxSizing: 'border-box' }}>
                        <input type="number" aria-label="Porcentagem" className="no-spin premium-input" value={percentDisplay} onChange={(e) => onDiscountChange(((subtotal * (parseFloat(e.target.value)||0)) / 100).toFixed(2))} style={{ border: 'none', background: 'transparent', outline: 'none', color: '#475569', fontWeight: '700', width: '100%', textAlign: 'center', fontSize: '0.95rem', minWidth: '0', padding: 0 }} min="0" step="0.1" placeholder="0" />
                        <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '0.8rem', marginLeft: '2px' }}>%</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px dashed #E2E8F0', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>Sinal / Pago</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '8px 12px', width: '120px', boxSizing: 'border-box' }}>
                    <span style={{ color: '#059669', fontWeight: '700', fontSize: '0.85rem', marginRight: '4px' }}>R$</span>
                    <input type="number" name="amount_paid" inputMode="decimal" className="no-spin premium-input" value={amountPaid === 0 ? '' : amountPaid} onChange={(e) => onAmountPaidChange(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', color: '#059669', fontWeight: '700', width: '100%', textAlign: 'right', fontSize: '0.95rem', minWidth: '0', padding: 0 }} min="0" step="0.01" placeholder="0.00" />
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: remaining > 0 ? '#FEF2F2' : '#F8FAFC', padding: '16px', borderRadius: '8px', border: remaining > 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0', marginTop: '4px' }}>
                <span style={{ fontSize: '0.9rem', color: remaining > 0 ? '#DC2626' : '#64748B', fontWeight: '800' }}>Falta Pagar</span>
                <span style={{ fontSize: '1.2rem', color: remaining > 0 ? '#DC2626' : '#64748B', fontWeight: '800', letterSpacing: '-0.5px' }}>R$ {remaining.toFixed(2)}</span>
            </div>
        </div>
    );
};

const OrderFormModal = ({ isOpen, onClose, orderToEdit, API_BASE_URL, token, auxData, onQuickClientAdd, onRefresh }) => {
    const isEditMode = !!orderToEdit;
    const initialState = { client_id: '', client_name: '', client_phone: '', category: 'Geral', delivery_date: '', amount_paid: 0, status: 'Criação de Arte', discount: 0 };

    const [orderData, setOrderData] = useState(initialState);
    const [productLines, setProductLines] = useState([createProductLineDraft()]);

    useEffect(() => {
        if (!isOpen) return;

        if (isEditMode) {
            const preparedLines = Array.isArray(orderToEdit.product_lines) && orderToEdit.product_lines.length > 0
                ? orderToEdit.product_lines.map((line) => normalizeLineForForm(line, auxData.dbProducts, auxData.dbFabrics))
                : [normalizeLineForForm({
                    line_key: 'legacy',
                    product_type: orderToEdit.product_type,
                    fabric_type: orderToEdit.fabric_type,
                    unit_price: orderToEdit.unit_price,
                    unit_cost: orderToEdit.unit_cost,
                    sizes_json: orderToEdit.sizes_json,
                    layout_path: orderToEdit.layout_path
                }, auxData.dbProducts, auxData.dbFabrics)];

            setOrderData({
                ...initialState,
                ...orderToEdit,
                delivery_date: orderToEdit.delivery_date ? parseDateSafe(orderToEdit.delivery_date).toISOString().split('T')[0] : '',
                discount: normalizeMoneyValue(orderToEdit.discount),
                amount_paid: getOrderAmountPaid(orderToEdit),
                status: orderToEdit.status || 'Criação de Arte'
            });
            setProductLines(preparedLines);
        } else {
            setOrderData(initialState);
            setProductLines([createProductLineDraft()]);
        }
    }, [isOpen, isEditMode, orderToEdit, auxData.dbProducts, auxData.dbFabrics]);

    const lineSummaries = useMemo(() => (
        productLines.map((line) => ({
            key: line.line_key,
            ...calculateTotals(line.sizes_json, parseFloat(line.unit_price) || 0, parseFloat(line.unit_cost) || 0)
        }))
    ), [productLines]);

    const subtotal = useMemo(() => lineSummaries.reduce((sum, line) => sum + line.total, 0), [lineSummaries]);
    const totalCost = useMemo(() => lineSummaries.reduce((sum, line) => sum + line.cost, 0), [lineSummaries]);

    const handleInputChange = useCallback((e) => setOrderData((prev) => ({ ...prev, [e.target.name]: e.target.value })), []);
    const handleClientNameChange = useCallback((value) => {
        setOrderData((prev) => ({ ...prev, client_name: value, client_id: '' }));
    }, []);
    const handleClientSelect = useCallback((client) => {
        setOrderData((prev) => ({
            ...prev,
            client_id: client?.id || '',
            client_name: client?.name || prev.client_name,
            client_phone: normalizePhoneDigits(client?.phone || prev.client_phone)
        }));
    }, []);
    const handleQuickClientAdd = useCallback(async (value) => {
        const createdClient = await onQuickClientAdd(value);
        setOrderData((prev) => ({
            ...prev,
            client_id: createdClient?.id || '',
            client_name: value
        }));
    }, [onQuickClientAdd]);

    const updateLine = useCallback((lineKey, updater) => {
        setProductLines((current) => current.map((line) => (
            line.line_key === lineKey ? updater(line) : line
        )));
    }, []);

    const handleLineFieldChange = useCallback((lineKey, field, value) => {
        updateLine(lineKey, (line) => ({ ...line, [field]: value }));
    }, [updateLine]);

    const handleLineProductSelect = useCallback((lineKey, value) => {
        updateLine(lineKey, (line) => {
            if (value === 'Outro' || !value) {
                return { ...line, product_type: value, custom_product_type: value === 'Outro' ? line.custom_product_type : '' };
            }

            const details = getProductDetails(value, auxData.dbProducts, auxData.dbFabrics);
            return {
                ...line,
                product_type: value,
                custom_product_type: '',
                production_label: details?.production_label || line.production_label,
                printing_types_json: details?.printing_types_json ?? line.printing_types_json,
                fabric_type: details?.fabric_type || line.fabric_type,
                custom_fabric_type: '',
                unit_price: details?.unit_price ?? line.unit_price,
                unit_cost: details?.unit_cost ?? line.unit_cost
            };
        });
    }, [auxData.dbProducts, auxData.dbFabrics, updateLine]);

    const handleLineFabricSelect = useCallback((lineKey, value) => {
        updateLine(lineKey, (line) => ({
            ...line,
            fabric_type: value,
            custom_fabric_type: value === 'Outro' ? line.custom_fabric_type : ''
        }));
    }, [updateLine]);

    const handleLineSizeChange = useCallback((lineKey, event) => {
        const { name, value } = event.target;
        updateLine(lineKey, (line) => ({
            ...line,
            sizes_json: { ...line.sizes_json, [name]: Number(value) || 0 }
        }));
    }, [updateLine]);

    const handleLineFileChange = useCallback((lineKey, event) => {
        const file = event.target.files?.[0] || null;
        if (file && file.size > 2 * 1024 * 1024) {
            Swal.fire({
                title: 'Ops! Imagem muito pesada',
                text: 'O arquivo tem mais de 2MB. Escolha uma imagem mais leve para esse produto.',
                icon: 'warning',
                confirmButtonColor: '#3B82F6'
            });
            event.target.value = '';
            return;
        }

        updateLine(lineKey, (line) => ({ ...line, layout_file: file }));
    }, [updateLine]);

    const handleAddProductLine = useCallback(() => {
        setProductLines((current) => [...current, createProductLineDraft()]);
    }, []);

    const handleRemoveProductLine = useCallback((lineKey) => {
        setProductLines((current) => current.length > 1 ? current.filter((line) => line.line_key !== lineKey) : current);
    }, []);

    const handleDiscountChange = useCallback((value) => {
        setOrderData((prev) => ({ ...prev, discount: normalizeMoneyValue(value) }));
    }, []);

    const handleAmountPaidChange = useCallback((value) => {
        setOrderData((prev) => ({ ...prev, amount_paid: normalizeMoneyValue(value) }));
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();

        const serializedLines = productLines.map((line) => serializeLineForApi(line, auxData.dbProducts, auxData.dbFabrics));
        const hasInvalidLine = serializedLines.some((line) => !String(line.product_type || '').trim());

        if (hasInvalidLine) {
            Swal.fire('Produto incompleto', 'Cada produto precisa ter pelo menos o nome/tipo preenchido.', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            const normalizedDiscount = normalizeMoneyValue(orderData.discount);
            const normalizedAmountPaid = normalizeMoneyValue(orderData.amount_paid);

            Object.keys(orderData).forEach((key) => {
                if (!['history', 'product_lines', 'sizes_json', 'layout_path', 'amount_paid', 'discount', 'synced_amount_paid'].includes(key) && orderData[key] !== undefined && orderData[key] !== null) {
                    formData.append(key, orderData[key]);
                }
            });

            formData.append('discount', normalizedDiscount);
            formData.append('amount_paid', normalizedAmountPaid);
            formData.append('total_price', Math.max(0, subtotal - normalizedDiscount));
            formData.append('cost_price', totalCost);
            formData.append('product_lines', JSON.stringify(serializedLines));

            productLines.forEach((line) => {
                if (line.layout_file) {
                    formData.append(`layout_file_${line.line_key}`, line.layout_file);
                }
            });

            let whatsappResult = null;

            if (isEditMode) {
                await OrderService.updateOrder(API_BASE_URL, token, orderData.id, formData);
                if (orderData.status !== orderToEdit.status) {
                    const statusRes = await OrderService.updateStatus(API_BASE_URL, token, orderData.tracking_code, orderData.status);
                    whatsappResult = statusRes.data?.whatsapp;
                }
                const whatsappText = whatsappResult?.sent
                    ? ' WhatsApp enviado ao cliente.'
                    : whatsappResult?.reason === 'missing_phone'
                        ? ' Cliente sem WhatsApp no pedido.'
                        : '';
                Swal.fire({ title: 'Atualizado!', text: `Pedido salvo com todos os produtos e valores.${whatsappText}`, icon: 'success', showConfirmButton: false, timer: 2500 });
            } else {
                await OrderService.createOrder(API_BASE_URL, token, formData);
                Swal.fire({ title: 'Criado!', text: 'Pedido salvo com sucesso.', icon: 'success', showConfirmButton: false, timer: 2500 });
            }

            onRefresh();
            onClose();
        } catch (error) {
            Swal.fire('Falha ao salvar', error.response?.data?.error || 'Verifique os dados preenchidos e tente novamente.', 'error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Revisar e Aprovar Pedido" : "Novo Pedido"}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>Informações Básicas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="flex flex-col gap-1 w-full">
                            <ClientAutocomplete value={orderData.client_name} onChange={handleClientNameChange} onSelectClient={handleClientSelect} onAddNew={handleQuickClientAdd} clients={auxData.dbClients} />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <label htmlFor="client_phone" style={styles.label}>WhatsApp do Cliente</label>
                            <input id="client_phone" type="tel" name="client_phone" className="premium-input" value={orderData.client_phone || ''} onChange={handleInputChange} placeholder="Ex: 81988074760" style={styles.input} />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <label htmlFor="status" style={styles.label}>Status Inicial</label>
                            <select id="status" name="status" className="premium-input" value={orderData.status} onChange={handleInputChange} style={styles.select}>
                                {ORDER_CONSTANTS.STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <label htmlFor="delivery_date" style={styles.label}>Data de Entrega</label>
                            <input id="delivery_date" type="date" name="delivery_date" className="premium-input" value={orderData.delivery_date} onChange={handleInputChange} onClick={(e) => e.target.showPicker()} style={{ ...styles.input, cursor: 'pointer', backgroundColor: '#fff' }} required />
                        </div>
                    </div>
                </div>

                <div style={styles.multiProductSectionHeader}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produtos do pedido</h4>
                        <p style={{ margin: '6px 0 0 0', color: '#64748B', fontSize: '0.92rem' }}>Agora você pode montar o mesmo pedido com vários produtos, grades e layouts separados.</p>
                    </div>
                    <button type="button" className="premium-btn" onClick={handleAddProductLine} style={styles.addLineButton}>
                        {Icons.Plus} Adicionar produto
                    </button>
                </div>

                <div style={styles.productLinesStack}>
                    {productLines.map((line, index) => (
                        <ProductLineEditor
                            key={line.line_key}
                            line={line}
                            index={index}
                            auxData={{ ...auxData, API_BASE_URL }}
                            canRemove={productLines.length > 1}
                            onFieldChange={handleLineFieldChange}
                            onProductSelect={handleLineProductSelect}
                            onFabricSelect={handleLineFabricSelect}
                            onSizeChange={handleLineSizeChange}
                            onRemove={handleRemoveProductLine}
                            onFileChange={handleLineFileChange}
                        />
                    ))}
                </div>

                <div style={{ borderTop: '2px dashed #E2E8F0', margin: '4px 0' }}></div>

                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '32px' }}>
                    <div style={{ flex: 1, minWidth: '320px', maxWidth: '400px' }}>
                        <FinancialSummary
                            subtotal={subtotal}
                            totalCost={totalCost}
                            discount={orderData.discount}
                            onDiscountChange={handleDiscountChange}
                            amountPaid={orderData.amount_paid}
                            onAmountPaidChange={handleAmountPaidChange}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '175px', flex: 1, minWidth: '250px', maxWidth: '350px' }}>
                        <button type="submit" className="premium-btn" style={{ ...styles.submitButton, width: '100%', padding: '16px', fontSize: '1.05rem', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                            {isEditMode ? 'Salvar Alterações e Lançar' : 'Salvar Pedido'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

// ============================================================================
// --- OUTROS MODAIS E TABELA ---
// ============================================================================
const StatusModal = ({ isOpen, onClose, orderToUpdate, onUpdateStatus }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Atualizar Status">
        <div style={{ padding: '8px 0' }}>
            <div style={styles.buttonsGrid}>
                {ORDER_CONSTANTS.STATUS_OPTIONS.filter(s => s !== 'Criação de Arte').map(status => { 
                    const isActive = isStatusActive(status, orderToUpdate?.status); 
                    return (<button key={status} onClick={() => onUpdateStatus(status, orderToUpdate?.tracking_code)} aria-label={`Mudar status para ${status}`} style={isActive ? styles.statusButtonCompleted : styles.statusButton}>{status} {isActive && Icons.Check}</button>); 
                })}
            </div>
        </div>
    </Modal>
);

const OrderItemsSummary = ({ items = [] }) => {
    const validItems = items.filter(item => item.size || item.player_name || item.player_number);
    if (validItems.length === 0) return null;

    return (
        <div style={{ marginBottom: '20px' }}>
            <p style={{fontWeight:'600', marginBottom:'10px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase'}}>Lista preenchida pela cliente:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                {validItems.map((item, index) => (
                    <div key={`${item.id || index}-${item.size || ''}`} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', backgroundColor: '#F8FAFC' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: '700', marginBottom: '4px' }}>Camisa {index + 1}</div>
                        <div style={{ fontWeight: '800', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.player_name || 'S/ Nome'}</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.82rem', color: '#475569', fontWeight: '700' }}>
                            <span>N: {item.player_number || '-'}</span>
                            <span>Tam: {item.size || '-'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProductLineEditor = ({
    line,
    index,
    auxData,
    canRemove,
    onFieldChange,
    onProductSelect,
    onFabricSelect,
    onSizeChange,
    onRemove,
    onFileChange
}) => {
    const [customPrintingType, setCustomPrintingType] = useState('');
    const effectiveProduct = getEffectiveLineProduct(line);
    const effectiveFabric = getEffectiveLineFabric(line);
    const lineTotals = calculateTotals(line.sizes_json, parseFloat(line.unit_price) || 0, parseFloat(line.unit_cost) || 0);
    const selectedPrintingTypes = normalizePrintingTypes(line.printing_types_json);
    const productionPreview = buildProductionLabel(line, auxData.dbProducts, auxData.dbFabrics);

    const handleTogglePrintingType = (printingType) => {
        const nextTypes = selectedPrintingTypes.includes(printingType)
            ? selectedPrintingTypes.filter((item) => item !== printingType)
            : [...selectedPrintingTypes, printingType];
        onFieldChange(line.line_key, 'printing_types_json', nextTypes);
    };

    const handleAddCustomPrintingType = () => {
        const normalized = customPrintingType.trim();
        if (!normalized) return;
        if (selectedPrintingTypes.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
            setCustomPrintingType('');
            return;
        }
        onFieldChange(line.line_key, 'printing_types_json', [...selectedPrintingTypes, normalized]);
        setCustomPrintingType('');
    };

    const handleRemovePrintingType = (printingType) => {
        onFieldChange(line.line_key, 'printing_types_json', selectedPrintingTypes.filter((item) => item !== printingType));
    };

    return (
        <div style={styles.productLineCard}>
            <div style={styles.productLineHeader}>
                <div>
                    <h4 style={styles.productLineTitle}>Produto {index + 1}</h4>
                    <p style={styles.productLineSubtitle}>
                        {effectiveProduct || 'Selecione o produto'}{effectiveFabric ? ` • ${effectiveFabric}` : ''}
                    </p>
                    {productionPreview && (
                        <p style={styles.productLinePreviewText}>
                            Ficha: ITEM {index + 1} - {productionPreview}
                        </p>
                    )}
                </div>
                {canRemove && (
                    <button type="button" onClick={() => onRemove(line.line_key)} style={styles.removeLineButton}>
                        {Icons.Trash} Remover
                    </button>
                )}
            </div>

            <div style={styles.productLineFields}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Produto</label>
                    <select className="premium-input" value={line.product_type} onChange={(event) => onProductSelect(line.line_key, event.target.value)} style={styles.select}>
                        <option value="">-- Selecione --</option>
                        {auxData.dbProducts.map((product) => <option key={product.id} value={product.name}>{product.name}</option>)}
                        <option value="Outro">Outro (Digitar)</option>
                    </select>
                    {line.product_type === 'Outro' && (
                        <input
                            type="text"
                            className="premium-input"
                            value={line.custom_product_type}
                            onChange={(event) => onFieldChange(line.line_key, 'custom_product_type', event.target.value)}
                            placeholder="Digite o nome do produto"
                            style={styles.input}
                        />
                    )}
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Tecido / Malha</label>
                    <select className="premium-input" value={line.fabric_type} onChange={(event) => onFabricSelect(line.line_key, event.target.value)} style={styles.select}>
                        <option value="">-- Selecione --</option>
                        {auxData.dbFabrics.map((fabric) => <option key={fabric.id} value={fabric.name}>{fabric.name}</option>)}
                        <option value="Outro">Outro</option>
                    </select>
                    {line.fabric_type === 'Outro' && (
                        <input
                            type="text"
                            className="premium-input"
                            value={line.custom_fabric_type}
                            onChange={(event) => onFieldChange(line.line_key, 'custom_fabric_type', event.target.value)}
                            placeholder="Digite o tecido"
                            style={styles.input}
                        />
                    )}
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Preço Unit. (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        className="premium-input"
                        value={line.unit_price}
                        onChange={(event) => onFieldChange(line.line_key, 'unit_price', event.target.value)}
                        style={{ ...styles.input, fontWeight: '700' }}
                        placeholder="0.00"
                    />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Custo Unit. (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        className="premium-input"
                        value={line.unit_cost}
                        onChange={(event) => onFieldChange(line.line_key, 'unit_cost', event.target.value)}
                        style={styles.input}
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div style={styles.productLineEnhancementsCard}>
                <div style={styles.productLineEnhancementsHeader}>
                    <h5 style={styles.productLineSectionTitle}>Impressão e acabamentos do item</h5>
                    <span style={styles.productLineEnhancementsHint}>Essas informações saem na ficha de produção.</span>
                </div>
                <div style={styles.productLinePrintingWrap}>
                    {PRINTING_TYPE_PRESETS.map((item) => {
                        const isActive = selectedPrintingTypes.includes(item);
                        return (
                            <button
                                key={item}
                                type="button"
                                onClick={() => handleTogglePrintingType(item)}
                                style={{
                                    ...styles.orderPrintingTag,
                                    ...(isActive ? styles.orderPrintingTagActive : {})
                                }}
                            >
                                {item}
                            </button>
                        );
                    })}
                </div>
                <div style={styles.customPrintingRow}>
                    <input
                        type="text"
                        className="premium-input"
                        value={customPrintingType}
                        onChange={(event) => setCustomPrintingType(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddCustomPrintingType();
                            }
                        }}
                        placeholder="Adicionar acabamento personalizado"
                        style={styles.input}
                    />
                    <button type="button" onClick={handleAddCustomPrintingType} style={styles.addPrintingTypeButton}>
                        Adicionar
                    </button>
                </div>
                <div style={styles.selectedPrintingWrap}>
                    {selectedPrintingTypes.length > 0 ? selectedPrintingTypes.map((item) => (
                        <span key={item} style={styles.selectedPrintingTag}>
                            {item}
                            <button type="button" onClick={() => handleRemovePrintingType(item)} style={styles.selectedPrintingRemove}>×</button>
                        </span>
                    )) : <small style={styles.productLineEnhancementsHint}>Nenhum acabamento definido para este item.</small>}
                </div>
                <div style={{ ...styles.formGroup, marginTop: '12px' }}>
                    <label style={styles.label}>Observações do item</label>
                    <textarea
                        className="premium-input"
                        value={line.production_notes || ''}
                        onChange={(event) => onFieldChange(line.line_key, 'production_notes', event.target.value)}
                        placeholder="Ex: Aplicar bordado na manga esquerda, revisar tom do friso, numerar costas."
                        style={{ ...styles.input, minHeight: '92px', resize: 'vertical' }}
                    />
                </div>
            </div>

            <div className="order-line-content" style={styles.productLineContent}>
                <div style={styles.productLineSizesWrap}>
                    <h5 style={styles.productLineSectionTitle}>Grade do produto</h5>
                    <OrderSizeInputs sizes={line.sizes_json} onChange={(event) => onSizeChange(line.line_key, event)} />
                </div>

                <div style={styles.productLineLayoutWrap}>
                    <h5 style={styles.productLineSectionTitle}>Layouts e anexos</h5>
                    <div style={styles.productLineLayoutCard}>
                        <div style={{ border: '1px dashed #CBD5E1', padding: '10px', borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
                            <input type="file" accept="image/*" onChange={(event) => onFileChange(line.line_key, event)} style={{ fontSize: '0.9rem', width: '100%' }} />
                        </div>

                        {line.layout_file ? (
                            <div style={styles.layoutStatusCard}>
                                <strong style={styles.layoutStatusTitle}>Novo layout selecionado</strong>
                                <span style={styles.layoutStatusText}>{line.layout_file.name}</span>
                            </div>
                        ) : line.layout_path ? (
                            <div style={styles.layoutPreviewCard}>
                                <img src={`${auxData.API_BASE_URL}/uploads/${line.layout_path}`} alt={`Layout ${index + 1}`} style={styles.layoutPreviewImage} />
                                <span style={styles.layoutStatusText}>Layout atual vinculado a este produto.</span>
                            </div>
                        ) : (
                            <div style={styles.layoutStatusCard}>
                                <strong style={styles.layoutStatusTitle}>Sem layout anexado</strong>
                                <span style={styles.layoutStatusText}>Você pode subir uma arte diferente para este produto.</span>
                            </div>
                        )}

                        <div style={styles.productLineTotals}>
                            <div>
                                <span style={styles.productLineMetricLabel}>Qtd. peças</span>
                                <strong style={styles.productLineMetricValue}>{lineTotals.totalQty}</strong>
                            </div>
                            <div>
                                <span style={styles.productLineMetricLabel}>Subtotal</span>
                                <strong style={styles.productLineMetricValue}>R$ {lineTotals.total.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OrderDetailsModal = ({ isOpen, onClose, order, onReset, onExportTxt, onUnlockClient, onRevertToQuote, API_BASE_URL, userRole }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Pedido">
        {order ? (
            <div style={styles.detailsContainer}>
                <h4 style={{fontSize:'1.1rem', fontWeight:'700', marginBottom:'15px'}}>{order.client_name} - {order.tracking_code}</h4>
                
                {Array.isArray(order.product_lines) && order.product_lines.length > 0 ? (
                    <div style={{ marginBottom: '20px', display: 'grid', gap: '14px' }}>
                        <p style={{fontWeight:'600', marginBottom:'0', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase'}}>Produtos do pedido:</p>
                        {order.product_lines.map((line, index) => (
                            <div key={line.id || line.line_key || index} style={styles.detailProductCard}>
                                <div style={styles.detailProductHeader}>
                                    <div>
                                        <strong style={{ display: 'block', color: '#0F172A', fontSize: '1rem' }}>{line.product_type}</strong>
                                        <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{line.fabric_type || 'Sem tecido informado'}</span>
                                        {line.production_label ? (
                                            <div style={{ color: '#1D4ED8', fontSize: '0.82rem', fontWeight: '700', marginTop: '6px', lineHeight: 1.5 }}>
                                                ITEM {index + 1} - {line.production_label}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <strong style={{ display: 'block', color: '#0F172A' }}>R$ {Number(line.total_price || 0).toFixed(2)}</strong>
                                        <span style={{ color: '#64748B', fontSize: '0.8rem' }}>Unit.: R$ {Number(line.unit_price || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                {normalizePrintingTypes(line.printing_types_json).length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                        {normalizePrintingTypes(line.printing_types_json).map((item) => (
                                            <span key={`${index}-${item}`} style={styles.tableTagLikeChip}>{item}</span>
                                        ))}
                                    </div>
                                ) : null}

                                <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom: line.layout_path ? '12px' : 0}}>
                                    {Object.entries(line.sizes_json || {}).map(([key, val]) => (val > 0 && <span key={`${index}-${key}`} style={{padding:'6px 12px', backgroundColor:'#f1f5f9', borderRadius:'6px', fontSize:'0.85rem', border:'1px solid #e2e8f0', color: '#0F172A'}}><b>{key}:</b> {val}</span>))}
                                </div>

                                {line.production_notes ? (
                                    <div style={styles.detailNoteBox}>
                                        <strong style={styles.detailNoteTitle}>Observações do item</strong>
                                        <div style={styles.detailNoteText}>{line.production_notes}</div>
                                    </div>
                                ) : null}

                                {line.layout_path ? (
                                    <div style={styles.detailLayoutBox}>
                                        <img src={`${API_BASE_URL}/uploads/${line.layout_path}`} alt={`Layout ${index + 1}`} style={styles.detailLayoutImage} />
                                        <a href={`${API_BASE_URL}/uploads/${line.layout_path}`} target="_blank" rel="noreferrer" style={{display:'block', marginTop:'8px', color:'#2563EB', fontSize:'0.8rem', fontWeight: '600'}}>Ver imagem original</a>
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : order.layout_path ? (
                    <div style={{marginBottom:'20px', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px'}}>
                        <p style={{fontWeight:'600', color:'#475569', marginBottom:'5px', fontSize:'0.8rem'}}>LAYOUT DO CLIENTE:</p>
                        <img src={`${API_BASE_URL}/uploads/${order.layout_path}`} alt="Layout" style={{maxWidth:'100%', borderRadius:'4px', maxHeight:'300px', objectFit:'contain'}} />
                        <a href={`${API_BASE_URL}/uploads/${order.layout_path}`} target="_blank" rel="noreferrer" style={{display:'block', marginTop:'5px', color:'#2563EB', fontSize:'0.8rem', fontWeight: '600'}}>Ver imagem original</a>
                    </div>
                ) : null}

                <OrderItemsSummary items={order.items || []} />

                <h5 style={{fontSize:'0.85rem', fontWeight:'700', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'15px', borderBottom:'1px solid #E2E8F0', paddingBottom:'10px'}}>Ações de Produção (Lista do Cliente)</h5>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    <button onClick={() => onExportTxt(order.id)} className="premium-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#10B981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                        <span style={{ display: 'flex' }}>{Icons.Download}</span> Baixar TXT para Produção (ZIP)
                    </button>
                    
                    {order.is_locked_by_client === 1 && (userRole === 'admin' || userRole === 'gerente') && (
                        <button onClick={() => onUnlockClient(order.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#FEF3C7', color: '#D97706', borderRadius: '8px', border: '1px solid #FCD34D', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <span style={{ display: 'flex' }}>{Icons.Unlock}</span> Permitir Nova Edição
                        </button>
                    )}
                </div>

                <h5 style={{fontSize:'0.85rem', fontWeight:'700', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'15px', borderBottom:'1px solid #E2E8F0', paddingBottom:'10px'}}>Histórico de Status</h5>
                <div style={styles.actionsContainer}><div style={styles.historyTimeline}>{order.history?.map((item, index) => (<div key={index} style={styles.historyItem}><div style={styles.historyDot}></div><div style={styles.historyContent}><p style={styles.historyStatus}>{item.status_text}</p><p style={styles.historyInfo}>{item.changed_by_name}</p><p style={styles.historyDate}>{formatDateTime(item.change_timestamp)}</p></div></div>))}</div></div>
                
                {(userRole === 'admin' || (userRole === 'gerente' && canRevertOrderToQuote(order))) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                        {canRevertOrderToQuote(order) && (
                            <button onClick={() => onRevertToQuote(order)} className="premium-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 16px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h11a4 4 0 010 8H7m-4-8l4-4m-4 4l4 4" /></svg>
                                Retornar para Orçamento
                            </button>
                        )}
                        {userRole === 'admin' && (
                            <button onClick={onReset} className="premium-btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '10px 16px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Resetar Histórico
                            </button>
                        )}
                    </div>
                )}
            </div>
        ) : <p>Carregando...</p>}
    </Modal>
);

const OrderRow = React.memo(({ order, isSelected, onCheckboxChange, onView, onEdit, onPrint, onStatusClick, userRole }) => {
    const [isHovered, setIsHovered] = useState(false);
    const paid = getOrderAmountPaid(order);
    const total = normalizeMoneyValue(order.total_price);
    const isFullyPaid = paid >= total && total > 0;

    return (
        <tr onClick={() => onView(order.tracking_code)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} style={{ ...styles.tr, ...(isHovered ? styles.trHover : {}), cursor: 'pointer' }}>
            <td style={styles.td} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar pedido ${order.tracking_code}`} checked={isSelected} onChange={() => onCheckboxChange(order.id)} style={styles.checkbox} /></td>
            <td style={{ ...styles.td, fontWeight: '600' }}>{order.client_name}</td>
            <td style={styles.td}>{order.tracking_code}</td>
            <td style={styles.td}>{order.layout_path ? <span style={{color:'#2563EB', display:'flex', alignItems:'center', gap:'4px', fontWeight:'600', fontSize:'0.8rem'}}>{Icons.Image} Anexado</span> : <span style={{color:'#94A3B8'}}>-</span>}</td>
            <td style={styles.td}><span onClick={(e) => { e.stopPropagation(); onStatusClick(order); }} style={{ ...styles.statusBadge, ...getStatusStyle(order.status), cursor: 'pointer' }}>{order.status}</span></td>
            <td style={{...styles.td, fontWeight:'600', color:'#4B5563'}}>{formatDateSafe(order.delivery_date)}</td>
            <td style={{...styles.td, fontWeight:'800', color:'#0F172A'}}>
                {formatMoney(total)}
                {paid > 0 && (
                    <div style={{ fontSize: '0.7rem', color: isFullyPaid ? '#10B981' : '#F59E0B', fontWeight: '700', marginTop: '2px' }}>
                        Pago: {formatMoney(paid)}
                    </div>
                )}
            </td>
            <td style={{...styles.td, textAlign:'right'}} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => onView(order.tracking_code)} aria-label="Ver Detalhes" style={styles.iconButton} title="Detalhes">{Icons.Eye}</button>
                    {(userRole === 'admin' || userRole === 'gerente') && <button onClick={() => onEdit(order)} aria-label="Editar e Aprovar" style={styles.iconButton} title="Editar e Aprovar">{Icons.Edit}</button>}
                    <button onClick={() => onPrint(order)} aria-label="Imprimir" style={styles.iconButton} title="Imprimir O.S.">{Icons.Printer}</button>
                </div>
            </td>
        </tr>
    );
});

const OrdersTable = React.memo(({ orders, selectedIds, onCheckboxChange, onView, onEdit, onPrint, onStatusClick, userRole }) => {
    if (orders.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: 'white' }}>Nenhum pedido encontrado.</div>;

    return (
        <div style={styles.tableContainer}>
            <table style={styles.table} aria-label="Tabela de Pedidos">
                <thead>
                    <tr><th scope="col" style={styles.th}></th><th scope="col" style={styles.th}>Cliente</th><th scope="col" style={styles.th}>Código</th><th scope="col" style={styles.th}>Layout</th><th scope="col" style={styles.th}>Status</th><th scope="col" style={styles.th}>Entrega</th><th scope="col" style={styles.th}>Total (R$)</th><th scope="col" style={{ ...styles.th, textAlign: 'right' }}>Ações</th></tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <OrderRow key={order.id} order={order} isSelected={selectedIds.includes(order.id)} onCheckboxChange={onCheckboxChange} onView={onView} onEdit={onEdit} onPrint={onPrint} onStatusClick={onStatusClick} userRole={userRole} />
                    ))}
                </tbody>
            </table>
        </div>
    );
});

// ============================================================================
// --- MAIN COMPONENT ---
// ============================================================================
const Orders = () => {
    const { token, API_BASE_URL, user } = useAuth();
    const location = useLocation();
    const { orders, dbProducts, dbFabrics, dbClients, loading, error, refreshOrders, quickAddClient, removeOrders } = useOrders(API_BASE_URL, token);
    
    const [currentTab, setCurrentTab] = useState('active'); 
    const [filterStatus, setFilterStatus] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const [modals, setModals] = useState({ form: false, details: false, status: false });
    const [orderToEdit, setOrderToEdit] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [orderToUpdateStatus, setOrderToUpdateStatus] = useState(null);

    useEffect(() => { if (location.state?.filterBy) setFilterStatus(location.state.filterBy); }, [location]);

    const toggleModal = useCallback((name, value) => setModals(prev => ({ ...prev, [name]: value })), []);
    const clearFilters = useCallback(() => { setFilterStatus(''); setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedOrderIds([]); }, []);
    const handleCheckboxChange = useCallback((id) => setSelectedOrderIds(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id]), []);

    const openCreateModal = useCallback(() => { setOrderToEdit(null); toggleModal('form', true); }, [toggleModal]);
    const openEditModal = useCallback(async (order) => {
        try {
            const res = await OrderService.getOrderHistory(API_BASE_URL, token, order.tracking_code);
            const detailedOrder = {
                ...res.data,
                sizes_json: { ...ORDER_CONSTANTS.DEFAULT_SIZES, ...(res.data.sizes_json || {}) }
            };
            setOrderToEdit(detailedOrder);
            toggleModal('form', true);
        } catch (error) {
            Swal.fire('Falha ao abrir', 'Não foi possível carregar os dados completos do pedido.', 'error');
        }
    }, [API_BASE_URL, token, toggleModal]);

    const handlePrintOrder = useCallback(async (order) => {
        try {
            const res = await OrderService.getOrderHistory(API_BASE_URL, token, order.tracking_code);
            const detailedOrder = {
                ...res.data,
                sizes_json: { ...ORDER_CONSTANTS.DEFAULT_SIZES, ...(res.data.sizes_json || {}) },
                product_lines: Array.isArray(res.data.product_lines) ? res.data.product_lines.map((line) => ({
                    ...line,
                    sizes_json: { ...ORDER_CONSTANTS.DEFAULT_SIZES, ...(line.sizes_json || {}) }
                })) : []
            };
            printOrder(detailedOrder, API_BASE_URL);
        } catch (error) {
            Swal.fire('Falha ao imprimir', 'Não foi possível carregar os dados completos da ficha de produção.', 'error');
        }
    }, [API_BASE_URL, token]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (o.status === 'Arte Arquivada') return false;
            const isDone = o.status === 'Entregue/Concluído' || o.status === 'Cancelado';
            if (currentTab === 'active' && isDone) return false;
            if (currentTab === 'history' && !isDone) return false;
            if (filterStatus && o.status !== filterStatus) return false;
            const searchLower = searchTerm.toLowerCase();
            if (searchTerm && (!o.client_name || !o.client_name.toLowerCase().includes(searchLower)) && (!o.tracking_code || !o.tracking_code.toLowerCase().includes(searchLower))) return false;
            if (startDate && endDate) {
                const orderDate = new Date(o.delivery_date).toISOString().split('T')[0];
                if (orderDate < startDate || orderDate > endDate) return false;
            }
            return true;
        });
    }, [orders, currentTab, filterStatus, searchTerm, startDate, endDate]);

    const handleDeleteSelected = useCallback(async () => {
        if (!selectedOrderIds.length) return;
        const result = await Swal.fire({ title: 'Confirmar exclusão?', text: `Deseja realmente excluir os ${selectedOrderIds.length} pedidos selecionados? Esta ação é definitiva.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Sim, excluir' });
        if (result.isConfirmed) {
            await removeOrders(selectedOrderIds);
            Swal.fire({ title: 'Tudo certo!', text: 'Itens removidos do sistema.', icon: 'success', showConfirmButton: false, timer: 2500 });
            setSelectedOrderIds([]);
        }
    }, [selectedOrderIds, removeOrders]);

    const handleRevertSelectedToQuote = useCallback(async () => {
        if (!selectedOrderIds.length) return;

        const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order.id));
        const revertibleOrders = selectedOrders.filter(canRevertOrderToQuote);
        const skippedCount = selectedOrders.length - revertibleOrders.length;

        if (!revertibleOrders.length) {
            Swal.fire('Ação indisponível', 'Selecione pedidos que ainda não entraram em produção, finalização ou cancelamento.', 'warning');
            return;
        }

        const result = await Swal.fire({
            title: revertibleOrders.length === 1 ? 'Mover pedido para orçamento?' : 'Mover pedidos para orçamento?',
            html: `O pedido será cancelado e o orçamento original voltará para <b>Em Análise</b>. Nenhum registro será excluído.${skippedCount > 0 ? `<br><br>${skippedCount} pedido(s) selecionado(s) serão ignorados por já estarem em produção, finalizados ou cancelados.` : ''}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2563EB',
            cancelButtonText: 'Cancelar',
            confirmButtonText: revertibleOrders.length === 1 ? 'Sim, mover' : `Sim, mover ${revertibleOrders.length}`
        });

        if (!result.isConfirmed) return;

        const results = await Promise.allSettled(
            revertibleOrders.map((order) => OrderService.revertToQuote(API_BASE_URL, token, order.id))
        );
        const failed = results.filter((item) => item.status === 'rejected');
        const succeededCount = results.length - failed.length;

        await refreshOrders();
        setSelectedOrderIds([]);

        if (failed.length > 0) {
            const firstError = failed[0].reason?.response?.data?.error || 'Alguns pedidos não puderam ser movidos para orçamento.';
            Swal.fire('Reversão parcial', `${succeededCount} pedido(s) movido(s). ${failed.length} falharam. ${firstError}`, 'warning');
            return;
        }

        Swal.fire('Pronto!', `${succeededCount} pedido(s) movido(s) para orçamento.`, 'success');
    }, [API_BASE_URL, token, orders, selectedOrderIds, refreshOrders]);

    const loadOrderDetails = useCallback(async (code) => {
        try {
            const res = await OrderService.getOrderHistory(API_BASE_URL, token, code);
            const d = res.data;
            d.sizes_json = { ...ORDER_CONSTANTS.DEFAULT_SIZES, ...d.sizes_json };
            setSelectedOrderDetails(d);
            toggleModal('details', true);
        } catch (e) { Swal.fire('Falha ao carregar', 'Não foi possível buscar os detalhes. Tente novamente.', 'error'); }
    }, [API_BASE_URL, token, toggleModal]);

    const handleUpdateStatus = useCallback(async (newStatus, code) => {
        if(!code) return;
        try {
            const res = await OrderService.updateStatus(API_BASE_URL, token, code, newStatus);
            const whatsapp = res.data?.whatsapp;
            toggleModal('status', false);
            if(modals.details) await loadOrderDetails(code);
            refreshOrders();
            const whatsappText = whatsapp?.sent
                ? ' WhatsApp enviado ao cliente.'
                : whatsapp?.reason === 'missing_phone'
                    ? ' Cadastre o WhatsApp no pedido para avisar o cliente automaticamente.'
                    : '';
            Swal.fire({ title: 'Status Atualizado!', text: `O pedido agora está: ${newStatus}.${whatsappText}`, icon: 'success', showConfirmButton: false, timer: 3000 });
        } catch (e) { Swal.fire('Puxa, tivemos um problema', 'Erro ao atualizar o status. Tente novamente.', 'error'); }
    }, [API_BASE_URL, token, modals.details, loadOrderDetails, refreshOrders, toggleModal]);

    const handleResetOrder = useCallback(async () => {
        if(!selectedOrderDetails) return;
        const res = await Swal.fire({ title: 'Atenção!', text: 'Deseja resetar o histórico deste pedido para "Criação de Arte"?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Sim, Resetar' });
        if (res.isConfirmed) {
            try {
                await OrderService.resetOrder(API_BASE_URL, token, selectedOrderDetails.tracking_code);
                Swal.fire({ title: 'Resetado!', text: 'Pedido voltou para o status inicial.', icon: 'success', showConfirmButton: false, timer: 2500 });
                await loadOrderDetails(selectedOrderDetails.tracking_code);
                refreshOrders();
            } catch (e) { Swal.fire('Falha ao resetar', 'Verifique sua conexão e tente novamente.', 'error'); }
        }
    }, [API_BASE_URL, token, selectedOrderDetails, loadOrderDetails, refreshOrders]);

    const handleExportTxt = async (id) => {
        try {
            const res = await OrderService.exportTxt(API_BASE_URL, token, id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Producao_atos_${id}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            Swal.fire('Erro no Download', 'O cliente ainda não preencheu a lista ou houve um erro no arquivo.', 'error');
        }
    };

    const handleUnlockClient = async (id) => {
        const result = await Swal.fire({ title: 'Liberar edição?', text: "Se você fizer isso, o cliente poderá alterar a lista pelo celular novamente.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#D97706', confirmButtonText: 'Sim, desbloquear' });
        if (result.isConfirmed) {
            try {
                const res = await OrderService.unlockOrder(API_BASE_URL, token, id);
                Swal.fire('Desbloqueado!', res.data.message || 'O cliente já pode editar.', 'success');
                await loadOrderDetails(selectedOrderDetails.tracking_code);
            } catch (e) { Swal.fire('Erro', 'Não foi possível desbloquear a lista.', 'error'); }
        }
    };

    const handleRevertToQuote = useCallback(async (order) => {
        if (!order?.id) return;

        const result = await Swal.fire({
            title: 'Retornar para orçamento?',
            text: 'O pedido será cancelado e o orçamento original voltará para Em Análise. Nenhum registro será excluído.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2563EB',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, retornar'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await OrderService.revertToQuote(API_BASE_URL, token, order.id);
            await refreshOrders();
            await loadOrderDetails(order.tracking_code);
            Swal.fire('Pronto!', response.data?.message || 'Pedido retornou para orçamento.', 'success');
        } catch (error) {
            Swal.fire('Não foi possível reverter', error.response?.data?.error || 'Tente novamente em alguns instantes.', 'error');
        }
    }, [API_BASE_URL, token, refreshOrders, loadOrderDetails]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando painel de pedidos...</div>;

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: '#0f172a', maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' }}>
            <style>{`
                .no-spin::-webkit-outer-spin-button,
                .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .no-spin { -moz-appearance: textfield; }
                
                .premium-input { transition: all 0.2s ease-in-out; }
                .premium-input:focus { outline: none !important; border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important; }
                
                .premium-btn { transition: all 0.2s ease; }
                .premium-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.25); background-color: #1D4ED8 !important; }
                .premium-btn:active { transform: translateY(0); box-shadow: none; }

                .premium-btn-danger { transition: all 0.2s ease; }
                .premium-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4) !important; background-color: #FEE2E2 !important; border-color: #EF4444 !important; color: #B91C1C !important; }
                .premium-btn-danger:active { transform: translateY(0); box-shadow: none; }

                @media (max-width: 960px) {
                    .order-line-content {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
            
            <header style={styles.header}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-hidden="true">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </span>
                        Painel de Pedidos
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, fontWeight: '500', marginLeft: '52px' }}>
                        Acompanhamento e faturamento de vendas
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {selectedOrderIds.length > 0 && user?.role === 'admin' && (<button onClick={handleDeleteSelected} style={styles.deleteButton}><span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Trash}</span> Excluir</button>)}
                    {selectedOrderIds.length > 0 && (user?.role === 'admin' || user?.role === 'gerente') && (<button onClick={handleRevertSelectedToQuote} style={styles.revertQuoteButton}><span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Return}</span> Mover p/ Orçamento</button>)}
                    <button onClick={openCreateModal} className="premium-btn" style={{...styles.addButton, backgroundColor: '#2563eb'}}><span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Plus}</span> Novo Pedido</button>
                </div>
            </header>

            <div style={styles.controlsContainer}>
                <div style={styles.tabsContainer}>
                    <button onClick={() => { setCurrentTab('active'); clearFilters(); }} style={currentTab === 'active' && !filterStatus ? styles.tabActive : styles.tabInactive}>Em Produção</button>
                    <button onClick={() => { setCurrentTab('history'); clearFilters(); }} style={currentTab === 'history' ? styles.tabActive : styles.tabInactive}>Histórico</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={styles.searchBox}>
                        <span style={{ color: '#94a3b8' }}>{Icons.Search}</span>
                        <input aria-label="Buscar pedidos" type="text" placeholder="Buscar cliente ou código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
                    </div>
                    <div style={styles.selectBox}>
                        <span style={{ color: '#94a3b8' }}>{Icons.Filter}</span>
                        <select aria-label="Filtrar por status" value={filterStatus || ''} onChange={(e) => setFilterStatus(e.target.value || null)} style={styles.selectInput}><option value="">Todos os Status</option>{ORDER_CONSTANTS.STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                    <div style={styles.dateBox}>
                        <span style={{ color: '#64748b', fontSize: '0.8rem', marginRight: '5px', fontWeight: '500' }}>Entrega:</span>
                        <input aria-label="Data inicial" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => e.target.showPicker()} style={{ ...styles.dateInput, cursor: 'pointer' }} />
                        <span style={{ color: '#94a3b8' }}>-</span>
                        <input aria-label="Data final" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => e.target.showPicker()} style={{ ...styles.dateInput, cursor: 'pointer' }} />
                    </div>
                    {(filterStatus || searchTerm || (startDate && endDate)) && (<button aria-label="Limpar filtros" onClick={clearFilters} style={styles.clearFilterButton}><span style={{ marginRight: '4px', display: 'flex' }}>{Icons.Close}</span> Limpar</button>)}
                </div>
            </div>

            {error && <p style={styles.error} role="alert">{error}</p>}

            <OrdersTable 
                orders={filteredOrders} selectedIds={selectedOrderIds} 
                onCheckboxChange={handleCheckboxChange} onView={loadOrderDetails} 
                onEdit={openEditModal} onPrint={handlePrintOrder} 
                onStatusClick={(o) => { setOrderToUpdateStatus(o); toggleModal('status', true); }} 
                userRole={user?.role} 
            />

            <OrderFormModal isOpen={modals.form} onClose={() => toggleModal('form', false)} orderToEdit={orderToEdit} API_BASE_URL={API_BASE_URL} token={token} auxData={{dbProducts, dbFabrics, dbClients}} onQuickClientAdd={quickAddClient} onRefresh={refreshOrders} />
            <StatusModal isOpen={modals.status} onClose={() => toggleModal('status', false)} orderToUpdate={orderToUpdateStatus} onUpdateStatus={handleUpdateStatus} />
            <OrderDetailsModal isOpen={modals.details} onClose={() => toggleModal('details', false)} order={selectedOrderDetails} onReset={handleResetOrder} onExportTxt={handleExportTxt} onUnlockClient={handleUnlockClient} onRevertToQuote={handleRevertToQuote} API_BASE_URL={API_BASE_URL} userRole={user?.role} />
        </div>
    );
};

const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' },
    addButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.9rem' },
    deleteButton: { backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fee2e2', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.9rem', transition: 'all 0.2s' },
    revertQuoteButton: { backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.9rem', transition: 'all 0.2s' },
    clearFilterButton: { backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
    controlsContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', gap: '14px', flexWrap: 'wrap' },
    searchBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', width: 'min(100%, 260px)' },
    searchInput: { border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '0.9rem', color: '#334155' },
    selectBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', width: 'min(100%, 220px)' },
    selectInput: { border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '0.9rem', color: '#334155', backgroundColor: 'transparent' },
    dateBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', maxWidth: '100%', overflowX: 'auto' },
    dateInput: { border: 'none', outline: 'none', fontSize: '0.85rem', color: '#334155', fontFamily: 'inherit', fontWeight: '500' },
    tabsContainer: { display: 'flex', gap: '32px' },
    tabActive: { padding: '8px 0', border: 'none', borderBottom: '2px solid #2563eb', backgroundColor: 'transparent', color: '#2563eb', fontWeight: '700', cursor: 'pointer', fontSize:'0.95rem' },
    tabInactive: { padding: '8px 0', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer', fontSize:'0.95rem', fontWeight: '500' },
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '860px' },
    th: { backgroundColor: '#f8fafc', padding: '16px 24px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.95rem' },
    tr: { transition: 'all 0.15s ease-out' },
    trHover: { backgroundColor: '#F8FAFC' },
    statusBadge: { padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-block', cursor: 'pointer', letterSpacing: '0.02em' },
    iconButton: { backgroundColor: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' },
    checkbox: { width:'16px', height:'16px', cursor: 'pointer', accentColor: '#2563eb' },
    error: { color: '#dc2626', marginBottom: '15px', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
    row: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
    sizeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: '10px' },
    sizeCell: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    label: { fontSize: '0.85rem', fontWeight: '700', color: '#334155', marginBottom: '2px' },
    input: { padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: '#fff', color: '#0f172a' },
    select: { padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.95rem', backgroundColor: '#fff', color: '#0f172a', outline: 'none' },
    submitButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
    multiProductSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' },
    addLineButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer' },
    productLinesStack: { display: 'grid', gap: '18px' },
    productLineCard: { border: '1px solid #DBEAFE', backgroundColor: '#F8FBFF', borderRadius: '18px', padding: '20px', display: 'grid', gap: '18px' },
    productLineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
    productLineTitle: { margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0F172A' },
    productLineSubtitle: { margin: '4px 0 0 0', fontSize: '0.88rem', color: '#64748B' },
    productLinePreviewText: { margin: '8px 0 0 0', fontSize: '0.82rem', color: '#1D4ED8', fontWeight: '700', lineHeight: 1.5 },
    removeLineButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '10px', padding: '9px 14px', fontWeight: '700', cursor: 'pointer' },
    productLineFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px' },
    productLineContent: { display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: '20px', alignItems: 'start' },
    productLineEnhancementsCard: { border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#FFFFFF', padding: '16px', display: 'grid', gap: '12px' },
    productLineEnhancementsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    productLineEnhancementsHint: { fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 },
    productLinePrintingWrap: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    orderPrintingTag: { padding: '9px 13px', borderRadius: '999px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease' },
    orderPrintingTagActive: { background: '#DBEAFE', borderColor: '#60A5FA', color: '#1D4ED8' },
    customPrintingRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px', alignItems: 'center' },
    addPrintingTypeButton: { padding: '12px 18px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap' },
    selectedPrintingWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '28px', alignItems: 'center' },
    selectedPrintingTag: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0F172A', color: '#FFFFFF', borderRadius: '999px', padding: '8px 12px', fontSize: '0.82rem', fontWeight: '700' },
    selectedPrintingRemove: { border: 'none', background: 'transparent', color: '#FFFFFF', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 },
    productLineSizesWrap: { border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#FFFFFF', padding: '16px' },
    productLineLayoutWrap: { border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#FFFFFF', padding: '16px' },
    productLineSectionTitle: { margin: '0 0 14px 0', fontSize: '0.84rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' },
    productLineLayoutCard: { display: 'grid', gap: '14px' },
    layoutStatusCard: { border: '1px dashed #CBD5E1', borderRadius: '12px', padding: '14px', backgroundColor: '#F8FAFC' },
    layoutStatusTitle: { display: 'block', color: '#0F172A', fontSize: '0.9rem', marginBottom: '4px' },
    layoutStatusText: { color: '#64748B', fontSize: '0.84rem', lineHeight: 1.5 },
    layoutPreviewCard: { border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF', padding: '10px' },
    layoutPreviewImage: { width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px', backgroundColor: '#F8FAFC' },
    productLineTotals: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', borderTop: '1px dashed #E2E8F0', paddingTop: '14px' },
    productLineMetricLabel: { display: 'block', fontSize: '0.74rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
    productLineMetricValue: { color: '#0F172A', fontSize: '1rem', fontWeight: '800' },
    detailsContainer: { padding: '10px 0' },
    detailProductCard: { border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', backgroundColor: '#F8FAFC' },
    detailProductHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' },
    tableTagLikeChip: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #BFDBFE' },
    detailNoteBox: { border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' },
    detailNoteTitle: { display: 'block', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
    detailNoteText: { color: '#334155', fontSize: '0.86rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
    detailLayoutBox: { border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF', padding: '10px' },
    detailLayoutImage: { maxWidth: '100%', borderRadius: '8px', maxHeight: '260px', objectFit: 'contain' },
    actionsContainer: { backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' },
    buttonsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' },
    statusButton: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#475569', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    statusButtonCompleted: { padding: '10px', border: '1px solid #16a34a', borderRadius: '8px', backgroundColor: '#dcfce7', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    historyTimeline: { position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #cbd5e1', marginLeft: '10px' },
    historyItem: { marginBottom: '28px', position: 'relative' },
    historyDot: { position: 'absolute', left: '-31px', top: '4px', width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%', border: '2px solid white', boxShadow:'0 0 0 3px #bfdbfe' },
    historyStatus: { fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a', fontSize: '0.95rem' },
    historyInfo: { margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: '500' },
    historyDate: { margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' },
    autocompleteList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', listStyle: 'none', padding: 0 },
    autocompleteItem: { padding: '12px 16px', cursor: 'pointer', fontSize: '0.95rem', color: '#334155', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s', fontWeight: '500' }
};

export default Orders;
