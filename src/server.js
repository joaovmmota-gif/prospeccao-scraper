const express = require('express');
const path = require('path');
// Importação segura das rotas
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. MIDDLEWARES GLOBAIS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. ARQUIVOS ESTÁTICOS (VIEWS)
// Serve CSS/JS e evita que caiam nas rotas de API
app.use(express.static(path.join(__dirname, 'views')));

// 3. ROTAS DE INTERFACE (UI)
/**
 * Entrega a interface gráfica
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const sendInterface = (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'interface.html'));
};

app.get('/', sendInterface);
app.get('/tools/test-ui', sendInterface);

// 4. ROTAS DE API (A CORREÇÃO CRÍTICA)
// O Frontend chama '/v1/linkedin/search'.
// O api.routes.js define '/linkedin/search'.
// Logo, montamos o ficheiro no prefixo '/v1'.
app.use('/v1', apiRoutes);

// ALERTA DE COMPATIBILIDADE:
// Com esta mudança:
// - Busca LinkedIn vira: /v1/linkedin/search (Correto ✅)
// - Enriquecer Email vira: /v1/enrich/email
// - Healthcheck vira: /v1/health

// Caso o seu Frontend use '/api/enrich/email' em vez de '/v1',
// precisamos de uma "ponte" adicional para compatibilidade:
app.use('/api', apiRoutes); 

// 5. TRATAMENTO DE ERRO 404 (JSON)
// Garante que chamadas de API erradas não retornem HTML
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint não encontrado', 
        path: req.path 
    });
});

// 6. INICIALIZAÇÃO
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor Online na porta ${PORT}`);
    console.log(`🛠️  Interface: http://localhost:${PORT}`);
    console.log(`📡 LinkedIn: http://localhost:${PORT}/v1/linkedin/search`);
    console.log(`📡 Email:    http://localhost:${PORT}/v1/enrich/email`);
    console.log(`=================================`);
});