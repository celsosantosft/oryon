const axios = require('axios');

// Token JWT do Admin Geral
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Código de Rastreio do Pedido 1
const TRACKING_CODE = '#ATOS-2774'; 

async function viewOrderHistory() {
    try {
        // CORREÇÃO: Usar encodeURIComponent para garantir que o '#' seja enviado corretamente.
        const encodedTrackingCode = encodeURIComponent(TRACKING_CODE);

        const response = await axios.get(`http://localhost:3001/api/orders/${encodedTrackingCode}/history`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}` 
            }
        });
        
        if (response.status === 200) {
            
            // DADOS RAW DA API: (mantido para debug)
            console.log("DADOS RAW DA API:", response.data); 
            
            console.log("✅ Histórico do Pedido encontrado!");
            console.log("Cliente:", response.data.client_name);
            console.log("--- Linha do Tempo ---");
            
            response.data.history.forEach((entry, index) => {
                console.log(`${index + 1}. Status: ${entry.status_text}`);
                console.log(`   Por: ${entry.changed_by_name} (${entry.changed_by_role})`);
                console.log(`   Em: ${entry.changed_at}`);
                console.log("------------------------");
            });
        }
    } catch (error) {
        console.error("❌ Erro ao buscar histórico:");
        if (error.response) {
             console.error("Status:", error.response.status);
             console.error("Mensagem:", error.response.data.message);
        } else {
             console.error("Erro de Conexão:", error.message);
        }
    }
}

viewOrderHistory();