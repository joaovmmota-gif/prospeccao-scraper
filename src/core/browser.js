const { chromium } = require('playwright'); // Usando Playwright puro para estabilidade

/**
 * Configurações de Hardening (Anti-Detecção Reforçado)
 */
const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--disable-blink-features=AutomationControlled', // Flag crucial para esconder o robô
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--start-maximized', // Simula tela cheia
];

// User Agent atualizado para bater com a versão do Playwright 1.58 (Chrome 131)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function startBrowser() {
    console.log('[BROWSER] Iniciando Chromium (Standard + Hardening)...');
    
    const browser = await chromium.launch({
        headless: true,
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ['--enable-automation'], // Remove a barra amarela
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
        permissions: ['geolocation', 'notifications'],
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

    // --- MÁSCARA MANUAL (EVASÃO DE SCRIPT) ---
    await page.addInitScript(() => {
        // 1. Remove navigator.webdriver (Método Robusto)
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // 2. Simula Plugins (Chrome PDF Viewer)
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const ChromePDFPlugin = {
                    0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
                    description: "Portable Document Format",
                    filename: "internal-pdf-viewer",
                    length: 1,
                    name: "Chrome PDF Plugin"
                };
                return [ChromePDFPlugin];
            },
        });

        // 3. Mascara permissões
        if (window.navigator.permissions) {
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
        }

        // 4. Fake WebGL Vendor
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            return getParameter(parameter);
        };

        // 5. Chrome Runtime (Necessário para evitar detecção básica)
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
    });

    return page;
}

module.exports = {
    startBrowser,
    createSession
};