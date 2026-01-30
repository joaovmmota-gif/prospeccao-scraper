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

// --- Debug (Stealth Check) ---
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