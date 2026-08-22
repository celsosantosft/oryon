const axios = require('axios');
const fs = require('fs');

async function run() {
    const { createEvolutionClient } = require('./config/evolution.js');
    const evolution = createEvolutionClient();
    
    const INSTANCE = evolution.defaults.instance || 'AtosVendas';
    const number = '5577991986422'; 
    
    // Create a simple base64 image
    const base64Img = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const dataUrl = `data:image/png;base64,${base64Img}`;
    
    console.log('Sending media...');
    try {
        const payload = {
            number: number,
            mediatype: 'image',
            mimetype: 'image/png',
            media: dataUrl,
            fileName: 'test.png',
            caption: 'Teste de Imagem'
        };
        const res = await evolution.post(`/message/sendMedia/${INSTANCE}`, payload);
        console.log('Success:', res.data);
    } catch (e) {
        console.error('Failed to sendMedia:', e.response?.data || e.message);
    }

    try {
        const payload = {
            number: number,
            mediatype: 'image',
            mimetype: 'image/png',
            mediaMessage: dataUrl,
            media: dataUrl,
            fileName: 'test.png',
            caption: 'Teste de Imagem'
        };
        const res = await evolution.post(`/message/sendWhatsAppMedia/${INSTANCE}`, payload);
        console.log('Success WhatsAppMedia:', res.data);
    } catch (e) {
        console.error('Failed to sendWhatsAppMedia:', e.response?.data || e.message);
    }
}

run();
