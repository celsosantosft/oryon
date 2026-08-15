const axios = require('axios');

const LOGIN_DATA = {
    email: "admin@atoserp.com",
    password: "senhaforte123" 
};

async function loginAdmin() {
    try {
        const response = await axios.post('http://localhost:3001/login', LOGIN_DATA);
        
        if (response.status === 200) {
            console.log("✅ Login de ADMIN feito com sucesso!");
            console.log("Token JWT Recebido: ", response.data.token);
            console.log("Usuário: ", response.data.user);
        }
    } catch (error) {
        console.error("❌ Erro no Login:");
        // Se o erro for de senha inválida
        if (error.response && error.response.data.message) {
             console.error(error.response.data.message);
        } else {
             console.error("Erro desconhecido:", error.message);
        }
    }
}

loginAdmin();