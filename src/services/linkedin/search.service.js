const { createSession, startBrowser } = require('../../core/browser');

/**
 * Realiza uma busca interna no LinkedIn (Simulando usuário real)
 * @param {string} cookieLiAt - Cookie de sessão
 * @param {Object} query - Objeto com { role, company }
 */
async function runInternalSearch(cookieLiAt, { role, company }) {
    let browser = null;
    try {
        // 1. Inicia o Motor
        browser = await startBrowser();
        const page = await createSession(browser, cookieLiAt);

        console.log(`[LINKEDIN] Navegando para a Home para validar sessão...`);
        
        // 2. Acessa a Home primeiro (Comportamento Humano)
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
        
        // Verifica se caiu no login (Sessão Expirada/Inválida)
        if (page.url().includes('login') || page.url().includes('context=signup')) {
            throw new Error('SESSION_INVALID: O cookie li_at expirou ou é inválido. Redirecionado para login.');
        }

        console.log('[LINKEDIN] Sessão válida! Iniciando busca...');

        // 3. Monta a URL de Busca de Pessoas
        // Filtros: keywords (termo livre), origin (barra global)
        const searchTerm = `${role} ${company}`;
        const encodedTerm = encodeURIComponent(searchTerm);
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedTerm}&origin=GLOBAL_SEARCH_HEADER`;

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        
        // Espera o container de resultados aparecer
        try {
            await page.waitForSelector('.reusable-search__entity-result-list', { timeout: 15000 });
        } catch (e) {
            // Se não achar lista, pode ser que não haja resultados ou o LinkedIn mudou o layout
            console.warn('[LINKEDIN] Lista de resultados não encontrada ou vazia.');
            // Tira um print de erro para debug
            await page.screenshot({ path: 'erro_busca_vazia.png' });
            return null;
        }

        // 4. Scroll Humano para carregar itens (Lazy Load)
        console.log('[LINKEDIN] Rolando página para carregar resultados...');
        await autoScroll(page);

        // 5. Retorna o HTML bruto para o Parser (próxima fase)
        const html = await page.content();
        
        console.log('[LINKEDIN] HTML extraído com sucesso.');
        return html;

    } catch (error) {
        console.error('[LINKEDIN ERROR]', error.message);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Função auxiliar para rolar a página até o fim suavemente
 */
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Para se chegar ao fim ou se passar de um limite de segurança
                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 5000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100); // Rola a cada 100ms
        });
    });
}

module.exports = { runInternalSearch };