const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email com Throttling e Proteção Catch-All
     * Rota: POST /api/enrich/email
     * * Changelog V2.3.0:
     * - Feature: Adicionada verificação checkCatchAll antes do loop de permutações.
     * - Fix: Implementado monitoramento de 'req.closed' para evitar Write After End.
     * - Fix: Garantia de resposta única com flag 'responseSent'.
     */
    enrich = async (req, res) => {
        let responseSent = false;

        // Handler para abortar processamento se o cliente (n8n) desistir/timeout
        req.on('close', () => {
            if (!responseSent) {
                console.warn('[EmailController] Cliente desconectou. Abortando verificação.');
                responseSent = true; 
            }
        });

        try {
            const { firstName, lastName, domain, companyName } = req.body;
            let targetDomain = domain;

            // 1. Resolução de Domínio via Clearbit (se necessário)
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Buscando domínio Clearbit para: "${companyName}"...`);
                targetDomain = await clearbitService.findDomain(companyName);
            }

            // Validação de entrada obrigatória
            if (!firstName || !lastName || !targetDomain) {
                responseSent = true;
                return res.status(400).json({ 
                    error: 'Missing parameters',
                    details: !targetDomain && companyName ? `Domain not found for: ${companyName}` : undefined
                });
            }

            // --- NOVO: PROTEÇÃO ANTI CATCH-ALL ---
            // Verifica se o servidor aceita qualquer e-mail antes de gastar tempo no loop
            const isCatchAll = await smtpService.checkCatchAll(targetDomain);
            
            if (isCatchAll) {
                responseSent = true;
                return res.json({
                    status: 'risky',
                    message: 'Domain is Catch-All. Validation is unreliable.',
                    data: { 
                        domain: targetDomain, 
                        catchAll: true,
                        recommendation: 'Manual check required' 
                    }
                });
            }
            // --------------------------------------

            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            
            // 2. Loop de Verificação com Throttling (Máx 5 req/min Hostinger)
            for (let i = 0; i < permutations.length; i++) {
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

                    // Se não for o último e a conexão estiver viva, aguarda 13s para respeitar o limite
                    if (i < permutations.length - 1 && !responseSent && !req.closed) {
                        console.log(`[Throttling] Aguardando 13s para próxima tentativa...`);
                        await this.delay(13000);
                    }

                } catch (innerError) {
                    console.error(`[SMTP] Erro durante verificação de ${email}:`, innerError.message);
                    if (i < permutations.length - 1 && !req.closed) await this.delay(13000);
                }
            }

            // 3. Fallback se nada for encontrado
            if (!responseSent && !req.closed) {
                responseSent = true;
                console.log(`[EmailController] Nenhum e-mail validado para ${targetDomain}.`);
                return res.json({
                    status: 'not_found',
                    action: 'schedule_night_batch',
                    metadata: { target_domain: targetDomain, reason: 'smtp_rejected_all_permutations' }
                });
            }

        } catch (error) {
            console.error('[EmailController] Erro crítico no processo de enrichment:', error);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = new EmailController();