import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Modal from './Modal';
import { getCalendarConnectionTone, normalizeCalendarReminderInputs } from '../utils/calendarIntegration';

const CalendarIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
    </svg>
);

const initialIntegration = {
    configured: false,
    server_ready: false,
    reminder_days: [7, 5, 3, 1, 0],
    health: 'disconnected',
    pending_count: 0,
    failed_count: 0
};

export default function GoogleCalendarIntegrationPanel({ token, apiBaseUrl, label = 'Google Agenda' }) {
    const [open, setOpen] = useState(false);
    const [integration, setIntegration] = useState(initialIntegration);
    const [reminders, setReminders] = useState(initialIntegration.reminder_days.map(String));
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
    const endpoint = `${apiBaseUrl}/calendar/integration`;

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(endpoint, { headers });
            setIntegration(data);
            setReminders((data.reminder_days || initialIntegration.reminder_days).map(String));
        } catch (error) {
            setMessage(error.response?.data?.message || 'Não foi possível consultar o Google Agenda.');
        } finally {
            setLoading(false);
        }
    }, [endpoint, headers]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const result = params.get('calendar');
        if (!result) return;
        // O retorno do OAuth precisa restaurar o painel e o resultado da ação.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true);
        setMessage(result === 'connected' ? 'Google Agenda conectado com sucesso.' : 'A conexão com o Google não foi concluída.');
        params.delete('calendar');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
        load();
    }, [load]);

    useEffect(() => {
        if (!open || !integration.pending_count) return undefined;
        const timer = window.setInterval(load, 5000);
        return () => window.clearInterval(timer);
    }, [open, integration.pending_count, load]);

    const run = async (action, successMessage) => {
        setBusy(true);
        setMessage('');
        try {
            await action();
            setMessage(successMessage);
            await load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || 'Não foi possível concluir esta ação.');
        } finally { setBusy(false); }
    };

    const connect = () => run(async () => {
        const { data } = await axios.post(`${apiBaseUrl}/calendar/oauth/start`, {}, { headers });
        window.location.assign(data.authorization_url);
    }, 'Abrindo o Google...');

    const save = () => run(async () => {
        const reminder_days = normalizeCalendarReminderInputs(reminders);
        await axios.put(endpoint, { reminder_days }, { headers });
    }, 'Lembretes salvos. Os pedidos ativos serão atualizados.');

    const sync = () => run(
        () => axios.post(`${endpoint}/sync-active`, {}, { headers }),
        'Pedidos ativos adicionados à fila de sincronização.'
    );

    const retry = () => run(
        () => axios.post(`${endpoint}/retry`, {}, { headers }),
        'Sincronizações com erro foram reenfileiradas.'
    );

    const disconnect = () => {
        if (!window.confirm('Desconectar o Google Agenda desta empresa?')) return;
        run(() => axios.delete(endpoint, { headers }), 'Google Agenda desconectado.');
    };

    const updateReminder = (index, value) => setReminders(current => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const addReminder = () => setReminders(current => {
        if (current.length >= 5) return current;
        const next = [7, 5, 3, 1, 0, 2, 4, 6].find(value => !current.includes(String(value))) ?? 0;
        return [...current, String(next)];
    });
    const removeReminder = (index) => setReminders(current => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
    const tone = getCalendarConnectionTone(integration);
    const triggerLabel = integration.configured ? 'Agenda conectada' : label;

    return (
        <>
            <style>{panelCss}</style>
            <button type="button" className={`calendar-trigger calendar-trigger--${tone}`} onClick={() => setOpen(true)} aria-label="Configurar Google Agenda">
                <CalendarIcon />
                <span>{loading ? 'Consultando agenda' : triggerLabel}</span>
                {integration.failed_count > 0 && <strong>{integration.failed_count}</strong>}
            </button>

            <Modal isOpen={open} onClose={() => setOpen(false)} title="Google Agenda">
                <div className="calendar-panel">
                    <section className={`calendar-status calendar-status--${tone}`}>
                        <div className="calendar-status__icon"><CalendarIcon size={22}/></div>
                        <div>
                            <strong>{integration.configured ? 'Agenda da empresa conectada' : 'Conecte o e-mail da empresa'}</strong>
                            <p>{integration.configured
                                ? integration.account_email
                                : 'Os pedidos serão incluídos automaticamente na data de entrega.'}</p>
                        </div>
                    </section>

                    {message && <div className="calendar-message" role="status">{message}</div>}

                    {!integration.configured ? (
                        <div className="calendar-empty">
                            {!integration.server_ready && (
                                <p className="calendar-warning">A integração ainda precisa das credenciais do Google configuradas no servidor.</p>
                            )}
                            <button type="button" className="calendar-primary" onClick={connect} disabled={busy || !integration.server_ready}>
                                <CalendarIcon /> Conectar e-mail Google
                            </button>
                        </div>
                    ) : (
                        <>
                            <section className="calendar-section">
                                <div className="calendar-section__heading">
                                    <div><strong>Lembretes</strong><p>Dias antes da entrega</p></div>
                                </div>
                                <div className="calendar-reminders">
                                    {reminders.map((value, index) => (
                                        <label key={index}>
                                            <span>{index + 1}º</span>
                                            <div className="calendar-reminder-input">
                                                <input type="number" min="0" max="28" step="1" value={value} onChange={event => updateReminder(index, event.target.value)} aria-label={`Lembrete ${index + 1} em dias`} />
                                                <button type="button" onClick={() => removeReminder(index)} disabled={reminders.length === 1} aria-label={`Remover lembrete ${index + 1}`} title="Remover lembrete">×</button>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="calendar-reminder-controls">
                                    <button type="button" onClick={addReminder} disabled={reminders.length >= 5}>Adicionar lembrete</button>
                                    <button type="button" className="calendar-primary" onClick={save} disabled={busy}>Salvar lembretes</button>
                                </div>
                            </section>

                            <section className="calendar-health">
                                <div><span>Pendentes</span><strong>{integration.pending_count || 0}</strong></div>
                                <div><span>Com erro</span><strong>{integration.failed_count || 0}</strong></div>
                                <div><span>Última sincronização</span><strong>{integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString('pt-BR') : 'Ainda não ocorreu'}</strong></div>
                            </section>

                            {integration.last_error && <p className="calendar-warning">{integration.last_error}</p>}

                            <div className="calendar-actions">
                                <button type="button" onClick={sync} disabled={busy}>Sincronizar pedidos ativos</button>
                                <button type="button" onClick={retry} disabled={busy || !integration.failed_count}>Tentar novamente</button>
                                {integration.calendar_url && <a href={integration.calendar_url} target="_blank" rel="noreferrer">Abrir agenda</a>}
                                <button type="button" className="calendar-danger" onClick={disconnect} disabled={busy}>Desconectar</button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
}

const panelCss = `
    .calendar-trigger { min-height:44px; display:inline-flex; align-items:center; gap:9px; padding:0 14px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#334155; font:700 .86rem/1 Inter,sans-serif; cursor:pointer; transition:transform 140ms cubic-bezier(.23,1,.32,1), background-color 160ms ease, border-color 160ms ease; touch-action:manipulation; user-select:none; -webkit-user-select:none; }
    .calendar-trigger:active, .calendar-primary:active, .calendar-actions button:active, .calendar-actions a:active { transform:scale(.97); }
    .calendar-trigger--success { color:#047857; border-color:#6ee7b7; background:#ecfdf5; }
    .calendar-trigger--warning { color:#a16207; border-color:#fde68a; background:#fffbeb; }
    .calendar-trigger--danger { color:#b91c1c; border-color:#fecaca; background:#fef2f2; }
    .calendar-trigger strong { min-width:20px; height:20px; display:grid; place-items:center; border-radius:10px; background:#b91c1c; color:white; font-size:.7rem; }
    .calendar-panel { display:grid; gap:18px; }
    .calendar-status { display:flex; align-items:center; gap:12px; padding:16px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; }
    .calendar-status--success { border-color:#a7f3d0; background:#ecfdf5; }
    .calendar-status--danger { border-color:#fecaca; background:#fef2f2; }
    .calendar-status__icon { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; border-radius:8px; background:white; color:#334155; box-shadow:0 1px 2px rgba(15,23,42,.08); }
    .calendar-status strong, .calendar-section strong { color:#0f172a; font-size:.95rem; }
    .calendar-status p, .calendar-section p { margin:4px 0 0; color:#64748b; font-size:.84rem; overflow-wrap:anywhere; }
    .calendar-message, .calendar-warning { margin:0; padding:12px 14px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; color:#475569; font-size:.84rem; }
    .calendar-warning { color:#92400e; background:#fffbeb; border-color:#fde68a; }
    .calendar-empty { display:grid; gap:14px; justify-items:start; }
    .calendar-section { display:grid; gap:14px; padding-top:2px; }
    .calendar-reminders { display:grid; grid-template-columns:repeat(5, minmax(64px, 1fr)); gap:8px; }
    .calendar-reminders label { display:grid; gap:5px; color:#64748b; font-size:.7rem; font-weight:700; }
    .calendar-reminder-input { position:relative; }
    .calendar-reminders input { width:100%; min-height:44px; box-sizing:border-box; padding:0 34px 0 10px; border:1px solid #cbd5e1; border-radius:8px; color:#0f172a; background:white; font-size:16px; font-weight:700; }
    .calendar-reminder-input button { position:absolute; right:4px; top:4px; width:36px; height:36px; border:0; border-radius:6px; background:transparent; color:#94a3b8; font-size:20px; cursor:pointer; }
    .calendar-reminder-input button:disabled { opacity:.25; cursor:not-allowed; }
    .calendar-reminder-controls { display:flex; flex-wrap:wrap; gap:8px; }
    .calendar-reminder-controls > button { min-height:44px; padding:0 14px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#334155; font-weight:700; cursor:pointer; }
    .calendar-reminder-controls > button:disabled { opacity:.5; cursor:not-allowed; }
    .calendar-primary, .calendar-actions button, .calendar-actions a { min-height:44px; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:0 14px; border-radius:8px; border:1px solid #cbd5e1; background:white; color:#334155; text-decoration:none; font:700 .82rem/1 Inter,sans-serif; cursor:pointer; transition:transform 140ms cubic-bezier(.23,1,.32,1), background-color 160ms ease; touch-action:manipulation; }
    .calendar-primary { width:max-content; color:white; background:#166534; border-color:#166534; }
    .calendar-primary:disabled, .calendar-actions button:disabled { opacity:.5; cursor:not-allowed; }
    .calendar-health { display:grid; grid-template-columns:1fr 1fr 2fr; gap:8px; }
    .calendar-health div { min-width:0; padding:12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; display:grid; gap:4px; }
    .calendar-health span { color:#64748b; font-size:.7rem; font-weight:700; text-transform:uppercase; }
    .calendar-health strong { color:#0f172a; font-size:.82rem; overflow-wrap:anywhere; }
    .calendar-actions { display:flex; flex-wrap:wrap; gap:8px; padding-top:2px; }
    .calendar-actions .calendar-danger { color:#b91c1c; border-color:#fecaca; margin-left:auto; }
    @media (hover:hover) and (pointer:fine) { .calendar-trigger:hover, .calendar-actions button:hover, .calendar-actions a:hover { background:#f8fafc; } .calendar-primary:hover { background:#14532d; } }
    @media (max-width:640px) { .calendar-trigger span { display:none; } .calendar-trigger { width:44px; padding:0; justify-content:center; } .calendar-reminders { grid-template-columns:repeat(5, minmax(50px, 1fr)); } .calendar-health { grid-template-columns:1fr 1fr; } .calendar-health div:last-child { grid-column:1 / -1; } .calendar-actions { display:grid; grid-template-columns:1fr; } .calendar-actions .calendar-danger { margin-left:0; } .calendar-primary { width:100%; } }
`;
