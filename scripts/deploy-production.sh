#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CLIENT_DIR="$APP_DIR/client"
SERVER_DIR="$APP_DIR/server"
PM2_APP_NAME="${PM2_APP_NAME:-oryon-server}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://atosfardamentos.com.br/login}"

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Required command not found: $1" >&2
        exit 1
    fi
}

require_command git
require_command node
require_command npm
require_command pm2

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "Node.js 20+ is required. Current version: $(node -v)" >&2
    exit 1
fi

export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_FUND=false
export NODE_ENV="${NODE_ENV:-production}"

log "Repository"
cd "$APP_DIR"
git rev-parse --short HEAD

log "Installing frontend dependencies"
cd "$CLIENT_DIR"
npm ci

log "Building frontend"
npm run build

log "Installing backend dependencies"
cd "$SERVER_DIR"
npm ci --omit=dev

log "Restarting PM2 app: $PM2_APP_NAME"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
else
    pm2 start "$SERVER_DIR/server.js" \
        --name "$PM2_APP_NAME" \
        --cwd "$SERVER_DIR" \
        --time
fi
pm2 save || true

if command -v curl >/dev/null 2>&1 && [ -n "$HEALTHCHECK_URL" ]; then
    log "Checking $HEALTHCHECK_URL"
    curl -fsS --max-time 20 "$HEALTHCHECK_URL" >/dev/null
fi

log "Deploy complete"
