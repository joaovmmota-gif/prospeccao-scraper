const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email
     * Fluxo: Clearbit -> MX Check -> Catch-All Check -> SMTP Validation Loop
     * Rota: POST /api/enrich/email
     */
    enrich = async (req, res) => {
        let responseSent = false;

        // 1. Monitoramento de Conexão (Abort Controller)
        // Se o n8n ou cliente desconectar, paramos o script para não gastar recursos/cota
        req.on('close', () => {
            if (!responseSent) {
                console.warn('[EmailController] ⚠️ Cliente desconectou. Abortando processo.');
                responseSent = true; 
            }
        });

        try {
            console.log('--- [DEBUG] Início da Requisição ---');
            console.log('Payload:', JSON.stringify(req.body));

            const { firstName, lastName, domain, companyName } = req.body;
            let targetDomain = domain;

            // 2. Resolução de Domínio (Clearbit)
            // Só executa se não temos o domínio, mas temos o nome da empresa
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Buscando domínio para empresa: "${companyName}"...`);
                try {
                    targetDomain = await clearbitService.findDomain(companyName);
                    
                    if (targetDomain) {
                        console.log(`[EmailController] ✅ Clearbit encontrou: ${targetDomain}`);
                    } else {
                        console.warn(`[EmailController] ⚠️ Clearbit não encontrou domínio para: "${companyName}"`);
                    }
                } catch (cbError) {
                    console.error(`[EmailController] ❌ Erro na API Clearbit: ${cbError.message}`);
                }
            }

            // 3. Validação de Parâmetros Obrigatórios
            if (!firstName || !lastName || !targetDomain) {
                responseSent = true;
                const errorMsg = !targetDomain && companyName 
                    ? `Não foi possível encontrar o domínio para a empresa: "${companyName}". Tente informar o 'domain' manualmente.`
                    : 'Parâmetros obrigatórios faltando: firstName, lastName e domain (ou companyName).';
                
                return res.status(400).json({ 
                    error: 'Missing parameters',
                    details: errorMsg
                });
            }

            // 4. Fail Fast: Verificação de Registros MX (DNS)
            // Evita tentar validar e-mails em domínios que não existem ou não têm servidor de e-mail
            console.log(`[EmailController] Verificando existência de MX para: ${targetDomain}`);
            const mxExists = await smtpService.checkDomainExists(targetDomain);

            if (!mxExists) {
                responseSent = true;
                return res.json({
                    status: 'invalid_domain',
                    message: `O domínio ${targetDomain} não possui servidores de e-mail válidos (MX Records).`,
                    data: { domain: targetDomain }
                });
            }

            // 5. Proteção Anti-Catch-All
            // Verifica se o servidor aceita tudo antes de iniciarmos o loop
            const isCatchAll = await smtpService.checkCatchAll(targetDomain);
            
            if (isCatchAll) {
                responseSent = true;
                return res.json({
                    status: 'risky',
                    message: 'Domínio é Catch-All (aceita qualquer e-mail). Validação SMTP não é confiável.',
                    data: { 
                        domain: targetDomain, 
                        catchAll: true,
                        recommendation: 'Verificação manual necessária' 
                    }
                });
            }

            // 6. Geração de Permutações e Loop de Validação
            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            console.log(`[EmailController] Iniciando validação de ${permutations.length} permutações...`);
            
            for (let i = 0; i < permutations.length; i++) {
                // Checa desconexão antes de cada passo
                if (responseSent || req.closed) break;

                const email = permutations[i];
                console.log(`[SMTP Loop] (${i + 1}/${permutations.length}) Testando: ${email}`);

                try {
                    const isValid = await smtpService.verifyEmailSMTP(email);

                    if (isValid && !responseSent && !req.closed) {
                        console.log(`[SMTP Loop] ✅ SUCESSO! E-mail válido: ${email}`);
                        responseSent = true;
                        return res.json({
                            status: 'found',
                            data: {
                                email: email,
                                method: 'smtp_validation',
                                domain_source: domain ? 'provided' : 'clearbit_discovery',
                                confidence: 'high',
                                attempts: i + 1
                            }
                        });
                    }

                    // Throttling: Aguarda 13s entre tentativas (Regra Hostinger)
                    // Não aguarda se for a última tentativa
                    if (i < permutations.length - 1 && !responseSent && !req.closed) {
                        console.log(`[Throttling] ⏳ Aguardando 13s...`);
                        await this.delay(13000);
                    }

                } catch (innerError) {
                    console.error(`[SMTP Loop] Erro ao testar ${email}:`, innerError.message);
                    // Em caso de erro de conexão, também respeitamos o delay para não parecer ataque
                    if (i < permutations.length - 1 && !req.closed) await this.delay(13000);
                }
            }

            // 7. Fallback (Nenhum e-mail encontrado)
            if (!responseSent && !req.closed) {
                responseSent = true;
                console.log(`[EmailController] 🏁 Fim do loop. Nenhum e-mail válido encontrado.`);
                return res.json({
                    status: 'not_found',
                    action: 'schedule_night_batch', // Sugestão para futuro
                    metadata: { target_domain: targetDomain, reason: 'smtp_rejected_all_permutations' }
                });
            }

        } catch (error) {
            console.error('[EmailController] 💥 Erro Crítico:', error);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    // Utilitário de Delay Promificado
    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = new EmailController();