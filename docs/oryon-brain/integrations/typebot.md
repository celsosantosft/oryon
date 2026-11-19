# WhatsApp e Typebot

## Architecture

- Oryon talks to Typebot through the Evolution API and the WhatsApp instance `AtosVendas`.
- A connected WhatsApp instance and a saved Typebot configuration are separate states.

## Once Per Contact

- When enabled, identify the contact by its WhatsApp `remoteJid`.
- Start the configured flow once. After the flow closes, later messages from the same contact must not restart it.
- A future administrative reset may explicitly release that contact to run the flow again.
- The current configuration represents this with `keepOpen: true` and no session expiry.
- Saving preserves the primary bot identity and sessions; obsolete duplicate integrations for the same URL and Typebot ID are removed first.

## Safety

- Never expose the Evolution API key in frontend code or memory notes.
- Do not disconnect or recreate the WhatsApp instance merely to change Typebot behavior.

## Webhook Load

- Subscribe only to events consumed by Oryon. High-volume update events that produced no state changes previously saturated the shared Node/SQLite request path and delayed the ERP.
- Keep new and sent messages, initial chat/contact sets, labels, QR code, startup and connection events enabled.

## Meta conversion signals

- Qualification sends a lead; the first paid deposit confirms one Purchase per order, at full order value. Never count an installment as another purchase.
- Purchases require order acquisition_source=meta_ads. Unknown origins wait for classification; organic, referral, returning-customer and store/other orders never send purchases. The phone alone is not an ad-origin signal.
- Manual and label qualification for the same conversation share duplicate protection. Success requires Meta's event receipt; retries preserve the original payload and time.
- WhatsApp messaging conversions require an explicitly configured WABA-linked dataset, Page and permissions. Use real click metadata from stored incoming messages when available; never manufacture ad identifiers.
- A purchase needs an explicit, unambiguous order/conversation link and incoming message before payment to use messaging attribution. API receipt does not prove ad attribution or purchase optimization.
- Creating/editing an order links its WhatsApp phone automatically; ambiguous phone matches are not guessed. Webhook contact/click signals retain minimal metadata without importing full message content or sending messages to the customer.
- Setup and validation: `docs/meta-purchase-on-deposit.md`.
- The ATOS WhatsApp page focuses on lead history, manual qualification, automatic purchases and connection. Audio/Typebot integrations remain available to the existing PD screen and are not changed or disconnected by the ATOS page simplification. Branding-specific UI is not a substitute for isolated Meta credentials.
