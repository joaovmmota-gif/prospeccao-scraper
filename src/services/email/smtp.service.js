const dns = require('dns').promises;
const net = require('net');

class SMTPService {

    /**
     * Verifica se o domínio possui registros MX válidos.
     */
    checkDomainExists = async (domain) => {
        try {
            console.log(`[SMTP] Verificando registros MX para: ${domain}`);
            const mxRecords = await dns.resolveMx(domain);
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
     * Versão Blindada contra "Write after end"
     */
    verifyEmailSMTP = async (email, mxServer) => {
        const domain = email.split('@')[1];
        
        try {
            // 1. Resolução de MX (se não fornecido)
            if (!mxServer) {
                const mxRecords = await dns.resolveMx(domain);
                if (!mxRecords || mxRecords.length === 0) return false;
                mxServer = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
            }

            // 2. Handshake SMTP
            return await new Promise((resolve) => {
                let resolved = false; // Flag para evitar dupla resolução
                const socket = net.createConnection(25, mxServer);
                let step = 0;

                // Função auxiliar para resolver a Promise apenas uma vez
                const finish = (result) => {
                    if (!resolved) {
                        resolved = true;
                        if (!socket.destroyed) socket.destroy();
                        resolve(result);
                    }
                };

                // Função auxiliar para escrever com segurança
                const safeWrite = (command) => {
                    if (resolved) return; // Se já acabou, não escreve mais
                    
                    if (socket.writable && !socket.destroyed) {
                        socket.write(command);
                    } else {
                        console.warn(`[SMTP] Tentativa de escrita em socket fechado para ${email}`);
                        finish(false);
                    }
                };

                // Timeout de 5s
                socket.setTimeout(5000, () => {
                    finish(false);
                });

                socket.on('data', (data) => {
                    if (resolved) return;

                    const response = data.toString();
                    
                    try {
                        // Passo 0: Servidor diz "220" -> Mandamos "HELO"
                        if (response.startsWith('220') && step === 0) {
                            safeWrite(`HELO ${domain}\r\n`);
                            step++;
                        }
                        // Passo 1: Aceita HELO -> Mandamos "MAIL FROM"
                        else if (response.startsWith('250') && step === 1) {
                            safeWrite(`MAIL FROM:<verify@${domain}>\r\n`);
                            step++;
                        }
                        // Passo 2: Aceita MAIL FROM -> Mandamos "RCPT TO"
                        else if (response.startsWith('250') && step === 2) {
                            safeWrite(`RCPT TO:<${email}>\r\n`);
                            step++;
                        }
                        // Passo 3: O Veredito
                        else if (step === 3) {
                            if (response.startsWith('250')) {
                                // E-mail válido!
                                safeWrite('QUIT\r\n');
                                finish(true);
                            } else {
                                // Qualquer coisa que não seja 250 aqui (ex: 550) é falha
                                safeWrite('QUIT\r\n');
                                finish(false);
                            }
                        }
                    } catch (err) {
                        console.error(`[SMTP] Erro lógico durante handshake: ${err.message}`);
                        finish(false);
                    }
                });

                socket.on('error', (err) => {
                    // Não logamos stack trace completo para não poluir, apenas aviso
                    // console.warn(`[SMTP] Erro de conexão/socket em ${email}: ${err.message}`);
                    finish(false);
                });

                socket.on('end', () => {
                    finish(false);
                });
            });

        } catch (error) {
            console.error(`[SMTP ERROR] Falha crítica ao verificar ${email}:`, error.message);
            return false;
        }
    }

    /**
     * Verifica Catch-All (Reutilizando a lógica blindada)
     */
    checkCatchAll = async (domain, mxServer) => {
        if (!mxServer) return false;

        const randomString = Math.random().toString(36).substring(2, 10);
        const testEmail = `anticanary_${randomString}@${domain}`;
        
        console.log(`[SMTP-Anticatch] Testando: ${testEmail} via ${mxServer}`);
        
        // Se der erro de conexão, assumimos que NÃO é catch-all (safe default)
        // para não bloquear domínios válidos por erro de rede.
        const isCatchAll = await this.verifyEmailSMTP(testEmail, mxServer);
        
        if (isCatchAll) {
            console.warn(`[SMTP-Anticatch] ALERTA: ${domain} é Catch-All.`);
        }
        
        return isCatchAll;
    }
}

module.exports = new SMTPService();