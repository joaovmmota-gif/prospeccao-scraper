const express = require('express');
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares Globais
app.use(express.json()); // Entender JSON
app.use(express.urlencoded({ extended: true })); // Entender formulários

// 2. Importar Rotas
// Tudo que está definido no api.routes.js será usado pelo app
app.use('/', apiRoutes);

// 3. Rota de Health Check (Raiz)
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        system: 'Prospeccao Scraper API',
        version: '2.0.0',
        endpoints: {
            ui: '/tools/test-ui',
            api: '/api/v1/linkedin/search'
        }
    });
});

// 4. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🛠️  Interface: http://localhost:${PORT}/tools/test-ui`);
    console.log(`=================================`);
});