const { startBrowser, createSession } = require('./src/core/browser');

async function runTest() {
    let browser = null;
    try {
        console.log('🧪 INICIANDO TESTE DE FURTIVIDADE (STEALTH)\n');

        // 1. Inicia o Motor
        browser = await startBrowser();

        // 2. Cria Sessão (passamos null no cookie só para testar o browser limpo)
        const page = await createSession(browser, null);

        // 3. Vai para o site de teste de bot
        console.log('🌐 Acessando https://bot.sannysoft.com/ ...');
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });

        // 4. Tira um print do resultado
        const screenshotPath = 'teste_stealth_resultado.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log(`\n✅ Teste concluído! Verifique a imagem: ${screenshotPath}`);
        console.log('🔎 Procure por "WebDriver: false" (verde) na imagem.');

    } catch (error) {
        console.error('❌ Falha no teste:', error);
    } finally {
        if (browser) await browser.close();
    }
}

runTest();