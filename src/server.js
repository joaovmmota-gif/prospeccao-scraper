const express = require('express');
const { startBrowser, createSession } = require('./core/browser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- ROTA DE DIAGNÓSTICO BÁSICA ---
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'LinkedIn Scraper API (Direct Auth)',
        mode: 'production_ready'
    });
});

// --- ROTA DE TESTE DE FURTIVIDADE (Visualizar em Produção) ---
// Acesse essa rota pelo navegador para ver se o robô é detectado
app.get('/debug/stealth', async (req, res) => {
    let browser = null;
    try {
        console.log('[DEBUG] Iniciando teste de stealth...');
        
        // 1. Inicia o motor usando nossa configuração blindada
        browser = await startBrowser();
        
        // 2. Cria sessão anônima
        const page = await createSession(browser, null);
        
        // 3. Acessa o site de teste de bot
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        
        // 4. Tira o print
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        
        // 5. Envia a imagem direto para o seu navegador
        res.set('Content-Type', 'image/png');
        res.send(screenshotBuffer);
        
    } catch (error) {
        console.error('[DEBUG ERROR]', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});