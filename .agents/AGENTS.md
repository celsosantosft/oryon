# Oryon ERP - Project Context

- **System Overview**: Oryon is a web ERP system (orders, production, finance, customer portal, WhatsApp integration).
- **Tech Stack**: Frontend is Vite + React (`client/`), Backend is Express + SQLite (`server/`).
- **Multi-Tenancy Model**: The system is now a product sold to multiple clients. It runs the same codebase deployed to separate folders on the VPS (e.g., `/var/www/oryon` and `/var/www/pd-fardamentos`), each managed by separate PM2 processes and configured via independent `.env` files.
- **Current Clients**: 
  - **Atos** (Primary/Original)
  - **PD Fardamentos** (New Secondary Client - uses monochrome theme and separate DB/logos)
- **Deployment**: Automatic via GitHub Actions. Deploys update both installations concurrently on the VPS.
