const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

// Aplica o plugin stealth ao Playwright
chromium.use(stealth());

/**
 * Configurações de Hardening (Anti-Detecção)
 */
const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--disable-blink-features=AutomationControlled', // CRÍTICO: Esconde que é robô
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--hide-scrollbars',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Inicia uma instância do navegador Chromium com configurações furtivas.
 * @returns {Promise<import('playwright').Browser>}
 */
async function startBrowser() {
    console.log('[BROWSER] Iniciando Chromium em modo Stealth...');
    
    const browser = await chromium.launch({
        headless: true, // Mude para false se quiser ver a tela rodando localmente
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ['--enable-automation'], // Remove a barra "Chrome is being controlled..."
    });

    return browser;
}

/**
 * Cria um novo contexto (sessão) e injeta o cookie de autenticação.
 * @param {import('playwright').Browser} browser - Instância do navegador iniciada
 * @param {string} cookieLiAt - O valor do cookie 'li_at' do LinkedIn
 * @returns {Promise<import('playwright').Page>} - Retorna a página pronta para uso
 */
async function createSession(browser, cookieLiAt) {
    console.log('[BROWSER] Criando contexto de sessão...');

    const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1366, height: 768 }, // Resolução comum de laptop
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        deviceScaleFactor: 1,
        hasTouch: false,
        javaScriptEnabled: true,
    });

    // Injeção do Cookie de Sessão
    if (cookieLiAt) {
        console.log('[BROWSER] Injetando cookie de autenticação (li_at)...');
        await context.addCookies([{
            name: 'li_at',
            value: cookieLiAt,
            domain: '.linkedin.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        }]);
    } else {
        console.warn('[BROWSER] ATENÇÃO: Nenhum cookie fornecido. A navegação será anônima.');
    }

    const page = await context.newPage();

    // Máscara extra para o Webdriver
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    return page;
}

module.exports = {
    startBrowser,
    createSession
};