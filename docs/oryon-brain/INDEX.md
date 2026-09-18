# Oryon Brain

Read this index first, then open only the note related to the current task.

## Project

Oryon is the production ERP for Atos Fardamentos. The live system is `https://atosfardamentos.com.br`; the repository copy is in `C:\oryon`.

## Task Routing

- Cutting queue, fabric sections, markers and spreading: [[domains/corte]]
- Orders, quotes, tracking codes and customer portal: [[domains/pedidos]]
- WhatsApp, Evolution API and Typebot: [[integrations/typebot]]
- Production hosting, SSH, firewall and availability incidents: [[operations/infrastructure]]

## Stable Working Rules

- Use real system data. Never add demonstrations, mock orders or silent fake fallbacks to operational screens.
- Prefer the smallest change that preserves existing behavior.
- Mobile workflows are important, especially for production users.
- Never expose or record secrets in frontend code, logs or this vault.
- Verify changes before commit and push.

## Memory Policy

Add only durable facts that will matter in future tasks. Put implementation details in code and Git history, not here. When a note conflicts with current code or a newer user instruction, the newer verified source wins.
