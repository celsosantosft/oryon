import { useState, useEffect } from 'react';
import { trackingService } from '../services/trackingService';
import { getPortalErrorContent } from '../utils/portalRequestState';

const showInvalidPortalAlert = async (error) => {
    const Swal = (await import('sweetalert2')).default;
    const content = getPortalErrorContent(error);
    return Swal.fire(content.title, content.message, 'error');
};

export const usePortalOrder = (code, portalToken, { showAlert = true } = {}) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await trackingService.getPortalOrder(code, portalToken);
                setOrder(data);
            } catch (err) {
                console.error(err);
                setOrder(null);
                setError(err);
                if (showAlert) showInvalidPortalAlert(err);
            } finally {
                setLoading(false);
            }
        };
        if (code) fetchOrder();
    }, [code, portalToken, showAlert]);

    const updateOrderStatus = (newStatus) => {
        setOrder(prev => ({ ...prev, status: newStatus }));
    };

    return { order, loading, error, updateOrderStatus };
};
