const dns = require('dns').promises;

/**
 * Descobre o domínio principal de uma empresa e valida se tem MX (E-mail)
 * @param {string} companyName - Nome da empresa (ex: "Nubank")
 * @returns {Promise<string|null>} Retorna o domínio validado (ex: "nubank.com.br") ou null
 */
async function findCompanyDomain(companyName) {
    if (!companyName) return null;

    console.log(`[DOMAIN DISCOVERY] Buscando domínio para: "${companyName}"...`);

    try {
        // 1. Consulta API Pública de Autocomplete da Clearbit
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`[CLEARBIT] Erro na API: ${response.status}`);
            return null;
        }

        const results = await response.json();

        if (!results || results.length === 0) {
            console.warn('[DOMAIN DISCOVERY] Nenhum domínio encontrado na Clearbit.');
            return null;
        }

        // 2. Estratégia de "Tentativa em Cascata" (Top 3)
        // Não pegamos apenas o primeiro, pois pode ser um domínio redirecionador sem e-mail.
        const topCandidates = results.slice(0, 3);
        
        for (const candidate of topCandidates) {
            const domain = candidate.domain;
            console.log(`[DNS CHECK] Verificando MX para: ${domain}...`);

            try {
                // Validação de MX (Mail Exchange)
                const mxRecords = await dns.resolveMx(domain);
                
                if (mxRecords && mxRecords.length > 0) {
                    console.log(`[DOMAIN DISCOVERY] ✅ Domínio válido encontrado: ${domain}`);
                    return domain; // Sucesso! Retorna o primeiro que tiver e-mail ativo.
                } else {
                    console.log(`[DNS CHECK] ⚠️ Domínio ${domain} não tem servidores de e-mail.`);
                }
            } catch (dnsError) {
                // Se der erro de DNS (ex: domínio não existe mais), apenas ignora e tenta o próximo
                console.log(`[DNS CHECK] Falha ao resolver ${domain}: ${dnsError.code}`);
            }
        }

        console.warn('[DOMAIN DISCOVERY] Nenhum dos domínios encontrados possui servidor de e-mail ativo.');
        return null;

    } catch (error) {
        console.error('[DOMAIN ERROR]', error.message);
        return null;
    }
}

module.exports = { findCompanyDomain };