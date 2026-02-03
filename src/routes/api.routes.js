const { Router } = require('express');
const router = Router();

// Importação dos Controllers
// Nota: Os controllers exportam instâncias (new Controller())
const emailController = require('../controllers/email.controller');
const linkedinController = require('../controllers/linkedin.controller');

/**
 * ROTAS DE LINKEDIN
 * Endpoint para busca e scraping de perfis
 */
// Verifica se o método existe antes de atribuir para evitar crash na inicialização
if (linkedinController && (linkedinController.search || linkedinController.scrape)) {
    // Tenta usar search, se não existir usa scrape (fallback de compatibilidade)
    const linkedinMethod = linkedinController.search || linkedinController.scrape;
    router.post('/linkedin/search', linkedinMethod);
} else {
    console.warn('[Routes] Aviso: Método do LinkedinController não encontrado.');
}

/**
 * ROTAS DE EMAIL (ENRICHMENT)
 * Endpoint para validação SMTP com Throttling
 */
router.post('/enrich/email', emailController.enrich);

/**
 * ROTA DE HEALTHCHECK
 * Para monitoramento do Docker/Easypanel
 */
router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

module.exports = router;