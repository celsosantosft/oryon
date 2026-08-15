import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';

const Icons = {
    Wallet: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Bank: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    ArrowUp: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
    ArrowDown: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
    Plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
    Trash: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    Check: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
    Search: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    ChevronDown: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>,
    ChevronUp: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>,
    User: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    History: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

const FinanceTransactions = () => {
    const { token, API_BASE_URL } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [orders, setOrders] = useState([]); 
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('A Receber'); 
    
    const [historyType, setHistoryType] = useState('Todas'); 
    const [searchQuery, setSearchQuery] = useState('');
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); 
    const [expandedOrders, setExpandedOrders] = useState({});

    // Centro de custo removido do estado inicial visível (mantido como vazio por segurança de banco)
    const initialFormState = {
        description: '',
        type: 'Despesa',
        amount: '',
        due_date: '',
        chart_of_account_id: '',
        cost_center_id: '',
        status: 'Pendente',
        repeat_count: '1',
        repeat_interval: 'monthly'
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchTransactions();
        fetchConfigData();
        fetchOrdersForNames();
    }, []); // eslint-disable-line

    const fetchTransactions = () => {
        axios.get(`${API_BASE_URL}/api/finance/transactions`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setTransactions(res.data))
            .catch(err => console.error("Erro", err));
    };

    const fetchConfigData = async () => {
        try {
            const accRes = await axios.get(`${API_BASE_URL}/api/finance/accounts`, { headers: { Authorization: `Bearer ${token}` } });
            setAccounts(accRes.data);
        } catch (error) { console.error(error); }
    };

    const fetchOrdersForNames = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/orders`, { headers: { Authorization: `Bearer ${token}` } });
            setOrders(res.data.orders || []);
        } catch (error) { console.error("Erro ao buscar pedidos para nomes", error); }
    };

    const formatISODate = (year, month, day) => {
        const safeMonth = String(month).padStart(2, '0');
        const safeDay = String(day).padStart(2, '0');
        return `${year}-${safeMonth}-${safeDay}`;
    };

    const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

    const shiftDateByInterval = (dateString, index, interval) => {
        if (!dateString || index === 0) return dateString;

        const [baseYear, baseMonth, baseDay] = dateString.split('-').map(Number);

        if (interval === 'monthly') {
            const monthOffset = (baseMonth - 1) + index;
            const targetYear = baseYear + Math.floor(monthOffset / 12);
            const targetMonthIndex = ((monthOffset % 12) + 12) % 12;
            const safeDay = Math.min(baseDay, getDaysInMonth(targetYear, targetMonthIndex));
            return formatISODate(targetYear, targetMonthIndex + 1, safeDay);
        }

        if (interval === 'yearly') {
            const targetYear = baseYear + index;
            const safeDay = Math.min(baseDay, getDaysInMonth(targetYear, baseMonth - 1));
            return formatISODate(targetYear, baseMonth, safeDay);
        }

        const nextDate = new Date(baseYear, baseMonth - 1, baseDay);
        const increment = interval === 'weekly' ? 7 * index : index;
        nextDate.setDate(nextDate.getDate() + increment);
        return formatISODate(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const repeatCount = Math.max(1, parseInt(formData.repeat_count || '1', 10) || 1);
            const repeatInterval = formData.repeat_interval || 'monthly';
            const basePayload = {
                description: formData.description.trim(),
                type: formData.type,
                status: formData.status,
                amount: formData.amount,
                due_date: formData.due_date,
                chart_of_account_id: formData.chart_of_account_id || '',
                cost_center_id: formData.cost_center_id || ''
            };

            const launches = Array.from({ length: repeatCount }, (_, index) => {
                const dueDate = shiftDateByInterval(basePayload.due_date, index, repeatInterval);
                return {
                    ...basePayload,
                    description: repeatCount > 1 ? `${basePayload.description} (${index + 1}/${repeatCount})` : basePayload.description,
                    due_date: dueDate,
                    payment_date: basePayload.status === 'Pago' ? dueDate : null
                };
            });

            await Promise.all(
                launches.map((payload) =>
                    axios.post(`${API_BASE_URL}/api/finance/transactions`, payload, { headers: { Authorization: `Bearer ${token}` } })
                )
            );

            Swal.fire({
                title: 'Sucesso',
                text: repeatCount > 1 ? `${repeatCount} lançamentos registrados com sucesso!` : 'Lançamento registrado!',
                icon: 'success',
                timer: 1700,
                showConfirmButton: false
            });
            fetchTransactions();
            setIsModalOpen(false);
            setFormData(initialFormState);
        } catch (error) { Swal.fire('Erro', 'Falha ao salvar.', 'error'); }
    };

    const handlePay = async (transaction) => {
        const today = new Date().toISOString().split('T')[0];
        const pendingAmount = Number(transaction?.amount || 0);
        const actionLabel = transaction?.type === 'Receita' ? 'receber' : 'pagar';

        const result = await Swal.fire({
            title: transaction?.type === 'Receita' ? 'Registrar recebimento' : 'Registrar pagamento',
            html: `
                <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:0.9rem; color:#475569;">
                        Valor pendente: <strong>R$ ${pendingAmount.toFixed(2)}</strong>
                    </div>
                    <input id="swal-paid-amount" class="swal2-input" type="number" step="0.01" min="0.01" max="${pendingAmount.toFixed(2)}" value="${pendingAmount.toFixed(2)}" placeholder="Valor da baixa">
                    <input id="swal-payment-date" class="swal2-input" type="date" value="${today}">
                    <input id="swal-payment-method" class="swal2-input" type="text" value="Dinheiro/PIX" placeholder="Forma de pagamento">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar baixa',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const paidAmount = parseFloat(document.getElementById('swal-paid-amount')?.value || '');
                const paymentDate = document.getElementById('swal-payment-date')?.value || '';
                const paymentMethod = (document.getElementById('swal-payment-method')?.value || '').trim();

                if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
                    Swal.showValidationMessage(`Informe um valor válido para ${actionLabel}.`);
                    return false;
                }

                if (paidAmount > pendingAmount) {
                    Swal.showValidationMessage('O valor informado não pode ser maior que o valor pendente.');
                    return false;
                }

                if (!paymentDate) {
                    Swal.showValidationMessage('Informe a data da baixa.');
                    return false;
                }

                return {
                    paid_amount: Number(paidAmount.toFixed(2)),
                    payment_date: paymentDate,
                    payment_method: paymentMethod || 'Dinheiro/PIX'
                };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await axios.put(
                `${API_BASE_URL}/api/finance/transactions/${transaction.id}/pay`,
                result.value,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            fetchTransactions();

            const isPartial = result.value.paid_amount < pendingAmount;
            Swal.fire({
                title: isPartial ? 'Baixa parcial!' : 'Baixada!',
                text: isPartial
                    ? `Foi baixado ${formatMoney(result.value.paid_amount)} e o restante continuou pendente.`
                    : 'Conta marcada como paga.',
                icon: 'success',
                timer: 1800,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Erro', error.response?.data?.error || 'Falha ao baixar conta.', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({ title: 'Excluir?', text: 'Deseja apagar este registro?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'Sim' });
        if (result.isConfirmed) {
            await axios.delete(`${API_BASE_URL}/api/finance/transactions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchTransactions();
        }
    };

    const toggleAccordion = (orderId) => {
        setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    const formatDate = (dateStr) => { if (!dateStr) return '-'; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; };

    const summary = useMemo(() => {
        let receitas = 0; let despesas = 0;
        transactions.forEach(t => {
            if (t.status === 'Pago') {
                if (t.type === 'Receita') receitas += parseFloat(t.amount);
                if (t.type === 'Despesa') despesas += parseFloat(t.amount);
            }
        });
        return { receitas, despesas, saldo: receitas - despesas };
    }, [transactions]);

    const processedData = useMemo(() => {
        const searchLower = searchQuery.toLowerCase();

        if (activeTab === 'Histórico') {
            const historyItems = transactions.filter(t => {
                if (t.status !== 'Pago') return false; 
                if (historyType === 'Receitas' && t.type !== 'Receita') return false;
                if (historyType === 'Despesas' && t.type !== 'Despesa') return false;
                const itemMonth = (t.payment_date || t.due_date || '').substring(0, 7);
                if (monthFilter && itemMonth !== monthFilter) return false;
                if (searchQuery && !t.description.toLowerCase().includes(searchLower)) return false;
                return true;
            }).sort((a, b) => new Date(b.payment_date || b.due_date) - new Date(a.payment_date || a.due_date));
            return { type: 'history', items: historyItems };
        }

        if (activeTab === 'A Pagar') {
            const pendingDespesas = transactions.filter(t => {
                if (t.type !== 'Despesa' || t.status === 'Pago') return false;
                if (searchQuery && !t.description.toLowerCase().includes(searchLower)) return false;
                return true;
            }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            return { type: 'payable', items: pendingDespesas };
        }

        if (activeTab === 'A Receber') {
            const pendingReceitas = transactions.filter(t => t.type === 'Receita');
            const groups = {};
            const avulsas = [];

            pendingReceitas.forEach(t => {
                const match = t.description.match(/(#ATOS-\d+)/);
                let orderId = match ? match[1] : null;
                
                let resolvedClientName = 'Cliente Avulso/Não Localizado';

                if (orderId) {
                    const linkedOrder = orders.find(o => o.tracking_code === orderId);
                    if (linkedOrder && linkedOrder.client_name) {
                        resolvedClientName = linkedOrder.client_name;
                    } else {
                        const regexFallback = t.description.match(/(#ATOS-\d+)(?:\s*(?:-|–)\s*(.*))?/);
                        if (regexFallback && regexFallback[2]) resolvedClientName = regexFallback[2].trim();
                    }
                }

                const matchesSearch = !searchQuery || 
                    t.description.toLowerCase().includes(searchLower) || 
                    resolvedClientName.toLowerCase().includes(searchLower) || 
                    (orderId && orderId.toLowerCase().includes(searchLower));

                if (orderId) {
                    if (!groups[orderId]) {
                        groups[orderId] = { orderId, clientName: resolvedClientName, total: 0, paid: 0, pending: 0, transactions: [], matchesSearch: false };
                    }
                    if (matchesSearch) groups[orderId].matchesSearch = true;

                    const val = parseFloat(t.amount);
                    groups[orderId].transactions.push(t);
                    groups[orderId].total += val;
                    if (t.status === 'Pago') groups[orderId].paid += val;
                    else groups[orderId].pending += val;
                } else {
                    if (matchesSearch && t.status !== 'Pago') avulsas.push(t);
                }
            });

            const groupedArray = Object.values(groups)
                .map(g => {
                    let overallStatus = 'Pendente';
                    if (g.pending === 0 && g.paid > 0) overallStatus = 'Pago';
                    else if (g.paid > 0 && g.pending > 0) overallStatus = 'Parcial';
                    return { ...g, overallStatus };
                })
                .filter(g => g.overallStatus !== 'Pago' && g.matchesSearch);

            return { type: 'receivable', groups: groupedArray, avulsas };
        }
    }, [transactions, activeTab, searchQuery, monthFilter, orders, historyType]);

    const openNewTransactionModal = () => {
        setFormData({ 
            ...initialFormState, 
            type: activeTab === 'A Receber' ? 'Receita' : 'Despesa' 
        });
        setIsModalOpen(true);
    };

    return (
        <div style={styles.mainContainer}>
            <style>{`
                .premium-input:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important; outline: none; }
                .tab-btn { transition: all 0.3s ease; display: flex; alignItems: center; gap: 8px; }
                .tab-btn:hover { background-color: #F8FAFC; border-radius: 8px; }
                .tab-active { border-bottom: 3px solid #3B82F6; color: #3B82F6; font-weight: 800; border-radius: 0; }
                .tab-active:hover { background-color: transparent; border-radius: 0; }
                .tab-inactive { border-bottom: 3px solid transparent; color: #64748B; font-weight: 600; }
                .row-hover:hover { background-color: #F8FAFC; cursor: pointer; }
                .sub-row:hover { background-color: #F1F5F9; }
            `}</style>

            <div style={styles.headerRow}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={styles.iconBox}>{Icons.Wallet}</div>
                    <div>
                        <h1 style={styles.pageTitle}>Contas e Transações</h1>
                        <p style={styles.subtitle}>Gerencie suas transações, pendências e fluxo de caixa</p>
                    </div>
                </div>
                <button onClick={openNewTransactionModal} style={styles.btnNovo}>
                    {Icons.Plus} Novo Lançamento
                </button>
            </div>

            <div style={styles.cardsGrid}>
                <div style={styles.mobillsCard}>
                    <div style={{...styles.cardIconBox, backgroundColor: '#3B82F6'}}>{Icons.Bank}</div>
                    <div style={styles.cardContent}>
                        <p style={styles.cardLabel}>Saldo em Caixa</p>
                        <h2 style={{...styles.cardValue, color: summary.saldo >= 0 ? '#0F172A' : '#EF4444'}}>{formatMoney(summary.saldo)}</h2>
                    </div>
                </div>
                <div style={styles.mobillsCard}>
                    <div style={{...styles.cardIconBox, backgroundColor: '#10B981'}}>{Icons.ArrowUp}</div>
                    <div style={styles.cardContent}>
                        <p style={styles.cardLabel}>Faturamento Global</p>
                        <h2 style={styles.cardValue}>{formatMoney(summary.receitas)}</h2>
                    </div>
                </div>
                <div style={styles.mobillsCard}>
                    <div style={{...styles.cardIconBox, backgroundColor: '#EF4444'}}>{Icons.ArrowDown}</div>
                    <div style={styles.cardContent}>
                        <p style={styles.cardLabel}>Despesas Pagas</p>
                        <h2 style={styles.cardValue}>{formatMoney(summary.despesas)}</h2>
                    </div>
                </div>
            </div>

            <div style={styles.controlsCard}>
                <div style={styles.tabsContainer}>
                    <button className={`tab-btn ${activeTab === 'A Receber' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('A Receber')} style={styles.tabButton}>
                        <span style={{color: activeTab === 'A Receber' ? '#3B82F6' : '#94A3B8'}}>{Icons.ArrowUp}</span> A Receber
                    </button>
                    <button className={`tab-btn ${activeTab === 'A Pagar' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('A Pagar')} style={styles.tabButton}>
                        <span style={{color: activeTab === 'A Pagar' ? '#EF4444' : '#94A3B8'}}>{Icons.ArrowDown}</span> A Pagar
                    </button>
                    <button className={`tab-btn ${activeTab === 'Histórico' ? 'tab-active' : 'tab-inactive'}`} onClick={() => {setActiveTab('Histórico'); setHistoryType('Todas');}} style={styles.tabButton}>
                        <span style={{color: activeTab === 'Histórico' ? '#8B5CF6' : '#94A3B8'}}>{Icons.History}</span> Histórico (Concluídos)
                    </button>
                </div>
                
                <div style={styles.filtersContainer}>
                    <div style={styles.searchBox}>
                        <span style={{ color: '#94A3B8' }}>{Icons.Search}</span>
                        <input type="text" placeholder={activeTab === 'A Receber' ? "Buscar Cliente ou Pedido..." : "Buscar descrição..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
                    </div>
                    
                    {activeTab === 'Histórico' && (
                        <div style={styles.subTabsContainer}>
                            <button onClick={() => setHistoryType('Todas')} style={{...styles.subTabBtn, backgroundColor: historyType === 'Todas' ? 'white' : 'transparent', color: historyType === 'Todas' ? '#0F172A' : '#64748B', boxShadow: historyType === 'Todas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}}>Todas</button>
                            <button onClick={() => setHistoryType('Receitas')} style={{...styles.subTabBtn, backgroundColor: historyType === 'Receitas' ? 'white' : 'transparent', color: historyType === 'Receitas' ? '#10B981' : '#64748B', boxShadow: historyType === 'Receitas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}}>Receitas</button>
                            <button onClick={() => setHistoryType('Despesas')} style={{...styles.subTabBtn, backgroundColor: historyType === 'Despesas' ? 'white' : 'transparent', color: historyType === 'Despesas' ? '#EF4444' : '#64748B', boxShadow: historyType === 'Despesas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}}>Despesas</button>
                        </div>
                    )}

                    {activeTab === 'Histórico' && (
                        <div style={styles.monthFilterBox}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748B' }}>Mês:</span>
                            <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontWeight: '700', color: '#0F172A', cursor: 'pointer' }} />
                        </div>
                    )}
                </div>
            </div>

            <div style={styles.tableCard}>
                <table style={styles.table}>
                    <thead>
                        {activeTab === 'A Receber' && (
                            <tr>
                                <th style={{...styles.th, width: '40px'}}></th>
                                <th style={styles.th}>Cliente / Origem</th>
                                <th style={styles.th}>Nº Pedido</th>
                                <th style={styles.th}>Situação</th>
                                <th style={styles.th}>Progresso do Pgto</th>
                                <th style={{...styles.th, textAlign: 'right'}}>Valor Total</th>
                            </tr>
                        )}
                        {activeTab === 'A Pagar' && (
                            <tr>
                                <th style={styles.th}>Descrição (A Pagar)</th>
                                <th style={styles.th}>Situação</th>
                                <th style={styles.th}>Categoria</th>
                                <th style={{...styles.th, textAlign: 'right'}}>Valor</th>
                                <th style={{...styles.th, textAlign: 'center'}}>Ações</th>
                            </tr>
                        )}
                        {activeTab === 'Histórico' && (
                            <tr>
                                <th style={styles.th}>Data de Pgto</th>
                                <th style={styles.th}>Descrição (Concluídos)</th>
                                <th style={styles.th}>Tipo</th>
                                <th style={styles.th}>Categoria</th>
                                <th style={{...styles.th, textAlign: 'right'}}>Valor</th>
                                <th style={{...styles.th, textAlign: 'center'}}>Ações</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        
                        {/* ================= ABA 1: A RECEBER (SANFONA) ================= */}
                        {activeTab === 'A Receber' && processedData.groups.map(group => {
                            const isExpanded = expandedOrders[group.orderId];
                            const percent = (group.paid / group.total) * 100;
                            return (
                                <React.Fragment key={group.orderId}>
                                    <tr className="row-hover" onClick={() => toggleAccordion(group.orderId)} style={{...styles.tr, backgroundColor: isExpanded ? '#F8FAFC' : 'white'}}>
                                        <td style={{...styles.td, color: '#94A3B8'}}>{isExpanded ? Icons.ChevronUp : Icons.ChevronDown}</td>
                                        <td style={{...styles.td, fontWeight: '600', color: '#334155', display:'flex', alignItems:'center', gap:'10px'}}>
                                            <span style={{color: '#94A3B8', display: 'flex'}}>{Icons.User}</span> {group.clientName.toUpperCase()}
                                        </td>
                                        <td style={{...styles.td, fontWeight: '700', color: '#3B82F6'}}>{group.orderId}</td>
                                        <td style={styles.td}><StatusBadge status={group.overallStatus} /></td>
                                        <td style={styles.td}>
                                            <div style={{width:'130px', backgroundColor:'#E2E8F0', height:'8px', borderRadius:'4px', overflow:'hidden', marginBottom: '4px'}}>
                                                <div style={{width:`${percent}%`, backgroundColor: percent === 100 ? '#10B981' : '#3B82F6', height:'100%'}}></div>
                                            </div>
                                            <span style={{fontSize:'0.75rem', color:'#64748B', fontWeight:'500'}}>{formatMoney(group.paid)} de {formatMoney(group.total)}</span>
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: '#0F172A'}}>{formatMoney(group.total)}</td>
                                    </tr>

                                    {isExpanded && group.transactions.map(t => (
                                        <tr key={t.id} className="sub-row" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                            <td></td>
                                            <td colSpan="2" style={{padding: '12px 24px', fontSize: '0.85rem', color: '#475569', display:'flex', alignItems:'center'}}>
                                                <div style={{width:'2px', height:'20px', backgroundColor:'#CBD5E1', marginRight:'12px'}}></div>
                                                {t.description.split('- Pedido')[0].trim()}
                                                <span style={{marginLeft:'10px', color:'#94A3B8', fontWeight: '500'}}>Venc: {formatDate(t.due_date)}</span>
                                            </td>
                                            <td style={{padding: '12px 24px'}}><span style={{fontSize: '0.75rem', fontWeight:'700', color: t.status === 'Pago' ? '#10B981' : '#F59E0B'}}>{t.status.toUpperCase()}</span></td>
                                            <td style={{padding: '12px 24px'}}></td>
                                            <td style={{padding: '12px 24px', textAlign: 'right'}}>
                                                <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'16px'}}>
                                                    <span style={{fontWeight: '600', color: '#334155'}}>{formatMoney(t.amount)}</span>
                                                    {t.status === 'Pendente' && <button onClick={(e) => { e.stopPropagation(); handlePay(t); }} style={{...styles.iconButton, color: '#10B981', backgroundColor: '#ECFDF5', padding: '4px 10px'}} title="Dar Baixa"><span style={{marginRight: '4px', display: 'flex'}}>{Icons.Check}</span> Baixar</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}

                        {/* Receitas Avulsas */}
                        {activeTab === 'A Receber' && processedData.avulsas.map(t => (
                            <tr key={t.id} style={styles.tr}>
                                <td style={styles.td}></td>
                                <td colSpan="2" style={{...styles.td, fontWeight: '600', color: '#334155'}}>{t.description} <span style={{fontSize:'0.75rem', color:'#64748B', fontWeight:'500', marginLeft:'8px'}}>{formatDate(t.due_date)}</span></td>
                                <td style={styles.td}><StatusBadge status={t.status} /></td>
                                <td style={styles.td}><span style={{fontSize:'0.75rem', color:'#94A3B8', fontStyle:'italic'}}>Lançamento Avulso</span></td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: '#10B981'}}>{formatMoney(t.amount)}</td>
                                <td style={{...styles.td, textAlign: 'center'}}>
                                    <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                                        {t.status === 'Pendente' && <button onClick={() => handlePay(t)} style={{...styles.iconButton, color: '#10B981', backgroundColor: '#ECFDF5'}}><span style={{marginRight: '4px', display: 'flex'}}>{Icons.Check}</span> Baixar</button>}
                                        <button onClick={() => handleDelete(t.id)} style={{...styles.iconButton, color: '#94A3B8'}} onMouseEnter={e=>e.currentTarget.style.color='#EF4444'} onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>{Icons.Trash}</button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {/* ================= ABA 2: A PAGAR ================= */}
                        {activeTab === 'A Pagar' && processedData.items.map(t => (
                            <tr key={t.id} style={styles.tr}>
                                <td style={{...styles.td, fontWeight: '600', color: '#334155'}}>{t.description} <br/><span style={{fontSize:'0.75rem', color:'#DC2626', fontWeight:'600'}}>Vence: {formatDate(t.due_date)}</span></td>
                                <td style={styles.td}><StatusBadge status={t.status} /></td>
                                <td style={styles.td}><span style={{fontSize:'0.85rem', color:'#64748B'}}>{t.account_name || 'Geral'}</span></td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: '#EF4444'}}>- {formatMoney(t.amount)}</td>
                                <td style={{...styles.td, textAlign: 'center'}}>
                                    <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                                        {t.status === 'Pendente' && <button onClick={() => handlePay(t)} style={{...styles.iconButton, color: '#10B981', backgroundColor: '#ECFDF5'}} title="Dar Baixa"><span style={{marginRight: '4px', display: 'flex'}}>{Icons.Check}</span> Pagar</button>}
                                        <button onClick={() => handleDelete(t.id)} style={{...styles.iconButton, color: '#94A3B8'}} onMouseEnter={e=>e.currentTarget.style.color='#EF4444'} onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>{Icons.Trash}</button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {/* ================= ABA 3: HISTÓRICO ================= */}
                        {activeTab === 'Histórico' && processedData.items.map(t => (
                            <tr key={t.id} style={styles.tr}>
                                <td style={{...styles.td, fontWeight: '600', color: '#0F172A'}}>{formatDate(t.payment_date || t.due_date)}</td>
                                <td style={{...styles.td, fontWeight: '500', color: '#334155'}}>{t.description}</td>
                                <td style={styles.td}>
                                    <span style={{ color: t.type === 'Receita' ? '#10B981' : '#EF4444', fontWeight: '700', fontSize: '0.85rem' }}>
                                        {t.type === 'Receita' ? '↑ Receita' : '↓ Despesa'}
                                    </span>
                                </td>
                                <td style={styles.td}><span style={{fontSize:'0.85rem', color:'#64748B'}}>{t.account_name || 'Geral'}</span></td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: t.type === 'Receita' ? '#10B981' : '#0F172A'}}>{t.type === 'Despesa' ? '- ' : ''}{formatMoney(t.amount)}</td>
                                <td style={{...styles.td, textAlign: 'center'}}>
                                    <button onClick={() => handleDelete(t.id)} style={{...styles.iconButton, color: '#94A3B8', margin: '0 auto'}} onMouseEnter={e=>e.currentTarget.style.color='#EF4444'} onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>{Icons.Trash}</button>
                                </td>
                            </tr>
                        ))}

                        {/* MENSAGENS VAZIAS */}
                        {activeTab === 'A Receber' && processedData.groups.length === 0 && processedData.avulsas.length === 0 && <tr><td colSpan="6" style={styles.emptyMessage}>Nenhuma pendência de recebimento no momento. 🎉</td></tr>}
                        {activeTab === 'A Pagar' && processedData.items.length === 0 && <tr><td colSpan="6" style={styles.emptyMessage}>Nenhuma conta a pagar no momento. 🎉</td></tr>}
                        {activeTab === 'Histórico' && processedData.items.length === 0 && <tr><td colSpan="6" style={styles.emptyMessage}>Nenhuma transação na categoria selecionada.</td></tr>}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Lançamento Avulso">
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={{backgroundColor: '#EFF6FF', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', color: '#1E3A8A', border: '1px solid #BFDBFE'}}>
                        <strong>Aviso:</strong> Para receber de pedidos, use a aba "A Receber". Use este formulário para registrar Despesas operacionais ou Receitas avulsas fora do sistema.
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Descrição *</label>
                        <input className="premium-input" type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={styles.input} placeholder="Ex: Conta de Luz, Fio/Linha..." required />
                    </div>
                    
                    <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Tipo *</label>
                            <select className="premium-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, chart_of_account_id: ''})} style={styles.select}>
                                <option value="Receita">Entrada (Receita)</option>
                                <option value="Despesa">Saída (Despesa)</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Valor (R$) *</label>
                            <input className="premium-input" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={styles.input} required />
                        </div>
                    </div>
                    
                    <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Situação Inicial *</label>
                            <select className="premium-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={styles.select}>
                                <option value="Pendente">A Pagar / A Receber (Pendente)</option>
                                <option value="Pago">Já Pago / Recebido</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Data *</label>
                            <input className="premium-input" type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} style={styles.input} required />
                        </div>
                    </div>

                    {/* ⭐ CAMPO PLANO DE CONTAS SOZINHO E CENTRALIZADO (SÓ APARECE EM DESPESA) ⭐ */}
                    {formData.type === 'Despesa' && (
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Plano de Contas / Categoria</label>
                            <select className="premium-input" value={formData.chart_of_account_id} onChange={e => setFormData({...formData, chart_of_account_id: e.target.value})} style={styles.select}>
                                <option value="">Geral / Sem Categoria</option>
                                {accounts.filter(a => a.type === 'Despesa').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div style={{ ...styles.formGroup, marginTop: '4px' }}>
                        <label style={styles.label}>Parcelamento / recorrência</label>
                        <div style={styles.recurrenceGrid}>
                            <div>
                                <input
                                    className="premium-input"
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={formData.repeat_count}
                                    onChange={e => setFormData({ ...formData, repeat_count: e.target.value })}
                                    style={styles.input}
                                />
                            </div>
                            <div>
                                <select
                                    className="premium-input"
                                    value={formData.repeat_interval}
                                    onChange={e => setFormData({ ...formData, repeat_interval: e.target.value })}
                                    style={styles.select}
                                >
                                    <option value="monthly">Mensal</option>
                                    <option value="weekly">Semanal</option>
                                    <option value="daily">Diária</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                        </div>
                        <span style={styles.formHint}>Use 10x para parcelas ou repita semanalmente quando for uma cobrança fixa.</span>
                    </div>

                    <button type="submit" style={{ padding: '16px', backgroundColor: formData.type === 'Receita' ? '#10B981' : '#EF4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>
                        {Number(formData.repeat_count || 1) > 1 ? 'Registrar lançamentos' : 'Registrar lançamento'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    let bg = '#F1F5F9', color = '#64748B', text = status;
    if (status === 'Pago') { bg = '#D1FAE5'; color = '#065F46'; text = 'PAGO'; }
    if (status === 'Pendente') { bg = '#FEF2F2'; color = '#991B1B'; text = 'PENDENTE'; }
    if (status === 'Parcial') { bg = '#FEF3C7'; color = '#92400E'; text = 'PAG. PARCIAL'; }
    return <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', backgroundColor: bg, color: color, letterSpacing: '0.05em' }}>{text}</span>;
};

const styles = {
    mainContainer: { fontFamily: "'Inter', sans-serif", maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
    pageTitle: { fontSize: 'clamp(1.35rem, 5vw, 1.8rem)', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '0' },
    subtitle: { margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '500' },
    iconBox: { padding: '14px', background: '#EFF6FF', borderRadius: '12px', color: '#2563EB', display: 'flex' },
    btnNovo: { backgroundColor: '#6366F1', color: 'white', padding: '12px 20px', borderRadius: '30px', border: 'none', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)', minHeight: '44px' },
    
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
    mobillsCard: { backgroundColor: 'white', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', minWidth: 0 },
    cardIconBox: { width: '48px', height: '48px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardContent: { flex: 1 },
    cardLabel: { fontSize: '0.85rem', color: '#64748B', margin: '0 0 4px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
    cardValue: { fontSize: '1.6rem', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },

    controlsCard: { backgroundColor: 'white', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '16px' },
    tabsContainer: { display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' },
    tabButton: { padding: '12px 14px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.95rem', outline: 'none', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', minHeight: '44px' },
    filtersContainer: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' },
    searchBox: { display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px', width: 'min(100%, 280px)', flex: '1 1 220px', backgroundColor: '#F8FAFC' },
    searchInput: { border: 'none', outline: 'none', backgroundColor: 'transparent', width: '100%', fontSize: '0.9rem', color: '#0F172A' },
    
    subTabsContainer: { display: 'flex', gap: '4px', backgroundColor: '#F8FAFC', padding: '4px', borderRadius: '8px', border: '1px solid #E2E8F0', overflowX: 'auto', maxWidth: '100%' },
    subTabBtn: { padding: '8px 12px', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' },
    monthFilterBox: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', maxWidth: '100%' },

    tableCard: { backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    th: { backgroundColor: '#F8FAFC', padding: '16px 24px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '16px 24px', borderBottom: '1px solid #F1F5F9', color: '#334155', fontSize: '0.95rem' },
    tr: { transition: 'all 0.15s ease' },
    emptyMessage: { padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '0.95rem', fontStyle: 'italic' },
    recurrenceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' },
    formHint: { display: 'block', marginTop: '10px', color: '#64748B', fontSize: '0.8rem', lineHeight: 1.5 },
    iconButton: { backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem' },

    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' },
    formGroup: { display: 'flex', flexDirection: 'column' },
    label: { marginBottom: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#334155' },
    input: { width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' },
    select: { width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box', cursor: 'pointer' }
};

export default FinanceTransactions;
