import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

// --- ÍCONES (SVG) ---
const Icons = {
    Plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-7l4-4m-4 4l5 5m-9 0L19 7"/></svg>,
    Trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V7a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    Search: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
    Box: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7L12 3 4 7l8 4 8-4zM4 17l8 4 8-4M4 12l8 4 8-4"/></svg>,
    Fabric: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
};

// =====================================================================================
// 🧵 ABA 2: GESTÃO DE MALHAS
// =====================================================================================
const FabricsManager = () => {
    const { API_BASE_URL, token, showNotification } = useAuth();
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fabricToEdit, setFabricToEdit] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [hoveredRowId, setHoveredRowId] = useState(null);

    useEffect(() => { fetchFabrics(); }, []);

    const fetchFabrics = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/fabrics`, { headers: { Authorization: `Bearer ${token}` } });
            setFabrics(res.data.fabrics || []);
        } catch (err) { showNotification('Erro ao carregar malhas.', 'error'); } finally { setLoading(false); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Tem certeza que deseja excluir esta malha?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/fabrics/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchFabrics();
            showNotification('Malha excluída com sucesso.');
        } catch (err) { showNotification('Erro ao excluir malha.', 'error'); }
    };

    const handleEditClick = (e, fabric) => {
        if(e) e.stopPropagation();
        setFabricToEdit(fabric);
        setFormData(fabric);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = fabricToEdit ? `${API_BASE_URL}/api/fabrics/${fabricToEdit.id}` : `${API_BASE_URL}/api/fabrics`;
        const method = fabricToEdit ? 'PUT' : 'POST';
        try {
            await axios({ method, url: endpoint, data: formData, headers: { Authorization: `Bearer ${token}` } });
            fetchFabrics();
            setIsModalOpen(false);
            showNotification('Malha salva com sucesso!');
        } catch (err) { showNotification('Erro ao salvar malha.', 'error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button onClick={() => { setFabricToEdit(null); setFormData({ name: '', description: '' }); setIsModalOpen(true); }} style={styles.addButton}>
                    <span style={{marginRight:'8px', display:'flex'}}>{Icons.Plus}</span> Nova Malha
                </button>
            </div>
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nome da Malha</th>
                            <th style={styles.th}>Descrição</th>
                            <th style={{...styles.th, textAlign:'right'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fabrics.length === 0 ? ( <tr><td colSpan="3" style={{padding:'30px', textAlign:'center', color:'#64748b'}}>Nenhuma malha cadastrada.</td></tr> ) : (
                            fabrics.map(f => (
                                <tr 
                                    key={f.id} 
                                    onClick={(e) => handleEditClick(e, f)}
                                    onMouseEnter={() => setHoveredRowId(f.id)}
                                    onMouseLeave={() => setHoveredRowId(null)}
                                    style={{ ...styles.tr, ...(hoveredRowId === f.id ? styles.trHover : {}) }}
                                >
                                    <td style={styles.td}><strong>{f.name}</strong></td>
                                    <td style={styles.td}>{f.description || '-'}</td>
                                    <td style={{...styles.td, textAlign:'right'}}>
                                        <div style={styles.actionButtons}>
                                            <button onClick={(e) => handleEditClick(e, f)} style={styles.iconButton} title="Editar">{Icons.Edit}</button>
                                            <button onClick={(e) => handleDelete(e, f.id)} style={{...styles.iconButton, color:'#DC2626'}} title="Excluir">{Icons.Trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={fabricToEdit ? 'Editar Malha' : 'Nova Malha'}>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Nome da Malha *</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={styles.input} required placeholder="Ex: DryFit, Algodão 30.1" />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Descrição</label>
                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={styles.input} />
                    </div>
                    <button type="submit" style={styles.submitButton}>Salvar</button>
                </form>
            </Modal>
        </div>
    );
};

// =====================================================================================
// 📦 ABA 1: GESTÃO DE PRODUTOS
// =====================================================================================

const TYPE_PECA_OPTIONS = ['camisa', 'short', 'bermuda', 'calça', 'jaleco', 'avental', 'outro'];
const TYPE_GOLA_OPTIONS = ['Gola Redonda', 'Gola V', 'Gola Polo', 'Gola Canoa', 'Sem Gola'];
const COLLAR_COMPATIBLE_TYPES = ['camisa', 'jaleco', 'outro'];
const PRINTING_TYPE_PRESETS = [
    '100% Sublimada',
    'Com Friso',
    'Bordado',
    'DTF',
    'Silk Screen',
    'Transfer',
    'Estampa Localizada',
    'Recorte',
    'Viés'
];

const normalizePrintingTypes = (value) => {
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

const buildProductTypeSummary = (product) => {
    const parts = [product.type_peca || product.category || 'Produto'];
    if (product.type_gola) parts.push(product.type_gola);
    return parts.filter(Boolean).join(' • ');
};

const buildProductProductionSummary = (product, fabricName = '') => {
    const parts = [];
    if (product.name) parts.push(product.name);
    if (product.type_gola && !String(product.name || '').toLowerCase().includes(String(product.type_gola).toLowerCase())) {
        parts.push(product.type_gola);
    }
    if (fabricName) parts.push(`Malha ${fabricName}`);
    normalizePrintingTypes(product.printing_types_json).forEach((item) => parts.push(item));
    return parts.filter(Boolean).join(' • ');
};

const buildInitialProductFormState = (product = null) => {
    const merged = {
        name: '',
        type_peca: TYPE_PECA_OPTIONS[0],
        has_collar: false,
        type_gola: '',
        printing_types_json: [],
        sale_price: '',
        tecido_principal_id: '',
        observations: '',
        ...(product || {})
    };

    return {
        ...merged,
        has_collar: Boolean(merged.type_gola),
        printing_types_json: normalizePrintingTypes(merged.printing_types_json)
    };
};

const ProductForm = ({ productToEdit, onClose, onSave }) => {
    const { API_BASE_URL, token, showNotification } = useAuth();
    const isEditing = !!productToEdit;
    const [availableFabrics, setAvailableFabrics] = useState([]);
    const [customPrintingType, setCustomPrintingType] = useState('');
    
    const [formData, setFormData] = useState(buildInitialProductFormState(productToEdit));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supportsCollar = COLLAR_COMPATIBLE_TYPES.includes(formData.type_peca);

    useEffect(() => {
        setFormData(buildInitialProductFormState(productToEdit));
        setCustomPrintingType('');
    }, [productToEdit]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/api/fabrics`, { headers: { Authorization: `Bearer ${token}` } }).then(res => setAvailableFabrics(res.data.fabrics || []));
        if (isEditing && productToEdit?.id) {
            axios.get(`${API_BASE_URL}/api/products/${productToEdit.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
                setFormData(prev => ({
                    ...prev,
                    ...res.data.product,
                    has_collar: Boolean(res.data.product?.type_gola),
                    printing_types_json: normalizePrintingTypes(res.data.product?.printing_types_json)
                }));
            });
        }
    }, [isEditing, productToEdit, API_BASE_URL, token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            if (name === 'type_peca' && !COLLAR_COMPATIBLE_TYPES.includes(value)) {
                return { ...prev, type_peca: value, has_collar: false, type_gola: '' };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleTogglePrintingType = (printingType) => {
        setFormData((prev) => {
            const current = normalizePrintingTypes(prev.printing_types_json);
            const next = current.includes(printingType)
                ? current.filter((item) => item !== printingType)
                : [...current, printingType];
            return { ...prev, printing_types_json: next };
        });
    };

    const handleAddCustomPrintingType = () => {
        const normalized = customPrintingType.trim();
        if (!normalized) return;

        setFormData((prev) => {
            const current = normalizePrintingTypes(prev.printing_types_json);
            if (current.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
                return prev;
            }
            return { ...prev, printing_types_json: [...current, normalized] };
        });
        setCustomPrintingType('');
    };

    const handleRemovePrintingType = (printingType) => {
        setFormData((prev) => ({
            ...prev,
            printing_types_json: normalizePrintingTypes(prev.printing_types_json).filter((item) => item !== printingType)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const endpoint = isEditing ? `${API_BASE_URL}/api/products/${productToEdit.id}` : `${API_BASE_URL}/api/products`;
        const method = isEditing ? 'PUT' : 'POST';
        
        // Envia production_cost 0 e consumption vazio silenciosamente para não quebrar o backend antigo
        const payload = {
            ...formData,
            type_gola: formData.has_collar ? formData.type_gola : null,
            printing_types_json: normalizePrintingTypes(formData.printing_types_json),
            production_cost: 0,
            consumption: []
        };
        delete payload.has_collar;
        
        try {
            await axios({ method, url: endpoint, data: payload, headers: { Authorization: `Bearer ${token}` } });
            showNotification('Produto salvo com sucesso!'); onSave(); onClose();
        } catch (error) { showNotification('Erro ao salvar produto.', 'error'); } finally { setIsSubmitting(false); }
    };

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}><label style={styles.label}>Nome do Produto *</label><input name="name" value={formData.name || ''} onChange={handleChange} style={styles.input} required /></div>
                <div style={styles.formGroup}><label style={styles.label}>Tipo de Peça</label><select name="type_peca" value={formData.type_peca || ''} onChange={handleChange} style={styles.select}>{TYPE_PECA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Estrutura da Peça</label>
                    {supportsCollar ? (
                        <div style={styles.inlineToggleCard}>
                            <label style={styles.checkboxRow}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData.has_collar)}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, has_collar: event.target.checked, type_gola: event.target.checked ? prev.type_gola : '' }))}
                                />
                                <span>Este produto usa gola</span>
                            </label>
                            {formData.has_collar && (
                                <select name="type_gola" value={formData.type_gola || ''} onChange={handleChange} style={styles.select} required>
                                    <option value="">Selecione o tipo...</option>
                                    {TYPE_GOLA_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}
                            {!formData.has_collar && <small style={styles.helperText}>A gola fica opcional e some da ficha quando este produto não usar.</small>}
                        </div>
                    ) : (
                        <div style={styles.disabledInfoCard}>
                            <strong style={{ color: '#0F172A' }}>Sem gola por padrão</strong>
                            <small style={styles.helperText}>Esse tipo de peça normalmente não usa gola, então a ficha fica mais limpa.</small>
                        </div>
                    )}
                </div>
            </div>
            
            <h4 style={styles.sectionTitle}>Material e Preço (Opcional)</h4>
            <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Malha / Tecido Padrão</label>
                    <select name="tecido_principal_id" value={formData.tecido_principal_id || ''} onChange={handleChange} style={styles.select}>
                        <option value="">-- Selecione --</option>
                        {availableFabrics.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Preço Base / Sugerido (R$)</label>
                    <input type="number" step="0.01" name="sale_price" value={formData.sale_price || ''} onChange={handleChange} style={styles.input} placeholder="0.00" />
                </div>
            </div>

            <h4 style={styles.sectionTitle}>Tipo de Impressão e Acabamentos</h4>
            <div style={styles.formGroup}>
                <label style={styles.label}>Composição produtiva do item</label>
                <p style={styles.helperText}>Você pode combinar vários acabamentos no mesmo produto. Exemplo: 100% Sublimada, Com Friso, Bordado e DTF.</p>
                <div style={styles.presetTagsWrap}>
                    {PRINTING_TYPE_PRESETS.map((item) => {
                        const isActive = normalizePrintingTypes(formData.printing_types_json).includes(item);
                        return (
                            <button
                                key={item}
                                type="button"
                                onClick={() => handleTogglePrintingType(item)}
                                style={{
                                    ...styles.presetTag,
                                    ...(isActive ? styles.presetTagActive : {})
                                }}
                            >
                                {item}
                            </button>
                        );
                    })}
                </div>
                <div style={styles.customTagRow}>
                    <input
                        value={customPrintingType}
                        onChange={(e) => setCustomPrintingType(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomPrintingType();
                            }
                        }}
                        style={styles.input}
                        placeholder="Adicionar acabamento personalizado"
                    />
                    <button type="button" onClick={handleAddCustomPrintingType} style={styles.secondaryButton}>Adicionar</button>
                </div>
                <div style={styles.selectedTagsWrap}>
                    {normalizePrintingTypes(formData.printing_types_json).length > 0 ? normalizePrintingTypes(formData.printing_types_json).map((item) => (
                        <span key={item} style={styles.selectedTag}>
                            {item}
                            <button type="button" onClick={() => handleRemovePrintingType(item)} style={styles.selectedTagRemove}>×</button>
                        </span>
                    )) : <small style={styles.helperText}>Nenhum tipo de impressão ou acabamento selecionado.</small>}
                </div>
            </div>

            <div style={styles.formGroup}>
                <label style={styles.label}>Observações de Produção</label>
                <textarea
                    name="observations"
                    value={formData.observations || ''}
                    onChange={handleChange}
                    style={{ ...styles.input, minHeight: '96px', resize: 'vertical' }}
                    placeholder="Detalhes internos do produto, instruções de acabamento, observações do corte, costura ou estampa."
                />
            </div>

            <div style={styles.formActions}>
                <button type="button" onClick={onClose} style={styles.cancelButton}>Cancelar</button>
                <button type="submit" style={styles.submitButton} disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar Produto'}</button>
            </div>
        </form>
    );
};

const ProductsManager = () => {
    const { token, API_BASE_URL, showNotification } = useAuth();
    const [products, setProducts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [fabricsMap, setFabricsMap] = useState({});
    const [hoveredRowId, setHoveredRowId] = useState(null);

    useEffect(() => { fetchProducts(); fetchFabricsMap(); }, []);

    const fetchFabricsMap = async () => { try { const res = await axios.get(`${API_BASE_URL}/api/fabrics`, { headers: { Authorization: `Bearer ${token}` } }); const map = {}; res.data.fabrics.forEach(f => map[f.id] = f.name); setFabricsMap(map); } catch (e) {} };
    const fetchProducts = async (search = searchTerm) => { try { const res = await axios.get(`${API_BASE_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` }, params: { search } }); setProducts(res.data.products || []); } catch (err) { console.error(err); } };
    
    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Deletar produto?')) return;
        try { await axios.delete(`${API_BASE_URL}/api/products/${id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchProducts(); showNotification('Produto excluído.'); } catch (err) { showNotification('Erro ao excluir.', 'error'); }
    };

    const handleEditClick = (e, product) => {
        if (e) e.stopPropagation();
        setProductToEdit(product);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={styles.searchBox}><span style={{marginRight:'10px', color:'#94a3b8'}}>{Icons.Search}</span><input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyUp={e => e.key === 'Enter' && fetchProducts(searchTerm)} style={styles.searchInput} /></div>
                <button onClick={() => { setProductToEdit(null); setIsModalOpen(true); }} style={styles.addButton}><span style={{marginRight:'8px', display:'flex'}}>{Icons.Plus}</span> Novo Produto</button>
            </div>
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nome</th>
                            <th style={styles.th}>Estrutura</th>
                            <th style={styles.th}>Impressão / Acabamento</th>
                            <th style={styles.th}>Malha Padrão</th>
                            <th style={styles.th}>Preço Base Sugerido</th>
                            <th style={{...styles.th, textAlign:'right'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length === 0 ? <tr><td colSpan="6" style={{padding:'30px', textAlign:'center', color:'#64748b'}}>Nenhum produto.</td></tr> :
                        products.map(p => {
                            const printingTypes = normalizePrintingTypes(p.printing_types_json);
                            return (
                                <tr 
                                    key={p.id} 
                                    onClick={(e) => handleEditClick(e, p)} 
                                    onMouseEnter={() => setHoveredRowId(p.id)}
                                    onMouseLeave={() => setHoveredRowId(null)}
                                    style={{ ...styles.tr, ...(hoveredRowId === p.id ? styles.trHover : {}) }}
                                >
                                    <td style={{...styles.td, fontWeight:600}}>{p.name}</td>
                                    <td style={styles.td}>
                                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{buildProductTypeSummary(p)}</div>
                                        <small style={{ color:'#64748b' }}>{buildProductProductionSummary(p, p.tecido_principal_id ? fabricsMap[p.tecido_principal_id] : '')}</small>
                                    </td>
                                    <td style={styles.td}>
                                        {printingTypes.length > 0 ? (
                                            <div style={styles.tableTagsWrap}>
                                                {printingTypes.map((item) => <span key={item} style={styles.tableTag}>{item}</span>)}
                                            </div>
                                        ) : <span style={{color:'#cbd5e1'}}>-</span>}
                                    </td>
                                    <td style={styles.td}>{p.tecido_principal_id ? fabricsMap[p.tecido_principal_id] : <span style={{color:'#cbd5e1'}}>-</span>}</td>
                                    <td style={styles.td}>R$ {Number(p.sale_price).toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign:'right'}}>
                                        <div style={styles.actionButtons}>
                                            <button onClick={(e) => handleEditClick(e, p)} style={styles.iconButton} title="Editar">{Icons.Edit}</button>
                                            <button onClick={(e) => handleDelete(e, p.id)} style={{...styles.iconButton, color:'#DC2626'}} title="Excluir">{Icons.Trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={productToEdit ? 'Editar Produto' : 'Novo Produto'}>
                <ProductForm productToEdit={productToEdit} onClose={() => setIsModalOpen(false)} onSave={() => fetchProducts(searchTerm)} />
            </Modal>
        </div>
    );
};

// =====================================================================================
// 🚀 PÁGINA PRINCIPAL
// =====================================================================================
const Products = () => {
    const [activeTab, setActiveTab] = useState('products');
    return (
        <div style={styles.mainContainer}>
            <div style={styles.header}><div style={{display:'flex', alignItems:'center', gap:'15px'}}><div style={styles.iconBox}>{Icons.Box}</div><div><h2 style={styles.title}>Catálogo e Materiais</h2><p style={styles.subtitle}>Gestão de produtos e cadastro de malhas.</p></div></div></div>
            <div style={styles.tabsBar}>
                <button onClick={() => setActiveTab('products')} style={{ ...styles.tabButton, borderBottom: activeTab === 'products' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'products' ? '#2563eb' : '#64748b' }}><span style={{marginRight:'8px', display:'inline-flex', alignItems:'center'}}>{Icons.Box}</span> Produtos (Peças)</button>
                <button onClick={() => setActiveTab('fabrics')} style={{ ...styles.tabButton, borderBottom: activeTab === 'fabrics' ? '3px solid #2563eb' : '3px solid transparent', color: activeTab === 'fabrics' ? '#2563eb' : '#64748b' }}><span style={{marginRight:'8px', display:'inline-flex', alignItems:'center'}}>{Icons.Fabric}</span> Malhas (Tecidos)</button>
            </div>
            {activeTab === 'products' ? <ProductsManager /> : <FabricsManager />}
        </div>
    );
};

const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", maxWidth: '1600px', margin: '0 auto', paddingBottom: '40px' },
    header: { marginBottom: '20px' },
    title: { color: '#0f172a', fontSize: '1.5rem', fontWeight: '700', margin: 0 },
    subtitle: { margin:0, color:'#64748b', fontSize:'0.9rem' },
    iconBox: { padding:'12px', background:'#ECFDF5', borderRadius:'10px', color:'#059669', display:'flex' },
    tabsBar: { display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
    tabButton: { background: 'none', border: 'none', padding: '10px 14px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display:'flex', alignItems:'center', whiteSpace: 'nowrap' },
    addButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display:'flex', alignItems:'center', minHeight: '44px' },
    submitButton: { padding: '12px 24px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' },
    cancelButton: { padding: '12px 24px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '600' },
    input: { width: '100%', padding: '12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' },
    select: { width: '100%', padding: '12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.95rem', backgroundColor:'white', outline: 'none' },
    secondaryButton: { padding: '12px 18px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap' },
    searchBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', width: 'min(100%, 300px)', flex: '1 1 220px' },
    searchInput: { border: 'none', outline: 'none', width: '100%', padding: '10px 0', fontSize: '0.9rem' },
    tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
    th: { backgroundColor: '#f8fafc', padding: '16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase' },
    td: { padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.9rem' },
    
    tr: { transition: 'all 0.1s ease-in-out', cursor: 'pointer' },
    trHover: { backgroundColor: '#F8FAFC', transform: 'scale(1)' }, 
    
    actionButtons: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
    iconButton: { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', fontSize:'1.1rem', color:'#64748b', transition:'color 0.2s', ':hover':{color:'#2563eb'} },
    
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' },
    helperText: { margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 },
    inlineToggleCard: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC' },
    disabledInfoCard: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '10px', border: '1px dashed #CBD5E1', background: '#F8FAFC' },
    checkboxRow: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', color: '#0F172A' },
    presetTagsWrap: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' },
    presetTag: { padding: '10px 14px', borderRadius: '999px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease' },
    presetTagActive: { background: '#DBEAFE', border: '1px solid #60A5FA', color: '#1D4ED8' },
    customTagRow: { display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' },
    selectedTagsWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', minHeight: '28px', alignItems: 'center' },
    selectedTag: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0F172A', color: '#FFFFFF', borderRadius: '999px', padding: '8px 12px', fontSize: '0.82rem', fontWeight: '700' },
    selectedTagRemove: { border: 'none', background: 'transparent', color: '#FFFFFF', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 },
    tableTagsWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    tableTag: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #BFDBFE' },
    sectionTitle: { margin: '20px 0 10px 0', fontSize: '1rem', color: '#0F172A', fontWeight: '800', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' },
    formActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '20px', marginTop: '10px', flexWrap: 'wrap' }
};

export default Products;
