# 1. ATUALIZADO: Usa a versão 1.58.0 exigida pelo erro
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

# 2. Define a pasta de trabalho dentro do container
WORKDIR /app

# 3. Copia os arquivos de definição de dependências primeiro
COPY package*.json ./

# 4. Instala as dependências do Node.js
RUN npm install

# 5. Copia todo o restante do código fonte para dentro do container
COPY . .

# 6. Expõe a porta 3000
EXPOSE 3000

# 7. Comando para iniciar o servidor
CMD ["node", "src/server.js"]