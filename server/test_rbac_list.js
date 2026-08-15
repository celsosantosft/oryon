const axios = require('axios');

// O Token JWT do Admin (obtido no Passo 20/23)
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzY1MjE2NzY0LCJleHAiOjE3NjUzMDMxNjR9.VDpZAuZTaezzHKyWaCYaOGDPiMqvTeY2WR726SB07U8'; 

async function listUsers() {
    try {
        const response = await axios.get('http://localhost:3001/api/users', {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            console.log("✅ Listagem de Usuários (Quadro de Funcionários) liberada!");
            console.log("Usuários encontrados: ", response.data.users.length);
            console.log("Primeiro Usuário (Admin): ", response.data.users[0]);
        }
    } catch (error) {
        console.error("❌ Erro ao listar usuários:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

listUsers();