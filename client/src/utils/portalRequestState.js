export const getPortalErrorContent = (error) => {
    const status = error?.response?.status || error?.status;

    if (status === 404) {
        return {
            title: 'Pedido não encontrado',
            message: 'Confira o número do pedido e tente novamente.'
        };
    }

    if (status === 401 || status === 403) {
        return {
            title: 'Link inválido',
            message: 'Abra novamente o link enviado pela empresa ou informe somente o número do pedido.'
        };
    }

    return {
        title: 'Portal temporariamente indisponível',
        message: 'Não foi possível carregar o pedido agora. Aguarde um momento e tente novamente.'
    };
};

export const buildPortalTarget = ({ preview, response, safeCode, portalToken }) => {
    const portalBasePath = preview ? '/portal-preview' : '/portal';
    const responseCode = response?.tracking_code || safeCode;
    let targetToken = portalToken;

    if (!targetToken && response?.portal_path) {
        const query = String(response.portal_path).split('?')[1] || '';
        targetToken = new URLSearchParams(query).get('token') || '';
    }

    return `${portalBasePath}/${encodeURIComponent(responseCode)}${targetToken ? `?token=${encodeURIComponent(targetToken)}` : ''}`;
};
