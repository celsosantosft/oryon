# Oryon ERP

Sistema web para gestao de pedidos, producao, financeiro, portal do cliente e integracao com WhatsApp.

## Estrutura

- `client`: frontend Vite + React.
- `server`: API Express + SQLite.
- `nginx-performance-snippet.conf`: exemplo de cache e gzip para producao.

## Requisitos

- Node.js
- npm
- SQLite local usado pelo backend

## Frontend

```bash
cd client
npm install
npm run build
```

Para desenvolvimento:

```bash
cd client
npm run dev
```

## Backend

```bash
cd server
npm install
npm start
```

Configure as variaveis de ambiente usando `.env.example` como referencia.

## Arquivos que nao entram no Git

O repositorio ignora dados sensiveis e arquivos gerados:

- `.env`
- bancos SQLite (`*.db`)
- uploads de clientes
- `node_modules`
- `client/dist`
- pacotes de deploy
- relatorios Lighthouse

