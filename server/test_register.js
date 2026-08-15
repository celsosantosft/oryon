const axios = require('axios'); // Vamos usar o axios para simular o registro

const ADMIN_DATA = {
    name: "Admin Geral",
    email: "admin@atoserp.com",
    password: "senhaforte123" // Use uma senha que você lembre!
};

async function registerAdmin() {
    try {
        const response = await axios.post('http://localhost:3001/register', ADMIN_DATA);
        
        if (response.status === 201) {
            console.log("✅ Registro de ADMIN feito com sucesso!");
            console.log("Token JWT: ", response.data.token);
            console.log("Usuário: ", response.data.user);
        }
    } catch (error) {
        console.error("❌ Erro no registro:");
        // Se o erro for por e-mail duplicado, avisamos
        if (error.response && error.response.status === 400) {
             console.error(error.response.data.message);
        } else {
             console.error("Erro desconhecido:", error.message);
        }
    }
}

registerAdmin();