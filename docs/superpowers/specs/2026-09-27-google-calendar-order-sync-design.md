# Google Calendar Order Sync Design

## Objective

Connect each tenant's company Google Calendar to Oryon so generated orders appear automatically on their delivery date. Quotes never create calendar events. The integration must be reliable, avoid duplicate events, remain optional, and never block the core order workflow when Google is unavailable.

## Approved Business Rules

- The calendar belongs to the company email account and is shared by the company only with authorized people.
- An event is created only after an order is successfully generated, whether the order is created directly or converted from a quote.
- Quotes do not create events.
- The event is all-day on the order delivery date.
- Editing the order's delivery date, tracking code, or customer updates the existing event.
- Marking an order as `Entregue/Concluído`, cancelling it, deleting it, or reverting it to a quote removes the event.
- Reopening or recreating an eligible order creates or restores one event without duplication.
- Reminder offsets are configurable, with a maximum of five reminders per event because of the Google Calendar API limit.
- The default reminder offsets are 7, 5, 3, 1, and 0 days before delivery.
- Calendar access and phone notifications remain controlled by Google Calendar sharing and each authorized user's notification settings.

## User Experience

The integration lives inside the existing `Entregas da Semana` page. Its header contains a Google Calendar button with a calendar icon. The button shows a green connected state, a neutral disconnected state, or a red warning when synchronization requires attention.

Selecting the button opens an integration panel with:

- connection state and connected company email;
- `Connect Google Calendar` and `Disconnect` actions;
- the dedicated calendar created for Oryon deliveries;
- five editable reminder offsets, expressed as days before delivery;
- synchronization health, last successful synchronization, and any actionable error;
- a retry action for pending or failed order synchronizations;
- an `Open calendar` action after connection.

Only administrators can connect, configure, retry, or disconnect the integration. Google remains responsible for access to the dedicated calendar, which the company shares only with authorized people.

The default reminder editor displays `7, 5, 3, 1, 0`. It accepts zero or positive whole days, removes duplicates, and allows no more than five values. Saving settings affects newly synchronized events and schedules existing active events for resynchronization so the configuration remains consistent.

Order screens do not gain ordinary calendar controls in the first version. Order details show a small calendar status only while synchronization is pending or failed, keeping the normal workflow quiet.

## Google Authorization And Security

The integration uses Google OAuth 2.0. Administrators authorize the company account through Google's consent screen; Oryon never asks for or stores the Google password.

Use the narrowest practical Calendar scopes. On first connection, Oryon creates a dedicated calendar named `Entregas Oryon` in the company account instead of using the primary calendar. The company shares only this dedicated calendar with authorized people. Tokens are stored server-side only, encrypted at rest with an application encryption key that is separate from the database. Refresh tokens, client secrets, and access tokens must never be returned to the browser, written to logs, or stored in repository files.

State and PKCE protections bind the OAuth callback to the initiating authenticated administrator. The callback validates the state, stores the encrypted credential, and redirects to the settings page with a non-sensitive result. Disconnecting revokes the Google grant when possible and deletes the local encrypted credential.

The data model and service boundaries are tenant-aware from the beginning. The current installation may use one company, but no global singleton may leak one tenant's credential or calendar ID into another tenant when Oryon becomes SaaS.

## Data Model

### `calendar_integrations`

- tenant identifier;
- provider (`google`);
- connected Google account email;
- ID of the dedicated Oryon delivery calendar;
- encrypted refresh token and required credential metadata;
- enabled flag;
- reminder offsets JSON, default `[7, 5, 3, 1, 0]`;
- last successful sync and last error summary;
- created and updated timestamps.

Only one active Google integration is allowed per tenant in the first version.

### `order_calendar_events`

- tenant identifier and order ID with a unique constraint;
- Google event ID;
- desired operation (`upsert` or `delete`);
- sync state (`pending`, `processing`, `synced`, or `failed`);
- retry count and next retry time;
- last error summary;
- synchronized content fingerprint;
- created, updated, and last synchronized timestamps.

The unique tenant/order constraint is the primary duplicate barrier. The Google event also receives private extended properties containing the tenant and order IDs so an ambiguous API response can be reconciled before another event is created.

## Calendar Event Format

- Summary: `#ATOS-1234 - Customer name` or the tenant's configured order prefix.
- Start: order `delivery_date` as an all-day date.
- End: the next date, as required for an all-day Google Calendar event.
- Description: order code, customer, total pieces, current status, and a secure link to open the order in Oryon.
- Visibility: the calendar's existing default visibility.
- Reminders: custom popup reminders generated from the configured offsets, up to five.
- Private extended properties: stable tenant and order identifiers.

The event description must not contain portal tokens, authentication tokens, financial secrets, or unnecessary customer personal data.

## Synchronization Architecture

Order routes do not call Google before completing their database transaction. Instead, after a successful order change they record the desired calendar operation in `order_calendar_events` using an idempotent upsert.

A calendar synchronization worker processes pending records:

1. Load the order and tenant integration.
2. Determine whether the order is eligible for an event.
3. If eligible, create or update the stored Google event.
4. If ineligible because it was delivered, cancelled, deleted, or reverted, delete the Google event when one exists.
5. Save the Google event ID, content fingerprint, and synchronized state.

Enqueueing wakes the worker for an immediate attempt. A periodic worker also scans due records every minute so a process restart cannot strand work. Failures use bounded exponential backoff. Authentication failures stop automatic retries and show an administrator action to reconnect Google. Temporary API and network failures remain retryable.

The order request succeeds once Oryon's database change succeeds. Calendar failure never rolls back or duplicates an order.

## Order Lifecycle Hooks

The shared calendar synchronization service is called from all order lifecycle paths rather than duplicating Google API code inside routes:

- direct order creation: enqueue `upsert`;
- quote-to-order conversion: enqueue `upsert` only after the order transaction commits;
- order edit: enqueue `upsert` when event content may have changed;
- status changed to `Entregue/Concluído` or `Cancelado`: enqueue `delete`;
- order deletion: write a deletion tombstone containing the calendar event ID before removing the order; the mapping table is not cascade-deleted until Google cleanup succeeds;
- order reverted to quote: enqueue `delete`;
- order reopened from a terminal state: enqueue `upsert`.

An order without a valid delivery date remains pending without creating an event. Adding a valid date later triggers synchronization.

## Failure Handling And Observability

- Store only sanitized error categories and messages; never persist Google tokens or complete API payloads in error fields.
- Log tenant ID, order ID, operation, attempt count, and outcome with a correlation ID.
- Expose integration health and failed/pending counts to administrators.
- Provide an administrator retry action that requeues failed records without creating a second event.
- Reconcile records that have no stored event ID by searching the integration's private extended order property before creating a new event.
- Rate-limit manual retry actions and worker concurrency to protect both Oryon and Google API quotas.

## API Surface

Administrator-only endpoints:

- start Google OAuth authorization;
- handle the OAuth callback;
- read integration status and non-sensitive settings;
- update calendar ID and reminder offsets;
- disconnect the integration;
- retry pending or failed synchronization.

Order endpoints keep their existing public contracts. Calendar synchronization status is internal unless an administrator requests integration diagnostics.

## Testing Strategy

### Unit tests

- normalize and validate at most five unique reminder offsets;
- format all-day event dates and descriptions;
- classify order statuses as event-eligible or removable;
- generate stable event fingerprints;
- sanitize Google errors and calculate retry delays.

### Service tests

- create one event for a new order;
- retry an ambiguous create without duplication;
- update the same event when delivery data changes;
- delete the event when delivered, cancelled, deleted, or reverted;
- recreate one event when an order is reopened;
- keep order creation successful when Google fails;
- isolate credentials and events between tenants.

### Route and UI tests

- require an administrator role for integration settings;
- complete and validate the OAuth state flow;
- prevent secrets from appearing in API responses;
- save valid reminder settings and reject invalid values;
- show connected, disconnected, pending, failed, and reconnect-required states.

Google API calls are mocked in automated tests. A staging calendar owned by a non-production account is used for the final integration test before production authorization.

## Deployment And Recovery

Database migrations add the integration and synchronization tables without modifying existing order data. The feature remains disabled until an administrator connects Google, so deployment cannot affect current order creation.

After connection, active future orders may be synchronized through an explicit administrator action. Historical and delivered orders are not imported automatically.

Rollback disables the worker and disconnects the integration without changing orders. Existing Google events may be removed through a controlled cleanup action if required.

## Out Of Scope

- Calendar events for quotes;
- one calendar per employee;
- more than one Google calendar per tenant;
- direct iCloud or CalDAV integration;
- internal daily WhatsApp or email reminders;
- automatic sharing of the company calendar with employees;
- placing customer lists, financial details, or sensitive portal credentials in calendar events.
