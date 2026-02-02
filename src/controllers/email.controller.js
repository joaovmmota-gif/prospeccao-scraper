const { generateEmailCandidates } = require('../services/email/permutator.service');
const { verifyEmailSMTP } = require('../services/email/smtp.service');
const { findCompanyDomain } = require('../services/domain/clearbit.service');

const findEmail = async (req, res) => {
    // Agora aceita 'companyName' além de 'domain'
    const { firstName, lastName, domain, companyName } = req.body;

    // Objeto de diagnóstico para o n8n
    const traceLog = [];
    const addTrace = (step, status, msg) => traceLog.push({ step, status, msg, timestamp: new Date() });

    if (!firstName || (!domain && !companyName)) {
        return res.status(400).json({ 
            success: false, 
            error: 'É necessário informar (Nome) E (Domínio OU Nome da Empresa).' 
        });
    }

    try {
        console.log(`[EMAIL FINDER] Iniciando processo para ${firstName}...`);
        addTrace('init', 'ok', 'Processo iniciado.');

        // 1. Descoberta de Domínio (Se não foi passado)
        let targetDomain = domain;
        
        if (!targetDomain && companyName) {
            addTrace('domain_discovery', 'running', `Buscando domínio para "${companyName}"...`);
            targetDomain = await findCompanyDomain(companyName);
            
            if (targetDomain) {
                addTrace('domain_discovery', 'success', `Domínio encontrado: ${targetDomain}`);
            } else {
                addTrace('domain_discovery', 'failed', 'Nenhum domínio com MX válido encontrado.');
                return res.json({ success: false, stage: 'domain_discovery', trace: traceLog, message: 'Domínio da empresa não encontrado.' });
            }
        } else {
            addTrace('domain_discovery', 'skipped', `Domínio fornecido manualmente: ${targetDomain}`);
        }

        // 2. Normalização e Permutação
        const candidates = generateEmailCandidates(firstName, lastName, targetDomain);
        addTrace('permutation', 'ok', `Gerados ${candidates.length} candidatos.`);
        console.log(`[EMAIL FINDER] Candidatos:`, candidates);

        let foundEmail = null;

        // 3. Validação SMTP Serial (Respeitando Rate Limits)
        for (const email of candidates) {
            console.log(`[SMTP] Testando: ${email}...`);
            
            // Pausa de segurança (Throttling) - 5 segundos entre requests para não bloquear na Hostinger
            // Se for muito lento, o n8n aguenta o timeout.
            if (candidates.indexOf(email) > 0) {
                await new Promise(r => setTimeout(r, 5000)); 
            }

            const exists = await verifyEmailSMTP(email);
            
            if (exists) {
                addTrace('smtp_check', 'success', `E-mail validado: ${email}`);
                foundEmail = email;
                break; // Achou! Para tudo.
            } else {
                addTrace('smtp_check', 'invalid', `Recusado: ${email}`);
            }
        }

        if (foundEmail) {
            res.json({ 
                success: true, 
                email: foundEmail, 
                domain: targetDomain,
                status: 'valid',
                trace: traceLog
            });
        } else {
            res.json({ 
                success: false, 
                domain: targetDomain,
                message: 'Nenhum e-mail válido encontrado nas permutações.',
                trace: traceLog
            });
        }

    } catch (error) {
        console.error('[EMAIL FINDER ERROR]', error);
        res.status(500).json({ success: false, error: error.message, trace: traceLog });
    }
};

module.exports = { findEmail };