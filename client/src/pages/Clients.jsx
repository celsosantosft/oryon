import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';

// --- Ícones SVG ---
const Icons = {
    Plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    Edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    Search: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
    User: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    MapPin: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    Check: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
};

const SEGMENTS = ['Corporativo / Empresas', 'Escolar / Faculdades', 'Igrejas / Eventos Religiosos', 'Interclasse / Esportivo', 'Pessoa Física / Varejo', 'Outros'];

// --- Utilitários de Máscara ---
const maskPhone = (val) => val.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15);
const maskCEP = (val) => val.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
const maskDoc = (val) => {
    let v = val.replace(/\D/g, '');
    if (v.length <= 11) { return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); } 
    else { return v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18); }
};

// ============================================================================
// ⭐ DESEMPACOTADOR DE DADOS (Compatibilidade com Banco de Dados) ⭐
// ============================================================================
const packAddressData = (formData) => {
    return JSON.stringify({
        addr: formData.address || '',
        cep: formData.cep || '',
        doc: formData.document || '',
        seg: formData.segment || ''
    });
};

const unpackAddressData = (addressString) => {
    try {
        if (!addressString) throw new Error("Vazio");
        const parsed = JSON.parse(addressString);
        return {
            address: parsed.addr || '',
            cep: parsed.cep || '',
            document: parsed.doc || '',
            segment: parsed.seg || ''
        };
    } catch (e) {
        return { address: addressString || '', cep: '', document: '', segment: '' };
    }
};

// --- Cores Dinâmicas ---
const getSegmentStyle = (segment) => {
    switch (segment) {
        case 'Corporativo / Empresas': return { bg: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
        case 'Interclasse / Esportivo': return { bg: '#dcfce7', color: '#15803d', border: '1px solid #86efac' };
        case 'Igrejas / Eventos Religiosos': return { bg: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' };
        case 'Escolar / Faculdades': return { bg: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
        case 'Pessoa Física / Varejo': return { bg: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
        default: return { bg: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
    }
};

const initialState = { name: '', phone: '', email: '', document: '', cep: '', address: '', segment: '' };

const Clients = () => {
    const { token, API_BASE_URL } = useAuth();
    
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSegment, setFilterSegment] = useState('');
    const [hoveredRowId, setHoveredRowId] = useState(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clientToEdit, setClientToEdit] = useState(null);
    const [formData, setFormData] = useState(initialState);
    const [isCepLoading, setIsCepLoading] = useState(false);

    // =======================
    // Buscar clientes
    // =======================
    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
            
            const processedClients = (res.data.clients || []).map(c => {
                const unpacked = unpackAddressData(c.address);
                return {
                    ...c,
                    address: unpacked.address,
                    cep: unpacked.cep,
                    document: unpacked.document,
                    segment: unpacked.segment
                };
            });
            
            // ⭐ ORDEM ALFABÉTICA FORÇADA (A-Z) ⭐
            processedClients.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
            
            setClients(processedClients);
        } catch (error) {
            Swal.fire({ title: 'Ops!', text: 'Erro ao carregar a lista de clientes.', icon: 'error', customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' } });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const handleSearchChange = (e) => { setSearchTerm(e.target.value); };

    // ⭐ BUSCA AUTOMÁTICA DE CEP ⭐
    const searchCep = async (cepStr) => {
        const cleanCep = cepStr.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;
        
        setIsCepLoading(true);
        try {
            const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
            if (response.data && !response.data.erro) {
                setFormData(prev => ({
                    ...prev,
                    address: `${response.data.logradouro}, Bairro: ${response.data.bairro}, ${response.data.localidade} - ${response.data.uf}`
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar CEP', error);
        } finally {
            setIsCepLoading(false);
        }
    };

    const handleFormChange = (e) => {
        let { name, value } = e.target;
        if (name === 'phone') value = maskPhone(value);
        if (name === 'document') value = maskDoc(value);
        if (name === 'cep') {
            value = maskCEP(value);
            if (value.replace(/\D/g, '').length === 8) searchCep(value);
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = (client = null) => {
        setClientToEdit(client);
        setFormData(client || initialState);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // TRAVA: Exige o Segmento
        if (!formData.segment) {
            Swal.fire({
                title: 'Campo Obrigatório',
                text: 'Por favor, selecione um Segmento/Nicho antes de salvar.',
                icon: 'warning',
                confirmButtonText: 'Entendi',
                buttonsStyling: false,
                customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title', confirmButton: 'premium-btn-solid-blue' }
            });
            return;
        }

        const endpoint = clientToEdit ? `${API_BASE_URL}/api/clients/${clientToEdit.id}` : `${API_BASE_URL}/api/clients`;
        const method = clientToEdit ? 'PUT' : 'POST';
        const payload = { name: formData.name, phone: formData.phone, email: formData.email, address: packAddressData(formData) };

        // ⭐ ANIMAÇÃO DE LOADING DO SWEETALERT ⭐
        Swal.fire({
            title: 'Salvando...',
            text: 'Aguarde enquanto sincronizamos os dados.',
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' },
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            await axios({ method, url: endpoint, data: payload, headers: { Authorization: `Bearer ${token}` } });
            await fetchClients();
            setIsModalOpen(false);
            
            // ⭐ TRANSIÇÃO PARA SUCESSO ANIMADO ⭐
            Swal.fire({ 
                title: clientToEdit ? 'Atualizado!' : 'Cadastrado!', 
                text: 'Cliente salvo com sucesso no CRM.', 
                icon: 'success', 
                timer: 2500, 
                showConfirmButton: false, 
                customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' } 
            });
        } catch (error) {
            Swal.fire({ title: 'Erro', text: 'Falha ao salvar dados.', icon: 'error', customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' } });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Excluir Cliente?',
            html: `<p style="color: #64748B; font-size: 1.05rem; margin-top: 12px;">Remover <b>${name}</b> do sistema? Esta ação apagará o cadastro.</p>`,
            icon: 'warning',
            width: '540px', padding: '32px', showCancelButton: true, reverseButtons: true, buttonsStyling: false,
            confirmButtonText: `Sim, Excluir`, cancelButtonText: `Cancelar`,
            customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title', actions: 'premium-swal-actions', confirmButton: 'premium-btn-danger-solid', cancelButton: 'premium-btn-outline-gray' }
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${API_BASE_URL}/api/clients/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchClients();
                Swal.fire({ title: 'Excluído!', text: 'O cliente foi removido.', icon: 'success', timer: 2500, showConfirmButton: false, customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' } });
            } catch (error) {
                Swal.fire({ title: 'Falha', text: 'Erro ao tentar excluir.', icon: 'error', customClass: { popup: 'premium-swal-popup', title: 'premium-swal-title' } });
            }
        }
    };

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm));
        const matchesSegment = filterSegment === '' || c.segment === filterSegment;
        return matchesSearch && matchesSegment;
    });

    return (
        <div style={styles.mainContainer}>
            
            {/* INJEÇÃO DE MICROINTERAÇÕES E ESTILOS PREMIUM */}
            <style>{`
                .premium-input { transition: all 0.2s ease-in-out; }
                .premium-input:focus { outline: none !important; border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important; background-color: #fff !important; }
                
                /* NOVOS BOTÕES PADRÃO "APROVAR ORÇAMENTO" PARA O MODAL */
                .premium-btn-solid-green {
                    background-color: #10B981 !important; color: white !important; border: none !important;
                    border-radius: 8px !important; font-weight: 600 !important; font-size: 0.95rem !important;
                    transition: all 0.2s ease !important; cursor: pointer !important; outline: none !important;
                }
                .premium-btn-solid-green:hover { background-color: #059669 !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25) !important; }
                
                .premium-btn-solid-blue { background-color: #3B82F6 !important; color: white !important; border: none !important; padding: 12px 24px !important; border-radius: 8px !important; cursor: pointer; font-weight: 600 !important; font-size: 0.95rem !important; }
                
                .premium-btn { transition: all 0.2s ease; }
                .premium-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.25); background-color: #1D4ED8 !important; }
                .premium-btn:active { transform: translateY(0); box-shadow: none; }
                
                .premium-swal-popup { border-radius: 24px !important; font-family: 'Inter', sans-serif !important; }
                .premium-swal-title { font-size: 1.6rem !important; color: #0F172A !important; font-weight: 800 !important; }
                .premium-swal-actions { display: flex !important; flex-direction: row !important; gap: 16px !important; width: 100% !important; justify-content: center !important; margin-top: 36px !important; }
                .premium-btn-danger-solid, .premium-btn-outline-gray { display: flex !important; align-items: center !important; justify-content: center !important; padding: 12px 28px !important; border-radius: 8px !important; font-weight: 600 !important; font-size: 0.95rem !important; transition: all 0.2s ease !important; cursor: pointer !important; outline: none !important; flex: 1 !important; }
                .premium-btn-danger-solid { background-color: #EF4444 !important; color: white !important; border: none !important; }
                .premium-btn-danger-solid:hover { background-color: #DC2626 !important; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3) !important; transform: translateY(-1px); }
                .premium-btn-outline-gray { background-color: transparent !important; border: 1.5px solid #CBD5E1 !important; color: #64748B !important; }
                .premium-btn-outline-gray:hover { background-color: #F8FAFC !important; color: #0F172A !important; border-color: #94A3B8 !important; }
            `}</style>

            {/* CABEÇALHO */}
            <div style={styles.header}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={styles.iconBox}>{Icons.User}</div>
                    <div>
                        <h2 style={styles.title}>CRM de Clientes</h2>
                        <p style={styles.subtitle}>Gerencie sua base de contatos e nichos</p>
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="premium-btn" style={styles.addButton}>
                    <span style={{marginRight:'8px', display:'flex'}}>{Icons.Plus}</span> Novo Cliente
                </button>
            </div>

            {/* BARRA DE PESQUISA E FILTROS */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={styles.searchBox}>
                    <span style={{marginRight:'10px', color:'#94a3b8'}}>{Icons.Search}</span>
                    <input className="premium-input" placeholder="Buscar por nome ou WhatsApp..." value={searchTerm} onChange={handleSearchChange} style={styles.searchInput} />
                </div>
                <div style={styles.filterBox}>
                    <select className="premium-input" value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)} style={styles.filterSelect}>
                        <option value="">Todos os Segmentos</option>
                        {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* TABELA DE CLIENTES */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nome / Empresa</th>
                            <th style={styles.th}>Segmento</th>
                            <th style={styles.th}>Contato</th>
                            <th style={styles.th}>Localização</th>
                            <th style={{...styles.th, textAlign:'right'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={styles.emptyMessage}>Carregando clientes...</td></tr>
                        ) : filteredClients.length === 0 ? (
                            <tr><td colSpan="5" style={styles.emptyMessage}>Nenhum cliente encontrado.</td></tr>
                        ) : (
                            filteredClients.map(c => {
                                const isHovered = hoveredRowId === c.id;
                                const segStyle = getSegmentStyle(c.segment);
                                return (
                                    <tr key={c.id} style={{ ...styles.tr, ...(isHovered ? styles.trHover : {}) }} onMouseEnter={() => setHoveredRowId(c.id)} onMouseLeave={() => setHoveredRowId(null)}>
                                        <td style={{...styles.td, fontWeight:600}}>
                                            {c.name}
                                            {c.document && <span style={{display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500'}}>{c.document}</span>}
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: segStyle.bg, color: segStyle.color, border: segStyle.border }}>
                                                {c.segment || 'Geral'}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            {c.phone || '-'}
                                            {c.email && <span style={{display: 'block', fontSize: '0.75rem', color: '#64748b'}}>{c.email}</span>}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.address}>
                                                {c.address || '-'}
                                            </div>
                                        </td>
                                        <td style={{...styles.td, textAlign:'right'}}>
                                            <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                                                <button onClick={() => handleOpenModal(c)} style={styles.iconButton} title="Editar">{Icons.Edit}</button>
                                                <button onClick={() => handleDelete(c.id, c.name)} style={{...styles.iconButton, color:'#DC2626'}} title="Excluir">{Icons.Trash}</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* ⭐ MODAL DE CADASTRO/EDIÇÃO (GRID COMPACTO SEM ROLAGEM) ⭐ */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={clientToEdit ? 'Ficha do Cliente' : 'Novo Cadastro'}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <h4 style={styles.sectionTitle}>Dados Principais</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Nome ou Razão Social *</label>
                            <input className="premium-input" name="name" value={formData.name} onChange={handleFormChange} style={styles.input} required placeholder="Ex: Colégio Santa Maria" />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Segmento / Nicho *</label>
                            <select className="premium-input" name="segment" value={formData.segment || ''} onChange={handleFormChange} style={styles.select} required>
                                <option value="">Selecione...</option>
                                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px' }}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>CPF / CNPJ</label>
                            <input className="premium-input" name="document" value={formData.document || ''} onChange={handleFormChange} style={styles.input} placeholder="000.000.000-00" />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Telefone / WhatsApp</label>
                            <input className="premium-input" name="phone" value={formData.phone} onChange={handleFormChange} style={styles.input} placeholder="(00) 00000-0000" />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Email</label>
                            <input className="premium-input" name="email" value={formData.email} onChange={handleFormChange} style={styles.input} type="email" placeholder="contato@empresa.com" />
                        </div>
                    </div>

                    <h4 style={styles.sectionTitle}>Localização</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '12px' }}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>CEP <span style={{fontSize: '0.65rem', color: '#94A3B8', fontWeight: '400'}}>(Automático)</span></label>
                            <div style={{ display: 'flex', width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                                <input className="premium-input" name="cep" value={formData.cep || ''} onChange={handleFormChange} style={{...styles.input, border: 'none', borderRadius: '0', flex: 1, backgroundColor: 'transparent'}} placeholder="00000-000" />
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: isCepLoading ? '#2563EB' : '#94A3B8' }}>
                                    {isCepLoading ? '...' : Icons.MapPin}
                                </div>
                            </div>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Endereço Completo</label>
                            <input className="premium-input" name="address" value={formData.address} onChange={handleFormChange} style={styles.input} placeholder="Rua, Número, Bairro, Cidade - UF" />
                        </div>
                    </div>

                    {/* ⭐ BOTÕES LADO A LADO PADRÃO 'APROVAR ORÇAMENTO' COM ÍCONES SVG ⭐ */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #E2E8F0', marginTop: '16px', paddingTop: '20px' }}>
                        <button type="button" onClick={() => setIsModalOpen(false)} className="premium-btn-outline-gray" style={{ flex: 'none' }}>
                            Cancelar
                        </button>
                        <button type="submit" className="premium-btn-solid-green" style={{ flex: 'none', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {clientToEdit ? Icons.Edit : Icons.Check}
                            {clientToEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// --- ESTILOS GLOBAIS ---
const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    title: { color: '#0f172a', fontSize: '1.75rem', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.02em' },
    subtitle: { margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '500' },
    iconBox: { padding: '12px', background: '#EFF6FF', borderRadius: '10px', color: '#2563EB', display: 'flex' },
    searchBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', width: '350px' },
    searchInput: { border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem', color: '#334155', backgroundColor: 'transparent' },
    filterBox: { display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', minWidth: '220px' },
    filterSelect: { border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' },
    addButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: '0.95rem' },
    tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    th: { backgroundColor: '#f8fafc', padding: '16px 24px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.95rem' },
    tr: { transition: 'background-color 0.15s ease' },
    trHover: { backgroundColor: '#F8FAFC' }, 
    emptyMessage: { padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.95rem' },
    iconButton: { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '6px', color: '#64748b', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    
    // Form adjustments
    sectionTitle: { margin: '10px 0 0 0', fontSize: '0.85rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' },
    formGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '4px', fontWeight: '700', fontSize: '0.8rem', color: '#334155' },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' },
    select: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }
};

export default Clients;