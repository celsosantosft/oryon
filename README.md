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

## Deploy automatico pelo GitHub

O repositorio tem um workflow em `.github/workflows/deploy-production.yml`.
Sempre que houver `push` na branch `main`, o GitHub Actions:

1. instala as dependencias do frontend;
2. valida o build do Vite;
3. acessa o VPS por SSH;
4. atualiza `/var/www/oryon` para o commit enviado;
5. roda `scripts/deploy-production.sh`;
6. recompila o frontend e reinicia o PM2.

### Segredos necessarios no GitHub

Cadastre em `Settings > Secrets and variables > Actions > New repository secret`:

- `DEPLOY_HOST`: IP ou dominio do VPS. Obrigatorio.
- `DEPLOY_SSH_KEY`: chave privada SSH usada pelo GitHub Actions. Obrigatorio.
- `DEPLOY_USER`: usuario SSH. Opcional, padrao `root`.
- `DEPLOY_PORT`: porta SSH. Opcional, padrao `22`.
- `DEPLOY_PATH`: caminho do projeto no VPS. Opcional, padrao `/var/www/oryon`.

No VPS, a chave publica correspondente precisa estar em `~/.ssh/authorized_keys`
do usuario configurado em `DEPLOY_USER`.

### Requisitos no VPS

- Node.js 20 ou superior.
- npm.
- git.
- pm2.
- projeto ja clonado em `/var/www/oryon`.
- app PM2 com o nome `oryon-server`.

Arquivos de producao como `.env`, `server/.env`, `server/atos.db` e
`server/uploads` ficam fora do Git e nao sao apagados pelo deploy.

## Arquivos que nao entram no Git

O repositorio ignora dados sensiveis e arquivos gerados:

- `.env`
- bancos SQLite (`*.db`)
- uploads de clientes
- `node_modules`
- `client/dist`
- pacotes de deploy
- relatorios Lighthouse
