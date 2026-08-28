#!/usr/bin/env bash
set -Eeuo pipefail

PRIMARY_APP_DIR="${1:-/var/www/oryon}"
APP_DIR="${2:-/var/www/pd-fardamentos}"
TARGET_COMMIT="${3:-main}"
DATA_DIR="${PD_DATA_DIR:-/var/lib/oryon/pd-fardamentos}"
PM2_APP_NAME="pd-fardamentos-server"
DOMAIN="pdfardamentos.com.br"
WWW_DOMAIN="www.pdfardamentos.com.br"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-atosfardamentos@gmail.com}"
NGINX_AVAILABLE="/etc/nginx/sites-available/pdfardamentos"
NGINX_ENABLED="/etc/nginx/sites-enabled/pdfardamentos"
MARKER_FILE="$DATA_DIR/.bootstrap-complete"
CREDENTIALS_FILE="/root/pd-fardamentos-initial-credentials.txt"

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Required command not found: $1" >&2
        exit 1
    fi
}

if [ "$(id -u)" -ne 0 ]; then
    echo "This bootstrap must run as root." >&2
    exit 1
fi

for command_name in git openssl nginx certbot node npm pm2 curl; do
    require_command "$command_name"
done

if [ -f "$MARKER_FILE" ]; then
    log "PD Fardamentos is already initialized"
    exit 0
fi

if [ ! -d "$PRIMARY_APP_DIR/.git" ]; then
    echo "Primary repository not found: $PRIMARY_APP_DIR" >&2
    exit 1
fi

if command -v ss >/dev/null 2>&1 \
    && ss -ltn | awk '{print $4}' | grep -Eq '(^|:)3002$' \
    && ! pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    echo "Port 3002 is already in use by another process." >&2
    exit 1
fi

REPOSITORY_URL="$(git -C "$PRIMARY_APP_DIR" remote get-url origin)"

if [ ! -d "$APP_DIR/.git" ]; then
    if [ -e "$APP_DIR" ] && [ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
        echo "Target exists and is not an initialized repository: $APP_DIR" >&2
        exit 1
    fi

    log "Cloning application"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch main "$REPOSITORY_URL" "$APP_DIR"
fi

log "Selecting commit $TARGET_COMMIT"
git -C "$APP_DIR" fetch origin main
git -C "$APP_DIR" checkout main
git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"

install -d -m 751 "$DATA_DIR"
install -d -m 750 "$DATA_DIR/uploads"
install -d -m 755 "$DATA_DIR/branding"

if [ ! -f "$APP_DIR/.env" ]; then
    JWT_SECRET="$(openssl rand -hex 48)"
    ADMIN_PASSWORD="$(openssl rand -hex 12)"
    PRIMARY_ENV="$PRIMARY_APP_DIR/.env"
    EVOLUTION_BASE_URL="http://127.0.0.1:8080"
    EVOLUTION_API_KEY=""

    if [ -f "$PRIMARY_ENV" ]; then
        PRIMARY_EVOLUTION_URL="$(awk -F= '/^(EVOLUTION_BASE_URL|SERVER_URL)=/ { sub(/^[^=]*=/, ""); print; exit }' "$PRIMARY_ENV")"
        PRIMARY_EVOLUTION_KEY="$(awk -F= '/^(EVOLUTION_API_KEY|AUTHENTICATION_API_KEY)=/ { sub(/^[^=]*=/, ""); print; exit }' "$PRIMARY_ENV")"
        EVOLUTION_BASE_URL="${PRIMARY_EVOLUTION_URL:-$EVOLUTION_BASE_URL}"
        EVOLUTION_API_KEY="${PRIMARY_EVOLUTION_KEY:-$EVOLUTION_API_KEY}"
    fi

    log "Creating isolated environment"
    umask 077
    cat > "$APP_DIR/.env" <<ENV
PORT=3002
JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=https://$DOMAIN,https://$WWW_DOMAIN
PUBLIC_APP_URL=https://$DOMAIN
VITE_API_BASE_URL=https://$DOMAIN/api

APP_DATA_DIR=$DATA_DIR
APP_BRAND_NAME=PD Fardamentos
APP_SYSTEM_NAME=PD System
APP_ORDER_PREFIX=PD
APP_QUOTE_PREFIX=ORC
APP_SUPPORT_EMAIL=contato@$DOMAIN
APP_META_LEAD_SOURCE=PD Fardamentos CRM

VITE_APP_BRAND_NAME=PD Fardamentos
VITE_APP_SYSTEM_NAME=PD System
VITE_APP_ORDER_PREFIX=PD
VITE_APP_SUPPORT_EMAIL=contato@$DOMAIN
VITE_APP_LOGO_URL=/branding/logo.png
VITE_APP_LOGO_SMALL_URL=/branding/logo.png
VITE_APP_LOGO_MEDIUM_URL=/branding/logo.png
VITE_APP_LOGO_WHITE_URL=/branding/logo-white.png
VITE_APP_PRINT_LOGO_URL=/branding/logo.png
VITE_APP_THEME=monochrome

ADMIN_EMAIL=admin@$DOMAIN
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_NAME=Administrador PD

EVOLUTION_BASE_URL=$EVOLUTION_BASE_URL
EVOLUTION_API_KEY=$EVOLUTION_API_KEY
EVOLUTION_INSTANCE=PDFardamentos
EVOLUTION_WEBHOOK_URL=

META_GRAPH_VERSION=v26.0
META_PIXEL_ID=
META_ACCESS_TOKEN=
ENV
    chmod 600 "$APP_DIR/.env"

    cat > "$CREDENTIALS_FILE" <<CREDENTIALS
PD Fardamentos
URL: https://$DOMAIN/login
Usuario: admin@$DOMAIN
Senha inicial: $ADMIN_PASSWORD
CREDENTIALS
    chmod 600 "$CREDENTIALS_FILE"
    umask 022
fi

# NODE_ENV is exported by the deploy script so Vite does not warn about it in .env.
sed -i '/^NODE_ENV=production$/d' "$APP_DIR/.env"

if grep -q '^VITE_APP_THEME=' "$APP_DIR/.env"; then
    sed -i 's/^VITE_APP_THEME=.*/VITE_APP_THEME=monochrome/' "$APP_DIR/.env"
else
    printf '\nVITE_APP_THEME=monochrome\n' >> "$APP_DIR/.env"
fi

log "Building application and starting isolated backend"
APP_DIR="$APP_DIR" \
PM2_APP_NAME="$PM2_APP_NAME" \
HEALTHCHECK_URL="" \
BRANDING_SOURCE_DIR="$APP_DIR/deploy/branding/pd-fardamentos" \
BRANDING_TARGET_DIR="$DATA_DIR/branding" \
bash "$APP_DIR/scripts/deploy-production.sh"

find "$APP_DIR/client/dist" -type d -exec chmod 755 {} +
find "$APP_DIR/client/dist" -type f -exec chmod 644 {} +

log "Installing Nginx site"
install -m 644 "$APP_DIR/deploy/nginx/pdfardamentos.conf" "$NGINX_AVAILABLE"
ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"

if ! nginx -t; then
    rm -f "$NGINX_ENABLED"
    nginx -t
    echo "Invalid PD Fardamentos Nginx configuration; site was disabled." >&2
    exit 1
fi

systemctl reload nginx
curl -fsS --max-time 20 "http://$DOMAIN/login" >/dev/null

log "Issuing HTTPS certificate"
certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    --email "$CERTBOT_EMAIL" \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "$WWW_DOMAIN"

curl -fsS --max-time 20 "https://$DOMAIN/login" >/dev/null
touch "$MARKER_FILE"

log "PD Fardamentos bootstrap complete"
echo "Initial credentials are stored at $CREDENTIALS_FILE"
