import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { buildCuttingFabricTabs } from '../utils/cuttingGrouping';

function parseDate(value) {
    if (!value) return null;
    const parts = String(value).split('-');
    const date = parts.length === 3
        ? new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0))
        : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = parseDate(value);
    return date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Sem prazo';
}

function getDeadlineState(value) {
    const date = parseDate(value);
    if (!date) return { label: 'Sem prazo', tone: 'neutral' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return { label: 'Atrasado', tone: 'danger' };
    if (diffDays === 0) return { label: 'Hoje', tone: 'danger' };
    if (diffDays === 1) return { label: 'Amanhã', tone: 'warning' };
    return { label: formatDate(value), tone: 'neutral' };
}

function getOrderUrgency(order) {
    const deadline = getDeadlineState(order.delivery_date);
    if (order.priority === 'high') return { label: 'Urgente', tone: 'danger' };
    if (deadline.tone === 'danger') return { label: deadline.label, tone: 'danger' };
    if (deadline.tone === 'warning') return { label: deadline.label, tone: 'warning' };
    return null;
}

function gradeTotal(grade = []) {
    return grade.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
}

function GradePills({ grade, compact = false }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {(grade || []).map(({ tamanho, quantidade }) => (
                <span
                    key={tamanho}
                    className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white font-black text-slate-800 ${
                        compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'
                    }`}
                >
                    <span>{tamanho}</span>
                    <span className="text-blue-700">{quantidade}</span>
                </span>
            ))}
        </div>
    );
}

function DeadlineBadge({ order }) {
    const deadline = getDeadlineState(order.delivery_date);
    const urgency = getOrderUrgency(order);
    const tone = urgency?.tone || deadline.tone;
    const label = urgency?.label || deadline.label;
    const className = tone === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700'
        : tone === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600';

    return (
        <span className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${className}`}>
            {label}
        </span>
    );
}

function OrderCard({ order, onOpen }) {
    const urgent = Boolean(getOrderUrgency(order));

    return (
        <button
            type="button"
            onClick={() => onOpen(order)}
            className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition active:scale-[0.99] ${
                urgent ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'
            }`}
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                        {order.tracking_code || `#${order.id_pedido}`}
                    </p>
                    <h4 className="mt-0.5 truncate text-base font-black text-slate-950">{order.cliente || 'Cliente não informado'}</h4>
                    <p className="mt-1 text-sm font-bold text-slate-700">{order.modelingLabel || order.produto?.nome_produto || 'Produto não informado'}</p>
                </div>
                <DeadlineBadge order={order} />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-md bg-slate-50 px-2 py-1">Malha: {order.produto?.tecido || order.fabricLabel || '-'}</span>
                <span className="rounded-md bg-slate-50 px-2 py-1">Cor: {order.cor_tecido || 'Não informada'}</span>
            </div>

            <GradePills grade={order.grade} compact />

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-sm font-black text-slate-900">{order.totalPieces || gradeTotal(order.grade)} peças</span>
                <span className="text-xs font-bold text-slate-500">Prazo {formatDate(order.delivery_date)}</span>
            </div>
        </button>
    );
}

function OrderDetails({ order, apiBaseUrl, completing, onClose, onComplete }) {
    if (!order) return null;

    const imageUrl = order.layout_path ? `${apiBaseUrl}/uploads/${order.layout_path}` : '';
    const finishes = order.produto?.acabamentos || [];

    return (
        <div className="fixed inset-0 z-[1000] flex items-end bg-slate-950/60 sm:items-center sm:p-6" onClick={onClose}>
            <section
                className="max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:mx-auto sm:max-w-3xl sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wider text-blue-700">{order.tracking_code || `#${order.id_pedido}`}</p>
                        <h3 className="truncate text-lg font-black text-slate-950">{order.cliente || 'Cliente não informado'}</h3>
                        <p className="text-sm font-bold text-slate-600">{order.modelingLabel || order.produto?.nome_produto || 'Produto não informado'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="h-10 w-10 rounded-md text-2xl font-bold text-slate-500 hover:bg-slate-100">
                        x
                    </button>
                </div>

                <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_290px]">
                    <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Layout / anexo</p>
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={`Layout do pedido ${order.tracking_code || order.id_pedido}`}
                                className="max-h-[430px] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                            />
                        ) : (
                            <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                                Nenhum layout anexado a este pedido.
                            </div>
                        )}
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Produção</p>
                            <p className="mt-1 font-black text-slate-950">{order.produto?.nome_produto || order.modelingLabel || '-'}</p>
                            <p className="text-sm font-bold text-slate-600">{order.produto?.tecido || order.fabricLabel || '-'}</p>
                            <p className="text-sm font-bold text-slate-600">Cor: {order.cor_tecido || 'Não informada'}</p>
                            {finishes.length > 0 && <p className="mt-1 text-xs font-bold text-slate-500">{finishes.join(' | ')}</p>}
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Grade completa</p>
                            <GradePills grade={order.grade} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Prazo</p>
                                <p className="font-black text-slate-900">{formatDate(order.delivery_date)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Peças</p>
                                <p className="font-black text-slate-900">{order.totalPieces || gradeTotal(order.grade)}</p>
                            </div>
                        </div>

                        {order.observacao && (
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Observações</p>
                                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-sm text-slate-700">{order.observacao}</p>
                            </div>
                        )}

                        {order.url_referencia && (
                            <a
                                href={order.url_referencia}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-700"
                            >
                                Abrir referência
                            </a>
                        )}
                    </aside>
                </div>

                <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4">
                    <button
                        type="button"
                        disabled={completing}
                        onClick={() => onComplete(order)}
                        className="h-12 w-full rounded-lg bg-green-600 px-4 text-base font-black uppercase text-white shadow-sm hover:bg-green-700 disabled:cursor-wait disabled:bg-green-400"
                    >
                        {completing ? 'Concluindo corte...' : 'Concluir corte deste pedido'}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default function CutterDashboard() {
    const { token, API_BASE_URL } = useAuth();
    const [orders, setOrders] = useState([]);
    const [selectedFabricId, setSelectedFabricId] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [notice, setNotice] = useState('');
    const [completingOrderId, setCompletingOrderId] = useState(null);

    useEffect(() => {
        let isActive = true;
        let requestInFlight = false;

        const loadOrders = async () => {
            if (requestInFlight) return;
            requestInFlight = true;

            try {
                const response = await axios.get(`${API_BASE_URL}/corte/pedidos`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!isActive) return;
                setOrders(Array.isArray(response.data) ? response.data : []);
                setLoadError('');
            } catch (error) {
                if (!isActive) return;
                console.error('Erro ao carregar pedidos reais do corte:', error);
                setOrders([]);
                setLoadError('Não foi possível carregar os pedidos reais do corte. Verifique a conexão com a API.');
            } finally {
                if (isActive) setLoading(false);
                requestInFlight = false;
            }
        };

        if (token) {
            loadOrders();
            const pollingId = window.setInterval(loadOrders, 15000);
            return () => {
                isActive = false;
                window.clearInterval(pollingId);
            };
        }

        return () => {
            isActive = false;
        };
    }, [API_BASE_URL, token]);

    const fabricTabs = useMemo(() => buildCuttingFabricTabs(orders), [orders]);
    const activeFabric = fabricTabs.find((tab) => tab.id === selectedFabricId) || fabricTabs[0] || null;
    const totalOrders = useMemo(() => new Set(fabricTabs.flatMap((tab) => (
        tab.modelings.flatMap((group) => group.orders.map((order) => order.id_pedido))
    ))).size, [fabricTabs]);
    const totalPieces = fabricTabs.reduce((sum, tab) => sum + tab.totalPieces, 0);
    const urgentOrders = fabricTabs.reduce((sum, tab) => sum + tab.modelings.reduce((groupSum, group) => (
        groupSum + group.orders.filter((order) => Boolean(getOrderUrgency(order))).length
    ), 0), 0);

    useEffect(() => {
        if (!activeFabric) {
            if (selectedFabricId) setSelectedFabricId('');
            return;
        }

        if (selectedFabricId !== activeFabric.id) {
            setSelectedFabricId(activeFabric.id);
        }
    }, [activeFabric, selectedFabricId]);

    const completeOrder = async (order) => {
        const label = order.tracking_code || `#${order.id_pedido}`;
        const confirmed = window.confirm(`Confirmar corte concluído do pedido ${label}? Ele sairá da fila de corte e irá para Costura Iniciada.`);
        if (!confirmed) return;

        setCompletingOrderId(order.id_pedido);
        setNotice('');

        try {
            await axios.post(
                `${API_BASE_URL}/corte/arquivar`,
                { id_pedido: order.id_pedido },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setOrders((current) => current.filter((item) => item.id_pedido !== order.id_pedido));
            setSelectedOrder(null);
            setNotice(`Pedido ${label} concluído e enviado para Costura Iniciada.`);
        } catch (error) {
            console.error('Erro ao concluir pedido no corte:', error);
            setNotice('Não foi possível concluir este pedido. Tente novamente.');
        } finally {
            setCompletingOrderId(null);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 lg:px-8">
                <header className="mb-4">
                    <p className="text-xs font-black uppercase tracking-widest text-blue-700">Corte PCP</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Fila real de corte</h1>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                        Escolha a malha da mesa, confira a modelagem e conclua o pedido real cortado.
                    </p>
                </header>

                <section className="mb-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400">Pedidos</p>
                        <p className="text-xl font-black text-slate-950">{totalOrders}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400">Peças</p>
                        <p className="text-xl font-black text-blue-700">{totalPieces}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400">Atenção</p>
                        <p className="text-xl font-black text-red-700">{urgentOrders}</p>
                    </div>
                </section>

                {notice && (
                    <p className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${
                        notice.startsWith('Não') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
                    }`}>
                        {notice}
                    </p>
                )}

                {loadError && (
                    <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {loadError}
                    </p>
                )}

                {loading && <p className="rounded-lg bg-blue-50 p-4 text-sm font-bold text-blue-700">Carregando pedidos reais liberados para corte...</p>}

                {!loading && !loadError && fabricTabs.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                        Nenhum pedido liberado para corte.
                    </div>
                )}

                {fabricTabs.length > 0 && (
                    <>
                        <nav className="-mx-3 mb-4 overflow-x-auto px-3" aria-label="Malhas com pedidos ativos no corte">
                            <div className="flex min-w-max gap-2">
                                {fabricTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedFabricId(tab.id)}
                                        className={`rounded-lg border px-4 py-3 text-sm font-black transition ${
                                            activeFabric?.id === tab.id
                                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-700'
                                        }`}
                                    >
                                        {tab.label}
                                        <span className={`ml-2 rounded-md px-2 py-1 text-xs ${activeFabric?.id === tab.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                            {tab.orderCount}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </nav>

                        {activeFabric && (
                            <section className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-blue-700">Malha na mesa</p>
                                            <h2 className="text-2xl font-black text-slate-950">{activeFabric.label}</h2>
                                        </div>
                                        <span className="rounded-md bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
                                            {activeFabric.totalPieces} peças
                                        </span>
                                    </div>
                                    <GradePills grade={activeFabric.gradeTotals} compact />
                                </div>

                                {activeFabric.modelings.map((group) => (
                                    <article key={group.id} className="rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-950">{group.label}</h3>
                                                <p className="text-sm font-bold text-slate-500">
                                                    {group.orderCount} pedido{group.orderCount === 1 ? '' : 's'} · {group.totalPieces} peças
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <GradePills grade={group.gradeTotals} compact />
                                        </div>

                                        <div className="grid gap-3 lg:grid-cols-2">
                                            {group.orders.map((order) => (
                                                <OrderCard
                                                    key={`${order.id_pedido}-${order.produto?.nome_produto}-${order.produto?.tecido}`}
                                                    order={order}
                                                    onOpen={setSelectedOrder}
                                                />
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </section>
                        )}
                    </>
                )}
            </div>

            <OrderDetails
                order={selectedOrder}
                apiBaseUrl={API_BASE_URL}
                completing={selectedOrder && completingOrderId === selectedOrder.id_pedido}
                onClose={() => setSelectedOrder(null)}
                onComplete={completeOrder}
            />
        </main>
    );
}
