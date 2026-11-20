// src/utils/printUtils.js
import { appConfig } from '../config/appConfig.js';

// --- FUNÇÃO AUXILIAR DE DATA ---
const formatDateSafe = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
}).format(Number(value || 0));

const resolvePublicAssetUrl = (assetUrl) => {
    const safeUrl = String(assetUrl || '').trim();
    if (/^https?:\/\//i.test(safeUrl)) return safeUrl;
    const path = safeUrl.startsWith('/') ? safeUrl : `/${safeUrl}`;
    return window.location.origin + path;
};

const buildLineDescription = (productType, fabricType) => {
    const product = String(productType || '').trim();
    const fabric = String(fabricType || '').trim();

    if (!product && !fabric) return 'PRODUTO';
    if (!fabric) return product.toUpperCase();
    if (product.toLowerCase().includes(fabric.toLowerCase())) return product.toUpperCase();
    return `${product} ${fabric}`.trim().toUpperCase();
};

const buildLineSizeData = (sizes = {}) => {
    const infantSizes = ['2', '4', '6', '8', '10', '12', '14'];
    const adultSizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'ESP'];
    const visibleSizes = Object.keys(sizes).filter((size) => Number(sizes[size] || 0) > 0);
    const infantRank = (size) => infantSizes.indexOf(String(size).toUpperCase().replace(/\s*ANOS?$/, ''));
    const adultRank = (size) => adultSizes.indexOf(String(size).toUpperCase());
    const visibleInfantSizes = visibleSizes
        .filter((size) => infantRank(size) >= 0)
        .sort((left, right) => infantRank(left) - infantRank(right));
    const visibleAdultSizes = visibleSizes
        .filter((size) => adultRank(size) >= 0)
        .sort((left, right) => adultRank(left) - adultRank(right));
    const knownSizes = new Set([...visibleInfantSizes, ...visibleAdultSizes]);
    const visibleOtherSizes = visibleSizes.filter((size) => !knownSizes.has(size));
    const combinedVisibleSizes = [...visibleInfantSizes, ...visibleAdultSizes, ...visibleOtherSizes];
    const totalInfant = visibleInfantSizes.reduce((sum, size) => sum + Number(sizes[size] || 0), 0);
    const totalAdult = visibleAdultSizes.reduce((sum, size) => sum + Number(sizes[size] || 0), 0);
    const totalOther = visibleOtherSizes.reduce((sum, size) => sum + Number(sizes[size] || 0), 0);

    return {
        visibleInfantSizes,
        visibleAdultSizes,
        visibleOtherSizes,
        combinedVisibleSizes,
        totalInfant,
        totalAdult,
        totalOther,
        totalPieces: totalInfant + totalAdult + totalOther
    };
};

const renderSizeTable = (label, sizesList, sizes, total, suffix = '') => {
    if (!sizesList.length) return '';

    return `
        <table style="margin-bottom: 8px;">
            <thead>
                <tr>
                    <th class="row-label">${label}</th>
                    ${sizesList.map((size) => `<th>${size}${suffix ? ` <br>${suffix}` : ''}</th>`).join('')}
                    <th class="total-col">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="row-label"></td>
                    ${sizesList.map((size) => `<td>${Number(sizes[size] || 0)}</td>`).join('')}
                    <td class="total-col">${total}</td>
                </tr>
            </tbody>
        </table>
    `;
};

const renderCompactSizeTable = (sizesList, sizes, total) => {
    if (!sizesList.length) return '';

    return `
        <table style="margin-bottom: 6px;">
            <thead>
                <tr>
                    <th class="row-label">TAMANHOS</th>
                    ${sizesList.map((size) => `<th>${size}</th>`).join('')}
                    <th class="total-col">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="row-label">QTDE</td>
                    ${sizesList.map((size) => `<td>${Number(sizes[size] || 0)}</td>`).join('')}
                    <td class="total-col">${total}</td>
                </tr>
            </tbody>
        </table>
    `;
};

const parsePrintingTypes = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
        } catch {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

const buildQuoteLineDetails = (line) => {
    const details = [];

    if (line.fabric_type) details.push(String(line.fabric_type).trim());

    const printingTypes = parsePrintingTypes(line.printing_types_json);
    if (printingTypes.length) details.push(printingTypes.join(', '));

    if (line.production_notes) details.push(`Obs.: ${String(line.production_notes).trim()}`);

    if (!details.length && line.description && line.description !== line.product_type) {
        details.push(String(line.description).trim());
    }

    return details;
};

const renderQuoteSizesInlineMarkup = (sizes = {}) => {
    const entries = Object.entries(sizes).filter(([, quantity]) => Number(quantity || 0) > 0);

    if (!entries.length) {
        return '<span class="sizes-empty">Grade não informada</span>';
    }

    return entries.map(([size, quantity], index) => `
        <span class="size-pair">${escapeHtml(size)}: ${Number(quantity || 0)}</span>${index < entries.length - 1 ? '<span class="size-separator">|</span>' : ''}
    `).join('');
};

const getPrintDate = (value) => {
    if (!value) return formatDateSafe(new Date().toISOString().split('T')[0]);
    return formatDateSafe(String(value).slice(0, 10));
};

const buildNormalizedLines = (order, apiBaseUrl) => {
    const productLines = Array.isArray(order.product_lines) && order.product_lines.length > 0
        ? order.product_lines
        : [{
            product_type: order.product_type || 'Produto',
            fabric_type: order.fabric_type || '',
            sizes_json: order.sizes_json || {},
            layout_path: order.layout_path || null,
            total_price: order.total_price || 0,
            unit_price: order.unit_price || 0
        }];

    return productLines.map((line, index) => {
        const sizes = line.sizes_json || {};
        const sizeData = buildLineSizeData(sizes);
        const rawUnitPrice = line.unit_price;
        const unitPrice = rawUnitPrice === null || rawUnitPrice === undefined || rawUnitPrice === ''
            ? null
            : Number(rawUnitPrice || 0);

        return {
            index,
            description: String(line.production_label || '').trim() || buildLineDescription(line.product_type, line.fabric_type),
            product_type: line.product_type || `Produto ${index + 1}`,
            fabric_type: line.fabric_type || 'Padrão',
            production_notes: String(line.production_notes || '').trim(),
            printing_types_json: line.printing_types_json || [],
            sizes,
            layoutUrl: line.layout_path ? `${apiBaseUrl}/uploads/${line.layout_path}` : null,
            total_price: Number(line.total_price || 0),
            unit_price: unitPrice,
            ...sizeData
        };
    });
};

const printToolbarStyles = `
    .print-toolbar { padding: 12px; background: #f1f5f9; }
    .print-toolbar button { min-height: 44px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer; touch-action: manipulation; }
    @media print { .print-toolbar { display: none; } }
`;

const printToolbar = `
    <div class="print-toolbar">
        <button id="print-document" type="button" disabled>Imprimir ou salvar PDF</button>
    </div>
`;

const buildStandardOrderPrintLayout = ({ order, logoUrl, normalizedLines, printDate, compactPrint }) => {
    const layoutLines = normalizedLines.filter((line) => line.layoutUrl);
    const notedLines = normalizedLines.filter((line) => line.production_notes);
    const submittedItems = Array.isArray(order.items)
        ? order.items.filter((item) => item.player_name || item.player_number || item.size)
        : [];
    const preferredSizeOrder = [...new Set(
        normalizedLines.flatMap((line) => line.combinedVisibleSizes.map((size) => String(size).trim().toUpperCase()))
    )];
    const itemsBySize = submittedItems.reduce((groups, item) => {
        const size = String(item.size || '').trim().toUpperCase() || 'SEM TAMANHO';
        if (!groups.has(size)) groups.set(size, []);
        groups.get(size).push(item);
        return groups;
    }, new Map());
    const submittedItemGroups = [
        ...preferredSizeOrder.filter((size) => itemsBySize.has(size)),
        ...[...itemsBySize.keys()].filter((size) => !preferredSizeOrder.includes(size))
    ].map((size) => ({ size, items: itemsBySize.get(size) }));
    const hasSingleLayout = layoutLines.length === 1;

    return `
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>O.S. ${order.tracking_code}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            ${printToolbarStyles}
            @page { margin: 6mm; size: A4; }
            body { font-family: 'Inter', sans-serif; color: #111827; padding: 0; max-width: 100%; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
            .header-logo img { max-height: 84px; max-width: 220px; object-fit: contain; display: block; }
            .header-title { text-align: center; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; font-weight: 700; color: #4B5563; }
            .header-os { text-align: right; }
            .os-badge { background: #111827; color: white; padding: 7px 14px; border-radius: 6px; font-weight: 800; font-size: 14px; display: inline-block; letter-spacing: 0.5px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
            .info-card { border: 1px solid #E5E7EB; border-radius: 6px; padding: 7px 10px; background: #F9FAFB; }
            .info-label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B728B; margin-bottom: 2px; font-weight: 600; }
            .info-value { font-size: 12px; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #111827; margin-bottom: 6px; border-left: 3px solid #2563EB; padding-left: 8px; margin-top: 10px; }
            .table-container { margin-bottom: 10px; }
            .line-section { margin-bottom: 10px; page-break-inside: avoid; }
            .line-title { font-size: 12px; font-weight: 800; color: #0F172A; margin: 0 0 4px 0; letter-spacing: 0.02em; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; border-radius: 4px; overflow: hidden; border: 1px solid #E5E7EB; margin-bottom: 6px; table-layout: fixed; }
            th { background: #F3F4F6; color: #111827; font-size: 9px; text-transform: uppercase; padding: 5px; font-weight: 800; border-right: 1px solid #E5E7EB; white-space: nowrap; height: 24px; }
            td { border-right: 1px solid #E5E7EB; padding: 0; text-align: center; font-size: 13px; font-weight: 700; color: #111827; border-top: 1px solid #E5E7EB; height: 28px; }
            .row-label { text-align: left; padding-left: 8px; font-size: 8px; color: #6B728B; font-weight: 700; background: #fff; width: 70px; }
            .total-col { background: #F9FAFB; color: #2563EB; font-weight: 800; width: 56px; }
            .customer-list-title { margin-top: 7px; margin-bottom: 4px; }
            .customer-groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 10px; margin-bottom: 6px; }
            .customer-size-group { border-top: 1px solid #CBD5E1; padding-top: 3px; min-width: 0; page-break-inside: avoid; }
            .customer-size-heading { display: flex; align-items: center; justify-content: space-between; gap: 4px; color: #1D4ED8; font-size: 7px; font-weight: 800; text-transform: uppercase; }
            .customer-size-count { color: #64748B; font-size: 6px; font-weight: 700; }
            .customer-size-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 6px; margin-top: 3px; }
            .customer-person { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 3px; min-width: 0; color: #334155; font-size: 6.5px; line-height: 1.2; }
            .customer-person-name { overflow-wrap: anywhere; }
            .customer-person-number { color: #0F172A; font-weight: 800; white-space: nowrap; }
            .layouts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 8px; }
            .layout-card { border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px; background: #FFFFFF; page-break-inside: avoid; }
            .layout-card-title { font-size: 11px; font-weight: 800; color: #0F172A; margin-bottom: 4px; }
            .layout-card-subtitle { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; font-weight: 700; margin-bottom: 10px; }
            .layout-empty { border: 1px dashed #CBD5E1; border-radius: 10px; padding: 16px; text-align: center; color: #64748B; font-size: 12px; background: #F8FAFC; }
            .image-frame { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: white; }
            .image-frame img { max-width: 100%; max-height: 210px; border-radius: 4px; object-fit: contain; }
            .single-layout { margin-top: 8px; }
            .single-layout-card { border: none; padding: 0; background: transparent; }
            .single-layout-frame { border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px; text-align: center; background: #FFFFFF; }
            .single-layout-frame img { width: 100%; max-height: ${submittedItems.length ? '350px' : '480px'}; border-radius: 6px; object-fit: contain; }
            .line-financials { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0 8px; justify-content: end; }
            .line-financial-card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 10px; background: #F8FAFC; }
            .line-financial-card.full { grid-column: 1 / -1; }
            .line-financial-label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B; margin-bottom: 2px; font-weight: 700; }
            .line-financial-value { font-size: 12px; font-weight: 800; color: #0F172A; text-align: right; }
            .notes-list { display: grid; gap: 8px; margin-top: 8px; }
            .note-card { border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px 12px; background: #FFFFFF; }
            .note-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #2563EB; margin-bottom: 4px; }
            .note-text { font-size: 11px; color: #334155; line-height: 1.55; white-space: pre-wrap; }
            .footer { margin-top: 12px; border-top: 1px solid #E5E7EB; padding-top: 8px; font-size: 8px; color: #9CA3AF; display: flex; justify-content: space-between; align-items: center; }
            ${compactPrint ? `
            @media print {
                .header { padding-bottom: 6px; margin-bottom: 8px; }
                .header-logo img { max-height: 60px; max-width: 100%; }
                .line-section, .table-container { margin-bottom: 6px; }
                th, td { height: auto; padding-block: 3px; }
                .layout-card, .image-frame, .single-layout-frame, .note-card { padding: 5px; }
                .layout-card-subtitle { margin-bottom: 4px; }
                .image-frame img { display: block; margin-inline: auto; max-height: 150px; }
                .single-layout-frame img { display: block; margin-inline: auto; width: auto; max-width: 100%; max-height: 280px; }
                .footer { margin-top: 6px; padding-top: 4px; }
            }` : ''}
        </style>
    </head>
    <body>
        ${printToolbar}
        <div class="header">
            <div class="header-logo"><img src="${logoUrl}" alt="Logo" /></div>
            <div class="header-title">Ficha de Produção</div>
            <div class="header-os"><span class="os-badge">${escapeHtml(order.tracking_code)}</span></div>
        </div>
        <div class="info-grid">
            <div class="info-card"><span class="info-label">Cliente</span><div class="info-value">${escapeHtml(order.client_name)}</div></div>
            <div class="info-card"><span class="info-label">Data de Entrega</span><div class="info-value">${formatDateSafe(order.delivery_date)}</div></div>
        </div>
        <div class="section-title">ITENS DA PRODUÇÃO</div>
        ${normalizedLines.map((line) => `
        <div class="line-section">
            <h2 class="line-title">ITEM ${line.index + 1} - ${escapeHtml(line.description)}</h2>
            <div class="table-container" style="margin-bottom: 0;">
                ${line.combinedVisibleSizes.length > 0 && line.combinedVisibleSizes.length <= 10
                    ? renderCompactSizeTable(line.combinedVisibleSizes, line.sizes, line.totalPieces)
                    : `${renderSizeTable('INFANTIL', line.visibleInfantSizes, line.sizes, line.totalInfant)}${renderSizeTable('ADULTO', line.visibleAdultSizes, line.sizes, line.totalAdult)}${renderSizeTable('OUTROS', line.visibleOtherSizes, line.sizes, line.totalOther)}`}
                ${!line.combinedVisibleSizes.length ? `
                <div style="padding: 18px; border: 1px dashed #D1D5DB; border-radius: 8px; color: #6B728B; font-size: 12px; text-align: center;">
                    Nenhum tamanho informado para este item.
                </div>` : ''}
            </div>
        </div>`).join('')}
        <div class="section-title">LAYOUTS DO PEDIDO</div>
        ${layoutLines.length ? `
        ${hasSingleLayout ? `
        <div class="single-layout">
            <div class="layout-card single-layout-card">
                <div class="layout-card-title">ITEM ${layoutLines[0].index + 1} - ${escapeHtml(layoutLines[0].description)}</div>
                <div class="layout-card-subtitle">Layout principal do pedido</div>
                <div class="single-layout-frame"><img src="${layoutLines[0].layoutUrl}" alt="Layout do pedido" /></div>
            </div>
        </div>` : `
        <div class="layouts-grid">
            ${layoutLines
                .map((line) => `
                <div class="layout-card">
                    <div class="layout-card-title">ITEM ${line.index + 1} - ${escapeHtml(line.description)}</div>
                    <div class="layout-card-subtitle">Layout do item ${line.index + 1}</div>
                    <div class="image-frame"><img src="${line.layoutUrl}" alt="Layout do item ${line.index + 1}" /></div>
                </div>`)
                .join('')}
        </div>`}` : `
        <div class="layout-empty">Nenhum layout anexado neste pedido.</div>`}
        ${submittedItemGroups.length ? `
        <div class="section-title customer-list-title">NOMES E NÚMEROS POR TAMANHO</div>
        <div class="customer-groups">
            ${submittedItemGroups.map((group) => `
            <section class="customer-size-group" data-size="${escapeHtml(group.size)}">
                <div class="customer-size-heading">
                    <span>TAMANHO ${escapeHtml(group.size)}</span>
                    <span class="customer-size-count">${group.items.length} peça(s)</span>
                </div>
                <div class="customer-size-items">
                    ${group.items.map((item) => `
                    <div class="customer-person">
                        <span class="customer-person-name">${escapeHtml(item.player_name || '-')}</span>
                        <strong class="customer-person-number">${escapeHtml(item.player_number || '-')}</strong>
                    </div>`).join('')}
                </div>
            </section>`).join('')}
        </div>` : ''}
        ${notedLines.length ? `
        <div class="section-title">OBSERVAÇÕES DE PRODUÇÃO</div>
        <div class="notes-list">
            ${notedLines.map((line) => `
            <div class="note-card">
                <div class="note-title">ITEM ${line.index + 1} - ${escapeHtml(line.description)}</div>
                <div class="note-text">${escapeHtml(line.production_notes)}</div>
            </div>`).join('')}
        </div>` : ''}
        <div class="footer">
            <span>Impresso em ${printDate}</span>
            <span>${escapeHtml(appConfig.systemName)} • Enterprise Edition</span>
        </div>
    </body>
    </html>`;
};

const buildPremiumQuotePrintLayout = ({ order, normalizedLines, printDate }) => {
    const totalGeneral = normalizedLines.reduce((sum, line) => sum + Number(line.total_price || 0), 0);
    const issueDate = getPrintDate(order.created_at || new Date().toISOString());
    const generalNotes = String(order.observacao || '').trim();

    return `
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Orçamento ${order.tracking_code}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            ${printToolbarStyles}
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; margin: 0; color: #1E293B; background: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .quote-print { width: 100%; }
            .quote-header { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 28px; align-items: start; padding-bottom: 18px; border-bottom: 1px solid #E2E8F0; }
            .brand-logo-wrap { margin-bottom: 14px; min-height: 68px; display: flex; align-items: center; }
            .brand-logo { height: 64px; max-width: 220px; object-fit: contain; display: block; }
            .brand-logo-fallback { display: none; font-size: 28px; font-weight: 900; letter-spacing: 0.02em; color: #0F172A; }
            .brand-meta { display: grid; gap: 6px; font-size: 12px; color: #475569; }
            .brand-meta strong { color: #0F172A; }
            .quote-header-right { text-align: right; }
            .quote-label { font-size: 40px; line-height: 1; font-weight: 900; color: #0F172A; letter-spacing: 0.08em; }
            .quote-number { margin-top: 8px; font-size: 18px; font-weight: 800; color: #2563EB; }
            .quote-issue { margin-top: 8px; font-size: 12px; color: #64748B; font-weight: 600; }
            .client-card { margin-top: 18px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 18px; }
            .client-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 18px; }
            .client-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B; margin-bottom: 4px; font-weight: 700; }
            .client-value { font-size: 16px; color: #0F172A; font-weight: 800; }
            .client-subvalue { font-size: 13px; color: #64748B; font-weight: 500; }
            .quote-table-wrap { margin-top: 20px; border: 1px solid #E2E8F0; border-radius: 18px; overflow: hidden; }
            .quote-table { width: 100%; border-collapse: collapse; }
            .quote-table thead th { background: #F8FAFC; color: #475569; padding: 14px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #E2E8F0; }
            .quote-table tbody td { padding: 14px 12px; border-top: 1px solid #E2E8F0; vertical-align: top; font-size: 13px; color: #0F172A; }
            .quote-table tbody tr { page-break-inside: avoid; }
            .art-thumb { width: 92px; height: 92px; border-radius: 14px; border: 1px solid #CBD5E1; background: #F8FAFC; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .art-thumb img { width: 100%; height: 100%; object-fit: cover; }
            .art-thumb-empty { text-align: center; font-size: 11px; color: #64748B; padding: 10px; line-height: 1.4; }
            .product-name { font-size: 14px; font-weight: 800; color: #0F172A; margin-bottom: 6px; }
            .product-details { display: grid; gap: 6px; font-size: 12px; color: #64748B; line-height: 1.55; }
            .product-detail-line { display: block; }
            .sizes-block { display: grid; gap: 8px; }
            .sizes-inline { font-size: 14px; color: #334155; line-height: 1.8; }
            .size-pair { display: inline-block; font-weight: 600; margin-right: 10px; }
            .size-separator { display: inline-block; color: #94A3B8; margin-right: 10px; }
            .sizes-empty { color: #94A3B8; }
            .line-summary { display: grid; gap: 8px; text-align: right; }
            .line-summary-qty { font-size: 14px; font-weight: 800; color: #0F172A; }
            .line-summary-unit { font-size: 12px; color: #64748B; }
            .line-summary-subtotal { font-size: 16px; font-weight: 900; color: #2563EB; }
            .quote-footer { margin-top: 20px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; align-items: stretch; }
            .notes-box, .summary-box { border-radius: 18px; border: 1px solid #E2E8F0; background: #FFFFFF; padding: 18px; }
            .footer-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; font-weight: 800; margin-bottom: 10px; }
            .notes-text { font-size: 13px; line-height: 1.7; color: #475569; white-space: pre-wrap; }
            .summary-rows { display: grid; gap: 10px; }
            .summary-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; color: #475569; }
            .summary-total { margin-top: 14px; padding-top: 14px; border-top: 1px solid #E2E8F0; }
            .summary-total-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 6px; font-weight: 800; text-align: right; }
            .summary-total-value { font-size: 34px; line-height: 1; font-weight: 900; text-align: right; color: #2563EB; }
            .quote-print-footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748B; }
            @media print {
                html, body { width: 210mm; min-height: 297mm; }
                .quote-print { width: 100%; }
                button, .btn, nav, aside, .sidebar, .topbar, .app-header, .page-actions, .screen-actions { display: none !important; }
            }
        </style>
    </head>
    <body>
        ${printToolbar}
            <div class="quote-print">
                <div class="quote-header">
                    <div>
                        <div class="brand-logo-wrap">
                            <img src="${resolvePublicAssetUrl(appConfig.printLogoUrl)}" alt="${escapeHtml(appConfig.brandName)}" class="brand-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div class="brand-logo-fallback">${escapeHtml(appConfig.brandName.toUpperCase())}</div>
                        </div>
                        <div class="brand-meta">
                            ${appConfig.companyDocument ? `<div><strong>CNPJ:</strong> ${escapeHtml(appConfig.companyDocument)}</div>` : ''}
                            ${appConfig.companyAddress ? `<div><strong>Endereço:</strong> ${escapeHtml(appConfig.companyAddress)}</div>` : ''}
                        <div><strong>E-mail:</strong> ${escapeHtml(appConfig.supportEmail)}</div>
                        <div><strong>WhatsApp:</strong> (81) 98807-4760</div>
                    </div>
                </div>
                <div class="quote-header-right">
                    <div class="quote-label">ORÇAMENTO</div>
                    <div class="quote-number">${escapeHtml(order.tracking_code)}</div>
                    <div class="quote-issue">Data de Emissão: ${issueDate}</div>
                </div>
            </div>

            <div class="client-card">
                <div class="client-grid">
                    <div>
                        <span class="client-label">Cliente</span>
                        <div class="client-value">${escapeHtml(order.client_name || 'Cliente não informado')}</div>
                    </div>
                    <div>
                        <span class="client-label">Validade do Orçamento</span>
                        <div class="client-value">${formatDateSafe(order.delivery_date)}</div>
                        <div class="client-subvalue">Proposta sujeita à confirmação até esta data.</div>
                    </div>
                </div>
            </div>

            <div class="quote-table-wrap">
                <table class="quote-table">
                    <thead>
                        <tr>
                            <th style="width: 110px;">Arte</th>
                            <th>Produto</th>
                            <th>Grade / Tamanhos</th>
                            <th style="width: 200px;">Resumo do Item</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${normalizedLines.map((line) => `
                        <tr>
                            <td>
                                <div class="art-thumb">
                                    ${line.layoutUrl ? `<img src="${line.layoutUrl}" alt="Arte do item ${line.index + 1}" />` : `<div class="art-thumb-empty">Arte em desenvolvimento</div>`}
                                </div>
                            </td>
                            <td>
                                <div class="product-name">ITEM ${line.index + 1} - ${escapeHtml(line.product_type || line.description || 'Produto')}</div>
                                <div class="product-details">
                                    ${buildQuoteLineDetails(line).map((detail) => `<span class="product-detail-line">${escapeHtml(detail)}</span>`).join('')}
                                </div>
                            </td>
                            <td>
                                <div class="sizes-block">
                                    <div class="sizes-inline">${renderQuoteSizesInlineMarkup(line.sizes)}</div>
                                </div>
                            </td>
                            <td>
                                <div class="line-summary">
                                    <div class="line-summary-qty">Qtd: ${line.totalPieces} peça(s)</div>
                                    <div class="line-summary-unit">V. Unit: ${line.unit_price !== null ? formatMoney(line.unit_price) : 'Não informado'}</div>
                                    <div class="line-summary-subtotal">Subtotal: ${formatMoney(line.total_price)}</div>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="quote-footer">
                <div class="notes-box">
                    <div class="footer-title">Observações Gerais</div>
                    <div class="notes-text">${generalNotes ? escapeHtml(generalNotes) : 'Sem observações gerais informadas para este orçamento.'}</div>
                </div>
                <div class="summary-box">
                    <div class="footer-title">Resumo Financeiro</div>
                    <div class="summary-rows">
                        <div class="summary-row">
                            <span>Itens do orçamento</span>
                            <strong>${normalizedLines.length}</strong>
                        </div>
                        <div class="summary-row">
                            <span>Total de peças</span>
                            <strong>${normalizedLines.reduce((sum, line) => sum + line.totalPieces, 0)}</strong>
                        </div>
                    </div>
                    <div class="summary-total">
                        <span class="summary-total-label">Total Geral</span>
                        <div class="summary-total-value">${formatMoney(totalGeneral)}</div>
                    </div>
                </div>
            </div>

            <div class="quote-print-footer">
                <span>Documento emitido em ${printDate}</span>
                <span>${escapeHtml(appConfig.brandName)}</span>
            </div>
        </div>
    </body>
    </html>`;
};

// --- FUNÇÃO PRINCIPAL DE IMPRESSÃO ---
export const printOrder = (order, apiBaseUrl, printWindow, { autoPrint = true, compactPrint = false } = {}) => {
    const logoUrl = resolvePublicAssetUrl(appConfig.logoUrl);
    const isQuote = String(order?.tracking_code || '').startsWith('#ORC-');
    const printDate = new Date().toLocaleString('pt-BR');
    const normalizedLines = buildNormalizedLines(order, apiBaseUrl);
    const content = isQuote
        ? buildPremiumQuotePrintLayout({ order, normalizedLines, printDate })
        : buildStandardOrderPrintLayout({ order, logoUrl, normalizedLines, printDate, compactPrint });

    printWindow.document.open();
    printWindow.document.write(content);
    const printButton = printWindow.document.getElementById('print-document');
    printButton.addEventListener('click', () => printWindow.print());
    printWindow.addEventListener('load', () => {
        printButton.disabled = false;
        if (autoPrint) printWindow.print();
    }, { once: true });
    printWindow.document.close();
};

const CLIENT_JPG_WIDTH = 1080;
const CLIENT_JPG_HEIGHT = 1350;

const safeFilePart = (value) => String(value || 'documento')
    .replace(/^#/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'documento';

export const buildClientJpgPages = (order, apiBaseUrl) => {
    const lines = buildNormalizedLines(order, apiBaseUrl);
    const isQuote = String(order?.tracking_code || '').startsWith('#ORC-');
    const code = safeFilePart(order?.tracking_code);

    return lines.map((line, index) => ({
        width: CLIENT_JPG_WIDTH,
        height: CLIENT_JPG_HEIGHT,
        documentLabel: isQuote ? 'ORÇAMENTO' : 'PEDIDO',
        clientName: String(order?.client_name || 'Cliente não informado'),
        trackingCode: String(order?.tracking_code || ''),
        deliveryDate: formatDateSafe(order?.delivery_date),
        status: String(order?.status || ''),
        total: Number(line.total_price || (lines.length === 1 ? order?.total_price : 0) || 0),
        pageNumber: index + 1,
        pageCount: lines.length,
        fileName: `${isQuote ? 'orcamento' : 'pedido'}-${code}${lines.length > 1 ? `-${index + 1}` : ''}.jpg`,
        line
    }));
};

const roundedRect = (ctx, x, y, width, height, radius) => {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    ctx.arcTo(x, y + height, x, y, safeRadius);
    ctx.arcTo(x, y, x + width, y, safeRadius);
    ctx.closePath();
};

const drawWrappedText = (ctx, value, x, y, maxWidth, lineHeight, maxLines = 2) => {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !current) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);

    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
        let last = visible.at(-1);
        while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        visible[visible.length - 1] = `${last}…`;
    }
    visible.forEach((line, index) => ctx.fillText(line, x, y + (index * lineHeight)));
    return visible.length;
};

const wrapCanvasText = (ctx, value, maxWidth) => {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);
    return lines;
};

const drawFullTextToFit = (ctx, value, x, y, maxWidth, {
    maxLines = 3,
    fontSize = 31,
    minFontSize = 18,
    fontWeight = 800,
    lineHeightRatio = 1.15
} = {}) => {
    let size = fontSize;
    let lines = [];
    do {
        ctx.font = `${fontWeight} ${size}px Arial, sans-serif`;
        lines = wrapCanvasText(ctx, value, maxWidth);
        if (lines.length <= maxLines) break;
        size -= 1;
    } while (size >= minFontSize);

    const lineHeight = Math.round(size * lineHeightRatio);
    lines.forEach((line, index) => ctx.fillText(line, x, y + (index * lineHeight)));
    return { lines: lines.length, fontSize: size, lineHeight };
};

const drawSectionHeading = (ctx, label, y, accent) => {
    ctx.fillStyle = accent;
    ctx.fillRect(64, y, 7, 30);
    ctx.fillStyle = '#334155';
    ctx.font = '800 21px Arial, sans-serif';
    ctx.fillText(label, 88, y + 3);
};

const chunkItems = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks;
};

const loadCanvasImage = async (url) => {
    if (!url) return null;
    try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;
        const objectUrl = URL.createObjectURL(await response.blob());
        const image = new Image();
        image.decoding = 'async';
        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
                image.src = objectUrl;
            });
            return image;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        return null;
    }
};

const drawContainedImage = (ctx, image, x, y, width, height) => {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, x + ((width - drawWidth) / 2), y + ((height - drawHeight) / 2), drawWidth, drawHeight);
};

const canvasToJpeg = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar o JPG.')), 'image/jpeg', 0.92);
});

const renderClientJpgPage = async (page) => {
    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d');
    const accent = appConfig.theme === 'monochrome' ? '#111827' : '#2563EB';
    const [logo, layout] = await Promise.all([
        loadCanvasImage(resolvePublicAssetUrl(appConfig.logoUrl)),
        loadCanvasImage(page.line.layoutUrl)
    ]);

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(28, 28, page.width - 56, page.height - 56);

    ctx.fillStyle = accent;
    ctx.fillRect(28, 28, page.width - 56, 10);
    if (logo) drawContainedImage(ctx, logo, 64, 58, 132, 132);

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 27px Arial, sans-serif';
    ctx.fillText(appConfig.brandName.toUpperCase(), 224, 60);
    ctx.fillStyle = '#64748B';
    ctx.font = '700 18px Arial, sans-serif';
    if (appConfig.companyDocument) ctx.fillText(`CNPJ ${appConfig.companyDocument}`, 224, 101);
    if (appConfig.companyAddress) drawWrappedText(ctx, appConfig.companyAddress, 224, 132, 530, 23, 2);

    roundedRect(ctx, 810, 58, 206, 112, 18);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillText(page.documentLabel, 913, 77);
    ctx.font = '800 26px Arial, sans-serif';
    drawWrappedText(ctx, page.trackingCode, 913, 108, 174, 30, 2);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(64, 210, 952, 4);

    roundedRect(ctx, 64, 238, 952, 150, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillText('CLIENTE', 90, 260);
    ctx.fillStyle = '#0F172A';
    drawFullTextToFit(ctx, page.clientName.toUpperCase(), 90, 292, 630, { maxLines: 3, fontSize: 30 });
    ctx.fillStyle = '#64748B';
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillText(page.documentLabel === 'ORÇAMENTO' ? 'VALIDADE' : 'DATA DE ENTREGA', 780, 260);
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 25px Arial, sans-serif';
    ctx.fillText(page.deliveryDate || 'Não informada', 780, 294);
    ctx.fillStyle = '#64748B';
    ctx.font = '700 16px Arial, sans-serif';
    ctx.fillText(`${page.pageNumber} de ${page.pageCount}`, 780, 337);

    drawSectionHeading(ctx, `ITEM ${page.pageNumber} DO ${page.documentLabel}`, 418, accent);
    ctx.fillStyle = '#0F172A';
    drawFullTextToFit(ctx, page.line.description, 64, 460, 952, { maxLines: 2, fontSize: 27, minFontSize: 19 });

    const sizeEntries = page.line.combinedVisibleSizes.map((size) => ({ size, quantity: Number(page.line.sizes[size] || 0) }));
    const sizeRows = chunkItems(sizeEntries.length ? sizeEntries : [{ size: '—', quantity: 0 }], 8);
    const gradeTop = 530;
    drawSectionHeading(ctx, 'GRADE DE TAMANHOS', gradeTop, accent);
    const tableTop = gradeTop + 42;
    sizeRows.forEach((row, rowIndex) => {
        const rowTop = tableTop + (rowIndex * 74);
        const cellWidth = 952 / row.length;
        row.forEach((entry, entryIndex) => {
            const x = 64 + (entryIndex * cellWidth);
            ctx.fillStyle = '#F1F5F9';
            ctx.fillRect(x, rowTop, cellWidth, 32);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, rowTop + 32, cellWidth, 40);
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, rowTop, cellWidth, 72);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#475569';
            ctx.font = '800 17px Arial, sans-serif';
            ctx.fillText(entry.size, x + (cellWidth / 2), rowTop + 7);
            ctx.fillStyle = entry.quantity > 0 ? accent : '#94A3B8';
            ctx.font = '800 23px Arial, sans-serif';
            ctx.fillText(String(entry.quantity), x + (cellWidth / 2), rowTop + 40);
        });
    });
    ctx.textAlign = 'left';

    const gradeBottom = tableTop + (sizeRows.length * 74);
    const layoutHeadingTop = gradeBottom + 22;
    drawSectionHeading(ctx, `LAYOUT DO ${page.documentLabel}`, layoutHeadingTop, accent);
    const layoutTop = layoutHeadingTop + 42;
    const layoutBottom = 1170;
    roundedRect(ctx, 64, layoutTop, 952, Math.max(220, layoutBottom - layoutTop), 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (layout) {
        drawContainedImage(ctx, layout, 82, layoutTop + 18, 916, Math.max(184, layoutBottom - layoutTop - 36));
    } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 26px Arial, sans-serif';
        ctx.fillText('Layout não anexado', 540, layoutTop + 90);
        ctx.textAlign = 'left';
    }

    ctx.fillStyle = '#475569';
    ctx.font = '800 20px Arial, sans-serif';
    ctx.fillText(`${page.line.totalPieces} PEÇA(S)`, 64, 1210);
    ctx.fillStyle = '#64748B';
    ctx.font = '700 16px Arial, sans-serif';
    ctx.fillText('SUBTOTAL DO PRODUTO', 720, 1198);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '800 32px Arial, sans-serif';
    ctx.fillText(formatMoney(page.total), 1016, 1224);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px Arial, sans-serif';
    ctx.fillText(appConfig.brandName, 64, 1300);

    return canvasToJpeg(canvas);
};

export const exportClientJpg = async (order, apiBaseUrl) => {
    const pages = buildClientJpgPages(order, apiBaseUrl);
    const files = [];
    for (const page of pages) {
        files.push(new File([await renderClientJpgPage(page)], page.fileName, { type: 'image/jpeg' }));
    }

    if (!navigator.share || !navigator.canShare?.({ files })) {
        const error = new Error('Este navegador não permite compartilhar imagens diretamente.');
        error.code = 'SHARE_UNSUPPORTED';
        throw error;
    }

    try {
        await navigator.share({
            files,
            title: `${pages[0].documentLabel} ${pages[0].trackingCode}`,
            text: `${pages[0].documentLabel} de ${pages[0].clientName}`
        });
        return { mode: 'shared', count: files.length };
    } catch (error) {
        if (error?.name === 'AbortError') return { mode: 'cancelled', count: files.length };
        throw error;
    }
};
