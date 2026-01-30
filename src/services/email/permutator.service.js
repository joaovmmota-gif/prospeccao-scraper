/**
 * Gera permutações de e-mail corporativo considerando múltiplos sobrenomes
 * @param {string} firstName - Primeiro nome (ex: Joao)
 * @param {string} lastName - Sobrenome completo (ex: Moreira Mota)
 * @param {string} domain - Domínio da empresa (ex: hostinger.com)
 */
function generateEmailCandidates(firstName, lastName, domain) {
    if (!firstName || !domain) return [];

    // Função de limpeza: remove acentos, caracteres especiais e espaços extras
    const clean = (str) => str.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove caracteres não alfanuméricos (mantém espaços)
        .trim();
    
    const f = clean(firstName);
    const rawLastName = clean(lastName || '');
    const d = domain.toLowerCase();

    // Usamos um Set para garantir que não haja e-mails duplicados na lista
    const candidates = new Set();

    // 1. Padrão Apenas Nome (comum em startups pequenas)
    candidates.add(`${f}@${d}`);

    // Função auxiliar para gerar padrões comuns dado um sobrenome específico
    const addVariations = (nome, sobrenome) => {
        if (!sobrenome) return;
        candidates.add(`${nome}.${sobrenome}@${d}`);       // joao.mota
        candidates.add(`${nome}${sobrenome}@${d}`);        // joaomota
        candidates.add(`${nome}_${sobrenome}@${d}`);       // joao_mota
        candidates.add(`${nome.charAt(0)}${sobrenome}@${d}`); // jmota
        candidates.add(`${nome.charAt(0)}.${sobrenome}@${d}`); // j.mota
        candidates.add(`${sobrenome}.${nome}@${d}`);       // mota.joao
    };

    // 2. Processamento dos Sobrenomes
    if (rawLastName) {
        // Divide os sobrenomes por espaço
        const surnameParts = rawLastName.split(/\s+/);

        // Cenário A: Sobrenome Completo (tudo junto)
        // ex: joao.moreiramota@...
        const fullSurnameJoined = rawLastName.replace(/\s+/g, '');
        addVariations(f, fullSurnameJoined);

        // Cenário B: Se tiver mais de um sobrenome (ex: "Moreira Mota")
        if (surnameParts.length > 1) {
            // Variação com o ÚLTIMO sobrenome (Muito comum: joao.mota@)
            const lastSurname = surnameParts[surnameParts.length - 1];
            addVariations(f, lastSurname);

            // Variação com o PRIMEIRO sobrenome (Comum: joao.moreira@)
            const firstSurname = surnameParts[0];
            addVariations(f, firstSurname);
        }
    }

    // Converte o Set de volta para Array
    const resultList = Array.from(candidates);
    
    // Log para debug (opcional)
    // console.log(`[PERMUTATOR] Gerados ${resultList.length} candidatos para ${f} ${rawLastName}`);
    
    return resultList;
}

module.exports = { generateEmailCandidates };