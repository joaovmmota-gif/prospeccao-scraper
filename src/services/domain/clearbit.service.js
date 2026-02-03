/**
 * Clearbit Service
 * Responsável por descobrir o domínio de uma empresa baseado no nome.
 * Utiliza a API pública de Autocomplete da Clearbit.
 */

class ClearbitService {
    constructor() {
        this.apiUrl = 'https://autocomplete.clearbit.com/v1/companies/suggest';
    }

    /**
     * Busca o domínio de uma empresa pelo nome
     * @param {string} companyName - Nome da empresa (ex: "Coca-Cola")
     * @returns {Promise<string|null>} - Retorna o domínio (ex: "coca-cola.com") ou null
     */
    async findDomain(companyName) {
        if (!companyName) return null;

        try {
            // Sanitiza o nome para URL
            const query = encodeURIComponent(companyName);
            const response = await fetch(`${this.apiUrl}?query=${query}`);

            if (!response.ok) {
                console.warn(`[Clearbit] Erro na API: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // A API retorna um array de sugestões. Pegamos a primeira (mais relevante).
            if (data && data.length > 0) {
                const bestMatch = data[0];
                console.log(`[Clearbit] Encontrado: ${companyName} -> ${bestMatch.domain}`);
                return bestMatch.domain;
            }

            console.log(`[Clearbit] Nenhum domínio encontrado para: ${companyName}`);
            return null;

        } catch (error) {
            console.error(`[Clearbit] Falha na requisição:`, error.message);
            return null;
        }
    }
}

module.exports = new ClearbitService();