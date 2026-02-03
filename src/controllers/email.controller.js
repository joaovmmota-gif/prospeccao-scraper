const permutatorService = require('../services/email/permutator.service');
const smtpService = require('../services/email/smtp.service');
const clearbitService = require('../services/domain/clearbit.service');

class EmailController {
    enrich = async (req, res) => {
        try {
            console.log('--- [DEBUG] Início da Requisição ---');
            console.log('Payload:', JSON.stringify(req.body));

            const { firstName, lastName, domain, companyName } = req.body;
            let targetDomain = domain;

            // 1. Clearbit
            if (!targetDomain && companyName) {
                console.log(`[EmailController] Buscando domínio para: "${companyName}"...`);
                try {
                    targetDomain = await clearbitService.findDomain(companyName);
                    if (targetDomain) console.log(`[EmailController] ✅ Clearbit: ${targetDomain}`);
                } catch (e) { console.error(e); }
            }

            if (!firstName || !lastName || !targetDomain) {
                return res.status(400).json({ error: 'Missing parameters' });
            }

            // 2. Fail Fast & MX Discovery
            // AGORA mxServer CONTÉM A STRING DO SERVIDOR (ex: alt1.google.com)
            console.log(`[EmailController] Verificando MX para: ${targetDomain}`);
            const mxServer = await smtpService.checkDomainExists(targetDomain);

            if (!mxServer) {
                return res.json({
                    status: 'invalid_domain',
                    message: `Domínio ${targetDomain} sem MX válido.`,
                    data: { domain: targetDomain }
                });
            }

            // 3. Proteção Anti-Catch-All
            // Passamos o mxServer resolvido para garantir que a função execute
            const isCatchAll = await smtpService.checkCatchAll(targetDomain, mxServer);
            
            if (isCatchAll) {
                return res.json({
                    status: 'risky',
                    message: 'Domínio é Catch-All.',
                    data: { domain: targetDomain, catchAll: true }
                });
            }

            // 4. Loop de Validação
            const permutations = permutatorService.generate(firstName, lastName, targetDomain);
            console.log(`[EmailController] Validando ${permutations.length} permutações...`);
            
            for (let i = 0; i < permutations.length; i++) {
                if (req.socket.destroyed || res.writableEnded) break;

                const email = permutations[i];
                console.log(`[SMTP Loop] (${i + 1}/${permutations.length}) Testando: ${email}`);

                try {
                    // Passamos mxServer para otimizar
                    const isValid = await smtpService.verifyEmailSMTP(email, mxServer);

                    if (isValid && !res.writableEnded) {
                        console.log(`[SMTP Loop] ✅ SUCESSO: ${email}`);
                        return res.json({
                            status: 'found',
                            data: { email, method: 'smtp', attempts: i + 1 }
                        });
                    }

                    if (i < permutations.length - 1 && !res.writableEnded) {
                        console.log(`[Throttling] ⏳ 13s...`);
                        await this.delay(13000);
                    }
                } catch (e) {
                    console.error(`Erro no loop: ${e.message}`);
                    if (i < permutations.length - 1) await this.delay(13000);
                }
            }

            if (!res.headersSent) {
                return res.json({
                    status: 'not_found',
                    action: 'schedule_night_batch',
                    metadata: { target_domain: targetDomain }
                });
            }

        } catch (error) {
            console.error('[EmailController] Erro:', error);
            if (!res.headersSent) res.status(500).json({ error: error.message });
        }
    }

    delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = new EmailController();