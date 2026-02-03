const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares Globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 2. Entrega de Arquivos Estáticos
 * Essencial para que a interface.html consiga carregar scripts e estilos
 */
app.use(express.static(path.join(__dirname, 'views')));

/**
 * 3. Rotas de UI (Prioridade Visual)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
app.get('/tools/test-ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'interface.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'interface.html'));
});

/**
 * 4. Rotas de API
 * Mapeadas na raiz conforme definido em api.routes.js.
 * Como as rotas acima são específicas (/tools/test-ui), elas não conflitam.
 * O router.get('/health') dentro de api.routes será acessado em /health.
 */
app.use('/', apiRoutes);

// 5. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🛠️  Interface: http://localhost:${PORT}/tools/test-ui`);
    console.log(`📡 Healthcheck: http://localhost:${PORT}/health`);
    console.log(`=================================`);
});