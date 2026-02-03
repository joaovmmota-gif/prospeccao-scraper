const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares Globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Rota Privada: Serve a Interface Frontend (HTML)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
const serveInterface = (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'interface.html'));
};

// 2. Definição de Rotas de UI
app.get('/', serveInterface);
app.get('/tools/test-ui', serveInterface);

// 3. Middlewares de API
// Nota: apiRoutes deve ser carregado depois da UI se houver conflito de '/'
app.use('/', apiRoutes);

/**
 * Rota de Health Check (JSON) 
 * Movida para /status para evitar conflito com a UI na raiz
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        system: 'Prospeccao Scraper API',
        version: '2.1.0',
        endpoints: {
            ui: '/tools/test-ui',
            api: '/api/enrich/email'
        }
    });
});

// 4. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🛠️  Interface: http://localhost:${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
    console.log(`=================================`);
});