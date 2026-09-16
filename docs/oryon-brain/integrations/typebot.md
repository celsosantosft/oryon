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
