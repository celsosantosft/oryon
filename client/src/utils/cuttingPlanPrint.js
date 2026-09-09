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

function renderMarkers(spread) {
    return spread.markers.map((marker) => marker.transformation ? `
        <g>
            <rect x="${marker.x}" y="${marker.y}" width="${marker.width}" height="${marker.height}" />
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 - 15}" text-anchor="middle" class="part">${escapeHtml(marker.label)}</text>
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 - 3}" text-anchor="middle" class="size">${escapeHtml(marker.size)}</text>
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 + 10}" text-anchor="middle" class="instruction">MANTER ${marker.transformation.keepBack} COSTAS</text>
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 + 17}" text-anchor="middle" class="instruction">TRANSFORMAR ${marker.transformation.toFront} EM FRENTE</text>
        </g>
    ` : `
        <g>
            <rect x="${marker.x}" y="${marker.y}" width="${marker.width}" height="${marker.height}" />
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 - 5}" text-anchor="middle" class="part">${escapeHtml(marker.label)}</text>
            <text x="${marker.x + marker.width / 2}" y="${marker.y + marker.height / 2 + 9}" text-anchor="middle" class="size">${escapeHtml(marker.size)}</text>
        </g>
    `).join('');
}

function renderLooseCuts(looseCuts, plural = true) {
    if (!looseCuts?.length) return '';
    return `
        <div class="loose-cuts">
            <b>${plural ? 'Cortes avulsos em retalho' : 'Corte avulso em retalho'}:</b>
            ${formatPartTotals(looseCuts)}
        </div>
    `;
}

export function buildCuttingPlanPrintHtml(plan, selectedOrders) {
    const ordersLabel = escapeHtml(selectedOrders
        .map((order) => order.tracking_code || `#${order.id_pedido}`)
        .join(', '));
    const requestedLabel = formatGrade(plan.gradeTotals);
    const pageCount = plan.spreads.length || 1;
    const pages = plan.spreads.map((spread, pageIndex) => {
        const surplus = spread.surplusParts || [];
        const looseCuts = pageIndex === plan.spreads.length - 1 ? renderLooseCuts(plan.looseCuts) : '';
        return `
            <section class="spread-page">
                <div class="title-row">
                    <div>
                        <h1>Plano de Corte PCP</h1>
                        <p class="muted">Pedidos: ${ordersLabel}</p>
                    </div>
                    <strong class="page-number">${pageIndex + 1}/${pageCount}</strong>
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
                    ${looseCuts}
                </div>
            </section>
        `;
    }).join('') || `
        <section class="spread-page">
            <div class="title-row">
                <div>
                    <h1>Plano de Corte PCP</h1>
                    <p class="muted">Pedidos: ${ordersLabel}</p>
                </div>
                <strong class="page-number">1/1</strong>
            </div>
            <div class="summary">
                <b>Total solicitado:</b> ${requestedLabel}<br>
                <b>Regra:</b> corte avulso sem girar os moldes.
            </div>
            <div class="loose-only">
                <h2>Corte avulso em retalho</h2>
                ${renderLooseCuts(plan.looseCuts, false)}
            </div>
        </section>
    `;

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
                    height: 270mm;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    break-after: page;
                    page-break-after: always;
                }
                .spread-page + .spread-page {
                    break-before: page;
                    page-break-before: always;
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
                .instruction { font-size: 3.8px; }
                .result { padding-top: 2mm; font-size: 8.5pt; line-height: 1.35; }
                .result p + p { margin-top: 1mm; }
                .loose-cuts { margin-top: 1.5mm; border: 1px solid #f59e0b; background: #fffbeb; padding: 1.5mm; }
                .loose-only { margin-top: 8mm; border: 2px solid #f59e0b; background: #fffbeb; padding: 6mm; font-size: 11pt; }
                .loose-only h2 { margin: 0 0 4mm; font-size: 18pt; }
                .loose-only .loose-cuts { margin: 0; border: 0; padding: 0; }
            </style>
        </head>
        <body>
            ${pages}
            <script>window.onload = () => { window.print(); };</script>
        </body>
        </html>`;
}
