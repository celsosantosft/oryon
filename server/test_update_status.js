const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Código de Rastreio do Pedido 1
const TRACKING_CODE = '#ATOS-2774'; 
const NEW_STATUS = 'Arte Aprovada/Liberada'; // Novo Status

async function updateOrderStatus() {
    try {
        const encodedTrackingCode = encodeURIComponent(TRACKING_CODE);

        const response = await axios.post(`http://localhost:3001/api/orders/${encodedTrackingCode}/status`, 
            { new_status: NEW_STATUS }, // Payload: Novo Status
            {
                headers: {
                    'Authorization': `Bearer ${ADMIN_TOKEN}` 
                }
            }
        );
        
        if (response.status === 200) {
            console.log(`✅ Status do pedido ${TRACKING_CODE} atualizado com sucesso!`);
            console.log("Mensagem da API:", response.data.message);
        }
    } catch (error) {
        console.error("❌ Erro ao atualizar status:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

updateOrderStatus();