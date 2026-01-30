const cheerio = require('cheerio');

/**
 * Recebe o HTML bruto do LinkedIn e extrai a lista de perfis
 * Baseado na estrutura de classes obfuscadas mas com data-view-name estáveis (2026)
 * @param {string} htmlContent - HTML da página de busca
 * @returns {Array} Lista de objetos com { name, headline, location, url }
 */
function parseProfileList(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const profiles = [];

    console.log('[PARSER] Iniciando extração via seletores data-view-name...');

    // 1. Encontra todos os blocos de resultado de pessoa
    $('div[data-view-name="people-search-result"]').each((i, element) => {
        try {
            const el = $(element);

            // 2. Extração do Nome e URL (A ncora principal)
            const nameLink = el.find('a[data-view-name="search-result-lockup-title"]');
            
            // O nome pode estar sujo com quebras de linha, então limpamos
            const name = nameLink.text().replace(/\n/g, '').trim();
            const rawUrl = nameLink.attr('href');

            if (!name || !rawUrl) return; // Pula se não tiver o básico

            // 3. Navegação Hierárquica para Cargo e Localização
            // Estrutura observada:
            // Container de Texto
            //   -> p (Nome)
            //   -> div (Wrapper do Headline) -> p (Texto do Headline)
            //   -> div (Wrapper da Location) -> p (Texto da Location)
            
            // Sobe para o paragrafo do nome, depois para o container de texto pai
            const textContainer = nameLink.closest('div'); 
            
            // O Headline costuma ser o texto do primeiro elemento irmão (div) após o nome
            // Procuramos os 'p' dentro dos 'div' irmãos
            const siblingDivs = textContainer.find('> div');
            
            let headline = 'Não informado';
            let location = 'Não informado';

            // Tenta pegar do primeiro e segundo irmão
            if (siblingDivs.length > 0) {
                headline = $(siblingDivs[0]).find('p').text().trim();
            }
            if (siblingDivs.length > 1) {
                location = $(siblingDivs[1]).find('p').text().trim();
            }

            // Fallback: Se a estrutura hierárquica falhar, tenta pegar todos os 'p' do container
            // Geralmente: Index 0=Nome, Index 1=Headline, Index 2=Location
            if (!headline || headline === 'Não informado') {
                const allParagraphs = textContainer.find('p');
                if (allParagraphs.length >= 2) headline = $(allParagraphs[1]).text().trim();
                if (allParagraphs.length >= 3) location = $(allParagraphs[2]).text().trim();
            }

            profiles.push({
                name,
                headline,
                location,
                // Remove parametros de query da URL para ficar limpa
                profileUrl: rawUrl.split('?')[0],
                origin: 'linkedin_direct'
            });

        } catch (err) {
            console.warn(`[PARSER] Erro ao processar card ${i}: ${err.message}`);
        }
    });

    console.log(`[PARSER] Extração concluída. ${profiles.length} perfis encontrados.`);
    return profiles;
}

module.exports = { parseProfileList };