const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
async function getProfitReport() {
    try {
        const response = await axios.get('http://localhost:3001/api/reports/profit', {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            const data = response.data;
            console.log("✅ Relatório Financeiro: Lucro Bruto (Pedidos Concluídos)");
            console.log("-----------------------------------------");
            console.log(`Receita Total (Pedidos Concluídos): R$ ${data.total_revenue}`);
            console.log(`Custo Total (Pedidos Concluídos): R$ ${data.total_cost}`);
            console.log(`Lucro Bruto: R$ ${data.gross_profit}`);
            console.log("-----------------------------------------");
        }
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

getProfitReport();