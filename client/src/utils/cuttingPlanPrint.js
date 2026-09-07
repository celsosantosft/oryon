function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatGrade(grade = []) {
    return grade.map((item) => `${escapeHtml(item.tamanho)} ${Number(item.quantidade) || 0}`).join(' · ') || 'Não informada';
}

function formatPartTotals(parts = []) {
    return parts.map((item) => (
        `${escapeHtml(item.tamanho)}: ${item.front} frente${item.front === 1 ? '' : 's'}, `
        + `${item.back} costa${item.back === 1 ? '' : 's'}, `
        + `${item.sleeve} manga${item.sleeve === 1 ? '' : 's'}`
    )).join(' · ');
}

function spreadSurplus(spread, requestedGrade) {
    const requested = new Map(requestedGrade.map((item) => [item.tamanho, item.quantidade]));
    return spread.partTotals.map((item) => {
        const quantity = requested.get(item.tamanho) || 0;
        return {
            tamanho: item.tamanho,
            front: Math.max(0, item.front - quantity),
            back: Math.max(0, item.back - quantity),
            sleeve: Math.max(0, item.sleeve - (quantity * 2))
        };
    }).filter((item) => item.front || item.back || item.sleeve);
}

function renderMarkers(spread) {
    return spread.markers.map((marker) => `
        <g>
            <rect x="${marker.x}" y="${marker.y}" width="${marker.width}" height="${marker.height}" />
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 - 5}" text-anchor="middle" class="part">${escapeHtml(marker.label)}</text>
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 + 9}" text-anchor="middle" class="size">${escapeHtml(marker.size)}</text>
        </g>
    `).join('');
}

export function buildCuttingPlanPrintHtml(plan, selectedOrders) {
    const ordersLabel = escapeHtml(selectedOrders
        .map((order) => order.tracking_code || `#${order.id_pedido}`)
        .join(', '));
    const requestedLabel = formatGrade(plan.gradeTotals);
    const pages = plan.spreads.map((spread, pageIndex) => {
        const surplus = spreadSurplus(spread, plan.gradeTotals);
        return `
            <section class="spread-page">
                <div class="title-row">
                    <div>
                        <h1>Plano de Corte PCP</h1>
                        <p class="muted">Pedidos: ${ordersLabel}</p>
                    </div>
                    <strong class="page-number">${pageIndex + 1}/${plan.spreads.length}</strong>
                </div>
                <div class="summary">
                    <b>Total solicitado:</b> ${requestedLabel}<br>
                    <b>Regra:</b> 1 frente, 1 costas e 2 mangas por camisa; moldes sem rotação.
                </div>
                <header class="spread-header">
                    <strong>Enfesto ${spread.index}</strong>
                    <span>${spread.layers} camada${spread.layers === 1 ? '' : 's'} · malha ${plan.table.width}cm x ${spread.usedLength}cm</span>
                </header>
                <div class="marker">
                    <svg viewBox="0 0 ${plan.table.width} ${spread.usedLength}" preserveAspectRatio="xMidYMin meet">
                        ${renderMarkers(spread)}
                    </svg>
                </div>
                <div class="result">
                    <p><b>Produção:</b> ${formatPartTotals(spread.partTotals)}</p>
                    <p><b>Sobras:</b> ${surplus.length ? formatPartTotals(surplus) : 'Nenhuma'}</p>
                </div>
            </section>
        `;
    }).join('');

    return `<!doctype html>
        <html lang="pt-BR">
        <head>
            <meta charset="utf-8">
            <title>Plano de Corte</title>
            <style>
                @page { size: A4 portrait; margin: 8mm; }
                * { box-sizing: border-box; }
                html, body { margin: 0; padding: 0; }
                body { font-family: Arial, sans-serif; color: #0f172a; }
                .spread-page {
                    width: 100%;
                    height: 280mm;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    break-after: page;
                    page-break-after: always;
                }
                .spread-page:last-child {
                    break-after: auto;
                    page-break-after: auto;
                }
                .title-row, .spread-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; }
                h1 { margin: 0 0 1mm; font-size: 17pt; }
                p { margin: 0; }
                .muted { color: #475569; font-size: 9pt; }
                .page-number { font-size: 9pt; }
                .summary { border: 1px solid #cbd5e1; padding: 2.5mm; margin: 3mm 0; font-size: 9pt; line-height: 1.35; }
                .spread-header { margin-bottom: 2mm; font-size: 9.5pt; }
                .marker { flex: 1; min-height: 0; display: flex; justify-content: center; }
                .marker svg { display: block; width: 100%; height: 100%; border: 1.5px solid #0f172a; background: white; }
                rect { fill: white; stroke: #ef0000; stroke-width: 0.7; }
                text { fill: #ef0000; font-weight: 900; }
                .part { font-size: 8px; }
                .size { font-size: 13px; }
                .result { padding-top: 2mm; font-size: 8.5pt; line-height: 1.35; }
                .result p + p { margin-top: 1mm; }
            </style>
        </head>
        <body>
            ${pages}
            <script>window.onload = () => { window.print(); };</script>
        </body>
        </html>`;
}
