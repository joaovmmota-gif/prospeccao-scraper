const path = require('path');
const { runInternalSearch } = require('../services/linkedin/search.service');
const { parseProfileList } = require('../services/linkedin/parser.service');

// 1. Lógica para servir a Interface HTML
const renderTestInterface = (req, res) => {
    res.sendFile(path.join(__dirname, '../views/interface.html'));
};

// 2. Lógica para processar a API de Busca
const searchProfiles = async (req, res) => {
    const { cookie, query } = req.body;

    // Validação de entrada
    if (!cookie || !query || !query.role || !query.company) {
        return res.status(400).json({ 
            success: false, 
            error: 'Parâmetros inválidos. É necessário enviar: cookie, query.role e query.company' 
        });
    }

    try {
        console.log(`[CONTROLLER] Iniciando busca: ${query.role} @ ${query.company}`);
        
        // A. Chama o Robô (Navegação)
        const htmlContent = await runInternalSearch(cookie, query);

        if (!htmlContent) {
            return res.status(404).json({ 
                success: false, 
                message: 'A busca foi realizada, mas a página retornou vazia ou houve um bloqueio severo.' 
            });
        }

        // B. Chama o Parser (Extração com seletores corrigidos)
        let extractedData = [];
        try {
            extractedData = parseProfileList(htmlContent);
        } catch (e) {
            console.error('[CONTROLLER] Erro fatal no parser:', e);
        }

        // Retorna o resultado limpo (JSON)
        res.json({
            success: true,
            metadata: {
                role: query.role,
                company: query.company,
                count: extractedData.length,
                timestamp: new Date().toISOString()
            },
            data: extractedData // Lista de perfis
        });

    } catch (error) {
        console.error('[CONTROLLER ERROR]', error);
        
        // Tratamento de erros específicos
        const statusCode = error.message.includes('SESSION_INVALID') ? 401 : 500;
        
        res.status(statusCode).json({
            success: false,
            error: error.message,
            suggestion: statusCode === 401 ? 'O cookie expirou. Gere um novo li_at.' : 'Erro interno no servidor.'
        });
    }
};

module.exports = {
    renderTestInterface,
    searchProfiles
};