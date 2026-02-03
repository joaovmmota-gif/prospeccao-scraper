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

    // Tenta usar search, se não existir usa scrape (fallback de compatibilidade)
    const linkedinMethod = linkedinController.search || linkedinController.scrape;
    router.post('/linkedin/search', linkedinMethod);



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