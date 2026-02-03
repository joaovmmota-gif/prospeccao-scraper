const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    /**
     * Processo de Enriquecimento de Email com Throttling (Hostinger Friendly)
     * Rota: POST /api/enrich/email
     * * Changelog V2.2:
     * - Adicionado suporte a 'companyName' (Busca automática de domínio via Clearbit).
     * - Mantido Throttling de 13s.
     */
    enrich = async (req, res) => {
        try {
            // Aceita domain OU companyName
            const { firstName, lastName, domain, companyName } = req.body;

            // 1. Resolução de Domínio (Lógica Inteligente)
            let targetDomain = domain;

            // Se não veio domínio, mas veio o nome da empresa, tentamos descobrir
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Domínio ausente. Buscando Clearbit para: "${companyName}"...`);
                targetDomain = await clearbitService.findDomain(companyName);
                
                if (targetDomain) {
                    console.log(`[EmailController] Domínio descoberto: ${targetDomain}`);
                }
            }

            // Validação Final: Se depois de tentar descobrir, ainda não temos domínio, paramos.
            if (!firstName || !lastName || !targetDomain) {
                return res.status(400).json({ 
                    error: 'Missing parameters. Required: firstName, lastName AND (domain OR companyName)',
                    details: !targetDomain && companyName ? `Could not resolve domain for company: ${companyName}` : undefined
                });
            }

            console.log(`[EmailController] Iniciando descoberta para: ${firstName} ${lastName} em ${targetDomain}`);

            // 2. Geração de Permutações (Limitado a 5 pelo PermutatorService)
            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            
            if (permutations.length === 0) {
                return res.status(400).json({ error: 'Invalid input data for permutation' });
            }

            // 3. Loop de Verificação com Delay (Throttling)
            for (let i = 0; i < permutations.length; i++) {
                const email = permutations[i];
                console.log(`[SMTP] Testando (${i + 1}/${permutations.length}): ${email}`);

                try {
                    // Chama a função correta do serviço SMTP
                    const isValid = await smtpService.verifyEmailSMTP(email);

                    if (isValid) {
                        console.log(`[SMTP] SUCESSO! Encontrado: ${email}`);
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
                    target_domain: targetDomain,
                    tested_permutations: permutations,
                    reason: 'smtp_rejected_all'
                }
            });

        } catch (error) {
            console.error('[EmailController] Erro crítico:', error);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Internal Server Error', details: error.message });
            }
        }
    }

    /**
     * Helper para pausar a execução (Promisified Timeout)
     */
    delay = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new EmailController();