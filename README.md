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

### Configuracao por instalacao/cliente

O mesmo codigo pode rodar em mais de uma instalacao usando `.env` diferente em
cada pasta do VPS. Para preservar o comportamento atual, os valores padrao ainda
sao da Atos.

Variaveis principais:

- `PORT`: porta do backend Express. Exemplo: `3001` para a Atos e `3002` para outro cliente.
- `PUBLIC_APP_URL`: dominio publico da instalacao.
- `CORS_ORIGIN`: origem permitida no backend.
- `VITE_API_BASE_URL`: URL da API usada no build do frontend.
- `APP_BRAND_NAME` / `VITE_APP_BRAND_NAME`: nome exibido da empresa.
- `APP_SYSTEM_NAME` / `VITE_APP_SYSTEM_NAME`: nome do sistema/marca tecnica.
- `APP_ORDER_PREFIX` / `VITE_APP_ORDER_PREFIX`: prefixo dos pedidos, sem `#`. Exemplo: `ATOS`.
- `APP_SUPPORT_EMAIL` / `VITE_APP_SUPPORT_EMAIL`: e-mail exibido em impressos.
- `VITE_APP_LOGO_URL`, `VITE_APP_LOGO_SMALL_URL`, `VITE_APP_LOGO_MEDIUM_URL`, `VITE_APP_LOGO_WHITE_URL`, `VITE_APP_PRINT_LOGO_URL`: logos usadas pelo frontend.
- `APP_DATA_DIR`: pasta persistente e exclusiva da instalacao. O banco e os uploads ficam nela.

Exemplo de segunda instalacao:

```env
PORT=3002
PUBLIC_APP_URL=https://cliente.com.br
CORS_ORIGIN=https://cliente.com.br
VITE_API_BASE_URL=https://cliente.com.br/api
APP_BRAND_NAME=Cliente Exemplo
APP_SYSTEM_NAME=Cliente Exemplo ERP
APP_ORDER_PREFIX=CLI
VITE_APP_BRAND_NAME=Cliente Exemplo
VITE_APP_SYSTEM_NAME=Cliente Exemplo ERP
VITE_APP_ORDER_PREFIX=CLI
```

## Deploy automatico pelo GitHub

O repositorio tem um workflow em `.github/workflows/deploy-production.yml`.
Sempre que houver `push` na branch `main`, o GitHub Actions:

1. instala as dependencias do frontend;
2. valida o build do Vite;
3. acessa o VPS por SSH;
4. atualiza `/var/www/oryon` para o commit enviado;
5. inicializa `/var/www/pd-fardamentos` na primeira execucao e depois o atualiza;
6. recompila cada frontend e reinicia seu processo PM2 separadamente.

### Segredos necessarios no GitHub

Cadastre em `Settings > Secrets and variables > Actions > New repository secret`:

- `DEPLOY_HOST`: IP ou dominio do VPS. Obrigatorio.
- `DEPLOY_SSH_KEY`: chave privada SSH usada pelo GitHub Actions. Obrigatorio.
- `DEPLOY_USER`: usuario SSH. Opcional, padrao `root`.
- `DEPLOY_PORT`: porta SSH. Opcional, padrao `22`.
- `DEPLOY_PATH`: caminho do projeto no VPS. Opcional, padrao `/var/www/oryon`.
- `SECONDARY_DEPLOY_PATH`: caminho da segunda instalacao. Opcional, padrao `/var/www/pd-fardamentos`.

No VPS, a chave publica correspondente precisa estar em `~/.ssh/authorized_keys`
do usuario configurado em `DEPLOY_USER`.

### Requisitos no VPS

- Node.js 20 ou superior.
- npm.
- git.
- pm2.
- projeto ja clonado em `/var/www/oryon`.
- segunda instalacao, quando ativa, clonada em `/var/www/pd-fardamentos`.
- processos PM2 `oryon-server` e `pd-fardamentos-server`. O script cria o segundo automaticamente.

Arquivos de producao como `.env`, `server/.env`, `server/atos.db` e
`server/uploads` ficam fora do Git e nao sao apagados pelo deploy. Para novas
instalacoes, prefira `APP_DATA_DIR` fora do repositorio, como
`/var/lib/oryon/pd-fardamentos`.

Os modelos da segunda instalacao estao em `deploy/pdfardamentos.env.example` e
`deploy/nginx/pdfardamentos.conf`. A inicializacao automatica usa
`scripts/bootstrap-pd-fardamentos.sh`, gera segredos diretamente na VPS e guarda
o acesso inicial em `/root/pd-fardamentos-initial-credentials.txt` com permissao
somente para `root`.

## Arquivos que nao entram no Git

O repositorio ignora dados sensiveis e arquivos gerados:

- `.env`
- bancos SQLite (`*.db`)
- uploads de clientes
- `node_modules`
- `client/dist`
- pacotes de deploy
- relatorios Lighthouse
