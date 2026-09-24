const getSwal = async () => (await import('sweetalert2')).default;

const escapeAlertHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const pluralize = (quantity, singular, plural) => `${quantity} ${quantity === 1 ? singular : plural}`;

const formatSurplus = (parts = []) => parts.map((item) => (
    `${escapeAlertHtml(item.tamanho)}: ${item.front} frente${item.front === 1 ? '' : 's'}, `
    + `${item.back} costa${item.back === 1 ? '' : 's'}, `
    + `${item.sleeve} manga${item.sleeve === 1 ? '' : 's'}`
)).join(' · ');

const formatPlanCard = (title, plan, recommended = false) => {
    const metrics = plan?.metrics || {};
    const surplus = formatSurplus(plan?.surplusParts);
    return `
        <div style="border: 1px solid ${recommended ? '#93c5fd' : '#cbd5e1'}; background: ${recommended ? '#eff6ff' : '#f8fafc'}; padding: 14px; border-radius: 8px; text-align: left;">
            <strong style="display: block; color: #0f172a; margin-bottom: 7px;">${escapeAlertHtml(title)}${recommended ? ' · Recomendado' : ''}</strong>
            <span style="display: block; color: #334155; line-height: 1.55;">
                ${pluralize(metrics.spreadCount || 0, 'enfesto', 'enfestos')} ·
                ${Number(metrics.fabricMeters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m ·
                ${pluralize(metrics.looseCutPieces || 0, 'componente em retalho', 'componentes em retalho')} ·
                ${pluralize(metrics.surplusPieces || 0, 'componente excedente', 'componentes excedentes')}
            </span>
            ${surplus ? `<small style="display: block; color: #92400e; margin-top: 7px; line-height: 1.45;">Sobras: ${surplus}</small>` : ''}
        </div>
    `;
};

export const buildCuttingPlanChoiceHtml = ({ economy, fewerSpreads }) => `
    <div style="display: grid; gap: 10px; margin-top: 8px;">
        ${formatPlanCard('Economizar malha', economy, true)}
        ${formatPlanCard('Reduzir enfestos', fewerSpreads)}
    </div>
`;

export const normalizeCuttingLayerCounts = (values, maxLayers = 20) => {
    const normalized = (values || []).map((value) => Number(value));
    return normalized.every((value) => (
        Number.isInteger(value) && value >= 1 && value <= maxLayers
    )) ? normalized : null;
};

export const buildCuttingLayersEditorHtml = (plan, maxLayers = 20) => `
    <div style="display: grid; gap: 10px; max-height: min(52dvh, 440px); margin-top: 8px; padding-right: 2px; overflow-y: auto; overscroll-behavior: contain; text-align: left;">
        <p style="margin: 0 0 2px; color: #475569; font-size: 0.875rem; line-height: 1.45;">
            Ajuste as folhas de cada enfesto. Sua máquina aceita no máximo ${maxLayers} folhas.
        </p>
        ${(plan?.spreads || []).map((spread, index) => `
            <label style="display: grid; grid-template-columns: minmax(0, 1fr) 92px; align-items: center; gap: 12px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 11px 12px; background: #f8fafc;">
                <span>
                    <strong style="display: block; color: #0f172a;">Enfesto ${index + 1}</strong>
                    <small style="display: block; margin-top: 2px; color: #64748b;">${escapeAlertHtml((spread.sizes || []).join(' · ') || 'Grade selecionada')}</small>
                </span>
                <span style="position: relative;">
                    <input
                        class="cutting-layer-input"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        max="${maxLayers}"
                        step="1"
                        value="${spread.layers}"
                        aria-label="Folhas do enfesto ${index + 1}"
                        style="box-sizing: border-box; width: 100%; min-height: 44px; border: 1px solid #94a3b8; border-radius: 7px; padding: 8px 34px 8px 10px; font-size: 16px; font-weight: 800; color: #0f172a; background: white;"
                    />
                    <small style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none;">fls.</small>
                </span>
            </label>
        `).join('')}
    </div>
`;

export const chooseCuttingPlanAlert = async (plans) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
        title: 'Como deseja preparar o corte?',
        html: buildCuttingPlanChoiceHtml(plans),
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonColor: '#2563EB',
        denyButtonColor: '#D97706',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Economizar malha',
        denyButtonText: 'Reduzir enfestos',
        cancelButtonText: 'Cancelar',
        focusConfirm: true
    });

    if (result.isConfirmed) return 'economy';
    if (result.isDenied) return 'fewer-spreads';
    return null;
};

export const chooseCuttingLayersAlert = async (plan, maxLayers = 20) => {
    if (!plan?.spreads?.length) return [];

    const Swal = await getSwal();
    const result = await Swal.fire({
        title: 'Quantas folhas em cada enfesto?',
        html: buildCuttingLayersEditorHtml(plan, maxLayers),
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563EB',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Recalcular e gerar PDF',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const values = Array.from(Swal.getPopup().querySelectorAll('.cutting-layer-input'))
                .map((input) => input.value);
            const layerCounts = normalizeCuttingLayerCounts(values, maxLayers);
            if (!layerCounts) {
                Swal.showValidationMessage(`Informe números inteiros entre 1 e ${maxLayers} folhas.`);
                return false;
            }
            return layerCounts;
        }
    });

    return result.isConfirmed ? result.value : null;
};

// Toast Verde para "Adicionado com Sucesso"
export const showToastSuccess = async (title = 'Adicionado com sucesso!') => {
    const Swal = await getSwal();
    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: title,
        showConfirmButton: false,
        timer: 1500,
        background: '#10B981', // Verde
        color: '#ffffff',
        iconColor: '#ffffff'
    });
};

// Toast Azul para "Alteração Salva"
export const showToastEdit = async (title = 'Alteração salva!') => {
    const Swal = await getSwal();
    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: title,
        showConfirmButton: false,
        timer: 1500,
        background: '#2563EB', // Azul
        color: '#ffffff',
        iconColor: '#ffffff'
    });
};

// Alerta de Envio de Lista Nominal
export const confirmSubmitListAlert = async (quantidade) => {
    const Swal = await getSwal();
    return await Swal.fire({
        title: 'Confirmar e Enviar?',
        html: `
            <div style="font-size: 0.95rem; color: #334155; text-align: left; margin-top: 10px;">
                <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <strong style="color: #1E40AF; display: block; margin-bottom: 8px; font-size: 1rem;">Termo de Responsabilidade</strong>
                    <span style="color: #1E40AF; font-size: 0.85rem; line-height: 1.5; display: block;">
                        Revisei e aprovo todos os nomes, números e tamanhos adicionados. Estou ciente de que a confecção copiará exatamente o que digitei, isentando-a de responsabilidade por erros de ortografia.
                    </span>
                </div>
                <p style="margin: 0; text-align: center;">Serão enviadas <strong>${quantidade} camisa(s)</strong>.<br/>Após o envio, a lista será bloqueada.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563EB',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Aceitar Termo e Enviar',
        cancelButtonText: 'Revisar Novamente'
    });
};

// Alerta de Envio de Grade Fechada
export const confirmBulkSubmitAlert = async (quantidade) => {
    const Swal = await getSwal();
    return await Swal.fire({
        title: 'Confirmar Grade Final?',
        html: `
            <div style="font-size: 0.95rem; color: #334155; text-align: left; margin-top: 10px;">
                <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <strong style="color: #1E40AF; display: block; margin-bottom: 8px; font-size: 1rem;">Termo de Responsabilidade</strong>
                    <span style="color: #1E40AF; font-size: 0.85rem; line-height: 1.5; display: block;">
                        Confirmo as quantidades exatas. Assumo a responsabilidade pela grade escolhida e estou ciente de que não poderei alterá-la após o envio para a produção.
                    </span>
                </div>
                <p style="margin: 0; text-align: center;">Serão enviadas <strong>${quantidade} peças</strong> SEM nome.<br/>Deseja confirmar?</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563EB',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Aceitar Termo e Enviar',
        cancelButtonText: 'Revisar'
    });
};

// Alerta de Aprovação de Arte
export const confirmApproveArtAlert = async () => {
    const Swal = await getSwal();
    return await Swal.fire({
        title: 'Aprovação de Arte',
        html: `
            <div style="font-size: 0.95rem; color: #334155; text-align: left; margin-top: 10px;">
                <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <strong style="color: #92400E; display: block; margin-bottom: 8px; font-size: 1rem;">Termo de Responsabilidade</strong>
                    <span style="color: #92400E; font-size: 0.85rem; line-height: 1.5; display: block;">
                        Eu li, conferi e aprovo a arte apresentada. Estou ciente de que após esta confirmação não haverá alterações, assumindo responsabilidade total pelo layout que será produzido.
                    </span>
                </div>
                <p style="margin: 0; text-align: center;">Deseja assinar o termo e autorizar a produção?</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#D97706',
        cancelButtonColor: '#94A3B8',
        confirmButtonText: 'Sim, Aprovar Arte',
        cancelButtonText: 'Cancelar'
    });
};
