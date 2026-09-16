# Typebot Presence and Conversion Flow Design

## Goal

Make the Atos WhatsApp introduction feel human without asking the customer questions or trying to interpret free-form replies.

The presentation must:

- run only once per WhatsApp contact;
- remain linear and informational;
- show `composing` before text and `recording` before audio;
- never restart because the customer sent a message during or after the presentation;
- finish with a clear handoff to human service;
- preserve all commercial facts, prices, deadlines, links and media.

## Current Behavior

The Typebot has one linear group, `Atendimento unico`, with nine `Wait` blocks, two MP3 audio blocks and no input block. The explicit waits total 43 seconds; the two audios total about 50 seconds.

Evolution receives each Typebot `Wait` as a client-side action. Its Typebot integration waits after sending the preceding bubble, but does not publish WhatsApp presence during that interval. Audio is correctly received as `message.type === "audio"` and sent through `audioWhatsapp`; `recording` is therefore shown only for the integration's `delayMessage`, currently preserved by Oryon with a 1000 ms default.

The existing once-per-contact implementation is already the correct lifecycle: `keepOpen: true` and no expiry preserve a closed session for the contact, so later messages do not restart the presentation.

## Chosen Architecture

Use Typebot HTTP Request blocks as presence-aware waits. Do not add another Oryon API endpoint and do not fork Evolution API.

Evolution already starts the Typebot session with these prefilled variables:

- `remoteJid`
- `instanceName`
- `serverUrl`
- `apiKey`

Each current `Wait` will be replaced by an HTTP request to:

```text
POST {{serverUrl}}/chat/sendPresence/{{instanceName}}
```

Headers:

```text
apikey: {{apiKey}}
Content-Type: application/json
```

Body for text:

```json
{
  "number": "{{remoteJid}}",
  "presence": "composing",
  "delay": 2000
}
```

Body for audio:

```json
{
  "number": "{{remoteJid}}",
  "presence": "recording",
  "delay": 5000
}
```

The Evolution endpoint holds the presence for `delay` milliseconds and then returns to `paused`. Because the HTTP Request waits for the response, it replaces the Typebot `Wait`; keeping both would double the delay.

The HTTP Request must execute server-side in Typebot, not in the customer's browser. Before editing the production flow, verify that `serverUrl` resolves to the public Evolution address reachable by Typebot Cloud.

The Evolution API key remains a runtime variable supplied by Evolution. It must not be hard-coded into the Typebot, stored in Oryon frontend code, printed in logs or added to the repository.

## Commercial Sequence

The flow stays automatic and asks no questions that Typebot must understand.

| Order | Content | Presence before sending | Delay |
| --- | --- | --- | --- |
| 1 | Greeting from Celso and Atos | none | none |
| 2 | Short introduction to the first audio | `composing` | 2 s |
| 3 | First MP3, about the material | `recording` | 5 s |
| 4 | Price ranges | `composing` | 2.5 s |
| 5 | Instagram invitation and link | `composing` | 2 s |
| 6 | Delivery information | `composing` | 2.5 s |
| 7 | Second MP3 | `recording` | 5 s |
| 8 | Size-table introduction | `composing` | 2 s |
| 9 | Size-table image | none | none |
| 10 | Short closing statement | `composing` | 1.8 s |
| 11 | Human handoff call to action | `composing` | 2 s |

The final call to action will not be a Typebot input. It should tell the customer what to send next and make clear that a person will continue the service. Recommended copy:

> Pronto, agora voce ja conhece os materiais, valores, entrega e tamanhos. Quando quiser comecar, envie a quantidade e o modelo que deseja. A partir daqui, nossa equipe continua com voce.

The first implementation should preserve the current audio files and all current business values. Text changes are limited to shortening transitions, combining the Instagram invitation with its link and replacing the final question with the handoff copy above.

## Messages During the Presentation

Customer messages received while the presentation is running must not create a new Typebot session, restart the flow or select a branch. The linear sequence completes once. After completion, the preserved closed session prevents another automatic run, and the human team handles subsequent messages.

## Failure Behavior

Presence is an enhancement, not a delivery dependency. Verification must confirm that a failed or timed-out presence request does not permanently block the next Typebot message. If the native HTTP Request block cannot continue after a presence failure, the fallback is one small Oryon proxy that always completes the intended delay and returns `204`, while recording the Evolution failure server-side without exposing secrets.

No silent retries should lengthen the presentation or send a message twice.

## Verification

Before publishing:

1. Test the unpublished Typebot with a dedicated WhatsApp contact.
2. Confirm each text status is `composing` for the configured duration.
3. Confirm each MP3 status is `recording` for five seconds before delivery.
4. Confirm there is no doubled delay from a remaining `Wait` block.
5. Send unrelated messages while the sequence is running and confirm the flow neither restarts nor branches.
6. Send another message after completion and confirm the presentation does not run again.
7. Temporarily test an invalid presence target in a duplicate unpublished flow and confirm the following message still proceeds, or activate the proxy fallback.
8. Confirm both MP3s, the size-table image, prices, delivery terms and Instagram link still render correctly.

Publish only after the full WhatsApp test passes. Do not disconnect or recreate the `AtosVendas` instance.
