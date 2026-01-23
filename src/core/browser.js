const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

// Aplica o plugin stealth
chromium.use(stealth());

/**
 * Configurações de Hardening (Anti-Detecção Reforçado)
 */
const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--disable-blink-features=AutomationControlled', // Oculta a flag de automação
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    // Flags adicionais para mascarar WebGL e WebRTC
    '--disable-gl-drawing-for-tests',
    '--enable-features=NetworkService,NetworkServiceInProcess',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function startBrowser() {
    console.log('[BROWSER] Iniciando Chromium em modo Stealth (Hardened)...');
    
    const browser = await chromium.launch({
        headless: true, 
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ['--enable-automation'],
        channel: 'chrome', // Tenta usar o Chrome real se disponível, senão Chromium
    });

    return browser;
}

async function createSession(browser, cookieLiAt) {
    console.log('[BROWSER] Criando contexto de sessão...');

    const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        javaScriptEnabled: true,
        permissions: ['geolocation'], // Simula permissões padrão
    });

    // Injeção do Cookie
    if (cookieLiAt) {
        await context.addCookies([{
            name: 'li_at',
            value: cookieLiAt,
            domain: '.linkedin.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        }]);
    }

    const page = await context.newPage();

    // --- MÁSCARA MANUAL (EVASÃO V2) ---
    // Injeta scripts em cada nova aba para sobrescrever propriedades de bot
    await page.addInitScript(() => {
        // 1. Remove a propriedade navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // 2. Mascara plugins (finge ter PDF Viewer, etc)
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5], // Fake length
        });

        // 3. Mascara permissões (evita detecção via Notification API)
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // 4. Fake WebGL Vendor (para não aparecer "Google SwiftShader" ou "Mesa")
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter(parameter);
        };
    });

    return page;
}

module.exports = {
    startBrowser,
    createSession
};