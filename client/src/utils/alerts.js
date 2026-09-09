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
