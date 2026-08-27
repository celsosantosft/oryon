import axios from 'axios';
import { appConfig, normalizeTrackingCode } from '../config/appConfig';

const API_BASE_URL = appConfig.apiBaseUrl;

const portalParams = (token) => (
    token ? { params: { token } } : {}
);

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
