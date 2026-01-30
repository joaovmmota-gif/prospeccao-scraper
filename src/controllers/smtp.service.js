const dns = require('dns').promises;
const net = require('net');

/**
 * Verifica se um e-mail existe conectando-se ao servidor SMTP
 * @param {string} email - E-mail para testar
 * @returns {Promise<boolean>} true se existir, false se não
 */
async function verifyEmailSMTP(email) {
    const domain = email.split('@')[1];
    
    try {
        console.log(`[SMTP] Buscando servidor MX para ${domain}...`);
        
        // 1. Descobre o servidor de e-mail da empresa (MX Record)
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
            console.warn(`[SMTP] Domínio ${domain} não tem servidor de e-mail.`);
            return false;
        }
        
        // Pega o servidor com maior prioridade (menor número)
        const mxServer = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
        console.log(`[SMTP] Servidor encontrado: ${mxServer}. Conectando na porta 25...`);

        // 2. Inicia o Handshake SMTP
        return await new Promise((resolve) => {
            const socket = net.createConnection(25, mxServer);
            let step = 0;
            let isValid = false;

            // Configura timeout de 5s para não travar
            socket.setTimeout(5000, () => {
                console.warn('[SMTP] Timeout na conexão.');
                socket.destroy();
                resolve(false);
            });

            socket.on('data', (data) => {
                const response = data.toString();
                // console.log(`[SERVER]: ${response.trim()}`); // Descomente para debug

                // Lógica da conversa SMTP
                // Passo 0: Servidor diz "220 Hello" -> Nós mandamos "HELO"
                if (response.startsWith('220') && step === 0) {
                    socket.write(`HELO ${domain}\r\n`);
                    step++;
                }
                // Passo 1: Servidor aceita HELO -> Nós mandamos "MAIL FROM" (Falso remetente)
                else if (response.startsWith('250') && step === 1) {
                    socket.write(`MAIL FROM:<verify@${domain}>\r\n`);
                    step++;
                }
                // Passo 2: Servidor aceita MAIL FROM -> Nós mandamos "RCPT TO" (O e-mail alvo)
                else if (response.startsWith('250') && step === 2) {
                    socket.write(`RCPT TO:<${email}>\r\n`);
                    step++;
                }
                // Passo 3: O Veredito
                // 250 = E-mail Válido! (O servidor aceitou receber)
                // 550 = E-mail Inválido (Usuário não existe)
                else if (step === 3) {
                    if (response.startsWith('250')) {
                        isValid = true; // SUCESSO!
                    }
                    // Encerramos a conexão educadamente
                    socket.write('QUIT\r\n');
                    socket.end();
                    resolve(isValid);
                }
            });

            socket.on('error', (err) => {
                console.warn(`[SMTP] Erro de conexão: ${err.message}`);
                resolve(false);
            });
        });

    } catch (error) {
        console.error(`[SMTP ERROR] Falha ao verificar ${email}:`, error.message);
        return false;
    }
}

module.exports = { verifyEmailSMTP };