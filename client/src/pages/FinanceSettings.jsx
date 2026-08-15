import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';

// --- ÍCONES PREMIUM ---
const Icons = {
    Settings: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Plus: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Edit: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    Trash: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
};

const FinanceSettings = () => {
    const { token, API_BASE_URL } = useAuth();
    
    // --- ESTADOS DO PLANO DE CONTAS ---
    const [accounts, setAccounts] = useState([]);
    const [newAccountData, setNewAccountData] = useState({ name: '', type: 'Despesa' });
    
    // --- ESTADOS PARA EDIÇÃO ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState({ id: null, name: '', type: 'Despesa' });

    useEffect(() => {
        fetchAccounts();
    }, []); // eslint-disable-line

    // ==========================================
    // FUNÇÕES DE COMUNICAÇÃO COM O BANCO DE DADOS
    // ==========================================
    
    const fetchAccounts = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/finance/accounts`, { headers: { Authorization: `Bearer ${token}` } });
            setAccounts(res.data);
        } catch (error) { console.error("Erro ao buscar categorias:", error); }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();
        if (!newAccountData.name.trim()) return;
        
        try {
            await axios.post(`${API_BASE_URL}/api/finance/accounts`, newAccountData, { headers: { Authorization: `Bearer ${token}` } });
            setNewAccountData({ name: '', type: 'Despesa' }); // Limpa o formulário
            fetchAccounts(); // Atualiza a lista
            Swal.fire({ title: 'Adicionada!', text: 'Nova categoria criada com sucesso.', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) { Swal.fire('Erro', 'Falha ao adicionar categoria.', 'error'); }
    };

    const handleDeleteAccount = async (id) => {
        const result = await Swal.fire({ 
            title: 'Excluir categoria?', 
            text: 'Lançamentos antigos vinculados a esta categoria ficarão sem categoria (Geral).', 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#EF4444', 
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${API_BASE_URL}/api/finance/accounts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchAccounts();
                Swal.fire({ title: 'Excluída!', icon: 'success', timer: 1500, showConfirmButton: false });
            } catch (error) { Swal.fire('Erro', 'Não foi possível excluir.', 'error'); }
        }
    };

    const openEditModal = (account) => {
        setAccountToEdit({ id: account.id, name: account.name, type: account.type });
        setIsEditModalOpen(true);
    };

    const handleUpdateAccount = async (e) => {
        e.preventDefault();
        if (!accountToEdit.name.trim()) return;

        try {
            await axios.put(`${API_BASE_URL}/api/finance/accounts/${accountToEdit.id}`, 
                { name: accountToEdit.name, type: accountToEdit.type }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setIsEditModalOpen(false);
            fetchAccounts();
            Swal.fire({ title: 'Atualizada!', text: 'Categoria alterada com sucesso.', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) { Swal.fire('Erro', 'Falha ao atualizar categoria.', 'error'); }
    };

    return (
        <div style={styles.mainContainer}>
            <style>{`
                .premium-input:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important; outline: none; }
                .list-item { transition: background-color 0.2s; }
                .list-item:hover { background-color: #F8FAFC; }
                .icon-btn { color: #94A3B8; transition: all 0.2s; }
                .icon-btn.edit:hover { color: #3B82F6; transform: scale(1.1); }
                .icon-btn.trash:hover { color: #EF4444; transform: scale(1.1); }
            `}</style>

            {/* CABEÇALHO */}
            <div style={styles.headerRow}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={styles.iconBox}>{Icons.Settings}</div>
                    <div>
                        <h1 style={styles.pageTitle}>Configurações Financeiras</h1>
                        <p style={styles.subtitle}>Estrutura do Plano de Contas e Categorias</p>
                    </div>
                </div>
            </div>

            {/* ÁREA CENTRALIZADA: PLANO DE CONTAS */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <div style={styles.cardContainer}>
                    
                    <div style={styles.cardHeader}>
                        <h2 style={styles.cardTitle}>Plano de Contas (Categorias)</h2>
                        <p style={styles.cardSubtitle}>Organize suas Receitas e Despesas para gerar os gráficos corretamente.</p>
                    </div>

                    {/* FORMULÁRIO DE ADIÇÃO (NO TOPO) */}
                    <div style={styles.addFormContainer}>
                        <form onSubmit={handleAddAccount} style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                            <select 
                                className="premium-input" 
                                value={newAccountData.type} 
                                onChange={(e) => setNewAccountData({...newAccountData, type: e.target.value})} 
                                style={styles.selectInput}
                            >
                                <option value="Despesa">Despesa</option>
                                <option value="Receita">Receita</option>
                            </select>
                            
                            <input 
                                type="text" 
                                className="premium-input" 
                                placeholder="Ex: Compra de Tecido, Energia..." 
                                value={newAccountData.name} 
                                onChange={(e) => setNewAccountData({...newAccountData, name: e.target.value})} 
                                style={styles.textInput} 
                                required 
                            />
                            
                            <button type="submit" style={styles.addBtn} title="Adicionar Categoria">
                                {Icons.Plus}
                            </button>
                        </form>
                    </div>

                    {/* LISTA DE CATEGORIAS CADASTRADAS */}
                    <div style={styles.listContainer}>
                        {accounts.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>
                                Nenhuma categoria cadastrada ainda.
                            </div>
                        ) : (
                            accounts.map(acc => (
                                <div key={acc.id} className="list-item" style={styles.listItem}>
                                    <span style={styles.itemName}>{acc.name}</span>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: '800', 
                                            padding: '4px 8px', 
                                            borderRadius: '6px', 
                                            letterSpacing: '0.05em',
                                            backgroundColor: acc.type === 'Receita' ? '#D1FAE5' : '#FEE2E2',
                                            color: acc.type === 'Receita' ? '#059669' : '#DC2626'
                                        }}>
                                            {acc.type.toUpperCase()}
                                        </span>
                                        
                                        {/* ⭐ BOTÕES SVG (EDITAR E EXCLUIR) ⭐ */}
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => openEditModal(acc)} className="icon-btn edit" style={styles.actionBtn} title="Editar">
                                                {Icons.Edit}
                                            </button>
                                            <button onClick={() => handleDeleteAccount(acc.id)} className="icon-btn trash" style={styles.actionBtn} title="Excluir">
                                                {Icons.Trash}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>

            {/* MODAL DE EDIÇÃO */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Categoria">
                <form onSubmit={handleUpdateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Tipo da Conta</label>
                        <select 
                            className="premium-input" 
                            value={accountToEdit.type} 
                            onChange={(e) => setAccountToEdit({...accountToEdit, type: e.target.value})} 
                            style={{ ...styles.selectInput, width: '100%' }}
                        >
                            <option value="Despesa">Despesa (Saída)</option>
                            <option value="Receita">Receita (Entrada)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Nome da Categoria</label>
                        <input 
                            type="text" 
                            className="premium-input" 
                            value={accountToEdit.name} 
                            onChange={(e) => setAccountToEdit({...accountToEdit, name: e.target.value})} 
                            style={styles.textInput} 
                            required 
                        />
                    </div>

                    <button type="submit" style={{ padding: '14px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>
                        Salvar Alterações
                    </button>
                </form>
            </Modal>

        </div>
    );
};

// =========================================================
// ESTILOS (CSS in JS)
// =========================================================
const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' },
    
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
    pageTitle: { fontSize: '1.8rem', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },
    subtitle: { margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '500' },
    iconBox: { padding: '14px', background: '#EFF6FF', borderRadius: '12px', color: '#3B82F6', display: 'flex' },
    
    // Deixei o Card com max-width para ficar elegante e centralizado no meio da tela
    cardContainer: { backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', width: '100%', maxWidth: '800px', overflow: 'hidden' },
    cardHeader: { padding: '24px', borderBottom: '1px solid #F1F5F9' },
    cardTitle: { fontSize: '1.2rem', fontWeight: '800', color: '#0F172A', margin: '0 0 6px 0' },
    cardSubtitle: { fontSize: '0.85rem', color: '#64748B', margin: 0 },
    
    addFormContainer: { padding: '20px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' },
    selectInput: { padding: '12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.95rem', backgroundColor: 'white', outline: 'none', color: '#334155', cursor: 'pointer' },
    textInput: { flex: 1, padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: 'white', color: '#0F172A' },
    addBtn: { backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', height: '44px' },
    
    listContainer: { display: 'flex', flexDirection: 'column' },
    listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F1F5F9' },
    itemName: { fontSize: '0.95rem', fontWeight: '600', color: '#334155' },
    
    actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default FinanceSettings;