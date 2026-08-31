import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { buildCuttingFabricTabs } from '../utils/cuttingGrouping';

function formatDate(value) {
    if (!value) return 'Sem prazo';
    const parts = String(value).split('-');
    const date = parts.length === 3
        ? new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0))
        : new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Sem prazo'
        : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getDeadlineState(value) {
    if (!value) return { label: 'Sem prazo', tone: 'neutral' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${value}T12:00:00`);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return { label: 'Atrasado', tone: 'danger' };
    if (diffDays === 0) return { label: 'Hoje', tone: 'danger' };
    if (diffDays === 1) return { label: 'Amanhã', tone: 'warning' };
    return { label: formatDate(value), tone: 'neutral' };
}

function GradePills({ grade }) {
    return (
        <div className="flex flex-wrap gap-2">
            {(grade || []).map(({ tamanho, quantidade }) => (
                <span
                    key={tamanho}
                    className={`flex min-w-[58px] items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm ${
                        quantidade > 0
                            ? 'border-slate-200 bg-white text-slate-800'
                            : 'border-slate-100 bg-slate-50 text-slate-300'
                    }`}
                >
                    <strong>{tamanho}</strong>
                    <span className="font-black">{quantidade}</span>
                </span>
            ))}
        </div>
    );
}

function OrderCard({ order, onOpen }) {
    const deadline = getDeadlineState(order.delivery_date);
    const urgent = order.priority === 'high';

    return (
        <button
            type="button"
            onClick={() => onOpen(order)}
            className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{order.tracking_code || `#${order.id_pedido}`}</p>
                    <h4 className="truncate text-base font-black text-slate-950">{order.cliente}</h4>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-600">{order.produto?.nome_produto}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    {urgent && <span className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-black uppercase text-red-700">Urgente</span>}
                    <span
                        className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ${
                            deadline.tone === 'danger'
                                ? 'bg-red-50 text-red-700'
                                : deadline.tone === 'warning'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        {deadline.label}
                    </span>
                </div>
            </div>

            <GradePills grade={order.grade} />

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span>{order.totalPieces} peças</span>
                {order.cor_tecido && <span>Cor: {order.cor_tecido}</span>}
                {order.produto?.acabamentos?.length > 0 && <span>{order.produto.acabamentos.join(' | ')}</span>}
            </div>
        </button>
    );
}

function OrderDetails({ order, apiBaseUrl, onClose, onComplete, completing }) {
    if (!order) return null;

    const imageUrl = order.layout_path ? `${apiBaseUrl}/uploads/${order.layout_path}` : '';

    return (
        <div className="fixed inset-0 z-[1000] flex items-end bg-slate-950/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
            <section
                className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:mx-auto sm:max-w-3xl sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wider text-blue-600">{order.tracking_code || `#${order.id_pedido}`}</p>
                        <h3 className="truncate text-lg font-black text-slate-950">{order.cliente}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-xl font-bold text-slate-500 hover:bg-slate-100">
                        ×
                    </button>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Layout do pedido</p>
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={`Layout do pedido ${order.tracking_code || order.id_pedido}`}
                                className="max-h-[420px] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                            />
                        ) : (
                            <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                                Nenhum layout anexado a este pedido.
                            </div>
                        )}
                    </div>

                    <aside className="space-y-4">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Produto</p>
                            <p className="mt-1 font-bold text-slate-950">{order.produto?.nome_produto || '-'}</p>
                            <p className="text-sm font-medium text-slate-600">{order.produto?.tecido || '-'}</p>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Grade</p>
                            <GradePills grade={order.grade} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Prazo</p>
                                <p className="font-black text-slate-900">{formatDate(order.delivery_date)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-400">Peças</p>
                                <p className="font-black text-slate-900">{order.totalPieces}</p>
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
                        {completing ? 'Enviando para costura...' : 'Concluir corte deste pedido'}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default function CutterDashboard() {
    const { token, API_BASE_URL } = useAuth();
    const [orders, setOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [selectedFabricId, setSelectedFabricId] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [completingOrderId, setCompletingOrderId] = useState(null);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        let isActive = true;

        const loadOrders = async () => {
            try {
                const authConfig = { headers: { Authorization: `Bearer ${token}` } };
                const [ordersResponse, historyResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/corte/pedidos`, authConfig),
                    axios.get(`${API_BASE_URL}/corte/pedidos?aba=historico`, authConfig)
                ]);

                if (!isActive) return;
                setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
                setHistoryOrders(Array.isArray(historyResponse.data) ? historyResponse.data : []);
            } catch (error) {
                if (!isActive) return;
                console.error('Erro ao carregar pedidos do corte:', error);
                setOrders([]);
                setHistoryOrders([]);
                setNotice('Não foi possível carregar os pedidos reais do corte. Verifique a conexão com a API.');
            } finally {
                if (isActive) setLoading(false);
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
    const activeFabric = fabricTabs.find((tab) => tab.id === selectedFabricId) || fabricTabs[0];
    const completedToday = historyOrders.length;
    const pendingPieces = fabricTabs.reduce((sum, tab) => sum + tab.totalPieces, 0);

    const completeOrder = async (order) => {
        const ok = window.confirm(`Confirmar corte concluído do pedido ${order.tracking_code || order.id_pedido}? Ele será enviado para Costura e sairá da fila de corte.`);
        if (!ok) return;

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
            setNotice(`Pedido ${order.tracking_code || order.id_pedido} enviado para Costura.`);
        } catch (error) {
            console.error('Erro ao concluir pedido no corte:', error);
            setNotice('Não foi possível concluir este pedido. Tente novamente.');
        } finally {
            setCompletingOrderId(null);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
                <header className="mb-4 sm:mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-blue-600">PCP / Corte</p>
                            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Mesa de Corte</h1>
                            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
                                Escolha a malha em produção, confira as modelagens e conclua os pedidos cortados.
                            </p>
                        </div>
                    </div>
                </header>

                <section className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-black uppercase text-slate-400">Pedidos</p>
                        <p className="text-xl font-black text-slate-950">{orders.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-black uppercase text-slate-400">Peças</p>
                        <p className="text-xl font-black text-blue-700">{pendingPieces}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-black uppercase text-slate-400">Histórico</p>
                        <p className="text-xl font-black text-green-700">{completedToday}</p>
                    </div>
                </section>

                {notice && (
                    <p className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${
                        notice.startsWith('Não') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
                    }`}>
                        {notice}
                    </p>
                )}

                <nav className="-mx-3 mb-5 overflow-x-auto px-3" aria-label="Malhas com pedidos no corte">
                    <div className="flex min-w-max gap-2">
                        {fabricTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelectedFabricId(tab.id)}
                                className={`rounded-lg border px-4 py-3 text-sm font-black transition ${
                                    activeFabric?.id === tab.id
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
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

                {loading && <p className="rounded-lg bg-blue-50 p-4 text-sm font-bold text-blue-700">Carregando pedidos liberados para corte...</p>}

                {!loading && !activeFabric && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500">
                        Nenhum pedido liberado para corte.
                    </div>
                )}

                {activeFabric && (
                    <section className="space-y-5">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-blue-600">Malha ativa</p>
                                    <h2 className="text-2xl font-black text-slate-950">{activeFabric.label}</h2>
                                </div>
                                <span className="rounded-md bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
                                    {activeFabric.totalPieces} peças
                                </span>
                            </div>
                            <GradePills grade={activeFabric.gradeTotals} />
                        </div>

                        {activeFabric.modelings.map((group) => (
                            <article key={group.id} className="rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm sm:p-4">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-950">{group.label}</h3>
                                        <p className="text-sm font-bold text-slate-500">
                                            {group.orderCount} pedidos · {group.totalPieces} peças
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <GradePills grade={group.gradeTotals} />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {group.orders.map((order) => (
                                        <OrderCard key={`${order.id_pedido}-${order.produto?.nome_produto}`} order={order} onOpen={setSelectedOrder} />
                                    ))}
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>

            <OrderDetails
                order={selectedOrder}
                apiBaseUrl={API_BASE_URL}
                onClose={() => setSelectedOrder(null)}
                onComplete={completeOrder}
                completing={selectedOrder && completingOrderId === selectedOrder.id_pedido}
            />
        </main>
    );
}
