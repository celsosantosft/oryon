const getSwal = async () => (await import('sweetalert2')).default;

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
