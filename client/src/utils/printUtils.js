// src/utils/printUtils.js

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
    const visibleInfantSizes = infantSizes.filter((size) => Number(sizes[size] || 0) > 0);
    const visibleAdultSizes = adultSizes.filter((size) => Number(sizes[size] || 0) > 0);
    const combinedVisibleSizes = [...visibleInfantSizes, ...visibleAdultSizes];
    const totalInfant = visibleInfantSizes.reduce((sum, size) => sum + Number(sizes[size] || 0), 0);
    const totalAdult = visibleAdultSizes.reduce((sum, size) => sum + Number(sizes[size] || 0), 0);

    return {
        visibleInfantSizes,
        visibleAdultSizes,
        combinedVisibleSizes,
        totalInfant,
        totalAdult,
        totalPieces: totalInfant + totalAdult
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

const formatQuoteSizesInline = (sizes = {}) => {
    const entries = Object.entries(sizes)
        .filter(([, quantity]) => Number(quantity || 0) > 0)
        .map(([size, quantity]) => `${size}: ${Number(quantity || 0)}`);

    return entries.length ? entries.join(' • ') : 'Grade não informada';
};

const parsePrintingTypes = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
        } catch (error) {
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

const buildStandardOrderPrintLayout = ({ order, logoUrl, normalizedLines, printDate }) => {
    const layoutLines = normalizedLines.filter((line) => line.layoutUrl);
    const notedLines = normalizedLines.filter((line) => line.production_notes);
    const hasSingleLayout = layoutLines.length === 1;

    return `
    <html>
    <head>
        <title>O.S. ${order.tracking_code}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
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
            .single-layout-frame img { width: 100%; max-height: 480px; border-radius: 6px; object-fit: contain; }
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
        </style>
    </head>
    <body>
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
                    : `${renderSizeTable('INFANTIL', line.visibleInfantSizes, line.sizes, line.totalInfant, 'ANOS')}${renderSizeTable('ADULTO', line.visibleAdultSizes, line.sizes, line.totalAdult)}`}
                ${!line.visibleInfantSizes.length && !line.visibleAdultSizes.length ? `
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
        ${notedLines.length ? `
        <div class="section-title">OBSERVAÇÕES DE PRODUÇÃO</div>
        <div class="notes-list">
            ${notedLines.map((line) => `
            <div class="note-card">
                <div class="note-title">ITEM ${line.index + 1} - ${escapeHtml(line.description)}</div>
                <div class="note-text">${escapeHtml(line.production_notes)}</div>
            </div>`).join('')}
        </div>` : ''}
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 250);
            };
        </script>
        <div class="footer">
            <span>Impresso em ${printDate}</span>
            <span>Atos Systems • Enterprise Edition</span>
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
        <title>Orçamento ${order.tracking_code}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
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
            <div class="quote-print">
                <div class="quote-header">
                    <div>
                        <div class="brand-logo-wrap">
                            <img src="/atos_logo.png" alt="Atos Fardamentos" class="brand-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div class="brand-logo-fallback">ATOS FARDAMENTOS</div>
                        </div>
                        <div class="brand-meta">
                            <div><strong>CNPJ:</strong> 59.907.753/0001-28</div>
                            <div><strong>Endereço:</strong> R. Atlântica - Ouro Preto, Olinda - PE, 53370-530</div>
                        <div><strong>E-mail:</strong> atosfardamentos@gmail.com</div>
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
                <span>Atos Fardamentos</span>
            </div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 250);
            };
        </script>
    </body>
    </html>`;
};

// --- FUNÇÃO PRINCIPAL DE IMPRESSÃO ---
export const printOrder = (order, apiBaseUrl) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    const logoUrl = window.location.origin + '/logo.png';
    const isQuote = String(order?.tracking_code || '').startsWith('#ORC-');
    const printDate = new Date().toLocaleString('pt-BR');
    const normalizedLines = buildNormalizedLines(order, apiBaseUrl);
    const content = isQuote
        ? buildPremiumQuotePrintLayout({ order, normalizedLines, printDate })
        : buildStandardOrderPrintLayout({ order, logoUrl, normalizedLines, printDate });

    printWindow.document.write(content);
    printWindow.document.close();
};
