const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Código de Rastreio do Pedido 1
const TRACKING_CODE = '#ATOS-2774'; 
const FINAL_STATUS = 'Entregue/Concluído'; // Status Final

async function completeOrder() {
    try {
        const encodedTrackingCode = encodeURIComponent(TRACKING_CODE);

        const response = await axios.post(`http://localhost:3001/api/orders/${encodedTrackingCode}/status`, 
            { new_status: FINAL_STATUS }, // Payload: Status Final
            {
                headers: {
                    'Authorization': `Bearer ${ADMIN_TOKEN}` 
                }
            }
        );
        
        if (response.status === 200) {
            console.log(`✅ Status do pedido ${TRACKING_CODE} atualizado para '${FINAL_STATUS}'.`);
            console.log("Mensagem da API:", response.data.message);
        }
    } catch (error) {
        console.error("❌ Erro ao concluir pedido:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

completeOrder();