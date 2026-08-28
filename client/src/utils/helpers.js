import imageCompression from 'browser-image-compression';

export const compressImageSafe = async (file) => {
    if (!file || !file.type.startsWith('image/')) return file;
    try {
        const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/webp'
        };
        const compressedFile = await imageCompression(file, options);
        return new File([compressedFile], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
        });
    } catch (error) {
        console.warn('Erro ao comprimir imagem, enviando original:', error);
        return file;
    }
};

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