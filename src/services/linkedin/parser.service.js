const cheerio = require('cheerio');

/**
 * Recebe o HTML bruto do LinkedIn e extrai a lista de perfis
 * @param {string} htmlContent - HTML da página de busca
 * @returns {Array} Lista de objetos com { name, headline, location, url }
 */
function parseProfileList(htmlContent) {
    // Carrega o HTML na memória para leitura rápida
    const $ = cheerio.load(htmlContent);
    const profiles = [];

    console.log('[PARSER] Iniciando extração de dados com Cheerio...');

    // Seletor dos cartões de resultado (pode variar, mas este é o padrão atual da busca de pessoas)
    // Buscamos a lista (ul) e iteramos sobre os itens (li)
    $('.reusable-search__entity-result-list > li').each((i, element) => {
        try {
            const el = $(element);

            // 1. Extração do Nome
            // O LinkedIn usa spans ocultos para acessibilidade. Pegamos o span visível.
            const nameAnchor = el.find('.entity-result__title-text a');
            // Tenta pegar o texto dentro do span aria-hidden="true" (que é o visual limpo)
            let name = nameAnchor.find('span[aria-hidden="true"]').text().trim();
            
            // Fallback: Se não achar o span especifico, pega o texto do link
            if (!name) name = nameAnchor.text().trim();

            const rawUrl = nameAnchor.attr('href');

            // 2. Extração do Cargo (Headline)
            const headline = el.find('.entity-result__primary-subtitle').text().trim();

            // 3. Extração da Localização
            const location = el.find('.entity-result__secondary-subtitle').text().trim();

            // 4. Validação e Limpeza
            // Filtra perfis privados ("Usuário do LinkedIn") ou sem URL
            if (name && !name.includes('LinkedIn Member') && !name.includes('Usuário do LinkedIn') && rawUrl) {
                profiles.push({
                    name: name,
                    headline: headline || 'Sem título',
                    location: location || 'Não informado',
                    // Limpa parâmetros de tracking da URL (?miniProfileUrn=...)
                    profileUrl: rawUrl.split('?')[0],
                    origin: 'linkedin_internal_search'
                });
            }

        } catch (err) {
            console.warn(`[PARSER] Erro ao ler item ${i}: ${err.message}`);
        }
    });

    console.log(`[PARSER] Extração concluída. ${profiles.length} perfis encontrados.`);
    return profiles;
}

module.exports = { parseProfileList };