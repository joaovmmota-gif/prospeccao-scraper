const dns = require('dns').promises;
const net = require('net');

class SMTPService {

    /**
     * Verifica se o domínio possui registros MX e RETORNA o servidor prioritário.
     */
    checkDomainExists = async (domain) => {
        try {
            console.log(`[SMTP] Verificando registros MX para: ${domain}`);
            const mxRecords = await dns.resolveMx(domain);
            
            if (Array.isArray(mxRecords) && mxRecords.length > 0) {
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
     * Verifica e-mail via SMTP (Versão Tolerante a Greylisting e Status 2xx)
     */
    verifyEmailSMTP = async (email, mxServer) => {
        const domain = email.split('@')[1];
        
        try {
            if (!mxServer) {
                const mxResult = await this.checkDomainExists(domain);
                if (!mxResult) return false;
                mxServer = mxResult;
            }

            return await new Promise((resolve) => {
                let resolved = false;
                const socket = net.createConnection(25, mxServer);
                let step = 0;

                const finish = (result, reason = '') => {
                    if (!resolved) {
                        resolved = true;
                        if (!socket.destroyed) socket.destroy();
                        if (reason) console.log(`[SMTP Debug] Fim da conexão para ${email}: ${reason}`);
                        resolve(result);
                    }
                };

                const safeWrite = (command) => {
                    if (resolved) return;
                    if (socket.writable && !socket.destroyed) {
                        socket.write(command);
                    } else {
                        finish(false, 'Socket fechado ao tentar escrever');
                    }
                };

                socket.setTimeout(5000, () => finish(false, 'Timeout 5s'));

                socket.on('data', (data) => {
                    if (resolved) return;
                    const response = data.toString();
                    
                    try {
                        // Responde ao handshake inicial
                        if (response.startsWith('220') && step === 0) {
                            safeWrite(`HELO ${domain}\r\n`);
                            step++;
                        } 
                        // Aceita qualquer código 2xx (250, 251, 252)
                        else if (response.startsWith('2') && step === 1) {
                            // Mudamos de verify@ para contact@ para evitar bloqueios simples
                            safeWrite(`MAIL FROM:<contact@${domain}>\r\n`);
                            step++;
                        } 
                        else if (response.startsWith('2') && step === 2) {
                            safeWrite(`RCPT TO:<${email}>\r\n`);
                            step++;
                        } 
                        else if (step === 3) {
                            // O Grande Veredito
                            if (response.startsWith('2')) {
                                // 250 OK, 251 Forwarding, 252 Cannot Verify but will accept
                                safeWrite('QUIT\r\n');
                                finish(true, `Aceito (${response.trim()})`);
                            } else {
                                // 550 User Unknown, 450 Throttled, 503 Bad Sequence
                                safeWrite('QUIT\r\n');
                                finish(false, `Rejeitado (${response.trim()})`);
                            }
                        }
                    } catch (e) { finish(false, `Erro de Parse: ${e.message}`); }
                });

                socket.on('error', (err) => finish(false, `Erro de Socket: ${err.message}`));
                socket.on('end', () => finish(false, 'Conexão encerrada pelo servidor'));
            });

        } catch (error) {
            console.error(`[SMTP Critical] ${error.message}`);
            return false;
        }
    }

    /**
     * Verifica Catch-All
     */
    checkCatchAll = async (domain, mxServer) => {
        if (!mxServer) {
            const mxResult = await this.checkDomainExists(domain);
            if (!mxResult) return false;
            mxServer = mxResult;
        }

        const randomString = Math.random().toString(36).substring(2, 10);
        // Usamos um prefixo que parece um usuário real para testar se ele aceita "qualquer um"
        const testEmail = `marketing_${randomString}@${domain}`;
        
        console.log(`[SMTP-Anticatch] Testando ${testEmail} via ${mxServer}...`);
        
        // Se o servidor aceitar esse email aleatório, É Catch-All
        const isCatchAll = await this.verifyEmailSMTP(testEmail, mxServer);
        
        if (isCatchAll) {
            console.warn(`[SMTP-Anticatch] ALERTA: ${domain} aceitou o email fantasma. É Catch-All.`);
        } else {
            console.log(`[SMTP-Anticatch] O servidor rejeitou o email fantasma. (Provavelmente seguro)`);
        }
        
        return isCatchAll;
    }
}

module.exports = new SMTPService();