const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
async function listOrders() {
    try {
        const response = await axios.get('http://localhost:3001/api/orders', {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            console.log("✅ Listagem de Pedidos liberada!");
            console.log("Pedidos encontrados: ", response.data.orders.length);
            
            const firstOrder = response.data.orders[0];
            console.log("--- Detalhes do Pedido 1 ---");
            console.log("Código de Rastreio:", firstOrder.tracking_code);
            console.log("Cliente:", firstOrder.client_name);
            console.log("Status Atual:", firstOrder.status);
            console.log("Tamanhos:", firstOrder.sizes_json); // Deve ser um objeto JS, não uma string
            console.log("Preço Total:", firstOrder.total_price);
            
        }
    } catch (error) {
        console.error("❌ Erro ao listar pedidos:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

listOrders();