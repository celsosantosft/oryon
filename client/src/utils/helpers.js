export const formatMoney = (val) => {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const parseNull = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.toLowerCase() === 'null') return '';
    return str;
};

export const getAsArray = (data, fallback) => {
    if (!data) return fallback;
    if (Array.isArray(data)) return data; 
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return data.split(',').map(item => item.trim()); }
    }
    return fallback;
};

export const generateId = () => {
    // Usa crypto.randomUUID se disponível, fallback seguro se não
    return typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Date.now().toString() + Math.random().toString(36).substring(2);
};