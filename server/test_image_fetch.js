const fs = require('fs');

async function run() {
    const { evolutionConfig } = require('./config/evolution.js');
    
    const INSTANCE = evolutionConfig.instance || 'AtosVendas';
    const number = '5577991986422'; 
    const apiKey = evolutionConfig.apiKey;
    const baseUrl = evolutionConfig.baseUrl;
    
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
        const res = await fetch(`${baseUrl}/message/sendMedia/${INSTANCE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log('Success sendMedia:', text);
    } catch (e) {
        console.error('Failed to sendMedia:', e);
    }

    console.log('Sending WhatsAppMedia...');
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
        const res = await fetch(`${baseUrl}/message/sendWhatsAppMedia/${INSTANCE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log('Success WhatsAppMedia:', text);
    } catch (e) {
        console.error('Failed to sendWhatsAppMedia:', e);
    }
}

run();
