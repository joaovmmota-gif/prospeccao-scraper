const express = require('express');
const router = express.Router();

// Importações
const linkedinController = require('../controllers/linkedin.controller');
const emailController = require('../controllers/email.controller');

/**
 * DEBUG & VALIDAÇÃO (Fail-Fast)
 * Garante que a função searchProfiles existe antes de tentar criar a rota.
 */
if (!linkedinController.searchProfiles) {
    console.error('❌ ERRO FATAL: linkedinController.searchProfiles não foi encontrado!');
    console.log('Exportações disponíveis:', Object.keys(linkedinController));
    process.exit(1); // Encerra o container para não ficar em loop de erro
}

/**
 * DEFINIÇÃO DE ROTAS
 */

// 1. Busca LinkedIn
// CORREÇÃO: Usando .searchProfiles (nome definido no controller)
router.post('/linkedin/search', linkedinController.searchProfiles);

// 2. Enriquecimento de Email
router.post('/enrich/email', emailController.enrich);

// 3. Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

module.exports = router;