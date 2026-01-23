🏗️ Estrutura do Projeto & Organização de Scripts

Este documento define a organização de arquivos do repositório prospeccao-scraper. O objetivo é separar a camada de API (HTTP) da camada de Execução (Browser Automation) para facilitar a manutenção e escalabilidade.

📂 Árvore de Diretórios (Visão Atual e Futura)

prospeccao-scraper/
├── Dockerfile                  # Receita de construção do container
├── package.json                # Dependências (Playwright, Express, etc.)
├── README.md                   # Documentação geral
│
└── src/                        # Código Fonte
    ├── server.js               # Ponto de entrada (Entrypoint).
    │
    ├── config/                 # Configurações estáticas
    │   └── browser.config.js   # Args do Chromium, User-Agents.
    │
    ├── core/                   # O "Motor" Compartilhado
    │   └── browser.js          # Factory do Playwright (usado por LinkedIn e Instagram).
    │
    ├── routes/                 # Rotas da API
    │   ├── linkedin.routes.js
    │   └── instagram.routes.js # [FUTURO]
    │
    ├── controllers/            # Lógica HTTP (Validação e Resposta)
    │   ├── linkedin.controller.js
    │   └── instagram.controller.js # [FUTURO]
    │
    ├── services/               # Lógica de Negócio (Onde o Scraping acontece)
    │   ├── linkedin/           # Módulo LinkedIn
    │   │   ├── search.service.js
    │   │   └── parser.service.js
    │   │
    │   ├── instagram/          # [FUTURO] Módulo Instagram
    │   │   └── bio.service.js
    │   │
    │   └── email/              # [FUTURO] Módulo Email
    │       └── validator.service.js
    │
    └── utils/                  # Funções auxiliares reutilizáveis
        └── delayer.js          # Funções de delay humano.


🧠 Responsabilidade de Cada Módulo

1. src/server.js

Função: Apenas inicia o servidor Express, carrega middlewares globais (JSON, Cors) e importa as rotas.

Regra: Não deve conter lógica de scraping nem configurações do Playwright.

2. src/core/browser.js

Função: Gerencia o ciclo de vida do navegador.

Responsabilidade: Lançar o Chromium com argumentos anti-detecção e injetar cookies antes da navegação.

3. src/services/{plataforma}/

Isolamento: Cada plataforma (LinkedIn, Instagram) tem sua pasta. Se o LinkedIn mudar, o Instagram não quebra.

Service: Executa a ação no navegador (clicar, digitar, rolar).

Parser: Recebe o HTML e extrai os dados (JSON).

📦 Padrão de Módulos (Regra de Ouro)

Para evitar erros de compatibilidade (SyntaxError: Cannot use import statement outside a module), este projeto utiliza estritamente o sistema CommonJS.

❌ NÃO USE (ES Modules - Sintaxe de Frontend/React):

import express from 'express';
export default function minhaFuncao() {};


✅ USE (CommonJS - Padrão Node.js Backend):

const express = require('express');

// Para exportar funções
module.exports = {
    minhaFuncao,
    outraFuncao
};

// Para importar funções de outro arquivo
const { minhaFuncao } = require('../services/linkedin/search.service');


🚀 Benefícios desta Estrutura

Segurança: O cookie do LinkedIn é manipulado apenas no browser.js, facilitando a proteção desse dado sensível.

Manutenção: Se o LinkedIn mudar o nome da classe CSS dos resultados, você altera apenas o parser.service.js, sem risco de quebrar a conexão com o banco de dados ou a API.

Escalabilidade: Adicionar o scraper de Instagram é apenas criar uma pasta nova em services/instagram, sem tocar no código do LinkedIn.