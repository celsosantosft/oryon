const axios = require('axios');

const TOKEN = process.env.ADMIN_TOKEN || '';
async function accessProtected() {
    try {
        const response = await axios.get('http://localhost:3001/api/protected', {
            headers: {
                // A segurança exige o Token no cabeçalho
                'Authorization': `Bearer ${TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            console.log("✅ Acesso PROTEGIDO autorizado com sucesso!");
            console.log("Cargo detectado pelo sistema: ", response.data.role);
            console.log("Resposta da API:", response.data.message);
        }
    } catch (error) {
        console.error("❌ Erro ao acessar rota protegida:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

accessProtected();