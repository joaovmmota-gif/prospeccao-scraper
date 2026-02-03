/**
 * Permutator Service - Refatorado para V2.1
 * Foco: Lei de Pareto (80/20) - Gera apenas as 5 permutações mais prováveis.
 * Motivo: Reduzir consumo de requisições SMTP na Hostinger (Limite 5/min).
 */

class PermutatorService {
    /**
     * Gera lista prioritária de emails
     * @param {string} firstName - Ex: "João"
     * @param {string} lastName - Ex: "Mota"
     * @param {string} domain - Ex: "empresa.com.br"
     * @returns {string[]} Array com 5 permutações únicas
     */
    generate(firstName, lastName, domain) {
        if (!firstName || !lastName || !domain) {
            return [];
        }

        // 1. Sanitização: Remove acentos, espaços extras e converte para lowercase
        const f = this.sanitize(firstName);
        const l = this.sanitize(lastName);
        const d = domain.toLowerCase().trim();

        // Garante que temos algo para trabalhar
        if (!f || !l || !d) return [];

        // 2. Definição das 5 variações estritas solicitadas
        const permutations = [
            `${f}.${l}@${d}`,        // nome.sobrenome@d
            `${f.charAt(0)}${l}@${d}`, // nsobrenome@d
            `${f}${l}@${d}`,          // nomesobrenome@d
            `${f.charAt(0)}.${l}@${d}`,// n.sobrenome@d
            `${f}@${d}`               // nome@d
        ];

        // Retorna apenas valores únicos (caso nome e sobrenome gerem duplicação)
        return [...new Set(permutations)];
    }

    /**
     * Limpa strings para formato de email
     * Ex: "João Victor" -> "joao" (Pega apenas o primeiro nome para evitar erros de permutação)
     */
    sanitize(str) {
        if (!str) return '';
        
        return str
            .normalize('NFD') // Separa acentos das letras
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .trim()
            .toLowerCase()
            .split(' ')[0] // Pega apenas o primeiro token (Ex: "Silva Santos" -> "silva") para garantir o padrão
            .replace(/[^a-z0-9]/g, ""); // Remove qualquer caracter não alfanumérico restante
    }
}

module.exports = new PermutatorService();