#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CLIENT_DIR="$APP_DIR/client"
SERVER_DIR="$APP_DIR/server"
PM2_APP_NAME="${PM2_APP_NAME:-oryon-server}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://atosfardamentos.com.br/login}"
BRANDING_SOURCE_DIR="${BRANDING_SOURCE_DIR:-}"
BRANDING_TARGET_DIR="${BRANDING_TARGET_DIR:-}"

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

if [ -n "$BRANDING_SOURCE_DIR" ] || [ -n "$BRANDING_TARGET_DIR" ]; then
    if [ ! -d "$BRANDING_SOURCE_DIR" ] || [ -z "$BRANDING_TARGET_DIR" ]; then
        echo "Branding source or target is invalid." >&2
        exit 1
    fi

    log "Synchronizing installation branding"
    branding_parent_dir="$(dirname "$BRANDING_TARGET_DIR")"
    if [ -d "$branding_parent_dir" ]; then
        chmod o+x "$branding_parent_dir"
    fi
    install -d -m 755 "$BRANDING_TARGET_DIR"
    for branding_file in logo.png logo-white.png; do
        if [ -f "$BRANDING_SOURCE_DIR/$branding_file" ]; then
            install -m 644 "$BRANDING_SOURCE_DIR/$branding_file" "$BRANDING_TARGET_DIR/$branding_file"
        fi
    done
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "Node.js 20+ is required. Current version: $(node -v)" >&2
    exit 1
fi

export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_FUND=false

log "Repository"
cd "$APP_DIR"
git rev-parse --short HEAD

log "Installing frontend dependencies"
cd "$CLIENT_DIR"
npm ci --include=dev

log "Building frontend"
npm run build

log "Installing backend dependencies"
cd "$SERVER_DIR"
npm ci

log "Restarting PM2 app: $PM2_APP_NAME"
export NODE_ENV="${NODE_ENV:-production}"
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
