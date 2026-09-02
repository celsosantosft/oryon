const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const USER_ID_TO_DELETE = 2; // ID da Maria Gerente

async function deleteUser() {
    try {
        const response = await axios.delete(`http://localhost:3001/api/users/${USER_ID_TO_DELETE}`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            console.log("✅ Usuário ID 2 excluído com sucesso!");
            console.log("Mensagem da API:", response.data.message);
        }
    } catch (error) {
        console.error("❌ Erro ao excluir usuário:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

deleteUser();