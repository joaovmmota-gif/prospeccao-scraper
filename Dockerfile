# 1. Usa a imagem oficial do Playwright (já vem com navegadores e dependências de sistema)
# Usamos a versão jammy (Ubuntu 22.04) para maior compatibilidade
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# 2. Define a pasta de trabalho dentro do container
WORKDIR /app

# 3. Copia os arquivos de definição de dependências primeiro
# Isso aproveita o cache do Docker se as dependências não mudarem
COPY package*.json ./

# 4. Instala as dependências do Node.js
RUN npm install

# 5. Copia todo o restante do código fonte para dentro do container
COPY . .

# 6. Expõe a porta 3000 (onde o Express está rodando)
EXPOSE 3000

# 7. Comando para iniciar o servidor quando o container subir
CMD ["node", "src/server.js"]