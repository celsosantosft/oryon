import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2'; 
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { printOrder as printQuote } from '../utils/printUtils';
import {
    PRINTING_TYPE_PRESETS,
    buildProductionLabel,
    createProductLineDraft,
    formatMoney,
    getEffectiveLineFabric,
    getEffectiveLineProduct,
    normalizeLineForForm,
    normalizeMoneyValue,
    normalizePrintingTypes,
    serializeLineForApi
} from './Orders';

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
    Unlock: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-8 4h14v10H5z" /></svg>
};

export const QUOTE_CONSTANTS = {
    DEFAULT_SIZES: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '14': 0, 'PP': 0, 'P': 0, 'M': 0, 'G': 0, 'GG': 0, 'XG': 0, 'XXG': 0, 'XXXG': 0, 'ESP': 0 },
    STATUS_OPTIONS: ['Em Análise', 'Enviado ao Cliente', 'Aprovado', 'Recusado', 'Cancelado']
};

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

export const calculateTotals = (currentSizes, uPrice, uCost) => {
    const totalQty = Object.values(currentSizes).reduce((acc, val) => acc + (Number(val) || 0), 0);
    return { total: totalQty * uPrice, cost: totalQty * uCost, totalQty };
};

export const getProductDetails = (productName, dbProducts, dbFabrics) => {
    const selectedProd = dbProducts.find(p => p.name === productName);
    if (!selectedProd) return null;
    const fabric = dbFabrics.find(f => f.id === selectedProd.tecido_principal_id);
    return { fabric_type: fabric?.name || '', unit_price: parseFloat(selectedProd.sale_price) || 0, unit_cost: parseFloat(selectedProd.production_cost) || 0 };
};

export const isStatusActive = (btn, curr) => { 
    if(!curr) return false; 
    if(curr==='Cancelado') return btn==='Cancelado'; 
    if(curr==='Recusado') return btn==='Recusado'; 
    if(btn==='Cancelado' || btn==='Recusado') return false; 
    return QUOTE_CONSTANTS.STATUS_OPTIONS.indexOf(btn) <= QUOTE_CONSTANTS.STATUS_OPTIONS.indexOf(curr); 
};

export const getStatusStyle = (s) => { 
    const stylesMap = {
        'Em Análise': {bg:'#fff7ed', color:'#c2410c', border:'1px solid #ffedd5'},
        'Enviado ao Cliente': {bg:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd'},
        'Aprovado': {bg:'#dcfce7', color:'#15803d', border:'1px solid #86efac'},
        'Recusado': {bg:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5'},
        'Cancelado': {bg:'#f3f4f6', color:'#4b5563', border:'1px solid #e5e7eb'}
    };
    return stylesMap[s] || {bg:'#f1f5f9',color:'#475569', border:'1px solid #e2e8f0'}; 
};

export const buildQuoteFormData = (data, sizes, layoutFile) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => { 
        if (key !== 'sizes_json' && key !== 'history' && data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]); 
        }
    });
    formData.append('sizes_json', JSON.stringify(sizes));
    if (layoutFile) formData.append('layout_file', layoutFile);
    return formData;
};

const normalizeQuoteDetails = (quote) => ({
    ...quote,
    discount: normalizeMoneyValue(quote?.discount),
    amount_paid: normalizeMoneyValue(quote?.amount_paid),
    sizes_json: { ...QUOTE_CONSTANTS.DEFAULT_SIZES, ...(quote?.sizes_json || {}) },
    product_lines: Array.isArray(quote?.product_lines)
        ? quote.product_lines.map((line) => ({
            ...line,
            sizes_json: { ...QUOTE_CONSTANTS.DEFAULT_SIZES, ...(line?.sizes_json || {}) }
        }))
        : []
});

// ============================================================================
// --- SERVICES ---
// ============================================================================
export const QuoteService = {
    getHeaders: (token, isMultipart = false) => ({ 
        headers: { 
            Authorization: `Bearer ${token}`, 
            ...(isMultipart && { 'Content-Type': 'multipart/form-data' }) 
        } 
    }),
    fetchQuotes: (api, token) => axios.get(`${api}/api/quotes`, QuoteService.getHeaders(token)),
    fetchProducts: (api, token) => axios.get(`${api}/api/products`, QuoteService.getHeaders(token)),
    fetchFabrics: (api, token) => axios.get(`${api}/api/fabrics`, QuoteService.getHeaders(token)),
    fetchClients: (api, token) => axios.get(`${api}/api/clients`, QuoteService.getHeaders(token)),
    createClient: (api, token, name) => axios.post(`${api}/api/clients`, { name }, QuoteService.getHeaders(token)),
    createQuote: (api, token, formData) => axios.post(`${api}/api/quotes`, formData, QuoteService.getHeaders(token, true)),
    updateQuote: (api, token, id, formData) => axios.put(`${api}/api/quotes/${id}`, formData, QuoteService.getHeaders(token, true)),
    updateStatus: (api, token, trackingCode, status) => axios.post(`${api}/api/quotes/${encodeURIComponent(trackingCode)}/status`, { new_status: status }, QuoteService.getHeaders(token)),
    deleteQuote: (api, token, id) => axios.delete(`${api}/api/quotes/${id}`, QuoteService.getHeaders(token)),
    resetQuote: (api, token, trackingCode) => axios.post(`${api}/api/quotes/${encodeURIComponent(trackingCode)}/reset`, {}, QuoteService.getHeaders(token)),
    getQuoteHistory: (api, token, trackingCode) => axios.get(`${api}/api/quotes/${encodeURIComponent(trackingCode)}/history`, QuoteService.getHeaders(token)),
    unlockQuote: (api, token, id) => axios.post(`${api}/api/quotes/${id}/unlock`, {}, QuoteService.getHeaders(token)),
    convertToOrder: (api, token, id) => axios.post(`${api}/api/quotes/${id}/convert`, {}, QuoteService.getHeaders(token)) 
};

// ============================================================================
// --- HOOKS CUSTOMIZADOS ---
// ============================================================================
const useQuotes = (API_BASE_URL, token) => {
    const [state, setState] = useState({ quotes: [], dbProducts: [], dbFabrics: [], dbClients: [], loading: true, error: null });

    const fetchAllData = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const [quotesRes, prodRes, fabRes, cliRes] = await Promise.all([
                QuoteService.fetchQuotes(API_BASE_URL, token),
                QuoteService.fetchProducts(API_BASE_URL, token),
                QuoteService.fetchFabrics(API_BASE_URL, token),
                QuoteService.fetchClients(API_BASE_URL, token)
            ]);
            setState({
                quotes: quotesRes.data.quotes || [],
                dbProducts: prodRes.data.products || [],
                dbFabrics: fabRes.data.fabrics || [],
                dbClients: cliRes.data.clients || [],
                loading: false, error: null
            });
        } catch (err) {
            setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar dados. Verifique sua conexão.' }));
        }
    }, [API_BASE_URL, token]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const refreshQuotes = useCallback(async () => {
        try {
            const res = await QuoteService.fetchQuotes(API_BASE_URL, token);
            setState(prev => ({ ...prev, quotes: res.data.quotes || [] }));
        } catch (e) { console.error(e); }
    }, [API_BASE_URL, token]);

    const quickAddClient = useCallback(async (name) => {
        const res = await QuoteService.createClient(API_BASE_URL, token, name);
        const newClient = { id: res.data.id, name };
        setState(prev => ({ ...prev, dbClients: [...prev.dbClients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
        return newClient;
    }, [API_BASE_URL, token]);

    const removeQuotes = useCallback(async (ids) => {
        await Promise.all(ids.map(id => QuoteService.deleteQuote(API_BASE_URL, token, id)));
        await refreshQuotes();
    }, [API_BASE_URL, token, refreshQuotes]);

    return { ...state, refreshQuotes, quickAddClient, removeQuotes };
};

// ============================================================================
// --- COMPONENTES AUXILIARES UI ---
// ============================================================================
const ClientAutocomplete = ({ value, onChange, onAddNew, clients }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const wrapperRef = useRef(null);
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
    const handleSelect = useCallback((name) => { onChange(name); setShowSuggestions(false); triggerSuccessEffect(); }, [onChange, triggerSuccessEffect]);
    const handleCreate = useCallback(() => { if (value?.trim()) { onAddNew(value); setShowSuggestions(false); triggerSuccessEffect(); } }, [value, onAddNew, triggerSuccessEffect]);
    const exactMatch = useMemo(() => safeClients.some(c => c.name.toLowerCase() === (value || '').toLowerCase()), [safeClients, value]);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <input 
                    id="client_name"
                    type="text" 
                    className="premium-input"
                    value={value || ''} 
                    onChange={handleChange} 
                    onFocus={() => value && setShowSuggestions(true)} 
                    placeholder="Busque ou digite o nome do cliente..." 
                    style={{ ...styles.input, borderColor: isSuccess ? '#10B981' : '#CBD5E1', paddingRight: '35px', width: '100%', boxSizing: 'border-box' }} 
                    autoComplete="off" 
                    required 
                />
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: isSuccess ? '#10B981' : '#94A3B8', pointerEvents: 'none' }}>{isSuccess ? Icons.Check : Icons.Search}</div>
            </div>
            {showSuggestions && (
                <ul style={styles.autocompleteList} role="listbox">
                    {suggestions.map((s) => (
                        <li key={s.id} onClick={() => handleSelect(s.name)} style={styles.autocompleteItem} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} role="option" aria-selected="false">
                            <span style={{ color: '#94a3b8', marginRight: '8px' }}>{Icons.User}</span>{s.name}
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

const QuoteSizeInputs = React.memo(({ sizes, onChange }) => {
    const { totalQty } = calculateTotals(sizes, 0, 0);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Infantil (Anos)</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['2', '4', '6', '8', '10', '12', '14'].map(s => (
                        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label htmlFor={`size-${s}`} style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{s}</label>
                            <input id={`size-${s}`} type="number" className="premium-input no-spin" name={s} value={sizes[s] > 0 ? sizes[s] : ''} onChange={onChange} style={{ ...styles.input, width: '64px', textAlign: 'center', padding: '10px', fontSize: '1rem', fontWeight: '600' }} min="0" />
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Adulto</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'].map(s => (
                        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label htmlFor={`size-${s}`} style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{s}</label>
                            <input id={`size-${s}`} type="number" className="premium-input no-spin" name={s} value={sizes[s] > 0 ? sizes[s] : ''} onChange={onChange} style={{ ...styles.input, width: '64px', textAlign: 'center', padding: '10px', fontSize: '1rem', fontWeight: '600' }} min="0" />
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

const FinancialSummary = ({ subtotal, totalCost, discount, onDiscountChange }) => {
    const safeDiscount = parseFloat(discount) || 0;
    const finalTotal = Math.max(0, subtotal - safeDiscount);

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
                <span style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '800' }}>{formatMoney(subtotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>Custo estimado</span>
                </div>
                <span style={{ fontSize: '1rem', color: '#475569', fontWeight: '700' }}>{formatMoney(totalCost)}</span>
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
                        <input type="number" aria-label="Porcentagem de desconto" className="no-spin premium-input" value={percentDisplay} onChange={(e) => onDiscountChange(((subtotal * (parseFloat(e.target.value) || 0)) / 100).toFixed(2))} style={{ border: 'none', background: 'transparent', outline: 'none', color: '#475569', fontWeight: '700', width: '100%', textAlign: 'center', fontSize: '0.95rem', minWidth: '0', padding: 0 }} min="0" step="0.1" placeholder="0" />
                        <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '0.8rem', marginLeft: '2px' }}>%</span>
                    </div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', color: '#0F172A', fontWeight: '800' }}>Total Final</span>
                <span style={{ fontSize: '1.5rem', color: '#16A34A', fontWeight: '800', letterSpacing: '-0.5px' }}>{formatMoney(finalTotal)}</span>
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
                        <input type="text" className="premium-input" value={line.custom_product_type} onChange={(event) => onFieldChange(line.line_key, 'custom_product_type', event.target.value)} placeholder="Digite o nome do produto" style={styles.input} />
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
                        <input type="text" className="premium-input" value={line.custom_fabric_type} onChange={(event) => onFieldChange(line.line_key, 'custom_fabric_type', event.target.value)} placeholder="Digite o tecido" style={styles.input} />
                    )}
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Preço Unit. (R$)</label>
                    <input type="number" step="0.01" className="premium-input" value={line.unit_price} onChange={(event) => onFieldChange(line.line_key, 'unit_price', event.target.value)} style={{ ...styles.input, fontWeight: '700' }} placeholder="0.00" />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Custo Unit. (R$)</label>
                    <input type="number" step="0.01" className="premium-input" value={line.unit_cost} onChange={(event) => onFieldChange(line.line_key, 'unit_cost', event.target.value)} style={styles.input} placeholder="0.00" />
                </div>
            </div>

            <div style={styles.productLineEnhancementsCard}>
                <div style={styles.productLineEnhancementsHeader}>
                    <h5 style={styles.productLineSectionTitle}>Impressão e acabamentos do item</h5>
                    <span style={styles.productLineEnhancementsHint}>Essas informações saem no orçamento e na ficha.</span>
                </div>
                <div style={styles.productLinePrintingWrap}>
                    {PRINTING_TYPE_PRESETS.map((item) => {
                        const isActive = selectedPrintingTypes.includes(item);
                        return (
                            <button key={item} type="button" onClick={() => handleTogglePrintingType(item)} style={{ ...styles.orderPrintingTag, ...(isActive ? styles.orderPrintingTagActive : {}) }}>
                                {item}
                            </button>
                        );
                    })}
                </div>
                <div style={styles.customPrintingRow}>
                    <input type="text" className="premium-input" value={customPrintingType} onChange={(event) => setCustomPrintingType(event.target.value)} onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddCustomPrintingType();
                        }
                    }} placeholder="Adicionar acabamento personalizado" style={styles.input} />
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
                    <textarea className="premium-input" value={line.production_notes || ''} onChange={(event) => onFieldChange(line.line_key, 'production_notes', event.target.value)} placeholder="Ex: Aplicar bordado na manga esquerda, revisar tom do friso, numerar costas." style={{ ...styles.input, minHeight: '92px', resize: 'vertical' }} />
                </div>
            </div>

            <div className="order-line-content" style={styles.productLineContent}>
                <div style={styles.productLineSizesWrap}>
                    <h5 style={styles.productLineSectionTitle}>Grade do produto</h5>
                    <QuoteSizeInputs sizes={line.sizes_json} onChange={(event) => onSizeChange(line.line_key, event)} />
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
                                <strong style={styles.productLineMetricValue}>{formatMoney(lineTotals.total)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const QuoteFormModal = ({ isOpen, onClose, quoteToEdit, API_BASE_URL, token, auxData, onQuickClientAdd, onRefresh }) => {
    const isEditMode = !!quoteToEdit;
    const initialState = {
        client_name: '',
        category: 'Geral',
        delivery_date: '',
        status: 'Em Análise',
        discount: 0,
        cor: '',
        tipo_estampa: '',
        observacao: '',
        url_referencia: ''
    };

    const [quoteData, setQuoteData] = useState(initialState);
    const [productLines, setProductLines] = useState([createProductLineDraft()]);

    useEffect(() => {
        if (!isOpen) return;

        if (isEditMode) {
            const preparedLines = Array.isArray(quoteToEdit.product_lines) && quoteToEdit.product_lines.length > 0
                ? quoteToEdit.product_lines.map((line) => normalizeLineForForm(line, auxData.dbProducts, auxData.dbFabrics))
                : [normalizeLineForForm({
                    line_key: 'legacy',
                    product_type: quoteToEdit.product_type,
                    fabric_type: quoteToEdit.fabric_type,
                    unit_price: quoteToEdit.unit_price,
                    unit_cost: quoteToEdit.unit_cost,
                    sizes_json: quoteToEdit.sizes_json,
                    layout_path: quoteToEdit.layout_path,
                    production_notes: quoteToEdit.observacao
                }, auxData.dbProducts, auxData.dbFabrics)];

            setQuoteData({
                ...initialState,
                ...quoteToEdit,
                delivery_date: quoteToEdit.delivery_date ? parseDateSafe(quoteToEdit.delivery_date).toISOString().split('T')[0] : '',
                discount: normalizeMoneyValue(quoteToEdit.discount)
            });
            setProductLines(preparedLines);
        } else {
            setQuoteData(initialState);
            setProductLines([createProductLineDraft()]);
        }
    }, [isOpen, isEditMode, quoteToEdit, auxData.dbProducts, auxData.dbFabrics]);

    const lineSummaries = useMemo(() => (
        productLines.map((line) => ({
            key: line.line_key,
            ...calculateTotals(line.sizes_json, parseFloat(line.unit_price) || 0, parseFloat(line.unit_cost) || 0)
        }))
    ), [productLines]);

    const subtotal = useMemo(() => lineSummaries.reduce((sum, line) => sum + line.total, 0), [lineSummaries]);
    const totalCost = useMemo(() => lineSummaries.reduce((sum, line) => sum + line.cost, 0), [lineSummaries]);

    const handleInputChange = useCallback((e) => setQuoteData((prev) => ({ ...prev, [e.target.name]: e.target.value })), []);

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
        setQuoteData((prev) => ({ ...prev, discount: normalizeMoneyValue(value) }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const serializedLines = productLines.map((line) => serializeLineForApi(line, auxData.dbProducts, auxData.dbFabrics));
        const hasInvalidLine = serializedLines.some((line) => !String(line.product_type || '').trim());

        if (hasInvalidLine) {
            Swal.fire('Produto incompleto', 'Cada produto precisa ter pelo menos o nome/tipo preenchido.', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            const normalizedDiscount = normalizeMoneyValue(quoteData.discount);

            Object.keys(quoteData).forEach((key) => {
                if (!['history', 'product_lines', 'sizes_json', 'layout_path', 'discount'].includes(key) && quoteData[key] !== undefined && quoteData[key] !== null) {
                    formData.append(key, quoteData[key]);
                }
            });

            formData.append('discount', normalizedDiscount);
            formData.append('total_price', Math.max(0, subtotal - normalizedDiscount));
            formData.append('cost_price', totalCost);
            formData.append('product_lines', JSON.stringify(serializedLines));

            productLines.forEach((line) => {
                if (line.layout_file) {
                    formData.append(`layout_file_${line.line_key}`, line.layout_file);
                }
            });

            if (isEditMode) {
                await QuoteService.updateQuote(API_BASE_URL, token, quoteData.id, formData);
                if (quoteData.status !== quoteToEdit.status) {
                    await QuoteService.updateStatus(API_BASE_URL, token, quoteData.tracking_code, quoteData.status);
                }
                Swal.fire({ title: 'Atualizado!', text: 'Orçamento salvo com todos os produtos e layouts.', icon: 'success', showConfirmButton: false, timer: 2500 });
            } else {
                await QuoteService.createQuote(API_BASE_URL, token, formData);
                Swal.fire({ title: 'Criado!', text: 'Orçamento salvo com sucesso.', icon: 'success', showConfirmButton: false, timer: 2500 });
            }

            onRefresh();
            onClose();
        } catch (error) {
            Swal.fire('Falha ao salvar', error.response?.data?.error || 'Verifique os dados preenchidos e tente novamente.', 'error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Editar Orçamento' : 'Novo Orçamento'}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>Informações Básicas</h4>
                    <div style={styles.row}>
                        <div style={styles.formGroup}>
                            <label htmlFor="client_name" style={styles.label}>Cliente</label>
                            <ClientAutocomplete value={quoteData.client_name} onChange={(value) => setQuoteData((prev) => ({ ...prev, client_name: value }))} onAddNew={async (value) => { await onQuickClientAdd(value); setQuoteData((prev) => ({ ...prev, client_name: value })); }} clients={auxData.dbClients} />
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="status" style={styles.label}>Status Inicial</label>
                            <select id="status" name="status" className="premium-input" value={quoteData.status} onChange={handleInputChange} style={styles.select}>
                                {QUOTE_CONSTANTS.STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="delivery_date" style={styles.label}>Data de Entrega / Validade</label>
                            <input id="delivery_date" type="date" name="delivery_date" className="premium-input" value={quoteData.delivery_date} onChange={handleInputChange} onClick={(e) => e.target.showPicker()} style={{ ...styles.input, cursor: 'pointer', backgroundColor: '#fff' }} required />
                        </div>
                    </div>
                    <div style={styles.row}>
                        <div style={styles.formGroup}>
                            <label htmlFor="cor" style={styles.label}>Cor / Referência</label>
                            <input id="cor" type="text" name="cor" className="premium-input" value={quoteData.cor || ''} onChange={handleInputChange} placeholder="Ex: Azul marinho + branco" style={styles.input} />
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="tipo_estampa" style={styles.label}>Tipo de estampa</label>
                            <input id="tipo_estampa" type="text" name="tipo_estampa" className="premium-input" value={quoteData.tipo_estampa || ''} onChange={handleInputChange} placeholder="Ex: Sublimação total" style={styles.input} />
                        </div>
                        <div style={styles.formGroup}>
                            <label htmlFor="url_referencia" style={styles.label}>URL de referência</label>
                            <input id="url_referencia" type="text" name="url_referencia" className="premium-input" value={quoteData.url_referencia || ''} onChange={handleInputChange} placeholder="https://..." style={styles.input} />
                        </div>
                    </div>
                    <div style={styles.formGroup}>
                        <label htmlFor="observacao" style={styles.label}>Observações gerais do orçamento</label>
                        <textarea id="observacao" name="observacao" className="premium-input" value={quoteData.observacao || ''} onChange={handleInputChange} placeholder="Ex: Cliente quer comparar duas opções, bordado só no peito, revisar gola antes da aprovação final." style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }} />
                    </div>
                </div>

                <div style={styles.multiProductSectionHeader}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produtos do orçamento</h4>
                        <p style={{ margin: '6px 0 0 0', color: '#64748B', fontSize: '0.92rem' }}>Monte o orçamento com vários produtos, grades, subtotais e layouts separados.</p>
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
                        <FinancialSummary subtotal={subtotal} totalCost={totalCost} discount={quoteData.discount} onDiscountChange={handleDiscountChange} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '175px', flex: 1, minWidth: '250px', maxWidth: '350px' }}>
                        <button type="submit" className="premium-btn" style={{ ...styles.submitButton, width: '100%', padding: '16px', fontSize: '1.05rem', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                            {isEditMode ? 'Salvar Alterações' : 'Salvar Orçamento'}
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
const StatusModal = ({ isOpen, onClose, quoteToUpdate, onUpdateStatus }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Atualizar Status">
        <div style={{ padding: '8px 0' }}>
            <div style={styles.buttonsGrid}>
                {QUOTE_CONSTANTS.STATUS_OPTIONS.map(status => { 
                    const isActive = isStatusActive(status, quoteToUpdate?.status); 
                    return (<button key={status} onClick={() => onUpdateStatus(status, quoteToUpdate?.tracking_code)} aria-label={`Mudar status para ${status}`} style={isActive ? styles.statusButtonCompleted : styles.statusButton}>{status} {isActive && Icons.Check}</button>); 
                })}
            </div>
        </div>
    </Modal>
);

const QuoteItemsSummary = ({ items = [] }) => {
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

const QuoteDetailsModal = ({ isOpen, onClose, quote, onReset, onUnlockClient, API_BASE_URL, userRole }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Orçamento">
        {quote ? (
            <div style={styles.detailsContainer}>
                <h4 style={{fontSize:'1.1rem', fontWeight:'700', marginBottom:'15px'}}>{quote.client_name} - {quote.tracking_code}</h4>

                {Array.isArray(quote.product_lines) && quote.product_lines.length > 0 ? (
                    <div style={{ marginBottom: '20px', display: 'grid', gap: '14px' }}>
                        <p style={{fontWeight:'600', marginBottom:'0', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase'}}>Produtos do orçamento:</p>
                        {quote.product_lines.map((line, index) => (
                            <div key={line.id || line.line_key || index} style={styles.detailProductCard}>
                                <div style={styles.detailProductHeader}>
                                    <div>
                                        <strong style={{ display: 'block', color: '#0F172A', fontSize: '1rem' }}>{line.product_type}</strong>
                                        <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{line.fabric_type || 'Sem tecido informado'}</span>
                                        {line.production_label ? (
                                            <div style={{ marginTop: '8px', color: '#1D4ED8', fontSize: '0.85rem', fontWeight: '700', lineHeight: 1.5 }}>
                                                ITEM {index + 1} - {line.production_label}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <strong style={{ display: 'block', color: '#0F172A', fontSize: '0.95rem' }}>{formatMoney(line.total_price)}</strong>
                                        <span style={{ color: '#64748B', fontSize: '0.8rem' }}>
                                            {Object.values(line.sizes_json || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0)} peça(s)
                                        </span>
                                    </div>
                                </div>

                                {normalizePrintingTypes(line.printing_types_json).length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                        {normalizePrintingTypes(line.printing_types_json).map((item) => (
                                            <span key={`${index}-${item}`} style={styles.tableTagLikeChip}>{item}</span>
                                        ))}
                                    </div>
                                ) : null}

                                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom: line.layout_path ? '12px' : 0 }}>
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
                ) : quote.layout_path ? (
                    <div style={{marginBottom:'20px', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px'}}>
                        <p style={{fontWeight:'600', color:'#475569', marginBottom:'5px', fontSize:'0.8rem'}}>LAYOUT EM ANEXO:</p>
                        <img src={`${API_BASE_URL}/uploads/${quote.layout_path}`} alt="Layout" style={{maxWidth:'100%', borderRadius:'4px', maxHeight:'300px', objectFit:'contain'}} />
                        <a href={`${API_BASE_URL}/uploads/${quote.layout_path}`} target="_blank" rel="noreferrer" style={{display:'block', marginTop:'5px', color:'#2563EB', fontSize:'0.8rem', fontWeight: '600'}}>Ver imagem original</a>
                    </div>
                ) : null}

                {quote.observacao ? (
                    <div style={styles.detailNoteBox}>
                        <strong style={styles.detailNoteTitle}>Observações gerais do orçamento</strong>
                        <div style={styles.detailNoteText}>{quote.observacao}</div>
                    </div>
                ) : null}

                {!Array.isArray(quote.product_lines) || quote.product_lines.length === 0 ? (
                    <div style={{marginBottom:'20px'}}>
                        <p style={{fontWeight:'600', marginBottom:'5px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase'}}>Grade de Tamanhos:</p>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'6px'}}>
                            {Object.entries(quote.sizes_json).map(([key, val]) => (val > 0 && <span key={key} style={{padding:'6px 12px', backgroundColor:'#f1f5f9', borderRadius:'6px', fontSize:'0.85rem', border:'1px solid #e2e8f0', color: '#0F172A'}}><b>{key}:</b> {val}</span>))}
                        </div>
                    </div>
                ) : null}

                <QuoteItemsSummary items={quote.items || []} />
                
                <h5 style={{fontSize:'0.85rem', fontWeight:'700', color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'15px', borderBottom:'1px solid #E2E8F0', paddingBottom:'10px'}}>Histórico de Status</h5>
                
                <div style={styles.actionsContainer}>
                    <div style={styles.historyTimeline}>
                        {quote.history?.map((item, index) => (
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

                {(userRole === 'admin' || userRole === 'gerente') && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                        {quote.is_locked_by_client === 1 && (
                            <button onClick={() => onUnlockClient(quote.id)} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px',
                                backgroundColor: '#FEF3C7', color: '#D97706', 
                                border: '1px solid #FCD34D', borderRadius: '8px', 
                                padding: '10px 16px', fontSize: '0.9rem', fontWeight: '600',
                                cursor: 'pointer'
                            }}>
                                {Icons.Unlock}
                                Permitir Nova Edição
                            </button>
                        )}
                        {userRole === 'admin' && (
                        <button onClick={onReset} className="premium-btn-danger" style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px',
                            backgroundColor: '#FEF2F2', color: '#DC2626', 
                            border: '1px solid #FCA5A5', borderRadius: '8px', 
                            padding: '10px 16px', fontSize: '0.9rem', fontWeight: '600',
                            cursor: 'pointer'
                        }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Voltar para Orçamento
                        </button>
                        )}
                    </div>
                )}

            </div>
        ) : <p>Carregando...</p>}
    </Modal>
);

// ⭐ OTIMIZAÇÃO: Linha Isolada para Prevenir Renderização da Tabela Inteira no Hover ⭐
const QuoteRow = React.memo(({ quote, isSelected, onCheckboxChange, onView, onEdit, onPrint, onStatusClick, onApproveToOrder, userRole }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <tr 
            onClick={() => onView(quote.tracking_code)} 
            onMouseEnter={() => setIsHovered(true)} 
            onMouseLeave={() => setIsHovered(false)} 
            style={{ ...styles.tr, ...(isHovered ? styles.trHover : {}), cursor: 'pointer' }}
        >
            <td style={styles.td} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar orçamento ${quote.tracking_code}`} checked={isSelected} onChange={() => onCheckboxChange(quote.id)} style={styles.checkbox} /></td>
            <td style={{ ...styles.td, fontWeight: '600' }}>{quote.client_name}</td>
            <td style={styles.td}>{quote.tracking_code}</td>
            <td style={styles.td}>{quote.layout_path ? <span style={{color:'#2563EB', display:'flex', alignItems:'center', gap:'4px', fontWeight:'600', fontSize:'0.8rem'}}>{Icons.Image} Anexado</span> : <span style={{color:'#94A3B8'}}>-</span>}</td>
            <td style={styles.td}><span onClick={(e) => { e.stopPropagation(); onStatusClick(quote); }} style={{ ...styles.statusBadge, ...getStatusStyle(quote.status), cursor: 'pointer' }}>{quote.status}</span></td>
            <td style={{...styles.td, fontWeight:'600', color:'#4B5563'}}>{formatDateSafe(quote.delivery_date)}</td>
            <td style={{...styles.td, fontWeight:'600'}}>{formatMoney(quote.total_price)}</td>
            <td style={{...styles.td, textAlign:'right'}} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {(quote.status === 'Em Análise' || quote.status === 'Enviado ao Cliente') && (
                        <button onClick={() => onApproveToOrder(quote)} aria-label="Aprovar Orçamento" style={styles.iconButtonApprove} title="Aprovar e Enviar p/ Pedidos">{Icons.Check}</button>
                    )}
                    <button onClick={() => onView(quote.tracking_code)} aria-label="Ver Detalhes" style={styles.iconButton} title="Detalhes">{Icons.Eye}</button>
                    {(userRole === 'admin' || userRole === 'gerente') && <button onClick={() => onEdit(quote)} aria-label="Editar" style={styles.iconButton} title="Editar">{Icons.Edit}</button>}
                    <button onClick={() => onPrint(quote)} aria-label="Imprimir" style={styles.iconButton} title="Imprimir Orçamento">{Icons.Printer}</button>
                </div>
            </td>
        </tr>
    );
});

const QuotesTable = React.memo(({ quotes, selectedIds, onCheckboxChange, onView, onEdit, onPrint, onStatusClick, onApproveToOrder, userRole }) => {
    if (quotes.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: 'white' }}>Nenhum orçamento encontrado.</div>;

    return (
        <div style={styles.tableContainer}>
            <table style={styles.table} aria-label="Tabela de Orçamentos">
                <thead>
                    <tr>
                        <th scope="col" style={styles.th}></th><th scope="col" style={styles.th}>Cliente</th><th scope="col" style={styles.th}>Código</th><th scope="col" style={styles.th}>Layout</th><th scope="col" style={styles.th}>Status</th><th scope="col" style={styles.th}>Validade / Prev.</th><th scope="col" style={styles.th}>Total (R$)</th><th scope="col" style={{ ...styles.th, textAlign: 'right' }}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {quotes.map((quote) => (
                        <QuoteRow 
                            key={quote.id} 
                            quote={quote} 
                            isSelected={selectedIds.includes(quote.id)}
                            onCheckboxChange={onCheckboxChange}
                            onView={onView}
                            onEdit={onEdit}
                            onPrint={onPrint}
                            onStatusClick={onStatusClick}
                            onApproveToOrder={onApproveToOrder}
                            userRole={userRole}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
});

// ============================================================================
// --- MAIN COMPONENT ---
// ============================================================================
const Quotes = () => {
    const { token, API_BASE_URL, user } = useAuth();
    const location = useLocation();
    const { quotes, dbProducts, dbFabrics, dbClients, loading, error, refreshQuotes, quickAddClient, removeQuotes } = useQuotes(API_BASE_URL, token);
    
    const [currentTab, setCurrentTab] = useState('active'); 
    const [filterStatus, setFilterStatus] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedQuoteIds, setSelectedQuoteIds] = useState([]);

    const [modals, setModals] = useState({ form: false, details: false, status: false });
    const [quoteToEdit, setQuoteToEdit] = useState(null);
    const [selectedQuoteDetails, setSelectedQuoteDetails] = useState(null);
    const [quoteToUpdateStatus, setQuoteToUpdateStatus] = useState(null);

    useEffect(() => { if (location.state?.filterBy) setFilterStatus(location.state.filterBy); }, [location]);

    const toggleModal = useCallback((name, value) => setModals(prev => ({ ...prev, [name]: value })), []);
    const clearFilters = useCallback(() => { setFilterStatus(''); setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedQuoteIds([]); }, []);
    const handleCheckboxChange = useCallback((id) => setSelectedQuoteIds(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id]), []);

    const fetchQuoteSnapshot = useCallback(async (code) => {
        const res = await QuoteService.getQuoteHistory(API_BASE_URL, token, code);
        return normalizeQuoteDetails(res.data);
    }, [API_BASE_URL, token]);

    const openCreateModal = useCallback(() => {
        setQuoteToEdit(null);
        toggleModal('form', true);
    }, [toggleModal]);

    const openEditModal = useCallback(async (quote) => {
        try {
            const detailedQuote = await fetchQuoteSnapshot(quote.tracking_code);
            setQuoteToEdit(detailedQuote);
            toggleModal('form', true);
        } catch (error) {
            Swal.fire('Falha ao carregar', 'Não foi possível abrir o orçamento para edição.', 'error');
        }
    }, [fetchQuoteSnapshot, toggleModal]);

    const filteredQuotes = useMemo(() => {
        return quotes.filter(o => {
            const isDone = o.status === 'Aprovado' || o.status === 'Recusado' || o.status === 'Cancelado';
            if (currentTab === 'active' && isDone) return false;
            if (currentTab === 'history' && !isDone) return false;
            if (filterStatus && o.status !== filterStatus) return false;
            const searchLower = searchTerm.toLowerCase();
            if (searchTerm && !o.client_name.toLowerCase().includes(searchLower) && !o.tracking_code.toLowerCase().includes(searchLower)) return false;
            if (startDate && endDate) {
                const quoteDate = new Date(o.delivery_date).toISOString().split('T')[0];
                if (quoteDate < startDate || quoteDate > endDate) return false;
            }
            return true;
        });
    }, [quotes, currentTab, filterStatus, searchTerm, startDate, endDate]);

    const handleDeleteSelected = useCallback(async () => {
        if (!selectedQuoteIds.length) return;
        const result = await Swal.fire({ title: 'Confirmar exclusão?', text: `Deseja realmente excluir os ${selectedQuoteIds.length} orçamentos selecionados? Esta ação é definitiva.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Sim, excluir' });
        if (result.isConfirmed) {
            await removeQuotes(selectedQuoteIds);
            Swal.fire({ title: 'Tudo certo!', text: 'Itens removidos do sistema.', icon: 'success', showConfirmButton: false, timer: 2500 });
            setSelectedQuoteIds([]);
        }
    }, [selectedQuoteIds, removeQuotes]);

    const loadQuoteDetails = useCallback(async (code) => {
        try {
            const detailedQuote = await fetchQuoteSnapshot(code);
            setSelectedQuoteDetails(detailedQuote);
            toggleModal('details', true);
        } catch (e) {
            Swal.fire('Falha ao carregar', 'Não foi possível buscar os detalhes. Tente novamente.', 'error');
        }
    }, [fetchQuoteSnapshot, toggleModal]);

    const handlePrint = useCallback(async (quote) => {
        try {
            const detailedQuote = await fetchQuoteSnapshot(quote.tracking_code);
            printQuote(detailedQuote, API_BASE_URL);
        } catch (error) {
            Swal.fire('Falha ao imprimir', 'Não foi possível carregar o orçamento completo para impressão.', 'error');
        }
    }, [API_BASE_URL, fetchQuoteSnapshot]);

    const handleUpdateStatus = useCallback(async (newStatus, code) => {
        if(!code) return;
        try {
            await QuoteService.updateStatus(API_BASE_URL, token, code, newStatus);
            toggleModal('status', false);
            if(modals.details) await loadQuoteDetails(code);
            refreshQuotes();
            Swal.fire({ title: 'Status Atualizado!', text: `O orçamento agora está: ${newStatus}`, icon: 'success', showConfirmButton: false, timer: 2500 });
        } catch (e) { Swal.fire('Puxa, tivemos um problema', 'Erro ao atualizar o status. Tente novamente.', 'error'); }
    }, [API_BASE_URL, token, modals.details, loadQuoteDetails, refreshQuotes, toggleModal]);

    const handleResetQuote = useCallback(async () => {
        if(!selectedQuoteDetails) return;
        const res = await Swal.fire({ title: 'Atenção!', text: 'Deseja voltar este orçamento para "Em Análise" e liberar a cliente para editar novamente?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Sim, Resetar' });
        if(res.isConfirmed) {
            try {
                await QuoteService.resetQuote(API_BASE_URL, token, selectedQuoteDetails.tracking_code);
                Swal.fire({ title: 'Resetado!', text: 'Orçamento voltou para edição da cliente.', icon: 'success', showConfirmButton: false, timer: 2500 });
                await loadQuoteDetails(selectedQuoteDetails.tracking_code);
                refreshQuotes();
            } catch (e) { Swal.fire('Falha ao resetar', 'Verifique sua conexão e tente novamente.', 'error'); }
        }
    }, [API_BASE_URL, token, selectedQuoteDetails, loadQuoteDetails, refreshQuotes]);

    const handleUnlockQuote = useCallback(async (id) => {
        const result = await Swal.fire({ title: 'Liberar edição?', text: "A cliente poderá alterar a lista do orçamento pelo celular novamente.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#D97706', confirmButtonText: 'Sim, desbloquear' });
        if (result.isConfirmed) {
            try {
                const res = await QuoteService.unlockQuote(API_BASE_URL, token, id);
                Swal.fire('Desbloqueado!', res.data.message || 'A cliente já pode editar.', 'success');
                await loadQuoteDetails(selectedQuoteDetails.tracking_code);
                refreshQuotes();
            } catch (e) { Swal.fire('Erro', 'Não foi possível desbloquear a lista.', 'error'); }
        }
    }, [API_BASE_URL, token, selectedQuoteDetails, loadQuoteDetails, refreshQuotes]);

const handleApproveToOrder = useCallback(async (quote) => {
        const result = await Swal.fire({
            title: 'Aprovar Orçamento?',
            html: `<p style="color: #64748B; font-size: 1.05rem; margin-top: 12px;">O pedido de <b>${quote.client_name}</b> precisa criar a arte ou a arte já está pronta?</p>`,
            icon: 'question',
            width: '640px', // ⭐ A MÁGICA AQUI: Quebra o limite padrão e deixa o card largo e imponente
            padding: '32px', // ⭐ Mais respiro interno
            showDenyButton: true,
            showCancelButton: true,
            reverseButtons: false, // Mantém a ordem: [Arte Pronta] [Precisa de Arte] [Cancelar]
            buttonsStyling: false, 
            confirmButtonText: `<div style="display:flex; align-items:center; justify-content:center;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> Arte Pronta</div>`,
            denyButtonText: `<div style="display:flex; align-items:center; justify-content:center;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Precisa de Arte</div>`,
            cancelButtonText: `Cancelar`,
            customClass: {
                popup: 'premium-swal-popup',
                title: 'premium-swal-title',
                actions: 'premium-swal-actions',
                confirmButton: 'premium-btn-outline-green', 
                denyButton: 'premium-btn-outline-blue',     
                cancelButton: 'premium-btn-outline-gray'    
            }
        });

        if (result.isConfirmed || result.isDenied) {
            try {
                const response = await QuoteService.convertToOrder(API_BASE_URL, token, quote.id);
                const novoTrackingCode = response.data?.tracking_code; 

                if (result.isConfirmed && novoTrackingCode) {
                    await axios.post(
                        `${API_BASE_URL}/api/orders/${encodeURIComponent(novoTrackingCode)}/status`,
                        { new_status: 'Arte Aprovada/Liberada' }, 
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }

                refreshQuotes();
                
                Swal.fire({
                    title: 'Pedido Gerado!',
                    text: result.isConfirmed ? 'Enviado direto para Produção (Arte Pronta).' : 'Enviado para a fila de Design.',
                    icon: 'success',
                    timer: 2500,
                    showConfirmButton: false
                });
            } catch (err) {
                Swal.fire('Falha na aprovação', 'Houve um erro de comunicação com o servidor.', 'error');
            }
        }
    }, [API_BASE_URL, token, refreshQuotes]);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: '#0f172a', maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' }}>
            
 {/* INJEÇÃO DE MICROINTERAÇÕES E ESTILOS PREMIUM */}
            <style>{`
                .no-spin::-webkit-outer-spin-button,
                .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .no-spin { -moz-appearance: textfield; }
                
                .premium-input { transition: all 0.2s ease-in-out; }
                .premium-input:focus { outline: none !important; border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important; }
                
                /* Botão Azul Padrão */
                .premium-btn { transition: all 0.2s ease; }
                .premium-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.25); background-color: #1D4ED8 !important; }
                .premium-btn:active { transform: translateY(0); box-shadow: none; }

                /* ⭐ NOVO: Botão de Perigo (Vermelho Neon) ⭐ */
                .premium-btn-danger { transition: all 0.2s ease; }
                .premium-btn-danger:hover { 
                    transform: translateY(-1px); 
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4) !important; /* Efeito Neon Vermelho */
                    background-color: #FEE2E2 !important; 
                    border-color: #EF4444 !important;
                    color: #B91C1C !important;
                }
                .premium-btn-danger:active { transform: translateY(0); box-shadow: none; }

                /* CSS EXCLUSIVO DOS BOTÕES DO SWEETALERT (LINHA ÚNICA) */
                .premium-swal-actions {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: nowrap !important;
                    gap: 12px !important;
                    width: 100% !important;
                    justify-content: center !important;
                    margin-top: 24px !important;
                }

                .premium-btn-outline-green, .premium-btn-outline-blue, .premium-btn-outline-gray {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 10px 0px !important;
                    border-radius: 8px !important;
                    font-weight: 600 !important;
                    font-size: 0.85rem !important;
                    background-color: transparent !important;
                    transition: all 0.2s ease !important;
                    flex: 1 !important;
                    white-space: nowrap !important;
                    cursor: pointer !important;
                    outline: none !important;
                }

                .premium-btn-outline-green { border: 1px solid #10B981 !important; color: #10B981 !important; }
                .premium-btn-outline-green:hover { background-color: #ECFDF5 !important; }

                .premium-btn-outline-blue { border: 1px solid #3B82F6 !important; color: #3B82F6 !important; }
                .premium-btn-outline-blue:hover { background-color: #EFF6FF !important; }

                .premium-btn-outline-gray { border: 1px solid #CBD5E1 !important; color: #64748B !important; }
                .premium-btn-outline-gray:hover { background-color: #F8FAFC !important; color: #0F172A !important; border-color: #94A3B8 !important; }
            `}</style>

            <header style={styles.header}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-hidden="true">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </span>
                        Painel de Orçamentos
                    </h1>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, fontWeight: '500', marginLeft: '52px' }}>
                        Criação e acompanhamento de propostas comerciais
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {selectedQuoteIds.length > 0 && user?.role === 'admin' && (<button onClick={handleDeleteSelected} style={styles.deleteButton}><span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Trash}</span> Excluir</button>)}
                    <button onClick={openCreateModal} className="premium-btn" style={styles.addButton}><span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Plus}</span> Novo Orçamento</button>
                </div>
            </header>

            <div style={styles.controlsContainer}>
                <div style={styles.tabsContainer}>
                    <button onClick={() => { setCurrentTab('active'); clearFilters(); }} style={currentTab === 'active' && !filterStatus ? styles.tabActive : styles.tabInactive}>Em Aberto</button>
                    <button onClick={() => { setCurrentTab('history'); clearFilters(); }} style={currentTab === 'history' ? styles.tabActive : styles.tabInactive}>Histórico</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={styles.searchBox}>
                        <span style={{ color: '#94a3b8' }}>{Icons.Search}</span>
                        <input aria-label="Buscar orçamentos" type="text" placeholder="Buscar cliente ou código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
                    </div>
                    <div style={styles.selectBox}>
                        <span style={{ color: '#94a3b8' }}>{Icons.Filter}</span>
                        <select aria-label="Filtrar por status" value={filterStatus || ''} onChange={(e) => setFilterStatus(e.target.value || null)} style={styles.selectInput}><option value="">Todos os Status</option>{QUOTE_CONSTANTS.STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                    <div style={styles.dateBox}>
                        <span style={{ color: '#64748b', fontSize: '0.8rem', marginRight: '5px', fontWeight: '500' }}>Previsão:</span>
                        <input aria-label="Data inicial" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => e.target.showPicker()} style={{ ...styles.dateInput, cursor: 'pointer' }} />
                        <span style={{ color: '#94a3b8' }}>-</span>
                        <input aria-label="Data final" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => e.target.showPicker()} style={{ ...styles.dateInput, cursor: 'pointer' }} />
                    </div>
                    {(filterStatus || searchTerm || (startDate && endDate)) && (<button aria-label="Limpar filtros" onClick={clearFilters} style={styles.clearFilterButton}><span style={{ marginRight: '4px', display: 'flex' }}>{Icons.Close}</span> Limpar</button>)}
                </div>
            </div>
            
            {error && <p style={styles.error} role="alert">{error}</p>}
            
            <QuotesTable quotes={filteredQuotes} selectedIds={selectedQuoteIds} onCheckboxChange={handleCheckboxChange} onView={loadQuoteDetails} onEdit={openEditModal} onPrint={handlePrint} onStatusClick={(o) => { setQuoteToUpdateStatus(o); toggleModal('status', true); }} onApproveToOrder={handleApproveToOrder} userRole={user?.role} />
            
            {/* MODAL UNIFICADO */}
            <QuoteFormModal isOpen={modals.form} onClose={() => toggleModal('form', false)} quoteToEdit={quoteToEdit} API_BASE_URL={API_BASE_URL} token={token} auxData={{dbProducts, dbFabrics, dbClients}} onQuickClientAdd={quickAddClient} onRefresh={refreshQuotes} />
            
            <StatusModal isOpen={modals.status} onClose={() => toggleModal('status', false)} quoteToUpdate={quoteToUpdateStatus} onUpdateStatus={handleUpdateStatus} />
            <QuoteDetailsModal isOpen={modals.details} onClose={() => toggleModal('details', false)} quote={selectedQuoteDetails} onReset={handleResetQuote} onUnlockClient={handleUnlockQuote} API_BASE_URL={API_BASE_URL} userRole={user?.role} />
        </div>
    );
};

// --- Estilos Globais Refatorados ---
const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' },
    addButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.9rem' },
    deleteButton: { backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fee2e2', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.9rem', transition: 'all 0.2s' },
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
    iconButtonApprove: { backgroundColor: '#dcfce7', border: 'none', color: '#15803d', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center' },
    checkbox: { width:'16px', height:'16px', cursor: 'pointer', accentColor: '#2563eb' },
    error: { color: '#dc2626', marginBottom: '15px', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
    row: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
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
    productLineEnhancementsHint: { color: '#64748B', fontSize: '0.82rem', lineHeight: 1.5 },
    productLinePrintingWrap: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    orderPrintingTag: { border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', borderRadius: '999px', padding: '9px 14px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' },
    orderPrintingTagActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF', color: '#1D4ED8', boxShadow: '0 0 0 1px #BFDBFE inset' },
    customPrintingRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px', alignItems: 'center' },
    addPrintingTypeButton: { border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: '10px', padding: '10px 16px', fontWeight: '700', cursor: 'pointer' },
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
    productLineTotals: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '12px 14px', border: '1px solid #E2E8F0' },
    productLineMetricLabel: { display: 'block', color: '#64748B', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' },
    productLineMetricValue: { display: 'block', color: '#0F172A', fontSize: '1rem', fontWeight: '800' },
    detailsContainer: { padding: '10px 0' },
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
    detailProductCard: { border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', backgroundColor: '#F8FAFC' },
    detailProductHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' },
    tableTagLikeChip: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #BFDBFE' },
    detailNoteBox: { border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' },
    detailNoteTitle: { display: 'block', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
    detailNoteText: { color: '#334155', fontSize: '0.86rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
    detailLayoutBox: { border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF', padding: '10px' },
    detailLayoutImage: { maxWidth: '100%', borderRadius: '8px', maxHeight: '260px', objectFit: 'contain' },
    autocompleteList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', listStyle: 'none', padding: 0 },
    autocompleteItem: { padding: '12px 16px', cursor: 'pointer', fontSize: '0.95rem', color: '#334155', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s', fontWeight: '500' }
};

export default Quotes;
