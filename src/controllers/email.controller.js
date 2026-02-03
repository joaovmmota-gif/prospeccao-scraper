const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email com Throttling (Hostinger Friendly)
     * Rota: POST /api/enrich/email
     * * Changelog V2.2.1:
     * - Fix: Implementado monitoramento de 'req.closed' para evitar Write After End.
     * - Fix: Garantia de resposta única com flag 'responseSent'.
     * - Fix: Abortagem imediata do loop de 13s caso o cliente desconecte.
     */
    enrich = async (req, res) => {
        let responseSent = false;

        // Handler para detectar se o cliente (n8n/browser) cancelou a requisição
        req.on('close', () => {
            if (!responseSent) {
                console.warn('[EmailController] Cliente desconectou prematuramente. Abortando processamento.');
                responseSent = true; 
            }
        });

        try {
            const { firstName, lastName, domain, companyName } = req.body;
            let targetDomain = domain;

            // 1. Resolução de Domínio
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Buscando domínio Clearbit: "${companyName}"...`);
                targetDomain = await clearbitService.findDomain(companyName);
            }

            // Validação de entrada
            if (!firstName || !lastName || !targetDomain) {
                responseSent = true;
                return res.status(400).json({ 
                    error: 'Missing parameters',
                    details: !targetDomain && companyName ? `Domain not found for: ${companyName}` : undefined
                });
            }

            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            
            // 2. Loop de Verificação com Proteção contra Socket Fechado
            for (let i = 0; i < permutations.length; i++) {
                // Se a resposta já foi enviada ou o cliente desconectou, sai do loop
                if (responseSent || req.closed) break;

                const email = permutations[i];
                console.log(`[SMTP] Testando (${i + 1}/${permutations.length}): ${email}`);

                try {
                    const isValid = await smtpService.verifyEmailSMTP(email);

                    if (isValid && !responseSent && !req.closed) {
                        console.log(`[SMTP] SUCESSO! Encontrado: ${email}`);
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

                    // Throttling: Só aguarda se não for o último e se a conexão ainda estiver ativa
                    if (i < permutations.length - 1 && !responseSent && !req.closed) {
                        console.log(`[Throttling] Aguardando 13s...`);
                        await this.delay(13000);
                    }

                } catch (innerError) {
                    console.error(`[SMTP] Erro em ${email}:`, innerError.message);
                    if (i < permutations.length - 1 && !req.closed) await this.delay(13000);
                }
            }

            // 3. Fallback Final (Se o loop acabar sem sucesso e a conexão persistir)
            if (!responseSent && !req.closed) {
                responseSent = true;
                console.log(`[EmailController] Nenhum email válido encontrado.`);
                return res.json({
                    status: 'not_found',
                    action: 'schedule_night_batch',
                    metadata: { target_domain: targetDomain, reason: 'smtp_rejected_all' }
                });
            }

        } catch (error) {
            console.error('[EmailController] Erro crítico:', error);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = new EmailController();