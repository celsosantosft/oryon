import axios from 'axios';

const API_BASE_URL = 'https://atosfardamentos.com.br/api';

const portalParams = (token) => (
    token ? { params: { token } } : {}
);

const normalizeTrackingCode = (code) => {
    let safeCode = String(code || '').trim().toUpperCase();

    if (/^\d+$/.test(safeCode)) {
        safeCode = `#ATOS-${safeCode}`;
    } else if (!safeCode.startsWith('#')) {
        safeCode = `#${safeCode}`;
    }

    return safeCode;
};

export const trackingService = {
    getPortalOrder: async (code, token) => {
        const safeCode = encodeURIComponent(normalizeTrackingCode(code));
        const response = await axios.get(`${API_BASE_URL}/api/tracking/portal/${safeCode}`, portalParams(token));
        return response.data;
    },
    saveDraft: async (code, token, items) => {
        const safeCode = encodeURIComponent(normalizeTrackingCode(code));
        await axios.post(`${API_BASE_URL}/api/tracking/portal/${safeCode}/save-draft`, { items }, portalParams(token));
    },
    submitItems: async (code, token, items) => {
        const safeCode = encodeURIComponent(normalizeTrackingCode(code));
        await axios.post(`${API_BASE_URL}/api/tracking/portal/${safeCode}/submit`, { items }, portalParams(token));
    },
    approveArt: async (code, token) => {
        const safeCode = encodeURIComponent(normalizeTrackingCode(code));
        await axios.post(`${API_BASE_URL}/api/tracking/portal/${safeCode}/approve-art`, {}, portalParams(token));
    }
};
