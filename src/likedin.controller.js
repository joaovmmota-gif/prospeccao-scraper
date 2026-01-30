const path = require('path');
const { runInternalSearch } = require('../services/linkedin/search.service');

// 1. Lógica para servir a Interface HTML
const renderTestInterface = (req, res) => {
    // Envia o arquivo HTML que criamos na pasta views
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
        
        // Chama o Serviço (o Robô)
        const htmlContent = await runInternalSearch(cookie, query);

        if (!htmlContent) {
            return res.status(404).json({ 
                success: false, 
                message: 'Busca finalizada, mas nenhum conteúdo foi retornado.' 
            });
        }

        // Retorna o resultado
        res.json({
            success: true,
            metadata: {
                role: query.role,
                company: query.company,
                timestamp: new Date().toISOString()
            },
            data: {
                html_preview: htmlContent.substring(0, 200) + '...',
                full_length: htmlContent.length
            }
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