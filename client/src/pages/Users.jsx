import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

// ============================================================================
// --- /assets/Icons.js ---
// ============================================================================
const Icons = {
    Plus: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Edit: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    Trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3 0V5a2 2 0 012-2h0a2 2 0 012 2v2"/></svg>,
};

// ============================================================================
// --- /services/userService.js ---
// ============================================================================
const UserService = {
    getHeaders: (token) => ({ headers: { Authorization: `Bearer ${token}` } }),
    
    fetchUsers: (api, token) => axios.get(`${api}/api/users`, UserService.getHeaders(token)),
    
    createUser: (api, token, userData) => axios.post(`${api}/api/users`, userData, UserService.getHeaders(token)),
    
    updateUser: (api, token, id, userData) => {
        const payload = { ...userData };
        delete payload.id;
        delete payload.email; // E-mail não pode ser editado
        return axios.put(`${api}/api/users/${id}`, payload, UserService.getHeaders(token));
    },

    deleteUser: (api, token, id) => axios.delete(`${api}/api/users/${id}`, UserService.getHeaders(token))
};

// ============================================================================
// --- /hooks/useUsers.js ---
// ============================================================================
const useUsers = (API_BASE_URL, token) => {
    const [state, setState] = useState({ users: [], loading: true, error: null });

    const loadUsers = useCallback(async () => {
        if (!token) return;
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const response = await UserService.fetchUsers(API_BASE_URL, token);
            setState({ users: response.data.users || [], loading: false, error: null });
        } catch (err) {
            setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar usuários.' }));
        }
    }, [API_BASE_URL, token]);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    return { ...state, refreshUsers: loadUsers };
};

// ============================================================================
// --- /components/users/UserFormModal.jsx ---
// ============================================================================
const UserFormModal = React.memo(({ isOpen, onClose, userToEdit, onSave, API_BASE_URL, token }) => {
    const initialState = useMemo(() => ({ name: '', email: '', password: '', role: 'costura', salary: '', birth_date: '' }), []);
    const [formData, setFormData] = useState(initialState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Preenche o formulário quando abre para edição ou zera se for criação
    useEffect(() => {
        if (isOpen) {
            if (userToEdit) {
                const formattedDate = userToEdit.birth_date ? new Date(userToEdit.birth_date).toISOString().split('T')[0] : '';
                setFormData({ ...userToEdit, birth_date: formattedDate });
            } else {
                setFormData(initialState);
            }
        }
    }, [isOpen, userToEdit, initialState]);

    const handleFormChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (userToEdit) {
                await UserService.updateUser(API_BASE_URL, token, userToEdit.id, formData);
                Swal.fire({ title: 'Atualizado!', text: `Usuário ${formData.name} atualizado com sucesso.`, icon: 'success', showConfirmButton: false, timer: 2500 });
            } else {
                await UserService.createUser(API_BASE_URL, token, formData);
                Swal.fire({ title: 'Criado!', text: 'Usuário criado com sucesso.', icon: 'success', showConfirmButton: false, timer: 2500 });
            }
            onSave();
            onClose();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || `Erro ao ${userToEdit ? 'atualizar' : 'criar'} usuário`;
            Swal.fire('Falha ao salvar', errorMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={userToEdit ? `Editar Usuário: ${userToEdit.name}` : 'Cadastrar Novo Funcionário'}>
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Nome Completo</label>
                    <input name="name" value={formData.name || ''} onChange={handleFormChange} style={styles.input} required />
                </div>
                
                <div style={styles.formGroup}>
                    <label style={styles.label}>E-mail (Login)</label>
                    <input 
                        type="email" 
                        name="email" 
                        value={formData.email || ''} 
                        onChange={handleFormChange} 
                        style={{...styles.input, backgroundColor: userToEdit ? '#f3f4f6' : 'white', color: userToEdit ? '#9ca3af' : 'inherit'}} 
                        required 
                        disabled={!!userToEdit} 
                    />
                    {userToEdit && <small style={{ color: '#6b7280', marginTop: '5px' }}>O e-mail não pode ser editado.</small>}
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Senha {userToEdit ? '(Deixe em branco para manter)' : '(Obrigatória)'}</label>
                    <input type="password" name="password" value={formData.password || ''} onChange={handleFormChange} style={styles.input} required={!userToEdit} />
                </div>

                <div style={styles.row}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Cargo</label>
                        <select name="role" value={formData.role || 'costura'} onChange={handleFormChange} style={styles.select} required>
                            <option value="admin">Administrador</option>
                            <option value="gerente">Gerente de Produção</option>
                            <option value="designer">Designer / Arte</option>
                            <option value="corte">Corte</option>
                            <option value="impressao">Impressão</option>
                            <option value="estampa">Estampa / Sublimação</option>
                            <option value="costura">Costura</option>
                            <option value="qualidade">Controle de Qualidade</option>
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Salário (R$)</label>
                        <input type="number" name="salary" value={formData.salary || ''} onChange={handleFormChange} style={styles.input} step="0.01" />
                    </div>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Data de Nascimento</label>
                    <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleFormChange} style={styles.input} />
                </div>

                <button type="submit" style={{...styles.submitButton, opacity: isSubmitting ? 0.7 : 1}} disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : (userToEdit ? 'Salvar Alterações' : 'Salvar Funcionário')}
                </button>
            </form>
        </Modal>
    );
});

// ============================================================================
// --- /components/users/UsersTable.jsx ---
// ============================================================================
const UsersTable = React.memo(({ users, onEditClick, onDeleteClick }) => {
    const [hoveredRowId, setHoveredRowId] = useState(null);

    if (users.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white' }}>Nenhum usuário cadastrado.</div>;
    }

    return (
        <div style={styles.tableContainer}>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>ID</th>
                        <th style={styles.th}>Nome</th>
                        <th style={styles.th}>E-mail</th>
                        <th style={styles.th}>Cargo</th>
                        <th style={styles.th}>Salário</th>
                        <th style={{...styles.th, textAlign: 'right'}}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr 
                            key={user.id} 
                            style={{ ...styles.tr, ...(hoveredRowId === user.id ? styles.trHover : {}) }}
                            onClick={() => onEditClick(user)}
                            onMouseEnter={() => setHoveredRowId(user.id)}
                            onMouseLeave={() => setHoveredRowId(null)}
                        >
                            <td style={styles.td}>
                                <span style={{ color: '#94a3b8', fontWeight: '600', fontSize: '0.85rem' }}>#{user.id}</span>
                            </td>
                            <td style={{ ...styles.td, fontWeight: '700', color: '#1e293b' }}>{user.name}</td>
                            <td style={styles.td}>{user.email}</td>
                            <td style={styles.td}>
                                <span style={styles.roleTag}>{user.role}</span>
                            </td>
                            <td style={{ ...styles.td, fontWeight: '500' }}>
                                {user.salary ? `R$ ${parseFloat(user.salary).toFixed(2)}` : <span style={{ color: '#cbd5e1' }}>-</span>}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                <button
                                    type="button"
                                    className="users-icon-button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onEditClick(user);
                                    }}
                                    style={styles.actionButton}
                                    aria-label={`Editar usuário ${user.name}`}
                                >
                                    {Icons.Edit}
                                </button>
                                <button
                                    type="button"
                                    className="users-icon-button users-icon-button-danger"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onDeleteClick(user);
                                    }}
                                    style={{ ...styles.actionButton, ...styles.deleteActionButton }}
                                    aria-label={`Excluir usuário ${user.name}`}
                                >
                                    {Icons.Trash}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

// ============================================================================
// --- /components/users/Users.jsx (Main Component) ---
// ============================================================================
const Users = () => {
    const { token, API_BASE_URL } = useAuth();
    const { users, loading, error, refreshUsers } = useUsers(API_BASE_URL, token);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);

    const handleOpenCreateModal = useCallback(() => {
        setUserToEdit(null);
        setIsModalOpen(true);
    }, []);

    const handleEditClick = useCallback((user) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    }, []);

    const handleDeleteClick = useCallback(async (user) => {
        const result = await Swal.fire({
            title: 'Confirmar exclusão?',
            text: `Deseja realmente excluir o usuário ${user.name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        try {
            await UserService.deleteUser(API_BASE_URL, token, user.id);
            await refreshUsers();
            Swal.fire({ title: 'Excluído!', text: 'Usuário removido do sistema.', icon: 'success', showConfirmButton: false, timer: 2500 });
        } catch (err) {
            Swal.fire('Falha ao excluir', err.response?.data?.error || 'Não foi possível excluir este usuário.', 'error');
        }
    }, [API_BASE_URL, token, refreshUsers]);

    if (loading) return <p style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando equipe...</p>;

    return (
        <div style={styles.mainContainer}>
            {/* ⭐ AQUI ENTROU A RECEITA DO TÍTULO PERFEITO ⭐ */}
            <header style={styles.header}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center' }}>
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </span>
                        Equipe e Acessos
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: '400', marginLeft: '38px' }}>
                        Gerencie permissões, salários e dados dos colaboradores.
                    </p>
                </div>
                <button type="button" onClick={handleOpenCreateModal} className="users-add-button" style={styles.addButton}>
                    <span style={{ marginRight: '6px', display: 'flex' }}>{Icons.Plus}</span> Novo Usuário
                </button>
            </header>

            {error && <p style={styles.error}>{error}</p>}

            <UsersTable users={users} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} />

            <UserFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                userToEdit={userToEdit} 
                onSave={refreshUsers}
                API_BASE_URL={API_BASE_URL}
                token={token}
            />
            <style>{`
                .users-add-button:hover {
                    background-color: #1d4ed8 !important;
                    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24) !important;
                    transform: translateY(-1px);
                }

                .users-add-button:active,
                .users-icon-button:active {
                    transform: translateY(0);
                }

                .users-icon-button:hover {
                    border-color: #93c5fd !important;
                    color: #2563eb !important;
                    background-color: #eff6ff !important;
                    transform: translateY(-1px);
                }

                .users-icon-button-danger:hover {
                    border-color: #fca5a5 !important;
                    color: #dc2626 !important;
                    background-color: #fef2f2 !important;
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// --- Global Styles ---
// ============================================================================
const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", padding: '20px', maxWidth: '1400px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    title: { color: '#0f172a', fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' },
    addButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '11px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.18)' },
    tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { backgroundColor: '#f8fafc', padding: '16px 20px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '0.9rem', verticalAlign: 'middle' },
    tr: { transition: 'background 0.15s ease', cursor: 'pointer' },
    trHover: { backgroundColor: '#f8fafc' },
    roleTag: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', border: '1px solid #bae6fd' },
    actionButton: { width: '36px', height: '36px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: 0, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    deleteActionButton: { color: '#dc2626', borderColor: '#fecaca', marginLeft: '8px' },
    error: { color: '#ef4444', marginBottom: '15px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', fontWeight: '500', border: '1px solid #fca5a5' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    formGroup: { display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' },
    row: { display: 'flex', gap: '20px' },
    label: { fontSize: '0.85rem', fontWeight: '600', color: '#334155' },
    input: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s', backgroundColor: '#fff', color: '#0f172a' },
    select: { padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', backgroundColor: 'white', outline: 'none', color: '#0f172a' },
    submitButton: { padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', marginTop: '10px', transition: 'background 0.2s', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }
};

export default Users;
