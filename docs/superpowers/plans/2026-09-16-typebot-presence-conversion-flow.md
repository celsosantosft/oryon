# Typebot Presence and Conversion Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Atos WhatsApp introduction run once per contact with natural `composing` and `recording` presence, a shorter linear sales sequence and a final handoff to a human.

**Architecture:** Replace Typebot `Wait` blocks with server-side HTTP Request blocks that call Evolution API's existing `/chat/sendPresence/:instanceName` endpoint using runtime variables already supplied by Evolution. Build and publish a duplicate Typebot first, test it through Evolution with a dedicated WhatsApp contact, then reproduce the verified configuration in the existing production Typebot without changing its public ID or Evolution integration identity.

**Tech Stack:** Typebot Cloud editor, Evolution API Typebot integration, WhatsApp/Baileys presence, Node.js diagnostic client already present in Oryon.

**Spec:** `docs/superpowers/specs/2026-09-16-typebot-presence-conversion-flow-design.md`

## Global Constraints

- The presentation runs only once per WhatsApp `remoteJid`.
- The flow is linear and contains no input, button, condition or free-form reply interpretation.
- Use `composing` before text and `recording` before MP3 audio.
- A presence HTTP Request replaces its corresponding `Wait`; never keep both.
- Preserve both MP3 files, the size-table image, all prices, delivery terms and the Instagram link.
- Keep the existing production Typebot public ID and Evolution integration ID so closed once-per-contact sessions remain valid.
- Do not disconnect or recreate the `AtosVendas` WhatsApp instance.
- Execute Typebot HTTP Requests server-side. Never enable `Execute on client`.
- Reference the runtime `apiKey` variable; never hard-code, display, log or commit its value.
- Do not publish the production Typebot until the user confirms at the publication step.
- A credential-like value is currently tracked in `server/test_typebot.js`. Treat it as exposed and handle removal and coordinated rotation in a separate security change before production publication.

## File And Surface Map

- External Typebot `My typebot` (`cmt3ubh7600000akozthm8qvg`): production flow to modify only after staging passes.
- External Typebot duplicate `My typebot - presence test 2026-09-16`: staging flow for presence, failure and WhatsApp tests.
- External Typebot duplicate `My typebot - backup 2026-09-16`: untouched rollback copy of the original flow.
- Evolution API instance `AtosVendas`: starts the staging Typebot for one dedicated test contact and provides runtime variables.
- `server/config/evolution.js`: existing secret-safe Evolution client used only for a local smoke-test command.
- `docs/oryon-brain/integrations/typebot.md`: already records the durable behavior; update only if verified production behavior differs from the approved spec.

---

### Task 1: Create Safe Typebot Staging And Rollback Copies

**Files:**
- No repository files.
- Create in Typebot: `My typebot - backup 2026-09-16`
- Create in Typebot: `My typebot - presence test 2026-09-16`

**Interfaces:**
- Consumes: production Typebot `cmt3ubh7600000akozthm8qvg`.
- Produces: one untouched backup and one editable staging public ID.

- [ ] **Step 1: Record the production baseline**

Open the production editor and verify the visible order is:

```text
Greeting
Wait 4s
Audio introduction text
Wait 5s
MP3 1
Wait 10s
Price ranges
Wait 3s
Instagram introduction
Instagram link
Wait 3s
Delivery information
Wait 5s
MP3 2
Wait 7s
Size-table introduction
Size-table image
Wait 3s
Closing statement
Wait 3s
Final call to action
```

Expected: two audio blocks load, the first is about 34.7 seconds and the second about 15.3 seconds.

- [ ] **Step 2: Duplicate the production Typebot twice**

From the Typebot dashboard, duplicate `My typebot` twice. Rename the copies exactly:

```text
My typebot - backup 2026-09-16
My typebot - presence test 2026-09-16
```

Expected: both duplicates have the same 21-block sequence and media as production.

- [ ] **Step 3: Keep the backup untouched**

Do not publish or edit `My typebot - backup 2026-09-16`. Open only the staging copy for all following tasks.

- [ ] **Step 4: Record the existing business variables**

Open the staging variables drawer and confirm these existing variables remain selectable:

```text
QuantidadeExata
MalhaEscolhida
NomeCliente
```

Expected: no existing variable is renamed or deleted.

- [ ] **Step 5: Create the Evolution runtime variables in staging**

Create four empty Typebot variables with these exact case-sensitive names:

```text
remoteJid
instanceName
serverUrl
apiKey
```

Expected: all four names exist beside the three business variables. Leave their default values empty; Evolution fills them when the WhatsApp session starts.

---

### Task 2: Prove One Presence-Aware Wait In Staging

**Files:**
- Modify in Typebot: `My typebot - presence test 2026-09-16`

**Interfaces:**
- Consumes: runtime variables confirmed in Task 1.
- Produces: one server-side presence request immediately before MP3 1.

- [ ] **Step 1: Replace only the `Wait 5s` before MP3 1**

Delete that single `Wait 5s` block and add an `HTTP request` block in the same position. Configure:

```text
Method: POST
URL: {{serverUrl}}/chat/sendPresence/{{instanceName}}
Execute on client: disabled
Header name: apikey
Header value: {{apiKey}}
Header name: Content-Type
Header value: application/json
```

Use this JSON body:

```json
{
  "number": "{{remoteJid}}",
  "presence": "recording",
  "delay": 5000
}
```

Expected: the HTTP block is connected between the audio-introduction text and MP3 1, with no `Wait` beside it.

- [ ] **Step 2: Verify server-side execution**

Reopen the HTTP block and confirm `Execute on client` remains disabled.

Expected: the Evolution API key is referenced only as `{{apiKey}}`; no literal credential appears in the block.

- [ ] **Step 3: Publish only the staging duplicate**

Publish `My typebot - presence test 2026-09-16` and copy its generated public ID from the Share page.

Expected: production `My typebot` still shows its previous published version and public ID.

---

### Task 3: Run The Minimal WhatsApp Presence Test

**Files:**
- Read: `server/config/evolution.js`
- No repository modifications.

**Interfaces:**
- Consumes: staging public ID from Task 2 and a dedicated WhatsApp test number supplied interactively.
- Produces: evidence that Typebot Cloud can reach `serverUrl` and show five seconds of `recording`.

- [ ] **Step 1: Collect test values without persisting them**

From PowerShell in `C:\oryon`, run:

```powershell
$env:TYPEBOT_TEST_NUMBER = Read-Host 'Numero WhatsApp de teste com DDI e DDD'
$env:TYPEBOT_TEST_ID = Read-Host 'Public ID do Typebot de teste'
```

Expected: values exist only in the current shell process and are not written to a file.

- [ ] **Step 2: Start the staging flow through Evolution**

Run this command from `C:\oryon`:

```powershell
node -e "const {createEvolutionClient,EVOLUTION_INSTANCE}=require('./server/config/evolution'); const run=async()=>{const number=process.env.TYPEBOT_TEST_NUMBER.replace(/\D/g,'')+'@s.whatsapp.net'; const id=process.env.TYPEBOT_TEST_ID; const api=createEvolutionClient({timeout:120000}); const found=await api.get('/typebot/find/'+encodeURIComponent(EVOLUTION_INSTANCE)); const bots=Array.isArray(found.data)?found.data:found.data.typebot; const primary=bots.find((bot)=>bot.enabled); if(!primary) throw new Error('Integracao Typebot ativa nao encontrada'); await api.post('/typebot/changeStatus/'+encodeURIComponent(EVOLUTION_INSTANCE),{remoteJid:number,status:'delete'}).catch(()=>{}); await api.post('/typebot/start/'+encodeURIComponent(EVOLUTION_INSTANCE),{remoteJid:number,url:primary.url,typebot:id}); console.log('Fluxo de teste iniciado.');}; run().catch((error)=>{console.error(error.response?.data||error.message);process.exit(1);});"
```

Expected: terminal prints `Fluxo de teste iniciado.` and the dedicated phone receives the staging presentation.

- [ ] **Step 3: Observe the first-audio transition**

On the dedicated phone, time the transition after the text announcing the audio.

Expected:

```text
Gravando audio... appears for about 5 seconds.
MP3 1 arrives once.
The old extra 5-second silent Wait does not occur.
```

- [ ] **Step 4: Inspect staging logs**

Open staging Results and inspect the latest submission logs.

Expected: no HTTP, media or session error is present.

Stop here if the HTTP Request fails, Typebot cannot reach `serverUrl`, or the flow blocks. Do not add the remaining presence blocks until this single request works.

---

### Task 4: Apply The Full Presence Schedule And Sales Copy In Staging

**Files:**
- Modify in Typebot: `My typebot - presence test 2026-09-16`

**Interfaces:**
- Consumes: verified HTTP Request structure from Task 3.
- Produces: complete staging flow with no `Wait` blocks.

- [ ] **Step 1: Create the reusable composing request configuration**

For every text delay below, use the same URL and headers from Task 2 with this body, changing only `delay`:

```json
{
  "number": "{{remoteJid}}",
  "presence": "composing",
  "delay": 2000
}
```

Expected: all composing requests execute server-side.

- [ ] **Step 2: Replace every remaining Wait using this exact mapping**

```text
Old Wait 4s before audio introduction -> composing 2000 ms
Old Wait 10s before prices -> composing 2500 ms
Old Wait 3s before Instagram -> composing 2000 ms
Old Wait 3s before delivery -> composing 2500 ms
Old Wait 5s before MP3 2 -> recording 5000 ms
Old Wait 7s before size-table introduction -> composing 2000 ms
Old Wait 3s before closing -> composing 1800 ms
Old Wait 3s before final CTA -> composing 2000 ms
```

Expected: searching the staging canvas for `Wait for` returns no blocks.

- [ ] **Step 3: Shorten the first-audio transition**

Replace the current introduction with:

```text
Vou te mandar um audio rapido para explicar como funciona nosso material.
```

Expected: the statement makes no promise that Typebot must interpret.

- [ ] **Step 4: Combine the Instagram introduction and link**

Replace the two current blocks with one text block:

```text
Veja alguns dos nossos trabalhos no Instagram:
https://www.instagram.com/atosfardamentos
```

Expected: the URL remains clickable and is sent once.

- [ ] **Step 5: Replace the final question with human handoff copy**

Use exactly:

```text
Pronto, agora voce ja conhece os materiais, valores, entrega e tamanhos. Quando quiser comecar, envie a quantidade e o modelo que deseja. A partir daqui, nossa equipe continua com voce.
```

Expected: there is no input block after this message and no question that Typebot must answer.

- [ ] **Step 6: Verify protected business content**

Compare staging with production and confirm these remain unchanged:

```text
Both MP3 source URLs
Both MP3 durations
All Dryfit and Cacharrel price ranges
15-business-day delivery statement and delivery methods
Size-table image
```

- [ ] **Step 7: Publish the updated staging duplicate**

Publish staging again.

Expected: the staging public ID is unchanged.

---

### Task 5: Verify Failure Behavior And Complete WhatsApp UX

**Files:**
- Modify temporarily in Typebot: `My typebot - presence test 2026-09-16`
- Restore before task completion.

**Interfaces:**
- Consumes: full staging flow from Task 4.
- Produces: verified success path and a decision on whether the Oryon proxy fallback is necessary.

- [ ] **Step 1: Run the complete staging flow again**

Delete only the dedicated contact's staging session with the same `changeStatus` command from Task 3, then start staging again.

Expected:

```text
Text transitions show Digitando... for their configured duration.
Both audio transitions show Gravando audio... for about 5 seconds.
Every message and media item arrives exactly once and in order.
The complete presentation is shorter than the original.
```

- [ ] **Step 2: Send unrelated messages during the presentation**

From the dedicated phone, send two ordinary messages while MP3 1 or a presence delay is running.

Expected: the presentation does not restart, branch or repeat any earlier message.

- [ ] **Step 3: Confirm once-per-contact after completion**

After the final handoff message, send one more message from the dedicated phone.

Expected: Typebot sends nothing and the message remains available for human handling.

- [ ] **Step 4: Test a failed presence request**

In staging only, change one composing request's URL suffix from:

```text
/chat/sendPresence/{{instanceName}}
```

to:

```text
/chat/sendPresence-invalid/{{instanceName}}
```

Publish staging, clear the dedicated test session and start it again.

Expected: record whether Typebot continues to the next message or stops at the failed request.

- [ ] **Step 5: Restore the valid URL immediately**

Restore `/chat/sendPresence/{{instanceName}}` and republish staging.

Expected: a final staging run succeeds with no error logs.

- [ ] **Step 6: Decide the fallback from evidence**

If Typebot continued after the intentional failure, keep the direct architecture and add no Oryon code.

If Typebot stopped, pause implementation and add a separate bounded design for one authenticated Oryon proxy that catches the Evolution failure, waits for the requested duration and returns `204`. Do not publish production with a failure mode that can block customer messages.

---

### Task 6: Reproduce The Verified Flow In Production

**Files:**
- Modify in Typebot: production `My typebot` (`cmt3ubh7600000akozthm8qvg`)
- Read: staging and untouched backup copies.

**Interfaces:**
- Consumes: fully verified staging configuration from Task 5.
- Produces: unpublished production draft with identical blocks and copy.

- [ ] **Step 1: Apply the verified request blocks to production**

Create the four empty production variables `remoteJid`, `instanceName`, `serverUrl` and `apiKey`, then reproduce the nine staging HTTP Request blocks in the same positions. Copy only variable references and JSON structure; never copy a runtime variable value.

Expected: production contains no `Wait for` blocks and still uses public ID `cmt3ubh7600000akozthm8qvg`.

- [ ] **Step 2: Apply the three approved text changes**

Copy from staging:

```text
Short first-audio transition
Combined Instagram message and link
Final human handoff message
```

Expected: prices, delivery facts, media and all other copy remain unchanged.

- [ ] **Step 3: Compare production draft against staging**

Verify block-by-block:

```text
same order
same presence types
same delay values
same headers expressed as variables
same media URLs
same final handoff
no input or condition blocks
```

Expected: production has unpublished changes and the existing published customer flow is still active.

- [ ] **Step 4: Request action-time publication confirmation**

Show the user the final unpublished production summary and ask for confirmation immediately before clicking `Publish`.

Expected: do not publish without that confirmation.

- [ ] **Step 5: Publish production**

After confirmation, click `Publish` once and wait for the success state.

Expected: published public ID remains `cmt3ubh7600000akozthm8qvg`.

---

### Task 7: Production Smoke Test And Closeout

**Files:**
- Verify: `docs/oryon-brain/integrations/typebot.md`
- Modify only if production behavior differs from the documented behavior.

**Interfaces:**
- Consumes: published production flow from Task 6.
- Produces: verified production behavior, retained rollback copy and clean repository state.

- [ ] **Step 1: Run production with a fresh dedicated contact**

Use a contact without an existing closed Typebot session, or explicitly delete only the dedicated test contact's session before starting.

Expected: all text and audio presence states match staging.

- [ ] **Step 2: Verify production once-per-contact behavior**

Send a message after the final handoff.

Expected: the presentation does not restart and Typebot sends no automated interpretation.

- [ ] **Step 3: Inspect Typebot Results and Evolution health**

Confirm the production submission has no logs and the `AtosVendas` instance remains connected.

Expected: no duplicate message, HTTP error, media error or connection interruption.

- [ ] **Step 4: Preserve rollback**

Keep `My typebot - backup 2026-09-16` unchanged until production has operated successfully for at least one business day. Do not delete it as part of this implementation.

- [ ] **Step 5: Verify repository state**

Run:

```powershell
git status --short
git log -1 --oneline
```

Expected: no uncommitted files were created by the Typebot UI work. If the memory note required a verified correction, commit only that note and push it after `git diff --check` passes.
