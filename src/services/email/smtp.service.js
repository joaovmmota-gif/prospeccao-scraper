const dns = require('dns').promises;
const net = require('net');

class SMTPService {

    /**
     * Verifica se o domínio possui registros MX e RETORNA o servidor prioritário.
     * @param {string} domain 
     * @returns {Promise<string|boolean>} O endereço do servidor (ex: "alt1.aspmx.l.google.com") ou false.
     */
    checkDomainExists = async (domain) => {
        try {
            console.log(`[SMTP] Verificando registros MX para: ${domain}`);
            const mxRecords = await dns.resolveMx(domain);
            
            if (Array.isArray(mxRecords) && mxRecords.length > 0) {
                // Ordena por prioridade e retorna o servidor (exchange)
                const bestServer = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
                console.log(`[SMTP] MX Encontrado: ${bestServer}`);
                return bestServer;
            }
            
            console.warn(`[SMTP] Domínio ${domain} não tem registros MX válidos.`);
            return false;
        } catch (error) {
            console.warn(`[SMTP] Falha ao resolver MX do domínio ${domain}:`, error.message);
            return false;
        }
    }

    /**
     * Verifica e-mail via SMTP (Blindado contra Write After End)
     */
    verifyEmailSMTP = async (email, mxServer) => {
        const domain = email.split('@')[1];
        
        try {
            // 1. Auto-resolução se o mxServer não for fornecido
            if (!mxServer) {
                const mxResult = await this.checkDomainExists(domain);
                if (!mxResult) return false;
                mxServer = mxResult;
            }

            // 2. Handshake SMTP Seguro
            return await new Promise((resolve) => {
                let resolved = false;
                const socket = net.createConnection(25, mxServer);
                let step = 0;

                const finish = (result) => {
                    if (!resolved) {
                        resolved = true;
                        if (!socket.destroyed) socket.destroy();
                        resolve(result);
                    }
                };

                const safeWrite = (command) => {
                    if (resolved) return;
                    if (socket.writable && !socket.destroyed) {
                        socket.write(command);
                    } else {
                        finish(false);
                    }
                };

                socket.setTimeout(5000, () => finish(false));

                socket.on('data', (data) => {
                    if (resolved) return;
                    const response = data.toString();
                    
                    try {
                        if (response.startsWith('220') && step === 0) {
                            safeWrite(`HELO ${domain}\r\n`);
                            step++;
                        } else if (response.startsWith('250') && step === 1) {
                            safeWrite(`MAIL FROM:<verify@${domain}>\r\n`);
                            step++;
                        } else if (response.startsWith('250') && step === 2) {
                            safeWrite(`RCPT TO:<${email}>\r\n`);
                            step++;
                        } else if (step === 3) {
                            if (response.startsWith('250')) {
                                safeWrite('QUIT\r\n');
                                finish(true);
                            } else {
                                safeWrite('QUIT\r\n');
                                finish(false);
                            }
                        }
                    } catch (e) { finish(false); }
                });

                socket.on('error', () => finish(false));
                socket.on('end', () => finish(false));
            });

        } catch (error) {
            return false;
        }
    }

    /**
     * Verifica Catch-All
     * Agora resolve o MX internamente se ele não for passado.
     */
    checkCatchAll = async (domain, mxServer) => {
        // Se não passar mxServer, resolvemos agora
        if (!mxServer) {
            const mxResult = await this.checkDomainExists(domain);
            if (!mxResult) return false;
            mxServer = mxResult;
        }

        const randomString = Math.random().toString(36).substring(2, 10);
        const testEmail = `anticanary_${randomString}@${domain}`;
        
        console.log(`[SMTP-Anticatch] Testando catch-all para ${domain} via ${mxServer}...`);
        
        // Reutiliza o verifyEmailSMTP passando o servidor já resolvido
        const isCatchAll = await this.verifyEmailSMTP(testEmail, mxServer);
        
        if (isCatchAll) {
            console.warn(`[SMTP-Anticatch] ALERTA: ${domain} é Catch-All.`);
        } else {
            console.log(`[SMTP-Anticatch] Sucesso: ${domain} não é Catch-All.`);
        }
        
        return isCatchAll;
    }
}

module.exports = new SMTPService();