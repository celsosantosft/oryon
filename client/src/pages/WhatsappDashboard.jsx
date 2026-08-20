import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Icons = {
    Tag: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13.5 13.5 20a2.1 2.1 0 0 1-3 0L4 13.5V4h9.5L20 10.5a2.1 2.1 0 0 1 0 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h.01" />
        </svg>
    ),
    Refresh: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-4h-4" />
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
    Search: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
    ),
    Phone: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 4.75 8.4 3.6a1.8 1.8 0 0 1 2.45.6l1.05 1.78a1.8 1.8 0 0 1-.35 2.25l-1.15 1.06a11.7 11.7 0 0 0 4.31 4.31l1.06-1.15a1.8 1.8 0 0 1 2.25-.35l1.78 1.05a1.8 1.8 0 0 1 .6 2.45l-1.15 1.9a2.5 2.5 0 0 1-2.64 1.16C10.96 17.7 6.3 13.04 5.34 7.39A2.5 2.5 0 0 1 6.5 4.75Z" />
        </svg>
    ),
    Check: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.5 4.5L19 7" />
        </svg>
    )
};

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

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function formatPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    if (match) return `+55 (${match[1]}) ${match[2]}-${match[3]}`;
    return digits || 'Sem telefone';
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function getPhoneSearchVariants(value) {
    const digits = onlyDigits(value);
    if (!digits) return [];

    const variants = [digits];

    if (digits.startsWith('55')) variants.push(digits.slice(2));
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) variants.push(`55${digits}`);

    if (digits.length === 11 && digits[2] === '9') {
        variants.push(`${digits.slice(0, 2)}${digits.slice(3)}`);
        variants.push(`55${digits.slice(0, 2)}${digits.slice(3)}`);
    }

    if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
        variants.push(`${digits.slice(0, 4)}${digits.slice(5)}`);
        variants.push(`${digits.slice(2, 4)}${digits.slice(5)}`);
    }

    return Array.from(new Set(variants.filter(item => item.length >= 4)));
}

function matchesPhoneSearch(phone, search) {
    const phoneDigits = onlyDigits(phone);
    if (!phoneDigits) return false;

    return getPhoneSearchVariants(search).some(variant => (
        phoneDigits.includes(variant)
        || phoneDigits.endsWith(variant)
        || variant.endsWith(phoneDigits)
    ));
}

function formatDateTime(value) {
    if (!value) return '';

    const date = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getLeadHistoryStatus(status) {
    if (status === 'sent') {
        return {
            label: 'Enviado',
            className: 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        };
    }

    if (status === 'failed') {
        return {
            label: 'Falhou',
            className: 'bg-red-50 text-red-700 ring-red-100'
        };
    }

    return {
        label: 'Processando',
        className: 'bg-amber-50 text-amber-700 ring-amber-100'
    };
}

function getConversationTags(conversation) {
    return Array.isArray(conversation?.tags) ? conversation.tags : [];
}

function getDisplayName(conversation) {
    return conversation?.display_name
        || conversation?.client_name
        || conversation?.push_name
        || formatPhone(conversation?.phone);
}

function getLabelKey(label) {
    return String(label?.evolution_label_id || label?.id || label?.name || '').trim().toLowerCase();
}

function getMetaCapiFeedback(metaCapi) {
    if (!metaCapi) return '';
    if (metaCapi.sent) return ' Evento enviado para a Meta.';
    if (metaCapi.reason === 'already_sent') return ' Evento da Meta já enviado antes.';
    if (metaCapi.reason === 'missing_config') return ' Meta sem Pixel ID ou token.';
    if (metaCapi.reason === 'missing_user_data') return ' Meta sem telefone ou e-mail válido.';
    if (metaCapi.reason === 'label_not_qualified') return '';
    if (metaCapi.skipped) return ' Meta não enviada.';
    return ' Meta falhou; confira os logs do servidor.';
}

function getDisabledEvolutionStorage(dataStorage) {
    const labels = {
        labels: 'DATABASE_SAVE_DATA_LABELS',
        chats: 'DATABASE_SAVE_DATA_CHATS',
        contacts: 'DATABASE_SAVE_DATA_CONTACTS'
    };

    return Object.entries(labels)
        .filter(([key]) => dataStorage?.[key]?.configured && dataStorage[key].value === false)
        .map(([, envName]) => envName);
}

const WhatsappDashboard = () => {
    const { token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState('labels');
    const [status, setStatus] = useState('close');
    const [qrcode, setQrcode] = useState('');
    const [statusLoading, setStatusLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [evolutionInfo, setEvolutionInfo] = useState(null);
    const [metaInfo, setMetaInfo] = useState(null);
    const [webhookInfo, setWebhookInfo] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [selectedPhone, setSelectedPhone] = useState('');
    const [conversationSearch, setConversationSearch] = useState('');
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [syncingLabels, setSyncingLabels] = useState(false);
    const [conversationLeadLoading, setConversationLeadLoading] = useState('');
    const [leadHistory, setLeadHistory] = useState([]);
    const [leadHistorySummary, setLeadHistorySummary] = useState({ total: 0, sent: 0, failed: 0 });
    const [loadingLeadHistory, setLoadingLeadHistory] = useState(false);

    const authConfig = useMemo(() => ({
        headers: { Authorization: `Bearer ${token}` }
    }), [token]);

    const currentStatus = STATUS_META[status] || STATUS_META.close;
    const isConnected = status === 'open';
    const metaSentContacts = useMemo(() => (
        conversations.filter(conversation => conversation.meta_capi_status === 'sent').length
    ), [conversations]);
    const sentLeadsTotal = Number(leadHistorySummary.sent || metaSentContacts || 0);

    const filteredConversations = useMemo(() => {
        const rawSearch = conversationSearch.trim();
        const search = normalizeText(rawSearch);
        const source = conversations;

        if (!search) return source;

        return source.filter(conversation => {
            const tags = getConversationTags(conversation).map(tag => tag.name).join(' ');
            const phoneMatch = matchesPhoneSearch(conversation.phone, rawSearch);

            return [
                getDisplayName(conversation),
                conversation.phone,
                conversation.remote_jid,
                tags
            ].some(value => normalizeText(value).includes(search)) || phoneMatch;
        });
    }, [conversationSearch, conversations]);

    const selectedConversation = useMemo(() => (
        filteredConversations.find(item => item.phone === selectedPhone)
        || filteredConversations[0]
        || null
    ), [filteredConversations, selectedPhone]);
    const selectedMetaSent = selectedConversation?.meta_capi_status === 'sent';

    const navigationItems = useMemo(() => ([
        { id: 'labels', label: 'Leads Meta', icon: Icons.Tag },
        { id: 'settings', label: 'Conexão', icon: Icons.Settings }
    ]), []);

    const fetchStatus = useCallback(async () => {
        if (!token) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/status`, authConfig);
            if (response.data?.config) setEvolutionInfo(response.data.config);
            if (response.data?.meta) setMetaInfo(response.data.meta);
            if (response.data?.webhook) setWebhookInfo(response.data.webhook);
            setStatus(normalizeStatus(response.data?.status));
            if (response.data?.configured === false && response.data?.error) {
                setError(previous => previous || response.data.error);
            }
        } catch (requestError) {
            if (requestError.response?.data?.config) setEvolutionInfo(requestError.response.data.config);
            if (requestError.response?.data?.meta) setMetaInfo(requestError.response.data.meta);
            setStatus('close');
            setError(requestError.response?.data?.error || 'Não foi possível consultar o WhatsApp agora.');
        } finally {
            setStatusLoading(false);
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchConversations = useCallback(async (silent = false, searchTerm = '') => {
        if (!token) return;
        if (!silent) setLoadingConversations(true);

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/conversations`, {
                ...authConfig,
                params: searchTerm.trim() ? { search: searchTerm.trim() } : {}
            });
            const nextConversations = response.data?.conversations || [];

            setConversations(nextConversations);
            setSelectedPhone(previous => {
                if (previous && nextConversations.some(conversation => conversation.phone === previous)) {
                    return previous;
                }

                const firstTagged = nextConversations.find(conversation => getConversationTags(conversation).length > 0);
                return firstTagged?.phone || nextConversations[0]?.phone || '';
            });
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Não foi possível carregar os contatos capturados.');
        } finally {
            if (!silent) setLoadingConversations(false);
        }
    }, [API_BASE_URL, authConfig, token]);

    const fetchLeadHistory = useCallback(async (silent = false) => {
        if (!token) return;
        if (!silent) setLoadingLeadHistory(true);

        try {
            const response = await axios.get(`${API_BASE_URL}/whatsapp/meta/qualified-leads/history`, {
                ...authConfig,
                params: { limit: 20 }
            });

            setLeadHistory(Array.isArray(response.data?.history) ? response.data.history : []);
            setLeadHistorySummary(response.data?.summary || { total: 0, sent: 0, failed: 0 });
        } catch (requestError) {
            console.error('Erro ao carregar histórico de leads Meta:', requestError.response?.data || requestError);
            setLeadHistory([]);
        } finally {
            if (!silent) setLoadingLeadHistory(false);
        }
    }, [API_BASE_URL, authConfig, token]);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => {
            fetchStatus();
            fetchConversations();
            fetchLeadHistory();
        }, 0);

        const statusInterval = window.setInterval(fetchStatus, 30000);
        const localRefreshInterval = window.setInterval(() => fetchConversations(true), 60000);
        const historyRefreshInterval = window.setInterval(() => fetchLeadHistory(true), 60000);

        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(statusInterval);
            window.clearInterval(localRefreshInterval);
            window.clearInterval(historyRefreshInterval);
        };
    }, [fetchConversations, fetchLeadHistory, fetchStatus]);

    useEffect(() => {
        const search = conversationSearch.trim();
        if (!search) {
            const timeoutId = window.setTimeout(() => {
                fetchConversations(true);
            }, 150);

            return () => window.clearTimeout(timeoutId);
        }

        if (search.length < 3 && onlyDigits(search).length < 4) return undefined;

        const timeoutId = window.setTimeout(() => {
            fetchConversations(true, search);
        }, 350);

        return () => window.clearTimeout(timeoutId);
    }, [conversationSearch, fetchConversations]);

    const handleSyncLabels = async () => {
        if (!token || syncingLabels) return;

        setSyncingLabels(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(`${API_BASE_URL}/whatsapp/sync`, {}, authConfig);
            if (response.data?.config) setEvolutionInfo(response.data.config);
            if (response.data?.meta) setMetaInfo(response.data.meta);

            const importedChats = Number(response.data?.chats || response.data?.label_sync?.conversations || 0);
            const labels = Number(response.data?.labels || 0);
            const labelAssociations = Number(response.data?.label_associations || 0);
            const metaSent = Number(response.data?.label_sync?.meta_sent || 0);
            const warnings = Array.isArray(response.data?.warnings) ? response.data.warnings.length : 0;
            const disabledStorage = getDisabledEvolutionStorage(response.data?.config?.dataStorage);

            if (disabledStorage.length) {
                setError(`A Evolution está com ${disabledStorage.join(', ')} desligado. Ligue essas variáveis no .env da VPS e reinicie a Evolution API.`);
            } else if (!labels && !labelAssociations && !importedChats) {
                setError('A Evolution respondeu sem contatos novos. Confira a conexão do WhatsApp e tente atualizar de novo.');
            } else {
                setSuccess(`Atualização concluída: ${importedChats} contato(s) capturado(s).${metaSent ? ` ${metaSent} evento(s) enviado(s) para a Meta.` : ''}${warnings ? ' Houve aviso(s) da Evolution API.' : ''}`);
            }
            await Promise.all([
                fetchConversations(false, conversationSearch),
                fetchLeadHistory(true)
            ]);
        } catch (requestError) {
            if (requestError.response?.data?.config) setEvolutionInfo(requestError.response.data.config);
            setError(requestError.response?.data?.error || 'Não foi possível atualizar os contatos agora.');
        } finally {
            setSyncingLabels(false);
        }
    };

    const handleConnect = async () => {
        setActionLoading('connect');
        setError('');
        setSuccess('');
        setQrcode('');

        try {
            const response = await axios.post(`${API_BASE_URL}/whatsapp/connect`, {}, authConfig);
            if (response.data?.config) setEvolutionInfo(response.data.config);

            const nextQrCode = normalizeQrImage(response.data?.qrcode || response.data?.base64 || '');
            const nextStatus = normalizeStatus(response.data?.status || (nextQrCode ? 'connecting' : 'close'));

            setQrcode(nextQrCode);
            setStatus(nextStatus);

            if (nextStatus === 'open') {
                setSuccess('Instância WhatsApp já conectada.');
            } else if (nextQrCode) {
                setSuccess('QR Code gerado.');
            } else {
                setError(response.data?.message || 'A Evolution API respondeu, mas não retornou um QR Code.');
            }
        } catch (requestError) {
            if (requestError.response?.data?.config) setEvolutionInfo(requestError.response.data.config);
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

    const sendQualifiedLeadPayload = async (leadData) => {
        setError('');
        setSuccess('');

        const response = await axios.post(
            `${API_BASE_URL}/whatsapp/meta/qualified-lead`,
            leadData,
            authConfig
        );
        const metaCapi = response.data?.meta_capi;

        setSuccess(`${response.data?.message || 'Lead qualificado processado.'}${getMetaCapiFeedback(metaCapi)}`);
        await Promise.all([
            fetchConversations(true, conversationSearch),
            fetchLeadHistory(true)
        ]);

        return response.data;
    };

    const handleSendConversationQualifiedLead = async (conversation) => {
        if (!conversation?.phone) return;

        const loadingKey = String(conversation.id || conversation.phone);
        if (conversationLeadLoading) return;

        setConversationLeadLoading(loadingKey);

        try {
            await sendQualifiedLeadPayload({
                name: getDisplayName(conversation),
                phone: conversation.phone,
                email: ''
            });
        } catch (requestError) {
            const metaCapi = requestError.response?.data?.meta_capi;
            setError(`${requestError.response?.data?.error || 'Não foi possível enviar o lead qualificado.'}${getMetaCapiFeedback(metaCapi)}`);
        } finally {
            setConversationLeadLoading('');
        }
    };

    const renderTagPill = (tag, compact = false) => {
        const color = tag.color || '#64748b';

        return (
            <span
                key={getLabelKey(tag) || tag.name}
                className={`inline-flex max-w-full items-center rounded-md border font-extrabold uppercase ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`}
                style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                title={tag.name}
            >
                <span className="truncate">{tag.name}</span>
            </span>
        );
    };

    const renderContactItem = (conversation) => {
        const active = conversation.phone === selectedConversation?.phone;
        const displayName = getDisplayName(conversation);
        const initial = String(displayName || conversation.phone || '?').trim().charAt(0).toUpperCase() || '?';
        const tags = getConversationTags(conversation);
        const metaSent = conversation.meta_capi_status === 'sent';
        const profileImage = conversation.profile_picture_url || conversation.profile_picture || conversation.picture_url || conversation.avatar_url || conversation.photo_url;

        return (
            <button
                key={conversation.id || conversation.phone}
                type="button"
                onClick={() => setSelectedPhone(conversation.phone)}
                className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
            >
                <div className="flex items-start gap-3">
                    {profileImage ? (
                        <img src={profileImage} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                    ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-extrabold text-slate-600">
                            {initial}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-extrabold text-slate-950">{displayName}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">{formatPhone(conversation.phone)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ring-1 ${metaSent ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-slate-50 text-slate-500 ring-slate-200'}`}>
                                {metaSent ? 'Meta' : 'Ativo'}
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {tags.length ? tags.map(tag => renderTagPill(tag, true)) : (
                                <span className="text-xs font-bold text-slate-400">
                                    {metaSent ? 'Enviado para Meta' : 'Aguardando Meta'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </button>
        );
    };

    const renderLeadHistory = () => (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-sm font-extrabold text-slate-950">Histórico de leads enviados</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {leadHistorySummary.sent || 0} enviado(s) para a Meta
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchLeadHistory()}
                    disabled={loadingLeadHistory}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loadingLeadHistory ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" /> : Icons.Refresh}
                    Atualizar
                </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
                {loadingLeadHistory ? (
                    <div className="flex h-28 items-center justify-center text-sm font-bold text-slate-500">Carregando histórico...</div>
                ) : leadHistory.length ? (
                    <div className="divide-y divide-slate-100">
                        {leadHistory.map(item => {
                            const statusMeta = getLeadHistoryStatus(item.status);

                            return (
                                <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-extrabold text-slate-950">{item.display_name || formatPhone(item.phone)}</p>
                                        <p className="mt-1 text-xs font-bold text-slate-500">
                                            {formatPhone(item.phone)}{item.updated_at ? ` - ${formatDateTime(item.updated_at)}` : ''}
                                        </p>
                                    </div>
                                    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${statusMeta.className}`}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-5 text-sm font-semibold text-slate-500">
                        Nenhum lead enviado para a Meta ainda.
                    </div>
                )}
            </div>
        </div>
    );

    const renderLabelsView = () => (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                            <p className="text-xs font-extrabold uppercase text-slate-400">Contatos capturados</p>
                            <strong className="mt-1 block text-2xl text-slate-950">{conversations.length}</strong>
                        </div>
                        <div>
                            <p className="text-xs font-extrabold uppercase text-slate-400">Leads Meta</p>
                            <strong className="mt-1 block text-2xl text-slate-950">{sentLeadsTotal}</strong>
                        </div>
                        <div>
                            <p className="text-xs font-extrabold uppercase text-slate-400">WhatsApp</p>
                            <strong className={`mt-1 block text-lg ${isConnected ? 'text-emerald-700' : 'text-red-700'}`}>
                                {currentStatus.label}
                            </strong>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSyncLabels}
                        disabled={syncingLabels}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Atualizar contatos"
                    >
                        {syncingLabels ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : Icons.Refresh}
                        Atualizar contatos
                    </button>
                </div>
            </section>

            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_1fr]">
                <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-slate-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-950">Contatos capturados</h2>
                                <p className="mt-1 text-xs font-bold text-slate-500">
                                    {conversationSearch.trim() ? `${filteredConversations.length} resultado(s)` : `${conversations.length} contato(s)`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchConversations(false, conversationSearch)}
                                disabled={loadingConversations}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Atualizar lista"
                            >
                                {loadingConversations ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" /> : Icons.Refresh}
                            </button>
                        </div>

                        <label className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                            {Icons.Search}
                            <input
                                value={conversationSearch}
                                onChange={(event) => setConversationSearch(event.target.value)}
                                placeholder="Buscar nome ou telefone"
                                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                            />
                        </label>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                        {loadingConversations ? (
                            <div className="flex h-44 items-center justify-center text-sm font-bold text-slate-500">Carregando contatos...</div>
                        ) : filteredConversations.length ? (
                            filteredConversations.map(renderContactItem)
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold leading-6 text-slate-500">
                                Nenhum contato capturado ainda.
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-slate-100 p-5">
                        {selectedConversation ? (
                            <div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-950">{getDisplayName(selectedConversation)}</h2>
                                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-500">
                                        {Icons.Phone}
                                        {formatPhone(selectedConversation.phone)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-950">Lead Meta</h2>
                                <p className="mt-1 text-sm font-bold text-slate-500">Selecione um contato capturado.</p>
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                        {selectedConversation ? (
                            <div>
                                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                                        <p className="text-xs font-extrabold uppercase text-slate-400">Lead selecionado</p>
                                        <h3 className="mt-2 text-2xl font-extrabold text-slate-950">{getDisplayName(selectedConversation)}</h3>
                                        <p className="mt-2 flex items-center gap-2 text-base font-bold text-slate-600">
                                            {Icons.Phone}
                                            {formatPhone(selectedConversation.phone)}
                                        </p>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {getConversationTags(selectedConversation).map(tag => renderTagPill(tag, true))}
                                            {!getConversationTags(selectedConversation).length ? (
                                                <span className="rounded-md bg-white px-3 py-1 text-xs font-extrabold uppercase text-slate-500 ring-1 ring-slate-200">
                                                    {selectedMetaSent ? 'Enviado para Meta' : 'Aguardando envio'}
                                                </span>
                                            ) : null}
                                        </div>
                                        {selectedConversation.meta_capi_updated_at ? (
                                            <p className="mt-4 text-xs font-bold text-slate-500">
                                                Último envio Meta: {formatDateTime(selectedConversation.meta_capi_updated_at)}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className={`rounded-lg border p-5 ${selectedMetaSent ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
                                        <p className={`text-xs font-extrabold uppercase ${selectedMetaSent ? 'text-emerald-700' : 'text-blue-700'}`}>Meta CAPI</p>
                                        <p className={`mt-2 text-sm font-semibold leading-6 ${selectedMetaSent ? 'text-emerald-900' : 'text-blue-900'}`}>
                                            {selectedMetaSent
                                                ? 'Este telefone já foi enviado para o Pixel da Meta.'
                                                : 'O evento usa o telefone capturado e envia os dados hasheados para o Pixel.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleSendConversationQualifiedLead(selectedConversation)}
                                            disabled={selectedMetaSent || conversationLeadLoading === String(selectedConversation.id || selectedConversation.phone)}
                                            className={`mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${selectedMetaSent ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                                        >
                                            {selectedMetaSent
                                                ? Icons.Check
                                                : conversationLeadLoading === String(selectedConversation.id || selectedConversation.phone)
                                                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                : Icons.Tag}
                                            {selectedMetaSent ? 'Já enviado' : 'Enviar Meta'}
                                        </button>
                                    </div>
                                </div>
                                {renderLeadHistory()}
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                                Selecione um contato capturado para enviar o lead qualificado para a Meta.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );

    const renderSettingsView = () => (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-950">Conexão WhatsApp</h2>
                        <p className="mt-1 text-sm font-bold text-slate-500">Instância AtosVendas</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${currentStatus.badge}`}>
                        <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
                        {statusLoading ? 'Consultando...' : currentStatus.label}
                    </div>
                </div>

                <div className={`mb-5 rounded-lg border px-4 py-4 ${currentStatus.panel}`}>
                    <p className="text-xs font-extrabold uppercase opacity-80">Status</p>
                    <strong className="mt-1 block text-xl">{currentStatus.label}</strong>
                </div>

                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    {qrcode && !isConnected ? (
                        <>
                            <img src={qrcode} alt="QR Code WhatsApp" className="h-64 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" />
                            <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-slate-500">
                                Leia o QR Code no WhatsApp Business.
                            </p>
                        </>
                    ) : isConnected ? (
                        <div className="max-w-sm">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                {Icons.Power}
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-950">Sessão ativa</h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                                Pronta para atualizar contatos.
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-sm">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                {Icons.Qr}
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-950">Aguardando conexão</h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                                Gere um QR Code somente se a instância precisar conectar.
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-5">
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

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-extrabold text-slate-950">Configuração</h2>

                {evolutionInfo ? (
                    <div className="mt-5 grid gap-3">
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Base</p>
                            <p className="mt-1 break-all text-sm font-bold text-slate-700">{evolutionInfo.baseUrl || 'Não definida'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Instância</p>
                            <p className="mt-1 break-all text-sm font-bold text-slate-700">{evolutionInfo.instance || 'Não definida'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Webhook</p>
                            <p className="mt-1 break-all text-sm font-bold text-slate-700">{evolutionInfo.webhookUrl || 'Não definido'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Chave</p>
                            <p className={`mt-1 text-sm font-bold ${evolutionInfo.hasApiKey ? 'text-emerald-700' : 'text-red-700'}`}>
                                {evolutionInfo.hasApiKey ? `Carregada (${evolutionInfo.apiKeySource || 'ambiente'})` : 'Não encontrada'}
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Webhook ativo</p>
                            <p className="mt-1 text-sm font-bold text-slate-700">
                                {webhookInfo?.lastConfiguredAt || webhookInfo?.configured_at || 'Aguardando confirmação'}
                            </p>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                                {(webhookInfo?.events || []).join(', ') || 'CHATS_UPDATE, LABELS_EDIT, LABELS_ASSOCIATION'}
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Evento Meta</p>
                            <p className="mt-1 text-sm font-bold text-slate-700">
                                {(metaInfo?.qualifiedLeadLabels || []).join(', ') || 'Não carregadas'}
                            </p>
                            {metaInfo?.qualifiedLeadLabelIds?.length ? (
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    IDs: {metaInfo.qualifiedLeadLabelIds.join(', ')}
                                </p>
                            ) : null}
                            <p className={`mt-2 text-xs font-bold ${metaInfo?.hasPixelId && metaInfo?.hasAccessToken ? 'text-emerald-700' : 'text-red-700'}`}>
                                {metaInfo?.hasPixelId && metaInfo?.hasAccessToken ? 'Pixel e token carregados' : 'Pixel ID ou token ausente'}
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-extrabold uppercase text-slate-400">Banco da Evolution</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {[
                                    ['labels', 'Labels'],
                                    ['chats', 'Chats'],
                                    ['contacts', 'Contatos']
                                ].map(([key, label]) => {
                                    const enabled = evolutionInfo?.dataStorage?.[key]?.value === true;
                                    const configured = evolutionInfo?.dataStorage?.[key]?.configured;

                                    return (
                                        <span
                                            key={key}
                                            className={`rounded-md px-2 py-1 text-xs font-extrabold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                                        >
                                            {label}: {configured ? (enabled ? 'ON' : 'OFF') : 'N/D'}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                        Configuração ainda não carregada.
                    </p>
                )}

                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
                    O modo atual atualiza contatos e envia leads qualificados para a Meta, sem carregar histórico de mensagens.
                </div>
            </section>
        </div>
    );

    const renderMainContent = () => {
        if (activeView === 'settings') {
            return (
                <div className="h-full overflow-y-auto">
                    {renderSettingsView()}
                </div>
            );
        }

        return renderLabelsView();
    };

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 lg:w-screen lg:flex-row">
            <aside className="flex shrink-0 flex-col bg-[#111827] px-3 py-3 text-slate-100 lg:h-full lg:w-64 lg:px-5 lg:py-6">
                <div className="hidden shrink-0 border-b border-slate-800 pb-5 text-center lg:block">
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

                <nav className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:block lg:flex-1 lg:space-y-2 lg:overflow-visible lg:py-5">
                    {navigationItems.map(item => {
                        const active = item.id === activeView;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveView(item.id)}
                                className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-extrabold transition lg:w-full lg:gap-3 lg:px-4 lg:py-3 lg:text-sm ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="hidden shrink-0 border-t border-slate-800 pt-5 lg:block">
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

            <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 lg:h-screen">
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

                <div className="min-h-0 flex-1 overflow-hidden p-3 lg:p-5">
                    {renderMainContent()}
                </div>
            </main>
        </div>
    );
};

export default WhatsappDashboard;
