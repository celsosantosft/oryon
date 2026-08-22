async function testTypebot() {
    try {
        const payload = {
            enabled: true,
            url: "https://typebot.co",
            typebot: "my-typebot-thm8qvg",
            expire: 0,
            keywordFinish: "#SAIR",
            delayMessage: 1000,
            unknownMessage: "Mensagem não reconhecida",
            listeningFromMe: false,
            stopBotFromMe: false,
            keepOpen: false,
            debounceTime: 10,
            ignoreJids: []
        };
        const url = `http://localhost:8080/typebot/create/AtosVendas`;
        
        console.log(`Sending to: ${url}`);
        let response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                apikey: 'AtosZap2026' 
            },
            body: JSON.stringify(payload)
        });
        
        console.log('CREATE Status:', response.status);
        console.log('CREATE Response:', await response.text());
        
        const urlSet = `http://localhost:8080/typebot/set/AtosVendas`;
        console.log(`Sending to: ${urlSet}`);
        response = await fetch(urlSet, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                apikey: 'AtosZap2026' 
            },
            body: JSON.stringify(payload)
        });
        
        console.log('SET Status:', response.status);
        console.log('SET Response:', await response.text());
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}
testTypebot();
