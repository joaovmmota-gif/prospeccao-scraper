const cheerio = require('cheerio');

/**
 * Recebe o HTML bruto do LinkedIn e extrai a lista de perfis
 * Baseado na estrutura de classes obfuscadas mas com data-view-name estáveis (2026)
 * @param {string} htmlContent - HTML da página de busca
 * @returns {Array} Lista de objetos com { name, headline, location, url, company }
 */
function parseProfileList(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const profiles = [];

    console.log('[PARSER] Iniciando extração via seletores data-view-name...');

    // 1. Encontra todos os blocos de resultado de pessoa
    $('div[data-view-name="people-search-result"]').each((i, element) => {
        try {
            const el = $(element);

            // 2. Extração do Nome e URL (Ancora principal)
            const nameLink = el.find('a[data-view-name="search-result-lockup-title"]');
            const name = nameLink.text().replace(/\n/g, '').trim();
            const rawUrl = nameLink.attr('href');

            if (!name || !rawUrl) return; 

            // 3. Navegação Hierárquica para Cargo e Localização
            const textContainer = nameLink.closest('div'); 
            const siblingDivs = textContainer.find('> div');
            
            let headline = 'Não informado';
            let location = 'Não informado';
            let company = 'Não identificada'; // Novo campo

            // Tenta pegar do primeiro e segundo irmão (estrutura padrão)
            if (siblingDivs.length > 0) {
                headline = $(siblingDivs[0]).find('p').text().trim();
            }
            if (siblingDivs.length > 1) {
                location = $(siblingDivs[1]).find('p').text().trim();
            }

            // Fallback para Headline/Location se a estrutura falhar
            if (!headline || headline === 'Não informado') {
                const allParagraphs = textContainer.find('p');
                if (allParagraphs.length >= 2) headline = $(allParagraphs[1]).text().trim();
                if (allParagraphs.length >= 3) location = $(allParagraphs[2]).text().trim();
            }

            // 4. Extração Precisa da Empresa (Linha "Atual:")
            // Varre todos os parágrafos dentro do container de texto deste perfil
            const allParagraphs = textContainer.find('p');
            allParagraphs.each((j, p) => {
                const text = $(p).text().trim();
                
                // Procura por linhas que começam com "Atual:" ou "Current:"
                // Regex: Começa com Atual/Current/Presente, tem algo no meio, depois " na " ou " at ", e captura o resto
                // Ex: "Atual: CEO na Nubank" -> captura "Nubank"
                const currentJobMatch = text.match(/^(?:Atual|Current|Presente):.*?\s(?:na|no|em|at)\s+(.*)/i);
                
                if (currentJobMatch) {
                    let rawCompany = currentJobMatch[1].trim();
                    
                    // Lógica de Limpeza: Remove texto entre parênteses no final
                    // Ex: "Hyperplane (acquired by nubank)" -> "Hyperplane"
                    rawCompany = rawCompany.replace(/\s*\(.*\)$/, '');
                    
                    company = rawCompany;
                    return false; // Para o loop .each assim que achar
                }
            });

            // Se não achou a linha "Atual:", tenta pegar do headline se tiver o padrão "Cargo at Empresa"
            if (company === 'Não identificada' && headline.includes(' at ')) {
                company = headline.split(' at ').pop().trim();
            } else if (company === 'Não identificada' && headline.includes(' na ')) {
                company = headline.split(' na ').pop().trim();
            }

            profiles.push({
                name,
                headline,
                location,
                company, // Campo novo e limpo
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