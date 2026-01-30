const express = require('express');
const router = express.Router();

const LinkedinController = require('../controllers/linkedin.controller');
const EmailController = require('../controllers/email.controller'); // Importa Controller de E-mail
const { startBrowser, createSession } = require('../core/browser');

// --- LinkedIn ---
router.get('/tools/test-ui', LinkedinController.renderTestInterface);
router.post('/api/v1/linkedin/search', LinkedinController.searchProfiles);

// --- E-mail Finder (NOVO) ---
router.post('/api/v1/email/find', EmailController.findEmail); // Nova Rota

// --- Debug ---
router.get('/debug/stealth', async (req, res) => {
    // ... (mantém código anterior) ...
});

module.exports = router;