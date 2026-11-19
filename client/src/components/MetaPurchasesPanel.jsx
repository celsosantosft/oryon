import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { purchasePresentation, formatMetaDate } from '../utils/metaDashboard';

const LABELS = {
    pending: 'Aguardando envio', sending: 'Enviando', retry: 'Aguardando nova tentativa',
    sent: 'Recebida pela Meta', cancelled: 'Envio cancelado', expired: 'Requer revisão', review: 'Recebimento incerto — revisar antes de reenviar',
    awaiting_source: 'Informe a origem no pedido', not_meta: 'Não enviado — origem fora de anúncios'
};

export default function MetaPurchasesPanel({ apiBaseUrl, authConfig, expanded = false, onSettings, onOrders }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const response = await axios.get(`${apiBaseUrl}/whatsapp/meta/purchases`, authConfig);
            setData(response.data);
            setError('');
        } catch {
            setError('Não foi possível consultar os envios de compras.');
        } finally {
            setRefreshing(false);
        }
    }, [apiBaseUrl, authConfig]);
    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, 30000);
        return () => clearInterval(timer);
    }, [refresh]);
    if (expanded) {
        const counts = Object.fromEntries((data?.counts || []).map(item => [item.status, Number(item.total)]));
        const needsAttention = ['retry', 'review', 'expired'];
        const visible = (data?.recent || []).filter(item => filter === 'all' || item.status === filter
            || (filter === 'attention' && needsAttention.includes(item.status)));
        const tones = { success: 'bg-emerald-50 text-emerald-700 ring-emerald-200', warning: 'bg-amber-50 text-amber-800 ring-amber-200', neutral: 'bg-slate-100 text-slate-600 ring-slate-200' };
        return <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="text-xl font-semibold text-slate-950">Compras automáticas</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pedidos de anúncio com sinal pago. Cada pedido envia uma compra pelo valor total.</p></div>
                    <div className="flex gap-2"><button type="button" onClick={onOrders} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Abrir pedidos</button><button type="button" onClick={refresh} disabled={refreshing} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{refreshing ? 'Atualizando…' : 'Atualizar'}</button></div>
                </div>
                {data && <div className="mt-5 grid grid-cols-3 gap-3">
                    {[['Recebidas pela Meta', counts.sent || 0], ['Aguardando origem', counts.awaiting_source || 0], ['Precisam de atenção', needsAttention.reduce((sum, key) => sum + (counts[key] || 0), 0)]].map(([label, total]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-xl text-slate-950">{total}</strong></div>)}
                </div>}
                {data && (!data.configured || !data.messaging_configured || data.test_mode) && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span>{!data.configured ? 'Configuração de envio pendente.' : data.test_mode ? 'Modo de teste ativo na Meta.' : 'A atribuição das conversões do WhatsApp ainda precisa ser configurada.'}</span><button type="button" onClick={onSettings} className="min-h-10 font-semibold underline">Ver conexão</button>
                </div>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-500">Últimos 20 registros · totais de todo o histórico acima</p>
                <select aria-label="Filtrar compras por status" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">Todos os status</option><option value="sent">Recebidas pela Meta</option><option value="awaiting_source">Aguardando origem</option><option value="attention">Precisam de atenção</option><option value="not_meta">Fora dos anúncios</option></select>
            </div>
            {error && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="min-h-0 flex-1 overflow-auto">
                {!data && !error ? <p role="status" className="p-8 text-sm text-slate-500">Consultando compras…</p> : visible.length ? <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className="px-5 py-3">Pedido / cliente</th><th scope="col" className="px-5 py-3">Valor do pedido</th><th scope="col" className="px-5 py-3">Situação</th><th scope="col" className="px-5 py-3">Atualização</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{visible.map(item => {
                        const presentation = purchasePresentation(item);
                        return <tr key={item.order_id} className="align-top hover:bg-slate-50"><td className="px-5 py-4"><strong className="block font-semibold text-slate-900">{item.tracking_code || `Pedido ${item.order_id}`}</strong><span className="mt-1 block text-slate-500">{item.client_name || 'Cliente não informado'}</span></td><td className="whitespace-nowrap px-5 py-4 text-slate-800">{Number(item.purchase_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[presentation.tone]}`}>{presentation.label}</span><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{presentation.detail}</p></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatMetaDate(item.updated_at)}</td></tr>;
                    })}</tbody>
                </table> : !error && <p className="p-10 text-center text-sm text-slate-500">{data?.recent?.length ? 'Nenhuma compra corresponde ao filtro.' : 'Nenhuma nova compra registrada para envio.'}</p>}
            </div>
            <p className="shrink-0 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Recebimento na Meta não comprova atribuição ao anúncio. Parcelas e pedidos históricos não geram novo envio.</p>
        </section>;
    }
    return (
        <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">Compras enviadas à Meta</h2>
                <button type="button" onClick={refresh} className="text-sm font-semibold text-blue-700">Atualizar</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Somente pedidos com origem “Anúncio Facebook/Instagram” e sinal pago enviam a compra. O envio usa o valor total, uma vez por pedido. Pedidos antigos não são reenviados.</p>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            {data && !data.configured && <p role="alert" className="mt-2 text-sm text-amber-800">Envio aguardando configuração do Pixel e token da Meta.</p>}
            {data?.test_mode && <p role="alert" className="mt-2 text-sm text-amber-800">Modo de teste ativo: os envios usam o código de teste da Meta.</p>}
            {data && !data.messaging_configured && <p className="mt-2 text-sm text-amber-800">A integração de conversões do WhatsApp ainda não foi configurada. Compras do ERP e atribuição ao anúncio são verificações diferentes.</p>}
            {!data && !error && <p className="mt-2 text-sm text-slate-500">Consultando envios…</p>}
            {data && !data.recent.length && <p className="mt-2 text-sm text-slate-500">Nenhuma nova compra registrada para envio.</p>}
            {Boolean(data?.recent.length) && <div className="mt-3 max-h-44 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead><tr><th className="p-2">Pedido</th><th className="p-2">Valor</th><th className="p-2">Envio</th></tr></thead>
                    <tbody>{data.recent.map(item => <tr key={item.order_id} className="border-t border-slate-100">
                        <td className="p-2">{item.order_id}</td>
                        <td className="p-2">{Number(item.purchase_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="p-2">{LABELS[item.status] || item.status}{item.last_error && <span className="block text-xs text-amber-800">{item.last_error === 'missing_customer_phone_or_email' ? 'Cadastre telefone ou e-mail válido no cliente.' : item.last_error === 'invalid_purchase_value' ? 'Confira o valor do pedido.' : item.status === 'expired' ? 'O prazo de envio expirou. Confira a integração.' : 'O envio ainda não foi confirmado. Confira a integração.'}</span>}</td>
                    </tr>)}</tbody>
                </table>
            </div>}
            <p className="mt-2 text-xs text-slate-500">Recebimento confirmado não significa atribuição ao anúncio ou otimização da campanha.</p>
        </section>
    );
}
