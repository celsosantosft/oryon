import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const LABELS = {
    pending: 'Aguardando envio', sending: 'Enviando', retry: 'Aguardando nova tentativa',
    sent: 'Recebida pela Meta', cancelled: 'Envio cancelado', expired: 'Requer revisão'
};

export default function MetaPurchasesPanel({ apiBaseUrl, authConfig }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const refresh = useCallback(async () => {
        try {
            const response = await axios.get(`${apiBaseUrl}/whatsapp/meta/purchases`, authConfig);
            setData(response.data);
            setError('');
        } catch {
            setError('Não foi possível consultar os envios de compras.');
        }
    }, [apiBaseUrl, authConfig]);
    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, 30000);
        return () => clearInterval(timer);
    }, [refresh]);
    return (
        <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">Compras enviadas à Meta</h2>
                <button type="button" onClick={refresh} className="text-sm font-semibold text-blue-700">Atualizar</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">O primeiro sinal pago confirma a compra. O envio usa o valor total do pedido, uma vez por pedido. Pedidos já pagos antes da ativação não são reenviados.</p>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            {data && !data.configured && <p role="alert" className="mt-2 text-sm text-amber-800">Envio aguardando configuração do Pixel e token da Meta.</p>}
            {data?.test_mode && <p role="alert" className="mt-2 text-sm text-amber-800">Modo de teste ativo: os envios usam o código de teste da Meta.</p>}
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
