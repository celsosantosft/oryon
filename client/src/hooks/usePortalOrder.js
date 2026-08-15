import { useState, useEffect } from 'react';
import { trackingService } from '../services/trackingService';

const showInvalidPortalAlert = async () => {
    const Swal = (await import('sweetalert2')).default;
    return Swal.fire('Ops!', 'Pedido não encontrado ou link inválido.', 'error');
};

export const usePortalOrder = (code, portalToken) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                setLoading(true);
                const data = await trackingService.getPortalOrder(code, portalToken);
                setOrder(data);
            } catch (err) {
                console.error(err);
                showInvalidPortalAlert();
            } finally {
                setLoading(false);
            }
        };
        if (code) fetchOrder();
    }, [code, portalToken]);

    const updateOrderStatus = (newStatus) => {
        setOrder(prev => ({ ...prev, status: newStatus }));
    };

    return { order, loading, updateOrderStatus };
};
