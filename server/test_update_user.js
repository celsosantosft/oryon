const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const USER_ID_TO_UPDATE = 2; // ID da Maria Gerente
const UPDATE_DATA = {
    salary: 5800.00, // Aumento de salário
    photo_url: "http://link.com/foto-maria.jpg", // Adicionando a foto
    role: "gerente" // Apenas para confirmar
};

async function updateUser() {
    try {
        const response = await axios.put(`http://localhost:3001/api/users/${USER_ID_TO_UPDATE}`, UPDATE_DATA, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            console.log("✅ Usuário ID 2 atualizado com sucesso!");
            console.log("Mensagem da API:", response.data.message);
        }
    } catch (error) {
        console.error("❌ Erro ao atualizar usuário:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

updateUser();