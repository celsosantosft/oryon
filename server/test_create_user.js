const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const NEW_USER_DATA = {
    name: "Maria Gerente",
    email: "maria.gerente@atoserp.com",
    password: "gerentesenha", 
    role: "gerente", // Cargo
    salary: 5500.00, // Salário (Para o Financeiro)
    birth_date: "1990-05-15" // Aniversário (Para o RH)
};

async function createUser() {
    try {
        const response = await axios.post('http://localhost:3001/api/users', NEW_USER_DATA, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 201) {
            console.log("✅ Novo usuário criado com sucesso!");
            console.log("Cargo:", response.data.user.role);
            console.log("Salário Registrado:", response.data.user.salary);
        }
    } catch (error) {
        console.error("❌ Erro ao criar usuário:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

createUser();