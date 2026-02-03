const dns = require('dns').promises;
const net = require('net');

class SMTPService {
    
    /**
     * Verifica SE o domínio tem servidores de e-mail (MX Records).
     * Deve ser chamado UMA VEZ antes de qualquer tentativa de envio.
     * @param {string} domain - O domínio a ser verificado (ex: google.com)
     * @returns {Promise<string|boolean>} O endereço do servidor MX prioritário ou false.
     */
    async hasMXRecords(domain) {
        try {
            console.log(`[SMTP] Verificando registros MX para: ${domain}`);
            const mxRecords = await dns.resolveMx(domain);
            
            if (!mxRecords || mxRecords.length === 0) {
                console.warn(`[SMTP] FALHA: Domínio ${domain} não possui entradas MX.`);
                return false;
            }
            
            // Retorna o servidor com maior prioridade (menor número de prioridade)
            const bestServer = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
            console.log(`[SMTP] MX encontrado: ${bestServer}`);
            return bestServer;

        } catch (error) {
            console.warn(`[SMTP] Erro ao resolver MX de ${domain}: ${error.code}`);
            return false;
        }
    }

    /**
     * Verifica se um e-mail existe conectando-se ao servidor SMTP
     * @param {string} email - E-mail para testar
     * @param {string} [mxServer] - (Opcional) Servidor MX já resolvido para otimização
     * @returns {Promise<boolean>} true se existir, false se não
     */
    verifyEmailSMTP = async (email, mxServer) => {
        const domain = email.split('@')[1];
        
        // Se não passar o servidor MX, resolvemos agora (Fallback de segurança)
        if (!mxServer) {
            const mx = await this.hasMXRecords(domain);
            if (!mx) return false;
            mxServer = mx;
        }

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
                // Não logamos erro de conexão como erro crítico, apenas retornamos false
                // pois pode ser bloqueio de firewall do lado deles
                socket.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Verifica se o domínio aceita qualquer e-mail (Catch-All)
     * @param {string} domain 
     * @param {string} [mxServer] - Servidor MX já resolvido
     * @returns {Promise<boolean>} true se for catch-all
     */
    checkCatchAll = async (domain, mxServer) => {
        // Se o domínio não tem servidor de e-mail, não pode ser Catch-All (é só inválido)
        if (!mxServer) return false;

        // Gera um e-mail aleatório que garantidamente não deveria existir
        const randomString = Math.random().toString(36).substring(2, 10);
        const testEmail = `anticanary_${randomString}@${domain}`;
        
        console.log(`[SMTP-Anticatch] Testando integridade do domínio: ${domain}...`);
        
        // Passamos o mxServer já resolvido para ganhar tempo
        const isCatchAll = await this.verifyEmailSMTP(testEmail, mxServer);
        
        if (isCatchAll) {
            console.warn(`[SMTP-Anticatch] ALERTA: Domínio ${domain} é Catch-All.`);
        }
        
        return isCatchAll;
    }
}

module.exports = new SMTPService();