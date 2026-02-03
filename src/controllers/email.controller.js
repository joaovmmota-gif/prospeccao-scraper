const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email
     * Versão 2.5.0: Fix de Falso Positivo de Desconexão (n8n Timeout)
     */
    enrich = async (req, res) => {
        // Removemos a flag responseSent global e o listener req.on('close') agressivo
        // Vamos confiar no res.headersSent nativo do Express

        try {
            console.log('--- [DEBUG] Início da Requisição ---');
            console.log('Payload:', JSON.stringify(req.body));

            const { firstName, lastName, domain, companyName } = req.body;
            let targetDomain = domain;

            // 1. Resolução de Domínio
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Buscando domínio para empresa: "${companyName}"...`);
                try {
                    targetDomain = await clearbitService.findDomain(companyName);
                    if (targetDomain) console.log(`[EmailController] ✅ Clearbit encontrou: ${targetDomain}`);
                } catch (cbError) {
                    console.error(`[EmailController] ❌ Erro na API Clearbit: ${cbError.message}`);
                }
            }

            // Validação de Parâmetros
            if (!firstName || !lastName || !targetDomain) {
                return res.status(400).json({ 
                    error: 'Missing parameters',
                    details: !targetDomain && companyName 
                        ? `Domínio não encontrado para "${companyName}".`
                        : 'firstName, lastName e domain são obrigatórios.'
                });
            }

            // 2. Fail Fast: Verificação de MX
            console.log(`[EmailController] Verificando MX para: ${targetDomain}`);
            const mxServer = await smtpService.checkDomainExists(targetDomain); // Usa o método correto que devolve boolean

            if (!mxServer) {
                return res.json({
                    status: 'invalid_domain',
                    message: `O domínio ${targetDomain} não possui MX válido.`,
                    data: { domain: targetDomain }
                });
            }

            // 3. Proteção Anti-Catch-All
            // Passamos mxServer = undefined para ele resolver internamente, ou você pode ajustar o checkDomainExists para retornar o servidor
            const isCatchAll = await smtpService.checkCatchAll(targetDomain);
            
            if (isCatchAll) {
                return res.json({
                    status: 'risky',
                    message: 'Domínio é Catch-All.',
                    data: { domain: targetDomain, catchAll: true }
                });
            }

            // 4. Loop de Validação
            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            console.log(`[EmailController] Iniciando validação de ${permutations.length} permutações...`);
            
            for (let i = 0; i < permutations.length; i++) {
                // VERIFICAÇÃO ATIVA DE CONEXÃO
                // Se o socket foi destruído ou a resposta já foi encerrada, paramos.
                if (req.socket.destroyed || res.writableEnded) {
                    console.warn('[EmailController] 🛑 Conexão encerrada pelo cliente. Parando loop.');
                    break;
                }

                const email = permutations[i];
                console.log(`[SMTP Loop] (${i + 1}/${permutations.length}) Testando: ${email}`);

                try {
                    const isValid = await smtpService.verifyEmailSMTP(email);

                    // Verifica novamente antes de tentar responder
                    if (isValid && !res.writableEnded && !req.socket.destroyed) {
                        console.log(`[SMTP Loop] ✅ SUCESSO! E-mail válido: ${email}`);
                        return res.json({
                            status: 'found',
                            data: {
                                email: email,
                                method: 'smtp_validation',
                                confidence: 'high',
                                attempts: i + 1
                            }
                        });
                    }

                    // Throttling (Delay)
                    if (i < permutations.length - 1 && !res.writableEnded) {
                        console.log(`[Throttling] ⏳ Aguardando 13s...`);
                        await this.delay(13000);
                    }

                } catch (innerError) {
                    console.error(`[SMTP Loop] Erro ao testar ${email}:`, innerError.message);
                    if (i < permutations.length - 1 && !res.writableEnded) await this.delay(13000);
                }
            }

            // 5. Fallback
            if (!res.headersSent && !res.writableEnded) {
                console.log(`[EmailController] 🏁 Fim do loop. Nada encontrado.`);
                return res.json({
                    status: 'not_found',
                    action: 'schedule_night_batch',
                    metadata: { target_domain: targetDomain }
                });
            }

        } catch (error) {
            console.error('[EmailController] 💥 Erro Crítico:', error);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = new EmailController();