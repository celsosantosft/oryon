const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ORDER_DATA = {
    client_name: "Empresa XPTO",
    product_type: "Camiseta Gola V",
    fabric_type: "Algodão Penteado 30.1",
    category: "Adulto",
    
    // Tabela de tamanhos (JSON)
    sizes_json: {
        P: 10,
        M: 15,
        G: 5,
        total: 30 
    },
    
    // Dados Financeiros
    total_price: 900.00, // Preço de venda
    cost_price: 450.00,  // Custo (Para cálculo de Lucro)
    delivery_date: "2026-01-25" 
};

async function createOrder() {
    try {
        const response = await axios.post('http://localhost:3001/api/orders', ORDER_DATA, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 201) {
            console.log("✅ Pedido criado com sucesso!");
            console.log("Código de Rastreio gerado:", response.data.tracking_code);
            console.log("ID do Pedido:", response.data.order_id);
            console.log("Status inicial (Linha do Tempo) registrado.");
        }
    } catch (error) {
        console.error("❌ Erro ao criar pedido:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

createOrder();