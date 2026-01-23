# prospeccao-scraper

🎯 OSINT B2B Growth Pipeline

Status: Em Desenvolvimento (Fase 2 - Scraping)
Objetivo: Pipeline de Engenharia de Dados para enriquecimento de leads B2B e redução de CAC a zero.

Este projeto substitui ferramentas de alto custo (Apollo/ZoomInfo) por uma arquitetura proprietária baseada em OSINT (Open Source Intelligence). O sistema identifica decisores e encontra canais de contato direto (WhatsApp) tornados públicos em redes sociais, operando sob a base legal de Legítimo Interesse B2B.

📂 Estrutura de Arquivos & Scripts (Inventário)

Abaixo, a lista dos arquivos que compõem este projeto. Verifique se todos estão na sua pasta raiz.

1. Aplicação (/src)

src/server.js (✅ CRIADO): O "cérebro" do robô.

Função 1: API Rest (Express) na porta 3000.

Função 2: POST /api/linkedin/search -> Faz busca no Google (Dorking) para achar perfis sem logar no LinkedIn.

Função 3: POST /api/enrich/instagram -> Busca perfil no Instagram e extrai WhatsApp da Bio/Linktree.

2. Infraestrutura (Raiz)

Dockerfile (⚠️ PENDENTE DE UPLOAD): A receita para o Easypanel construir o container.

Importante: Deve usar a imagem mcr.microsoft.com/playwright:v1.41.0-jammy.

package.json (⚠️ PENDENTE DE UPLOAD): Lista as dependências (playwright, express, stealth).

🗺 Roadmap de Desenvolvimento

Use este checklist para acompanhar o progresso real do projeto.

Fase 1: Infraestrutura (Easypanel & Docker)

[x] Criação do Repositório GitHub (prospeccao-scraper).

[x] Configuração do .gitignore e LICENSE.

[ ] Ação Necessária: Criar/Subir o arquivo Dockerfile na raiz.

[ ] Ação Necessária: Criar/Subir o arquivo package.json na raiz.

[ ] Ação Necessária: Deploy no Easypanel (Serviço deve ficar "Verde/Running").

Fase 2: Microsserviços de Scraping (Node.js)

[x] Implementação do servidor Express básico (src/server.js).

[x] Implementação da busca Google Dorking para LinkedIn (/api/linkedin/search).

[x] Implementação da busca e extração de Bio do Instagram (/api/enrich/instagram).

[ ] Teste manual das rotas (via Postman ou n8n).

Fase 3: Orquestração (n8n)

[ ] Configuração do serviço n8n no Easypanel.

[ ] Criação do Workflow: Receber Nome Empresa -> Chamar API LinkedIn -> Chamar API Instagram.

[ ] Integração com Google Sheets para salvar os leads.

🚀 Como Fazer o Deploy (Easypanel)

Garanta que o Dockerfile e package.json estão na raiz deste repositório.

Crie um App no Easypanel do tipo GitHub.

Configurações de Build:

Branch: main

Build Path: /

Configurações de Porta: Exponha a porta 3000.

🛠 Stack Tecnológica

Runtime: Node.js

Browser Automation: Playwright (com plugin puppeteer-extra-plugin-stealth).

API: Express.js

Infra: Docker (Imagem Microsoft Playwright).

⚖️ Aviso Legal

Este software é uma Prova de Conceito (PoC). O uso para spam massivo é desencorajado. O sistema possui delays intencionais para simular navegação humana.