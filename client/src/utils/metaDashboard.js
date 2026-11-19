export function filterMetaLeads(records, query = '', status = 'all') {
    const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const text = fold(query.trim());
    const digits = query.replace(/\D/g, '');
    const phoneVariants = value => {
        const clean = String(value || '').replace(/\D/g, '');
        const full = [10, 11].includes(clean.length) ? '55' + clean : clean;
        return [clean, full, /^55\d{2}9\d{8}$/.test(full) ? full.slice(0, 4) + full.slice(5) : full];
    };
    return records.filter(item => {
        const matchesStatus = status === 'all' || item.status === status
            || (status === 'attention' && ['failed', 'review', 'skipped'].includes(item.status));
        const matchesText = !text || fold(item.display_name).includes(text)
            || (digits && phoneVariants(digits).some(part => phoneVariants(item.phone || item.source_id).some(phone => phone.includes(part))));
        return matchesStatus && matchesText;
    });
}

export function purchasePresentation(item) {
    const labels = {
        sent: ['Recebida pela Meta', 'success', 'Recebimento confirmado.'],
        pending: ['Aguardando envio', 'neutral', 'O sistema enviará automaticamente.'],
        sending: ['Enviando', 'neutral', 'Aguardando resposta da Meta.'],
        retry: ['Nova tentativa agendada', 'warning', 'O sistema tentará novamente.'],
        review: ['Revisão necessária', 'warning', 'Confira o Gerenciador de Eventos antes de reenviar.'],
        expired: ['Prazo expirado', 'warning', 'O evento não será reenviado com uma data diferente.'],
        awaiting_source: ['Origem não identificada', 'warning', 'Edite o pedido e informe como o cliente chegou.'],
        not_meta: ['Fora dos anúncios', 'neutral', 'Venda registrada no ERP; não enviada à Meta.'],
        cancelled: ['Envio cancelado', 'neutral', 'Pedido cancelado ou sem pagamento confirmado.']
    };
    let [label, tone, detail] = labels[item.status] || ['Status indisponível', 'warning', 'Atualize para consultar o envio.'];
    if (item.status === 'retry' && item.last_error === 'missing_customer_phone_or_email') {
        label = 'Contato incompleto';
        detail = 'Cadastre um telefone ou e-mail válido no cliente.';
    }
    if (item.status === 'retry' && item.last_error === 'invalid_purchase_value') {
        label = 'Confira o valor';
        detail = 'O pedido precisa ter um valor válido para envio.';
    }
    return { label, tone, detail };
}

export function formatMetaDate(value) {
    if (!value) return '—';
    let input = value;
    if (typeof value === 'number') input = value * 1000;
    else if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) input = value.replace(' ', 'T') + 'Z';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' }).format(date);
}
