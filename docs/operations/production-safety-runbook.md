# Oryon production safety runbook

This runbook is the first safety layer before SaaS hardening work. Use it before deploys, database migrations, security changes, or onboarding a new customer installation.

## Current production model

Oryon currently runs as dedicated installations per customer. Each installation should have its own domain, `.env`, data directory, SQLite database, uploads directory, JWT secret, Evolution API settings, and PM2 process.

Do not migrate the two active customers to a shared database until backups, staging, smoke tests, and a rollback path have been verified.

## Minimum backup command

Run from each production installation:

```bash
cd /var/www/oryon
bash scripts/backup-production.sh
```

For a secondary installation:

```bash
cd /var/www/pd-fardamentos
bash scripts/backup-production.sh
```

The backup archive is written to `.backups/production/oryon-backup-YYYYMMDD-HHMMSS.tar.gz` by default. Override the target when needed:

```bash
BACKUP_ROOT=/var/backups/oryon/atos bash scripts/backup-production.sh
```

## What the backup includes

- SQLite database from `APP_DATABASE_PATH`, or `APP_DATA_DIR/atos.db`, or `server/atos.db`.
- Uploads from `APP_UPLOADS_DIR`, or `APP_DATA_DIR/uploads`, or `server/uploads`.
- Root `.env` and `server/.env` when present.
- Deployment and Nginx reference files.
- A `manifest.txt` with source paths and Git commit.

## Before any production change

1. Run the backup script for every active customer installation.
2. Copy the archive off the VPS or into a protected backup location.
3. Confirm the archive contains `manifest.txt`, database, config, and uploads.
4. Run the change in staging first when the change touches database, auth, uploads, deploy, or public routes.
5. Keep the previous production archive until the new release has been used successfully.

## Restore outline

1. Stop the PM2 process for the affected installation.
2. Extract the selected backup archive into a temporary directory.
3. Restore the `.env` files to the installation path.
4. Restore the database and uploads to the paths shown in `manifest.txt`.
5. Start the PM2 process and check `/login` plus core API smoke tests.

Never test restore for the first time during an incident. Use staging to rehearse it.
