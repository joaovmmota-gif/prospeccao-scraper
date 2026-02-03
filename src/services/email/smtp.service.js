const dns = require('dns').promises;
const net = require('net');

class SMTPService {

    /**
     * Verifica se o domínio possui registros MX válidos (existe e pode receber e-mails)
     * Deve ser chamado antes de qualquer tentativa de conexão SMTP.
     * @param {string} domain - Domínio a ser verificado
     * @returns {Promise<boolean>} true se existir, false se não
     */
    checkDomainExists = async (domain) => {
        try {
            console.log(`[SMTP] Verificando registros MX para: ${domain}`);
            const mxRecords = await dns.resolveMx(domain);
            
            // Verifica se retornou um array e se tem pelo menos um registro
            if (Array.isArray(mxRecords) && mxRecords.length > 0) {
                return true;
            }
            
            console.warn(`[SMTP] Domínio ${domain} não tem registros MX válidos.`);
            return false;
        } catch (error) {
            console.warn(`[SMTP] Falha ao resolver MX do domínio ${domain}:`, error.message);
            return false;
        }
    }

    /**
     * Verifica se um e-mail existe conectando-se ao servidor SMTP
     * @param {string} email - E-mail para testar
     * @returns {Promise<boolean>} true se existir, false se não
     */
    verifyEmailSMTP = async (email) => {
        const domain = email.split('@')[1];
        
        try {
            // 1. Descobre o servidor de e-mail da empresa (MX Record)
            const mxRecords = await dns.resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                console.warn(`[SMTP] Domínio ${domain} não tem servidor de e-mail.`);
                return false;
            }
            
            // Pega o servidor com maior prioridade (menor número)
            const mxServer = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;

            // 2. Inicia o Handshake SMTP
            return await new Promise((resolve) => {
                const socket = net.createConnection(25, mxServer);
                let step = 0;
                let isValid = false;

                // Configura timeout de 5s para não travar o loop de 13s
                socket.setTimeout(5000, () => {
                    socket.destroy();
                    resolve(false);
                });

                socket.on('data', (data) => {
                    const response = data.toString();

                    // Passo 0: Servidor diz "220" -> Mandamos "HELO"
                    if (response.startsWith('220') && step === 0) {
                        socket.write(`HELO ${domain}\r\n`);
                        step++;
                    }
                    // Passo 1: Aceita HELO -> Mandamos "MAIL FROM"
                    else if (response.startsWith('250') && step === 1) {
                        socket.write(`MAIL FROM:<verify@${domain}>\r\n`);
                        step++;
                    }
                    // Passo 2: Aceita MAIL FROM -> Mandamos "RCPT TO"
                    else if (response.startsWith('250') && step === 2) {
                        socket.write(`RCPT TO:<${email}>\r\n`);
                        step++;
                    }
                    // Passo 3: O Veredito
                    else if (step === 3) {
                        if (response.startsWith('250')) {
                            isValid = true; 
                        }
                        socket.write('QUIT\r\n');
                        socket.end();
                        resolve(isValid);
                    }
                });

                socket.on('error', (err) => {
                    console.warn(`[SMTP] Erro de conexão em ${email}: ${err.message}`);
                    socket.destroy();
                    resolve(false);
                });
            });

        } catch (error) {
            console.error(`[SMTP ERROR] Falha ao verificar ${email}:`, error.message);
            return false;
        }
    }

    /**
     * Verifica se o domínio aceita qualquer e-mail (Catch-All)
     * @param {string} domain 
     * @returns {Promise<boolean>} true se for catch-all
     */
    checkCatchAll = async (domain) => {
        // Gera um e-mail aleatório que garantidamente não deveria existir
        const randomString = Math.random().toString(36).substring(2, 10);
        const testEmail = `anticanary_${randomString}@${domain}`;
        
        console.log(`[SMTP-Anticatch] Testando integridade do domínio: ${domain}...`);
        
        // Se o servidor SMTP disser que este e-mail aleatório "existe", o domínio é Catch-All
        const isCatchAll = await this.verifyEmailSMTP(testEmail);
        
        if (isCatchAll) {
            console.warn(`[SMTP-Anticatch] ALERTA: Domínio ${domain} é Catch-All. Validação desativada para este alvo.`);
        }
        
        return isCatchAll;
    }
}

// Exporta uma instância para manter o estado se necessário e facilitar o uso
module.exports = new SMTPService();