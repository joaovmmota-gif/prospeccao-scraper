const express = require('express');
// Importa o Playwright com extras
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

// Aplica o plugin stealth para evitar que o Google detecte que é um robô
chromium.use(stealth());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configurações de Comportamento Humano
const CONFIG = {
    // Atraso mínimo e máximo entre ações (em milissegundos)
    DELAY_MIN: 2000,
    DELAY_MAX: 5000,
    // User Agent genérico de Chrome Windows para parecer usuário comum
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Função auxiliar para pausas aleatórias (Humanizar)
const randomDelay = async (page) => {
    const delay = Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1) + CONFIG.DELAY_MIN);
    await page.waitForTimeout(delay);
};

// --- ROTA DE DIAGNÓSTICO ---
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Scraper API (Google Dorking Mode)',
        ready: true
    });
});

// --- ROTA DE BUSCA REAL (GOOGLE DORKING) ---
app.post('/api/linkedin/search', async (req, res) => {
    const { cargo, empresa } = req.body;

    // Validação básica
    if (!cargo || !empresa) {
        return res.status(400).json({ error: 'Faltam parâmetros: cargo e empresa são obrigatórios.' });
    }

    console.log(`[SCRAPER] Iniciando busca real para: ${cargo} em ${empresa}`);

    let browser = null;
    try {
        // 1. Inicia o navegador (Headless = true para servidor, false para ver rodando no PC)
        browser = await chromium.launch({
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Necessário para Docker
        });

        // 2. Cria uma nova página (aba)
        const context = await browser.newContext({ userAgent: CONFIG.USER_AGENT });
        const page = await context.newPage();

        // 3. Monta a Query do Google (Dorking)
        // site:br.linkedin.com/in/ "Cargo" "Empresa"
        const query = `site:br.linkedin.com/in/ "${cargo}" "${empresa}"`;
        
        // 4. Vai para o Google
        await page.goto('https://www.google.com.br');
        await randomDelay(page);

        // Tenta lidar com popups de "Aceitar Cookies" do Google se aparecerem
        try {
            const cookieButton = await page.$('button:has-text("Aceitar")'); 
            if (cookieButton) await cookieButton.click();
        } catch (e) { /* Ignora se não tiver popup */ }

        // 5. Digita a busca e dá Enter
        // Seletor do campo de busca do Google (geralmente é textarea[name="q"] ou input[name="q"])
        await page.fill('textarea[name="q"], input[name="q"]', query);
        await page.keyboard.press('Enter');

        // 6. Espera os resultados carregarem (seletor genérico de resultados do Google)
        await page.waitForSelector('#search');
        await randomDelay(page);

        // 7. Extração dos Dados (Scraping)
        // O Google estrutura resultados geralmente dentro de div.g
        const results = await page.$$eval('#search div.g', (elements) => {
            return elements.map(el => {
                const titleEl = el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const snippetEl = el.querySelector('div[style*="-webkit-line-clamp"]'); 

                if (titleEl && linkEl) {
                    return {
                        titulo: titleEl.innerText,
                        url: linkEl.href,
                        // Limpeza básica do título para tentar extrair nome (falível, mas útil)
                        nome_provavel: titleEl.innerText.split('-')[0].split('|')[0].trim(),
                        snippet: snippetEl ? snippetEl.innerText : ''
                    };
                }
                return null;
            }).filter(item => item !== null && item.url.includes('linkedin.com/in/'));
        });

        console.log(`[SCRAPER] Sucesso! Encontrados ${results.length} resultados.`);

        // 8. Fecha o navegador e retorna
        await browser.close();

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('[ERRO SCRAPER]', error);
        if (browser) await browser.close();
        res.status(500).json({ 
            success: false, 
            error: error.message,
            tip: "Pode ser bloqueio do Google (Captcha) ou seletor que mudou."
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Scraper API (Modo Real) rodando na porta ${PORT}`);
});