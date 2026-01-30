const { chromium } = require('playwright');

const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--disable-blink-features=AutomationControlled', // CRÍTICO
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--start-maximized',
];

// User Agent de Windows padrão
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function startBrowser() {
    console.log('[BROWSER] Iniciando Chromium (Stealth V3)...');
    
    const browser = await chromium.launch({
        headless: true,
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ['--enable-automation'],
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

    // --- EVASÃO CIRÚRGICA (V3) ---
    await page.addInitScript(() => {
        // 1. Remove WebDriver do PROTÓTIPO (Mais eficiente)
        // Isso impede que sites verifiquem Object.getPrototypeOf(navigator).webdriver
        delete Object.getPrototypeOf(navigator).webdriver;

        // 2. Mock do objeto 'chrome' (Sem quebrar tipos)
        window.chrome = {
            runtime: {},
            app: {
                isInstalled: false,
                InstallState: {
                    DISABLED: 'disabled',
                    INSTALLED: 'installed',
                    NOT_INSTALLED: 'not_installed'
                },
                RunningState: {
                    CANNOT_RUN: 'cannot_run',
                    READY_TO_RUN: 'ready_to_run',
                    RUNNING: 'running'
                }
            },
            csi: () => {},
            loadTimes: () => {}
        };

        // 3. Permissões (Simples e eficaz)
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
    });

    return page;
}

module.exports = {
    startBrowser,
    createSession
};