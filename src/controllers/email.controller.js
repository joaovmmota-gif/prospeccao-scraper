const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email com Throttling (Hostinger Friendly)
     * Rota: POST /api/enrich/email
     * * NOTA: Usando Arrow Function para garantir o bind do 'this' e
     * permitir destructuring nas rotas sem gerar erro de 'Undefined'.
     */
    enrich = async (req, res) => {
        try {
            const { firstName, lastName, domain } = req.body;

            // 1. Validação Básica
            if (!firstName || !lastName || !domain) {
                return res.status(400).json({ 
                    error: 'Missing parameters. Required: firstName, lastName, domain' 
                });
            }

            console.log(`[EmailController] Iniciando descoberta para: ${firstName} ${lastName} em ${domain}`);

            // 2. Geração de Permutações (Limitado a 5 pelo PermutatorService)
            const permutations = permutatorService.generate(firstName, lastName, domain);
            
            if (permutations.length === 0) {
                return res.status(400).json({ error: 'Invalid input data for permutation' });
            }

            // 3. Loop de Verificação com Delay (Throttling)
            for (let i = 0; i < permutations.length; i++) {
                const email = permutations[i];
                console.log(`[SMTP] Testando (${i + 1}/${permutations.length}): ${email}`);

                try {
                    // CORREÇÃO: Chamando o nome correto da função conforme smtp.service.js
                    const isValid = await smtpService.verifyEmailSMTP(email);

                    if (isValid) {
                        console.log(`[SMTP] SUCESSO! Encontrado: ${email}`);
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

                    // Se não é válido e não é o último, aplica o delay obrigatório da Hostinger
                    // 5 requisições/min = 1 req a cada 12s. Usamos 13s para margem de segurança.
                    if (i < permutations.length - 1) {
                        console.log(`[Throttling] Aguardando 13s para evitar bloqueio da Hostinger...`);
                        await this.delay(13000);
                    }

                } catch (innerError) {
                    console.error(`[SMTP] Erro ao testar ${email}:`, innerError.message);
                    // Em caso de erro de conexão, mantém o delay por segurança
                    if (i < permutations.length - 1) await this.delay(13000);
                }
            }

            // 4. Fallback - Nenhum encontrado nas 5 tentativas principais
            console.log(`[EmailController] Nenhum email válido encontrado nas permutações principais.`);
            return res.json({
                status: 'not_found',
                action: 'schedule_night_batch',
                metadata: {
                    tested_permutations: permutations,
                    reason: 'smtp_rejected_all'
                }
            });

        } catch (error) {
            console.error('[EmailController] Erro crítico:', error);
            // Evita erro de "headers already sent"
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    /**
     * Helper para pausar a execução (Promisified Timeout)
     * Arrow function para manter contexto
     */
    delay = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new EmailController();