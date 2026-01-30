const { generateEmailCandidates } = require('../services/email/permutator.service');
const { verifyEmailSMTP } = require('../services/email/smtp.service');

const findEmail = async (req, res) => {
    const { firstName, lastName, domain } = req.body;

    if (!firstName || !domain) {
        return res.status(400).json({ error: 'Nome e Domínio são obrigatórios.' });
    }

    try {
        console.log(`[EMAIL FINDER] Iniciando busca para ${firstName} ${lastName || ''} em @${domain}`);

        // 1. Gera candidatos
        const candidates = generateEmailCandidates(firstName, lastName, domain);
        console.log(`[EMAIL FINDER] Testando ${candidates.length} permutações:`, candidates);

        let foundEmail = null;

        // 2. Testa um por um (Serialmente para não bloquear IP)
        for (const email of candidates) {
            console.log(`[EMAIL FINDER] Verificando: ${email}...`);
            const exists = await verifyEmailSMTP(email);
            
            if (exists) {
                console.log(`[EMAIL FINDER] ✨ SUCESSO! E-mail encontrado: ${email}`);
                foundEmail = email;
                break; // Para assim que achar o certo
            }
            
            // Pequena pausa para não parecer ataque DDoS no SMTP
            await new Promise(r => setTimeout(r, 1000));
        }

        if (foundEmail) {
            res.json({ success: true, email: foundEmail, status: 'valid' });
        } else {
            res.json({ success: false, message: 'Nenhum e-mail válido encontrado nas permutações padrão.' });
        }

    } catch (error) {
        console.error('[EMAIL FINDER ERROR]', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { findEmail };