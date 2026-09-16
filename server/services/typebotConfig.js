async function saveTypebotConfig(evolution, instance, body) {
    const instancePath = encodeURIComponent(instance);
    const response = await evolution.get(`/typebot/find/${instancePath}`);
    const bots = Array.isArray(response.data) ? response.data : response.data?.typebot;
    if (!Array.isArray(bots)) throw new Error('Resposta inesperada ao consultar integrações Typebot.');
    const existing = body.id
        ? bots.find(bot => bot.id === body.id)
        : bots.find(bot => bot.typebot === body.typebot);
    if (body.id && !existing) throw new Error('Integração Typebot não encontrada. Atualize a página.');
    const payload = {
        enabled: body.enabled,
        url: body.url,
        typebot: body.typebot,
        expire: 0,
        keywordFinish: existing?.keywordFinish ?? '#SAIR',
        delayMessage: existing?.delayMessage ?? 1000,
        unknownMessage: existing?.unknownMessage ?? 'Mensagem não reconhecida',
        listeningFromMe: existing?.listeningFromMe ?? false,
        stopBotFromMe: existing?.stopBotFromMe ?? false,
        keepOpen: typeof body.oncePerContact === 'boolean' ? body.oncePerContact : (existing?.keepOpen ?? false),
        debounceTime: existing?.debounceTime ?? 0,
        ignoreJids: existing?.ignoreJids ?? [],
        triggerType: existing?.triggerType ?? 'all',
        triggerOperator: existing?.triggerOperator ?? 'contains',
        triggerValue: existing?.triggerValue ?? ''
    };
    // Atualizar conserva o botId e as sessões que impedem novos disparos por contato.
    if (existing?.id) {
        return evolution.put(`/typebot/update/${encodeURIComponent(existing.id)}/${instancePath}`, payload);
    }
    return evolution.post(`/typebot/create/${instancePath}`, payload);
}

module.exports = { saveTypebotConfig };
