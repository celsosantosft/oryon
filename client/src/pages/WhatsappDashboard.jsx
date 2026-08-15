import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Icons = {
    Message: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19.5V6.75A3.75 3.75 0 0 1 8.75 3h6.5A3.75 3.75 0 0 1 19 6.75v6.5A3.75 3.75 0 0 1 15.25 17H8.5L5 19.5Z" />
        </svg>
    ),
    Automation: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h7M4 17h7M15 7h5M15 17h5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM11 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
        </svg>
    ),
    Qr: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2v-2ZM18 14h2v6h-4v-2h2v-4ZM14 18h2v2h-2v-2Z" />
        </svg>
    ),
    Power: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 6.75a8 8 0 1 0 10 0" />
        </svg>
    ),
    Save: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h12l2 2v14H5V4Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v6h8V4M8 16h8" />
        </svg>
    ),
    Link: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1 1" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1-1" />
        </svg>
    ),
    Archive: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M6 7v13h12V7M5 4h14v3H5V4Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11h4" />
        </svg>
    ),
    Refresh: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-4h-4" />
        </svg>
    ),
    Funnel: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
        </svg>
    ),
    Settings: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.06a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.66-1.1H3a2.1 2.1 0 0 1 0-4.2h.06A1.8 1.8 0 0 0 4.72 8.6a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 0 1 2.97-2.97l.04.04A1.8 1.8 0 0 0 9.3 4a1.8 1.8 0 0 0 1.1-1.66V2a2.1 2.1 0 0 1 4.2 0v.06A1.8 1.8 0 0 0 15.7 4a1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 0 1 2.97 2.97l-.04.04A1.8 1.8 0 0 0 19.4 8.6a1.8 1.8 0 0 0 1.66 1.1H21a2.1 2.1 0 0 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z" />
        </svg>
    ),
    Back: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19 3 12m0 0 7-7m-7 7h18" />
        </svg>
    )
};

const FUNNEL_STAGES = [
    { id: 'novo_lead', title: 'Novo Lead' },
    { id: 'em_atendimento', title: 'Em Atendimento' },
    { id: 'orcamento', title: 'Orçamento' },
    { id: 'fechamento', title: 'Fechamento' }
];

function normalizeFunnelStage(value) {
    const normalized = String(value || 'novo_lead').trim().toLowerCase();
    return FUNNEL_STAGES.some(stage => stage.id === normalized) ? normalized : 'novo_lead';
}

const STATUS_META = {
    open: {
        label: 'Conectado',
        badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        dot: 'bg-emerald-500',
        panel: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    },
    connecting: {
        label: 'Aguardando Leitura',
        badge: 'bg-amber-50 text-amber-700 ring-amber-200',
        dot: 'bg-amber-500',
        panel: 'border-amber-200 bg-amber-50 text-amber-700'
    },
    close: {
        label: 'Desconectado',
        badge: 'bg-red-50 text-red-700 ring-red-200',
        dot: 'bg-red-500',
        panel: 'border-red-200 bg-red-50 text-red-700'
    }
};

function normalizeStatus(value) {
    const status = String(value || 'close').toLowerCase();
    if (status.includes('open') || status.includes('connected')) return 'open';
    if (status.includes('connecting') || status.includes('pairing') || status.includes('qrcode')) return 'connecting';
    return 'close';
}

function normalizeQrImage(value) {
    if (!value) return '';
    if (value.startsWith('data:image')) return value;
    return `data:image/png;base64,${value.replace(/^base64,/, '')}`;
}

function formatPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    if (match) return `+55 (${match[1]}) ${match[2]}-${match[3]}`;
    return digits || 'Sem telefone';
}

function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function orderOptionLabel(order) {
    if (!order) return '';
    const code = order.tracking_code || `Pedido ${order.id}`;
    const client = order.client_name ? ` - ${order.client_name}` : '';
    const status = order.status ? ` (${order.status})` : '';
    return `${code}${client}${status}`;
}

const WhatsappDashboard = () => {
    const { token, API_BASE_URL, showNotification } = useAuth();
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState('inbox');
    const [status, setStatus] = useState('close');
    const [qrcode, setQrcode] = useState('');
    const [statusLoading, setStatusLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [message, setMessage] = useState('');
    const [delaySeconds, setDelaySeconds] = useState(3);
    const [audioFile, setAudioFile] = useState(null);
    const [savedAudioName, setSavedAudioName] = useState('');

    const [conversations, setConversations] = useState([]);
    const [selectedPhone, setSelectedPhone] = useState('');
    const [linkedOrders, setLinkedOrders] = useState([]);
    const [orders, setOrders] = useState([]);
    const [conversationSearch, setConversationSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [linking, setLinking] = useState(false);
    const [officialLabels, setOfficialLabels] = useState([]);
    const [labelActionLoading, setLabelActionLoading] = useState('');

    const authConfig = useMemo(() => ({
        headers: { Authorization: `Bearer ${token}` }
    }), [token]);

    const currentStatus = STATUS_META[status] || STATUS_META.close;
    const isConnected = status === 'open';
    const selectedConversation = conversations.find(item => item.phone === selectedPhone) || null;
    const shouldLoadConversations = activeView === 'inbox' || activeView === 'funnel';

    const conversationsWithFunnelStage = useMemo(() => (
        conversations.map(conversation => ({
            ...conversation,
            funnel_stage: normalizeFunnelStage(conversation.funnel_stage)
        }))
    ), [conversations]);

    const navigationItems = useMemo(() => ([
        {
            id: 'inbox',
            label: 'Caixa de Entrada',
            description: 'Gerencie conversas, responda clientes e anexe atendimentos aos pedidos.',
            icon: Icons.Message
        },
        {
            id: 'funnel',
            label: 'Funil de Vendas',
            description: 'Acompanhe clientes por etapa comercial e visualize oportunidades abertas.',
            icon: Icons.Funnel
        },
        {
            id: 'settings',
            label: 'Configurações',
            description: 'Controle a conexão da Evolution API e configure a automação de boas-vindas.',
            icon: Icons.Settings
        }
    ]), []);
    const activeViewMeta = navigationItems.find(item => item.id === activeView) || navigationItems[0];

    const filteredOrders = useMemo(() => {
        const search = orderSearch.trim().toLowerCase();
        return orders
            .filter(order => {
                if (!search) return true;
                return [
                    order.tracking_code,
                    order.client_name,
                    order.status,
                    order.client_phone
                ].some(value => String(value || '').toLowerCase().includes(search));
            })
            .slice(0, 80);
    }, [orders, orderSearch]);

    const fetchStatus = useCallback(async () => {
        if (!token) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/status`, authConfig);
            setStatus(normalizeStatus(response.data?.status));
        } catch (requestError) {
            setStatus('close');
            setError(requestError.response?.data?.error || 'Não foi possível consultar o WhatsApp agora.');
        } finally {
            setStatusLoading(false);
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchAutomation = useCallback(async () => {
        if (!token) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/automation`, authConfig);
            setMessage(response.data?.welcome_message || '');
            setDelaySeconds(Number(response.data?.delay_seconds ?? 3));
            setSavedAudioName(response.data?.audio_original_name || '');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível carregar a automação salva.');
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchOrders = useCallback(async () => {
        if (!token) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/api/orders`, authConfig);
            setOrders(response.data?.orders || []);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível carregar os pedidos.');
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchOfficialLabels = useCallback(async () => {
        if (!token) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/labels`, authConfig);
            const labels = Array.isArray(response.data?.labels)
                ? response.data.labels
                : response.data?.tags;
            setOfficialLabels(Array.isArray(labels) ? labels : []);
        } catch (requestError) {
            console.error('Erro ao carregar etiquetas oficiais do WhatsApp:', requestError.response?.data || requestError);
            setOfficialLabels([]);
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchConversations = useCallback(async (silent = false) => {
        if (!token) return;
        if (!silent) setLoadingConversations(true);

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/conversations`, {
                ...authConfig,
                params: conversationSearch.trim() ? { search: conversationSearch.trim() } : {}
            });
            const nextConversations = response.data?.conversations || [];
            setConversations(nextConversations);
            setSelectedPhone(previous => previous || nextConversations[0]?.phone || '');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível carregar as conversas.');
        } finally {
            if (!silent) setLoadingConversations(false);
        }
    }, [API_BASE_URL, authConfig, conversationSearch, token]);

    const fetchConversationLinks = useCallback(async (phone = selectedPhone, silent = false) => {
        if (!token || !phone) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/conversations/${phone}/messages`, authConfig);
            setLinkedOrders(response.data?.linked_orders || []);
            if (!silent) await fetchConversations(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível carregar os pedidos vinculados.');
        }
    }, [API_BASE_URL, authConfig, fetchConversations, selectedPhone, token]);

    useEffect(() => {
        fetchStatus();
        fetchAutomation();
        fetchOfficialLabels();

        const interval = window.setInterval(fetchStatus, 12000);
        return () => window.clearInterval(interval);
    }, [fetchAutomation, fetchOfficialLabels, fetchStatus]);

    useEffect(() => {
        if (!shouldLoadConversations) return undefined;

        fetchConversations();
        fetchOrders();

        const interval = window.setInterval(() => fetchConversations(true), 3000);
        return () => window.clearInterval(interval);
    }, [fetchConversations, fetchOrders, shouldLoadConversations]);

    useEffect(() => {
        if (activeView !== 'inbox' || !selectedPhone) {
            setLinkedOrders([]);
            return undefined;
        }

        fetchConversationLinks(selectedPhone);

        return undefined;
    }, [activeView, fetchConversationLinks, selectedPhone]);

    const handleConnect = async () => {
        setActionLoading('connect');
        setError('');
        setSuccess('');
        setQrcode('');

        try {
            const response = await axios.post(`${API_BASE_URL}/whatsapp/connect`, {}, authConfig);
            const nextQrCode = normalizeQrImage(response.data?.qrcode || response.data?.base64 || '');
            const nextStatus = normalizeStatus(response.data?.status || (nextQrCode ? 'connecting' : 'close'));

            setQrcode(nextQrCode);
            setStatus(nextStatus);

            if (nextStatus === 'open') {
                setSuccess('Instância WhatsApp já conectada.');
            } else if (nextQrCode) {
                setSuccess('QR Code gerado. Faça a leitura no aplicativo WhatsApp.');
            } else {
                setError(response.data?.message || 'A Evolution API respondeu, mas não retornou um QR Code.');
            }
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Erro ao gerar QR Code.');
        } finally {
            setActionLoading('');
        }
    };

    const handleLogout = async () => {
        setActionLoading('logout');
        setError('');
        setSuccess('');

        try {
            await axios.delete(`${API_BASE_URL}/whatsapp/logout`, authConfig);
            setStatus('close');
            setQrcode('');
            setSuccess('WhatsApp desconectado com sucesso.');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Erro ao desconectar o WhatsApp.');
        } finally {
            setActionLoading('');
        }
    };

    const handleSaveAutomation = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('welcome_message', message);
        formData.append('delay_seconds', String(delaySeconds || 0));
        if (audioFile) formData.append('audio', audioFile);

        try {
            const response = await axios.post(`${API_BASE_URL}/whatsapp/save-automation`, formData, authConfig);
            const settings = response.data?.settings;

            setSavedAudioName(settings?.audio_original_name || audioFile?.name || savedAudioName);
            setAudioFile(null);
            setSuccess('Automação salva com sucesso.');
            showNotification?.('Automação do WhatsApp salva.');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Erro ao salvar a automação.');
        } finally {
            setSaving(false);
        }
    };

    const handleAttachOrder = async () => {
        if (!selectedPhone || !selectedOrderId) return;
        setLinking(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(
                `${API_BASE_URL}/whatsapp/conversations/${selectedPhone}/orders`,
                { order_id: Number(selectedOrderId) },
                authConfig
            );
            setLinkedOrders(response.data?.linked_orders || []);
            setSelectedOrderId('');
            setSuccess('Pedido anexado à conversa.');
            await fetchConversations(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível anexar o pedido.');
        } finally {
            setLinking(false);
        }
    };

    const handleDetachOrder = async (orderId) => {
        if (!selectedPhone || !orderId) return;
        setError('');
        setSuccess('');

        try {
            const response = await axios.delete(
                `${API_BASE_URL}/whatsapp/conversations/${selectedPhone}/orders/${orderId}`,
                authConfig
            );
            setLinkedOrders(response.data?.linked_orders || []);
            setSuccess('Pedido removido da conversa.');
            await fetchConversations(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível remover o pedido.');
        }
    };

    const handleConversationStatus = async (nextStatus) => {
        if (!selectedPhone) return;
        setError('');
        setSuccess('');

        try {
            await axios.patch(
                `${API_BASE_URL}/whatsapp/conversations/${selectedPhone}`,
                { status: nextStatus },
                authConfig
            );
            setSuccess(nextStatus === 'archived' ? 'Conversa arquivada.' : 'Conversa reaberta.');
            await fetchConversations(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível atualizar a conversa.');
        }
    };

    const conversationHasLabel = (conversation, label) => (
        Array.isArray(conversation?.tags)
        && conversation.tags.some(tag => (
            String(tag.id || '') === String(label?.id || '')
            || String(tag.name || '').trim().toLowerCase() === String(label?.name || '').trim().toLowerCase()
        ))
    );

    const handleApplyWhatsappLabel = async (label) => {
        if (!selectedConversation || !label?.id) return;

        const labelKey = String(label.id);
        setLabelActionLoading(labelKey);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(
                `${API_BASE_URL}/whatsapp/add-label`,
                {
                    phone: selectedConversation.phone,
                    jid: selectedConversation.remote_jid,
                    labelId: label.id
                },
                authConfig
            );
            const appliedLabel = response.data?.label || label;

            await fetchConversations(true);
            setConversations(previous => previous.map(conversation => {
                if (conversation.phone !== selectedConversation.phone || conversationHasLabel(conversation, appliedLabel)) {
                    return conversation;
                }

                return {
                    ...conversation,
                    tags: [...(Array.isArray(conversation.tags) ? conversation.tags : []), appliedLabel]
                };
            }));
            setSuccess('Etiqueta aplicada no WhatsApp Business.');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível aplicar a etiqueta no WhatsApp Business.');
        } finally {
            setLabelActionLoading('');
        }
    };

    const renderConversations = () => (
        <div className="flex-1 flex flex-row p-4 gap-4 overflow-hidden h-full">
            <section className="flex-1 min-w-0 flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden h-full">
                <div className="shrink-0 border-b border-slate-100 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-950">Contatos Capturados (Via Etiquetas)</h2>
                            <p className="mt-1 text-xs font-bold text-slate-500">{conversations.length} contato(s) capturado(s)</p>
                        </div>
                    </div>
                    <input
                        value={conversationSearch}
                        onChange={(event) => setConversationSearch(event.target.value)}
                        placeholder="Buscar nome, telefone ou etiqueta"
                        className="mt-4 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 overflow-y-auto">
                    {loadingConversations ? (
                        <div className="col-span-full flex h-44 items-center justify-center text-sm font-bold text-slate-500">Carregando contatos...</div>
                    ) : conversations.length ? (
                        conversations.map(conversation => {
                            const active = conversation.phone === selectedPhone;
                            const displayName = conversation.display_name || conversation.push_name || formatPhone(conversation.phone);
                            const profileImage = conversation.profile_picture_url || conversation.profile_picture || conversation.picture_url || conversation.avatar_url || conversation.photo_url;
                            const initial = String(displayName || conversation.phone || '?').trim().charAt(0).toUpperCase() || '?';
                            const tags = Array.isArray(conversation.tags) ? conversation.tags : [];

                            return (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => setSelectedPhone(conversation.phone)}
                                    className={`bg-white border border-slate-200 rounded-lg p-4 shadow-sm cursor-pointer hover:border-blue-400 text-left transition ${active ? 'border-blue-500 ring-4 ring-blue-100' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-extrabold text-slate-500">
                                            {profileImage ? (
                                                <img src={profileImage} alt={displayName} className="h-full w-full object-cover" />
                                            ) : (
                                                <span>{initial}</span>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[15px] font-extrabold text-slate-900">{displayName}</p>
                                            <p className="mt-1 truncate text-xs font-bold text-slate-500">{formatPhone(conversation.phone)}</p>
                                        </div>

                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${conversation.status === 'archived' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                            {conversation.status === 'archived' ? 'Arquivado' : 'Ativo'}
                                        </span>
                                    </div>

                                    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Etiquetas</p>
                                        {tags.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map(tag => (
                                                    <span
                                                        key={tag.id}
                                                        className="rounded-md border px-2.5 py-1 text-[11px] font-extrabold uppercase"
                                                        style={{ borderColor: tag.color, color: tag.color, backgroundColor: tag.color + '33' }}
                                                    >
                                                        {tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs font-semibold leading-5 text-slate-400">Sem etiquetas aplicadas ainda.</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="col-span-full flex h-44 items-center justify-center px-6 text-center text-sm font-semibold leading-6 text-slate-500">
                            Nenhum contato capturado ainda. Quando um cliente chegar pelo WhatsApp conectado, ele aparece aqui.
                        </div>
                    )}
                </div>
            </section>

            <aside className="w-[320px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden h-full">
                <div className="shrink-0 border-b border-slate-100 p-5">
                    <h2 className="text-lg font-extrabold text-slate-950">Pedido vinculado</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                        Anexe a conversa ao pedido para manter o atendimento junto do acompanhamento.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div>
                        <label className="mb-2 block text-sm font-extrabold text-slate-700">Buscar pedido</label>
                        <input
                            value={orderSearch}
                            onChange={(event) => setOrderSearch(event.target.value)}
                            placeholder="Código, cliente ou status"
                            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-extrabold text-slate-700">Selecionar pedido</label>
                        <select
                            value={selectedOrderId}
                            onChange={(event) => setSelectedOrderId(event.target.value)}
                            disabled={!selectedConversation}
                            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                        >
                            <option value="">Escolha um pedido</option>
                            {filteredOrders.map(order => (
                                <option key={order.id} value={order.id}>{orderOptionLabel(order)}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleAttachOrder}
                            disabled={!selectedConversation || !selectedOrderId || linking}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {linking ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : Icons.Link}
                            Anexar ao pedido
                        </button>
                    </div>

                    <div>
                        <h3 className="mb-3 text-sm font-extrabold text-slate-700">Pedidos anexados</h3>
                        {linkedOrders.length ? (
                            <div className="space-y-2">
                                {linkedOrders.map(order => (
                                    <div key={order.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-extrabold text-slate-950">{order.tracking_code}</p>
                                                <p className="mt-1 text-xs font-bold text-slate-500">{order.client_name}</p>
                                                <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-blue-700">
                                                    {order.status}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDetachOrder(order.id)}
                                                className="rounded-md px-2 py-1 text-xs font-extrabold text-red-600 hover:bg-red-50"
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
                                Nenhum pedido anexado a esta conversa.
                            </p>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                        {selectedConversation?.status === 'archived' ? (
                            <button
                                type="button"
                                onClick={() => handleConversationStatus('open')}
                                disabled={!selectedConversation}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-extrabold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {Icons.Message}
                                Reabrir conversa
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleConversationStatus('archived')}
                                disabled={!selectedConversation}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {Icons.Archive}
                                Arquivar conversa
                            </button>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                        <h3 className="mb-3 text-sm font-extrabold text-slate-700">Etiquetar no WhatsApp</h3>
                        <p className="mb-3 text-xs font-semibold leading-5 text-slate-500">
                            Aplica a etiqueta diretamente no WhatsApp Business conectado.
                        </p>
                        {officialLabels.length ? (
                            <div className="flex flex-wrap gap-2">
                                {officialLabels.map(label => {
                                    const labelColor = label.color || '#64748b';
                                    const activeLabel = conversationHasLabel(selectedConversation, label);
                                    const loadingLabel = labelActionLoading === String(label.id);

                                    return (
                                        <button
                                            key={label.id || label.name}
                                            type="button"
                                            onClick={() => handleApplyWhatsappLabel(label)}
                                            disabled={!selectedConversation || loadingLabel}
                                            className="rounded-md border px-3 py-1.5 text-xs font-extrabold uppercase transition disabled:cursor-not-allowed disabled:opacity-60"
                                            style={activeLabel
                                                ? { backgroundColor: labelColor, borderColor: labelColor, color: '#fff' }
                                                : { borderColor: labelColor, color: labelColor, backgroundColor: labelColor + '12' }}
                                        >
                                            {loadingLabel ? 'Aplicando...' : label.name}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">
                                Nenhuma etiqueta oficial retornada pela Evolution API.
                            </p>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );

    const renderFunnel = () => (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-4 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-extrabold text-slate-950">Funil de Vendas</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        Conversas organizadas por estágio comercial.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchConversations()}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50"
                >
                    {Icons.Refresh}
                    Atualizar
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto pb-2">
                <div className="flex h-full min-w-max gap-4">
                    {FUNNEL_STAGES.map(stage => {
                        const stageConversations = conversationsWithFunnelStage.filter(conversation => conversation.funnel_stage === stage.id);

                        return (
                            <section key={stage.id} className="flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                <div className="shrink-0 border-b border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-extrabold text-slate-950">{stage.title}</h3>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-slate-500 ring-1 ring-slate-200">
                                            {stageConversations.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                                    {stageConversations.length ? (
                                        stageConversations.map(conversation => {
                                            const displayName = conversation.display_name || conversation.push_name || formatPhone(conversation.phone);

                                            return (
                                                <button
                                                    key={conversation.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPhone(conversation.phone);
                                                        setActiveView('inbox');
                                                    }}
                                                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                                                >
                                                    <p className="truncate text-sm font-extrabold text-slate-950">{displayName}</p>
                                                    <p className="mt-1 text-xs font-bold text-slate-500">{formatPhone(conversation.phone)}</p>
                                                    {Array.isArray(conversation.tags) && conversation.tags.length ? (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {conversation.tags.map(tag => (
                                                                <span
                                                                    key={tag.id}
                                                                    className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border"
                                                                    style={{ borderColor: tag.color, color: tag.color, backgroundColor: tag.color + '1A' }}
                                                                >
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    <p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">
                                                        {conversation.last_message_text || 'Sem mensagens salvas ainda.'}
                                                    </p>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold leading-6 text-slate-500">
                                            Nenhuma conversa nesta etapa.
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderAutomation = () => (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            {Icons.Message}
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-950">Conexão WhatsApp</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">Instância AtosVendas</p>
                        </div>
                    </div>
                </div>

                <div className={`mb-6 rounded-lg border px-4 py-4 ${currentStatus.panel}`}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-extrabold uppercase opacity-80">Status do aparelho</p>
                            <strong className="mt-1 block text-xl">{currentStatus.label}</strong>
                        </div>
                        <span className={`h-4 w-4 rounded-full ${currentStatus.dot}`} />
                    </div>
                </div>

                <div className="flex min-h-[330px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    {qrcode && !isConnected ? (
                        <>
                            <img src={qrcode} alt="QR Code WhatsApp" className="h-64 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" />
                            <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-slate-500">
                                Abra o WhatsApp, vá em aparelhos conectados e leia o QR Code.
                            </p>
                        </>
                    ) : isConnected ? (
                        <div className="max-w-sm">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                {Icons.Power}
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-950">Sessão ativa</h3>
                            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                                A instância está pronta para receber e enviar mensagens pela Evolution API.
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-sm">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                {Icons.Qr}
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-950">Aguardando conexão</h3>
                            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                                Gere um QR Code para vincular o aparelho à instância AtosVendas.
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    {isConnected ? (
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={actionLoading === 'logout'}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {actionLoading === 'logout' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-700" /> : Icons.Power}
                            Desconectar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConnect}
                            disabled={actionLoading === 'connect'}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {actionLoading === 'connect' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : Icons.Qr}
                            Gerar QR Code
                        </button>
                    )}
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <form onSubmit={handleSaveAutomation} className="flex h-full flex-col">
                    <div className="border-b border-slate-100 p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                {Icons.Automation}
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-950">Automação de Boas-Vindas (Anúncios)</h2>
                                <p className="mt-1 text-sm font-medium text-slate-500">Enviada apenas para contatos novos que ainda não são clientes</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid flex-1 gap-5 p-6">
                        <label className="block">
                            <span className="mb-2 block text-sm font-extrabold text-slate-700">Mensagem de Texto Inicial</span>
                            <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                rows={8}
                                placeholder="Oi! Vi que você se interessou pelos nossos fardamentos. Me fala o nome da sua equipe e a quantidade aproximada de peças?"
                                className="min-h-[210px] w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <div className="grid gap-5 md:grid-cols-[1fr_190px]">
                            <label className="block">
                                <span className="mb-2 block text-sm font-extrabold text-slate-700">Áudio PTT (.ogg)</span>
                                <input
                                    type="file"
                                    accept=".ogg"
                                    onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                                    className="block w-full cursor-pointer rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm file:mr-4 file:border-0 file:bg-blue-50 file:px-4 file:py-3 file:text-sm file:font-extrabold file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                />
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                                    Faça upload de um áudio .ogg para enviar como PTT.
                                </p>
                                {audioFile?.name || savedAudioName ? (
                                    <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                                        {audioFile?.name ? `Selecionado: ${audioFile.name}` : `Salvo: ${savedAudioName}`}
                                    </p>
                                ) : null}
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-extrabold text-slate-700">Atraso/Delay (em segundos)</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={delaySeconds}
                                    onChange={(event) => setDelaySeconds(event.target.value)}
                                    className="h-[47px] w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                                    Simula o tempo antes do envio.
                                </p>
                            </label>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 p-6">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : Icons.Save}
                            Salvar Automação
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );

    const renderMainContent = () => {
        if (activeView === 'funnel') return renderFunnel();
        if (activeView === 'settings') {
            return (
                <div className="h-full overflow-y-auto">
                    {renderAutomation()}
                </div>
            );
        }

        return renderConversations();
    };

    return (
        <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
            <aside className="flex h-full w-64 shrink-0 flex-col bg-[#0f172a] px-5 py-6 text-slate-100">
                <div className="shrink-0 border-b border-slate-800 pb-5 text-center">
                        <img
                            src="/logo-white.png"
                            alt="ATOS"
                            className="mx-auto h-12 max-w-[180px] object-contain"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                                const fallback = document.getElementById('whatsapp-sidebar-logo-text');
                                if (fallback) fallback.style.display = 'block';
                            }}
                        />
                        <h1 id="whatsapp-sidebar-logo-text" className="mt-3 hidden text-lg font-extrabold tracking-wide text-white">ATOS</h1>
                        <span className="mt-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            MÓDULO WHATSAPP
                        </span>
                        <div className={`mt-4 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${currentStatus.badge}`}>
                            <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
                            {statusLoading ? 'Consultando...' : currentStatus.label}
                        </div>
                </div>

                <nav className="flex-1 space-y-2 py-5">
                    {navigationItems.map(item => {
                        const active = item.id === activeView;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveView(item.id)}
                                className={`inline-flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-extrabold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="shrink-0 border-t border-slate-800 pt-5">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-extrabold text-slate-300 transition hover:border-blue-500 hover:bg-slate-800 hover:text-white"
                    >
                        {Icons.Back}
                        <span>Voltar ao ERP Principal</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-50 overflow-hidden">
                    {error || success ? (
                        <div className="shrink-0 space-y-3 px-5 pt-5">
                            {error ? (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            {success ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                                    {success}
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-hidden p-5">
                        {renderMainContent()}
                    </div>
            </main>
        </div>
    );
};

export default WhatsappDashboard;
