# Google Calendar Order Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize generated orders with a dedicated company Google Calendar and manage the integration from `Entregas da Semana`.

**Architecture:** Order routes write idempotent synchronization intents to SQLite after successful local changes. A focused worker reconciles those intents with Google Calendar through an OAuth provider adapter, so Google failures never duplicate or roll back orders. The React delivery page exposes administrator-only connection, reminder, health, retry, and open-calendar controls.

**Tech Stack:** Node.js 22 CommonJS, Express 5, SQLite3, Axios, Node `crypto`, React 19, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-google-calendar-order-sync-design.md`

## Global Constraints

- Quotes never create calendar events; only generated orders do.
- Use one dedicated `Entregas Oryon` calendar per tenant, never the company's primary calendar.
- Store Google credentials only encrypted on the server; never expose or log tokens.
- Allow one to five unique reminder offsets from 0 through 28 days; default to `7, 5, 3, 1, 0`.
- Order creation and updates succeed when Google is unavailable; synchronization is retried separately.
- Delivery, cancellation, deletion, and quote reversion remove the corresponding event.
- Preserve one event per tenant/order through unique local mapping and Google private extended properties.
- Only administrators can connect, configure, retry, or disconnect Google Calendar.
- Do not place portal tokens, financial details, or unnecessary customer data in events.

## Review Focus

- A retry after Google created an event but Oryon missed the response must recover that event instead of creating a duplicate; Task 4 tests reconciliation by private order property.
- A delivery or cancellation queued while an upsert is pending must make deletion the final desired operation; Task 4 tests last-write-wins queue behavior.
- Missing or malformed delivery dates must not create invalid Google events or block orders; Tasks 4 and 5 test the skipped state and later recovery.
- A revoked refresh token must mark the integration as reconnect-required while order APIs keep succeeding; Tasks 2, 4, and 5 test this boundary.
- Hard deletion before Google responds must retain enough tombstone data to remove the remote event; Tasks 1, 4, and 5 test mapping survival.

---

### Task 1: Calendar Configuration And Persistence

**Files:**
- Create: `server/utils/calendarSettings.js`
- Create: `server/test/calendar-settings.test.js`
- Modify: `server/config/appConfig.js`
- Modify: `server/database.js`
- Modify: `.env.example`

**Interfaces:**
- Produces: `DEFAULT_REMINDER_DAYS: number[]` and `normalizeReminderDays(values): number[]`.
- Produces: `appConfig.tenantKey: string` from `APP_TENANT_KEY`, falling back to the normalized order prefix.
- Produces tables `calendar_integrations`, `calendar_oauth_sessions`, and `order_calendar_events` with unique `(tenant_key, order_id)` mapping.

- [ ] **Step 1: Write reminder validation and schema contract tests**

Test `normalizeReminderDays([0, 7, 3, 7, 1])` returns `[7, 3, 1, 0]`; reject empty arrays, more than five unique values, decimals, negatives, and values above 28. Assert the database bootstrap source defines encrypted credential fields, one-time OAuth session expiry, unique tenant/order mapping, desired operation, retry metadata, event ID, and deletion tombstone columns.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd server && node --test test/calendar-settings.test.js`

Expected: FAIL because `calendarSettings.js` and the new schema do not exist.

- [ ] **Step 3: Implement settings normalization, tenant configuration, and additive tables**

Use integer SQLite columns for flags and retry counts, JSON text for reminder offsets and desired event snapshots, and no cascading foreign key from `order_calendar_events` to `orders` so deletion tombstones survive.

- [ ] **Step 4: Run focused and server regression tests**

Run: `cd server && node --test test/calendar-settings.test.js && npm test`

Expected: PASS with existing databases upgraded through `CREATE TABLE IF NOT EXISTS` and additive column guards.

- [ ] **Step 5: Commit**

```bash
git add .env.example server/config/appConfig.js server/database.js server/utils/calendarSettings.js server/test/calendar-settings.test.js
git commit -m "feat: add calendar integration persistence"
```

### Task 2: Secure Google Calendar Provider Adapter

**Files:**
- Create: `server/services/googleCalendarClient.js`
- Create: `server/test/google-calendar-client.test.js`

**Interfaces:**
- Consumes: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, and `CALENDAR_TOKEN_ENCRYPTION_KEY`.
- Produces: `encryptCredential(value, key)` and `decryptCredential(payload, key)` using AES-256-GCM.
- Produces: `createGoogleCalendarClient({ http, config, now })` with methods `buildAuthorizationUrl(session)`, `exchangeCode(code, verifier)`, `refreshAccessToken(refreshToken)`, `ensureDeliveryCalendar(accessToken)`, `findOrderEvent(accessToken, calendarId, tenantKey, orderId)`, `insertEvent(...)`, `updateEvent(...)`, `deleteEvent(...)`, and `revokeToken(...)`.

- [ ] **Step 1: Write provider adapter tests with a fake Axios client**

Cover encryption round-trip and tamper rejection, PKCE authorization URL parameters, token exchange without leaking credentials, creation/reuse of `Entregas Oryon`, private-property event lookup, 404-as-success on deletion, API error sanitization, and revoked-token classification as `reconnect_required`.

- [ ] **Step 2: Run the provider test and verify RED**

Run: `cd server && node --test test/google-calendar-client.test.js`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapter with existing Axios and Node crypto**

Keep HTTP details inside this file. Do not add a Google SDK dependency. Validate the encryption key at use time so the disabled integration cannot prevent server startup, while an attempted connection with missing configuration returns a clear administrator error.

- [ ] **Step 4: Run provider and security tests**

Run: `cd server && node --test test/google-calendar-client.test.js test/security-regressions.test.js`

Expected: PASS with no secret values in errors or serialized responses.

- [ ] **Step 5: Commit**

```bash
git add server/services/googleCalendarClient.js server/test/google-calendar-client.test.js
git commit -m "feat: add secure Google Calendar client"
```

### Task 3: Administrator OAuth And Settings API

**Files:**
- Create: `server/routes/calendar.js`
- Create: `server/test/calendar-routes.test.js`
- Modify: `server/server.js`

**Interfaces:**
- Consumes: Task 1 settings/schema and Task 2 provider adapter.
- Produces: `GET /api/calendar/integration`, `POST /api/calendar/oauth/start`, `GET /api/calendar/oauth/callback`, `PUT /api/calendar/integration`, and `DELETE /api/calendar/integration`.
- Returns only `{ configured, account_email, calendar_name, calendar_url, reminder_days, health }`; never credential fields.

- [ ] **Step 1: Write route behavior tests**

Use a temporary Express server and injected fake provider/database. Assert administrator authorization on every mutating endpoint, single-use state and PKCE callback validation, dedicated calendar creation, reminder normalization, safe redirect to `/deliveries?calendar=connected|error`, safe status serialization, and token revocation on disconnect.

- [ ] **Step 2: Run route tests and verify RED**

Run: `cd server && node --test test/calendar-routes.test.js`

Expected: FAIL because the routes are not mounted.

- [ ] **Step 3: Implement and mount the calendar router**

Store only a hash of OAuth state plus its verifier and expiry. Consume the session transactionally before token exchange. Create the dedicated calendar once, encrypt the refresh token, and return a non-sensitive browser redirect.

- [ ] **Step 4: Run route, authentication, and full server tests**

Run: `cd server && node --test test/calendar-routes.test.js test/security.test.js && npm test`

Expected: PASS; disconnected installations continue starting without Google environment variables.

- [ ] **Step 5: Commit**

```bash
git add server/routes/calendar.js server/test/calendar-routes.test.js server/server.js
git commit -m "feat: add Google Calendar administration API"
```

### Task 4: Idempotent Order Calendar Synchronization Worker

**Files:**
- Create: `server/services/orderCalendarSync.js`
- Create: `server/test/order-calendar-sync.test.js`
- Modify: `server/routes/calendar.js`
- Modify: `server/test/calendar-routes.test.js`
- Modify: `server/server.js`

**Interfaces:**
- Consumes: calendar integration rows and Task 2 provider methods.
- Produces: `buildOrderCalendarEvent(order, reminderDays, context)`.
- Produces: `createOrderCalendarSyncService({ db, calendarClient, tenantKey, publicAppUrl, now })` with `enqueueUpsert(orderId)`, `enqueueDelete(orderId, snapshot)`, `processDue(limit)`, `retryFailed()`, `start()`, and `stop()`.
- Produces administrator-only `POST /api/calendar/integration/retry` and `POST /api/calendar/integration/sync-active` endpoints.

- [ ] **Step 1: Write event formatting and worker tests**

Assert all-day start/end dates, tenant-specific tracking prefix, sanitized description, reminder conversion to minutes, content fingerprint stability, one event for repeated upserts, recovery after ambiguous create through private properties, update on changed delivery data, delete last-write-wins, invalid-date skip, deletion tombstone cleanup, bounded exponential backoff, reconnect-required handling, and tenant isolation.

- [ ] **Step 2: Run worker tests and verify RED**

Run: `cd server && node --test test/order-calendar-sync.test.js`

Expected: FAIL because the worker does not exist.

- [ ] **Step 3: Implement queue reconciliation and the one-minute worker**

Use atomic claims from `pending`/due `failed` to `processing`, reset stale processing rows on startup, and cap each batch. Before insert, search by private tenant/order properties whenever no event ID is stored. An upsert fingerprint match is a no-op. A successful delete clears the event ID and retains a compact audit row.

- [ ] **Step 4: Start and stop the worker from the server lifecycle**

Start after database initialization, call `.unref()` on the interval, and no-op when no integration is enabled. Export `stop()` for tests and graceful shutdown hooks.

- [ ] **Step 5: Add retry and active-order synchronization routes**

Assert administrator authorization, retry rate limiting, and active-future-order backfill without historical or terminal orders in `calendar-routes.test.js`, then connect the endpoints to `retryFailed()` and idempotent `enqueueUpsert()` calls.

- [ ] **Step 6: Run worker and full server tests**

Run: `cd server && node --test test/order-calendar-sync.test.js && npm test`

Expected: PASS without open interval handles keeping the test process alive.

- [ ] **Step 7: Commit**

```bash
git add server/services/orderCalendarSync.js server/test/order-calendar-sync.test.js server/routes/calendar.js server/test/calendar-routes.test.js server/server.js
git commit -m "feat: synchronize orders with Google Calendar"
```

### Task 5: Connect Every Order Lifecycle Path

**Files:**
- Create: `server/test/order-calendar-lifecycle.test.js`
- Modify: `server/routes/orders.js`
- Modify: `server/routes/quotes.js`
- Modify: `server/routes/reverterPedidoParaOrcamento.js`

**Interfaces:**
- Consumes: `enqueueUpsert(orderId)` and `enqueueDelete(orderId, snapshot)` from Task 4.
- Produces: calendar intent after direct creation, quote conversion, edit, terminal status, reset/reopen, deletion, and quote reversion.

- [ ] **Step 1: Write lifecycle tests before modifying routes**

Assert no intent for quote creation/edit, one upsert after direct order creation, one upsert after quote transaction commit, upsert after delivery date/customer edits, delete after `Entregue/Concluído` or `Cancelado`, deletion tombstone before hard delete, delete after quote reversion, and upsert after reopening. Simulate provider failure and assert order responses still succeed.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `cd server && node --test test/order-calendar-lifecycle.test.js`

Expected: FAIL because route hooks are missing.

- [ ] **Step 3: Add non-blocking centralized lifecycle hooks**

Enqueue only after local database success. Quote conversion enqueues after `COMMIT`; quote CRUD remains untouched. Editing uses the same upsert path even when content is unchanged because Task 4 fingerprints it. Terminal operations overwrite pending upserts with delete.

- [ ] **Step 4: Run order, quote, finance, and lifecycle regressions**

Run: `cd server && node --test test/order-calendar-lifecycle.test.js test/quote-order-tracking.test.js test/converted-order-sync.test.js test/effective-order-items.test.js && npm test`

Expected: PASS with existing order response bodies unchanged.

- [ ] **Step 5: Commit**

```bash
git add server/routes/orders.js server/routes/quotes.js server/routes/reverterPedidoParaOrcamento.js server/test/order-calendar-lifecycle.test.js
git commit -m "feat: enqueue calendar sync across order lifecycle"
```

### Task 6: Google Calendar Panel In Weekly Deliveries

**Files:**
- Create: `client/src/components/GoogleCalendarIntegrationPanel.jsx`
- Create: `client/src/utils/calendarIntegration.js`
- Create: `client/src/utils/calendarIntegration.test.js`
- Create: `client/src/pages/WeeklyDeliveries.calendar.test.js`
- Modify: `client/src/pages/WeeklyDeliveries.jsx`

**Interfaces:**
- Consumes: Task 3 integration endpoints and `useAuth().user.role`.
- Produces: `normalizeCalendarReminderInputs(values)` and `getCalendarConnectionTone(integration)`.
- Produces: administrator-only header button and modal panel inside `Entregas da Semana`.

- [ ] **Step 1: Write client utility and layout tests**

Assert reminder input normalization mirrors the server's 0..28 day and five-value rules; badge tones cover disconnected, connected, syncing, failed, and reconnect-required states. Assert the page renders the calendar trigger only for normalized `admin`, opens a mobile-safe modal, consumes OAuth query results once, and exposes connect, save, synchronize-current-orders, retry, open-calendar, and disconnect actions.

- [ ] **Step 2: Run client tests and verify RED**

Run: `cd client && node --test src/utils/calendarIntegration.test.js src/pages/WeeklyDeliveries.calendar.test.js`

Expected: FAIL because the panel and utilities do not exist.

- [ ] **Step 3: Implement the panel and focused page integration**

Fetch integration status only for administrators. Open Google's authorization URL in the same browser flow, returning to `/deliveries`. Use the existing `Modal`, 44px minimum touch targets, 16px numeric inputs on mobile, tenant-neutral status colors, and no new page route. Poll only while the panel is open and synchronization is pending.

- [ ] **Step 4: Run accessibility, client regression, lint, and build checks**

Run: `cd client && npm test && npx eslint src/components/GoogleCalendarIntegrationPanel.jsx src/utils/calendarIntegration.js src/pages/WeeklyDeliveries.jsx && npm run build`

Expected: all checks PASS and the existing weekly-delivery table behavior remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/GoogleCalendarIntegrationPanel.jsx client/src/utils/calendarIntegration.js client/src/utils/calendarIntegration.test.js client/src/pages/WeeklyDeliveries.jsx client/src/pages/WeeklyDeliveries.calendar.test.js
git commit -m "feat: manage Google Calendar from weekly deliveries"
```

### Task 7: Deployment Verification And Operational Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/oryon-brain/domains/pedidos.md`
- Create: `server/test/calendar-integration-regression.test.js`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployment checklist, Google Cloud OAuth setup instructions, recovery steps, and durable business rules.

- [ ] **Step 1: Add an integration regression test**

With fake Google HTTP and temporary SQLite, exercise connect, create order, update delivery date, mark delivered, and verify exactly one event was created, updated, then deleted. Assert a simulated Google outage leaves the order successful and the sync row retryable.

- [ ] **Step 2: Run the end-to-end regression test**

Run: `cd server && node --test test/calendar-integration-regression.test.js`

Expected: PASS with no real network access.

- [ ] **Step 3: Document deployment and recovery**

Document Google Cloud project creation, Calendar API enablement, exact redirect URI, production environment variable names, dedicated calendar sharing, iPhone Google Calendar activation, reconnect procedure, pending-sync inspection, and rollback. Do not include actual credentials.

- [ ] **Step 4: Record the durable order-calendar rules in Oryon Brain**

Add only the approved lifecycle and reminder rules to `docs/oryon-brain/domains/pedidos.md`.

- [ ] **Step 5: Run final verification**

Run: `cd server && npm test`

Run: `cd client && npm test && npm run build`

Run: `git diff --check && git status --short`

Expected: all suites and builds PASS; only intended documentation or implementation files are changed.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/oryon-brain/domains/pedidos.md server/test/calendar-integration-regression.test.js
git commit -m "docs: add Google Calendar deployment guide"
```

- [ ] **Step 7: Push and verify the remote commit**

Run: `git push origin main`

Verify: `git ls-remote origin refs/heads/main` matches `git rev-parse HEAD`. If terminal authentication is unavailable, use GitHub Desktop's `Push origin` and repeat the hash check before reporting deployment readiness.
