const express = require('express');
const router = express.Router();

// Importa o controlador que acabamos de criar
const LinkedinController = require('../controllers/linkedin.controller.js');
const { startBrowser, createSession } = require('../core/browser'); // Importando para a rota de debug legado

// --- Rota de Interface (View) ---
router.get('/tools/test-ui', LinkedinController.renderTestInterface);

// --- Rota da API (Action) ---
router.post('/api/v1/linkedin/search', LinkedinController.searchProfiles);

// --- Rota de Debug (Legado/Stealth Check) ---
router.get('/debug/stealth', async (req, res) => {
    let browser = null;
    try {
        browser = await startBrowser();
        const page = await createSession(browser, null);
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        res.set('Content-Type', 'image/png');
        res.send(screenshotBuffer);
    } catch (e) {
        res.status(500).send(e.message);
    } finally {
        if(browser) await browser.close();
    }
});

module.exports = router;