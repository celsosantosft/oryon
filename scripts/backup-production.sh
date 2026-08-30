#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVER_DIR="${SERVER_DIR:-$APP_DIR/server}"
BACKUP_ROOT="${BACKUP_ROOT:-$APP_DIR/.backups/production}"
TIMESTAMP="${TIMESTAMP:-$(date '+%Y%m%d-%H%M%S')}"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

resolve_env_value() {
    local key="$1"
    local fallback="${2:-}"
    local value="${!key:-}"

    if [ -n "$value" ]; then
        printf '%s\n' "$value"
        return
    fi

    for env_file in "$APP_DIR/.env" "$SERVER_DIR/.env"; do
        if [ -f "$env_file" ]; then
            value="$(
                awk -F= -v key="$key" '
                    $0 !~ /^[[:space:]]*#/ && $1 ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*$" {
                        sub(/^[^=]*=/, "", $0);
                        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0);
                        gsub(/^["'\'']|["'\'']$/, "", $0);
                        print $0;
                        exit;
                    }
                ' "$env_file"
            )"
            if [ -n "$value" ]; then
                printf '%s\n' "$value"
                return
            fi
        fi
    done

    printf '%s\n' "$fallback"
}

resolve_path() {
    local value="$1"
    local fallback="$2"
    local selected="${value:-$fallback}"

    if [[ "$selected" = /* ]]; then
        printf '%s\n' "$selected"
    else
        printf '%s\n' "$SERVER_DIR/$selected"
    fi
}

copy_if_exists() {
    local source="$1"
    local target_dir="$2"

    if [ -e "$source" ]; then
        mkdir -p "$target_dir"
        cp -a "$source" "$target_dir/"
    fi
}

mkdir -p "$BACKUP_DIR"

APP_DATA_DIR="$(resolve_env_value APP_DATA_DIR "$SERVER_DIR")"
APP_DATABASE_PATH="$(resolve_env_value APP_DATABASE_PATH "")"
APP_UPLOADS_DIR="$(resolve_env_value APP_UPLOADS_DIR "")"

DATABASE_PATH="$(resolve_path "$APP_DATABASE_PATH" "${APP_DATA_DIR%/}/atos.db")"
UPLOADS_DIR="$(resolve_path "$APP_UPLOADS_DIR" "${APP_DATA_DIR%/}/uploads")"

log "Creating backup in $BACKUP_DIR"

if [ -f "$DATABASE_PATH" ]; then
    mkdir -p "$BACKUP_DIR/database"
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$DATABASE_PATH" ".backup '$BACKUP_DIR/database/$(basename "$DATABASE_PATH")'"
    else
        cp -a "$DATABASE_PATH" "$BACKUP_DIR/database/"
    fi
else
    log "Database not found at $DATABASE_PATH"
fi

copy_if_exists "$UPLOADS_DIR" "$BACKUP_DIR/runtime"
copy_if_exists "$APP_DIR/.env" "$BACKUP_DIR/config"
copy_if_exists "$SERVER_DIR/.env" "$BACKUP_DIR/config/server"
copy_if_exists "$APP_DIR/deploy" "$BACKUP_DIR/config"
copy_if_exists "$APP_DIR/nginx-performance-snippet.conf" "$BACKUP_DIR/config"

{
    printf 'timestamp=%s\n' "$TIMESTAMP"
    printf 'app_dir=%s\n' "$APP_DIR"
    printf 'server_dir=%s\n' "$SERVER_DIR"
    printf 'database_path=%s\n' "$DATABASE_PATH"
    printf 'uploads_dir=%s\n' "$UPLOADS_DIR"
    git -C "$APP_DIR" rev-parse HEAD 2>/dev/null | sed 's/^/git_commit=/'
} > "$BACKUP_DIR/manifest.txt"

tar -C "$BACKUP_ROOT" -czf "$BACKUP_ROOT/oryon-backup-$TIMESTAMP.tar.gz" "$TIMESTAMP"

log "Backup archive created: $BACKUP_ROOT/oryon-backup-$TIMESTAMP.tar.gz"
