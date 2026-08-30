const express = require('express');
const cors = require('cors');
const path = require('path');
require('./config/env').loadEnv();
const { appConfig } = require('./config/appConfig');
const { appPaths } = require('./config/paths');
const { createSecurityMiddleware, resolveTrustProxyConfig } = require('./middlewares/security');

// Inicializa o Banco de Dados
require('./database');

const app = express();
const PORT = appConfig.port;
const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : '*';

// --- CONFIGURA��O B�SICA ---
app.set('trust proxy', resolveTrustProxyConfig());
app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(createSecurityMiddleware());
app.use(express.json());
app.use('/api/uploads', express.static(appPaths.uploadsDir));

// --- IMPORTA��O DAS GAVETAS (ROTAS) ---
const usersRoutes = require('./routes/users');
const clientsRoutes = require('./routes/clients');
const productsRoutes = require('./routes/products');
const quotesRoutes = require('./routes/quotes');
const ordersRoutes = require('./routes/orders');
const { router: reverterPedidoParaOrcamentoRoutes } = require('./routes/reverterPedidoParaOrcamento');
const financeRoutes = require('./routes/finance'); // ?? C�rebro Financeiro importado
const corteRoutes = require('./routes/corte');
let whatsappRoutes = null;

try {
    whatsappRoutes = require('./routes/whatsapp');
} catch (error) {
    console.warn('Módulo WhatsApp não carregado. Verifique routes/whatsapp.js e rode npm install no server.', error.message);
}

// --- LIGA��O DAS ROTAS NO MOTOR (COM O /API OFICIAL) ---
app.use('/api', usersRoutes);
app.use('/api', clientsRoutes);
app.use('/api', productsRoutes);
app.use('/api', quotesRoutes);
app.use('/api', ordersRoutes);
app.use('/api', reverterPedidoParaOrcamentoRoutes);
app.use('/api', financeRoutes); // ?? M�dulo Financeiro ativado no motor!
app.use('/api', corteRoutes);
if (whatsappRoutes) {
    app.use('/api', whatsappRoutes);
}

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`?? Servidor ERP escutando na rede local (Wi-Fi) na porta ${PORT}`);
});
