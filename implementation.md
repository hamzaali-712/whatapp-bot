# WhatsApp API — Implementation Plan

**Project:** Self-hosted WhatsApp REST API  
**Runtime:** Node.js + TypeScript  
**WhatsApp integration:** Baileys (unofficial WhatsApp Web integration)  
**Database:** Supabase PostgreSQL  
**Hosting:** Render Web Service  
**Source control:** GitHub  
**Deployment:** Render CLI and/or Git-connected automatic deploys  
**Status:** Implementation specification — Codex must inspect the repository before changing code.

---

## 1. Mission and definition of done

Build a maintainable, secure, testable WhatsApp REST API that:

1. Starts locally using the repository's supported Node.js version.
2. Connects one WhatsApp account through QR pairing.
3. Persists the complete Baileys authentication state, including credentials and Signal keys, in Supabase.
4. Restores the session after an ordinary process restart or Render redeploy, without requiring a new QR scan when WhatsApp still considers the linked device valid.
5. Exposes authenticated REST endpoints for status, QR retrieval, text, image, and document sending, and session logout.
6. Receives incoming messages and delivers normalized events to a configured webhook.
7. Handles disconnects, reconnects, rate limits, invalid input, database failures, and graceful shutdown predictably.
8. Builds cleanly, passes automated tests, and deploys to the connected Render service.
9. Includes accurate setup, deployment, operations, and troubleshooting documentation.

**No one can guarantee that an unofficial WhatsApp Web integration will remain connected forever or that WhatsApp will never restrict an account.** The engineering goal is reliable session recovery and observable failure handling, not a promise of uninterrupted WhatsApp availability. Baileys is unofficial and subject to WhatsApp changes and terms. Do not use it for unsolicited bulk messaging.

## 2. Non-negotiable engineering rules

Codex must follow these rules throughout the work:

- Inspect the actual repository, `package.json`, lockfile, TypeScript config, current source, Git status, and installed package versions before editing.
- Do not assume the earlier generated code is correct. Treat it as unverified and audit every file.
- Read the installed Baileys package's actual TypeScript declarations and examples. Match imports, socket options, event payloads, auth types, and disconnect handling to the installed version. Do not copy APIs from an unrelated version or old tutorial.
- Keep one coherent module system. Prefer ESM with TypeScript `NodeNext` and explicit `.js` relative import extensions in TypeScript source if that is compatible with the repository and installed packages. Do not mix CommonJS and ESM.
- Use exact, supported package versions and preserve the existing package manager/lockfile. Do not blindly replace the lockfile or downgrade packages.
- Never use `useMultiFileAuthState` in production on Render Free as the persistence strategy. Render Free's filesystem is ephemeral and the service can sleep. Use Supabase-backed auth storage.
- Do not run multiple active service instances against the same WhatsApp session. The design must document and enforce a single active owner/instance for a given session ID. Do not scale horizontally without implementing distributed locking and a deliberate multi-session architecture.
- Do not store plaintext credentials or Signal keys in Supabase. Encrypt persisted auth values using AES-256-GCM with a dedicated 32-byte key supplied through an environment variable. Keep the encryption key outside the database and source control.
- Never log QR contents, message bodies, API secrets, service-role keys, encryption keys, auth records, or full sensitive webhook payloads.
- Never expose the QR endpoint publicly. Protect it with API authentication and recommend short-lived pairing windows / access restrictions.
- Validate every request at the API boundary. Prefer a schema validation library such as Zod if it is not already installed and appropriate.
- Enforce request size limits and media size/type limits. Do not accept arbitrary remote URLs for media downloads.
- Use structured, useful errors. Do not return stack traces or internal database errors in production responses.
- Do not claim a message is delivered merely because the send method returned. Distinguish accepted/sent acknowledgement from recipient delivery/read receipts.
- Do not silently swallow database write failures. Auth persistence failures must be visible and must prevent unsafe continuation where appropriate.
- Do not add fake data, placeholder success responses, TODO implementations, or unimplemented endpoints presented as complete.
- Do not commit `.env`, credentials, QR codes, auth data, database dumps, or private keys.
- Make changes in small phases. Run the relevant checks after each phase and fix all regressions before proceeding.
- Do not deploy until local checks and tests pass and the user has approved the deployment step if a deployment action would modify the live service.

## 3. Current repository context

The intended starting layout is:

```text
whatsapp-api/
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── whatsapp/
│   │   ├── client.ts
│   │   ├── connection.ts
│   │   ├── auth.ts
│   │   └── events.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── whatsapp.ts
│   │   └── webhook.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── services/
│   │   └── message.service.ts
│   └── server.ts
├── auth/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

Codex may reorganize this structure when there is a clear technical reason. If it does, update this document or add an architecture note and keep the resulting structure simple.

The user has:
- Created the project folder and initial structure.
- Installed an initial set of dependencies.
- Connected GitHub.
- Connected Render and can use the Render CLI.
- Not yet confirmed that the current code compiles or works.

Do not assume the Render service name, service ID, GitHub repository URL, Supabase project URL, or secret values. Inspect available local configuration and ask the user only for genuinely missing non-secret details. Never ask the user to paste secrets into chat.

## 4. Target architecture

```text
Client / AI agent / application
        |
        | HTTPS + API key
        v
Express REST API on Render
        |
        +---- Health and readiness
        |
        +---- API authentication + rate limiting + validation
        |
        +---- WhatsApp service layer
        |         |
        |         v
        |      Baileys socket
        |         |
        |         +---- WhatsApp linked device
        |         |
        |         +---- Incoming message events
        |                       |
        |                       v
        |                 Webhook delivery worker
        |
        +---- Auth persistence adapter
                  |
                  v
             Supabase PostgreSQL
             encrypted credentials + encrypted Signal keys
```

### Design boundaries

- **Routes:** HTTP parsing, validation, status codes, and response formatting only.
- **Services:** application operations such as sending a message and webhook delivery.
- **WhatsApp client/connection manager:** owns the socket lifecycle and connection state.
- **Auth repository:** reads/writes/deletes serialized auth values in Supabase.
- **Crypto module:** encrypts/decrypts persisted values; never mixes database access with crypto implementation.
- **Config:** validates environment variables once at startup.
- **Events:** converts Baileys events into normalized internal events.
- **Webhook delivery:** handles timeout, bounded retry, signature/secret, and safe logging.

Do not make the HTTP server wait indefinitely for WhatsApp to connect. The HTTP server should start and expose health/readiness status even if WhatsApp is disconnected.

## 5. Environment variables

Create `.env.example` with placeholders only. Validate all required variables with a schema at startup.

Required:

```dotenv
NODE_ENV=development
PORT=5000

API_SECRET=replace_with_a_long_random_secret

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_with_server_only_service_role_key

WHATSAPP_SESSION_ID=main
AUTH_ENCRYPTION_KEY=64_hex_characters_for_32_bytes

WEBHOOK_URL=
WEBHOOK_SECRET=

CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Rules:

- `PORT` must use `process.env.PORT` on Render and default locally to `5000`.
- `API_SECRET` must be a sufficiently long random secret. Compare secrets safely; do not log them.
- `AUTH_ENCRYPTION_KEY` must decode from hex to exactly 32 bytes. Fail startup if missing or malformed when Supabase auth persistence is enabled.
- Validate `SUPABASE_URL` as a URL and require HTTPS in production.
- Validate `WEBHOOK_URL` as HTTPS in production. Reject loopback/private-network targets unless explicitly enabled for local development; protect against SSRF.
- `CORS_ORIGINS` is an explicit allowlist. Do not use wildcard CORS with credentialed requests.
- The Supabase service-role key is server-only and must never be sent to a browser.
- `.env` must be ignored by Git. `.env.example` must remain committed.
- Do not print the complete environment object.

## 6. Supabase schema and auth storage

Create a migration file, for example `supabase/migrations/001_whatsapp_auth.sql`, and document how to apply it in Supabase SQL Editor or the Supabase CLI.

Suggested schema:

```sql
create table if not exists public.whatsapp_auth (
  session_id text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, key)
);

alter table public.whatsapp_auth enable row level security;

-- Do not create anon/authenticated access policies.
-- Server-side service-role access bypasses RLS; keep that key private.
```

Requirements:

- Use parameterized Supabase client methods; never build raw SQL with user-controlled strings.
- Store each auth item under a session ID and key.
- Serialize Baileys values using Baileys' `BufferJSON` replacer/reviver or the exact supported serializer for the installed version.
- Encrypt serialized values before database writes. Decrypt after reads.
- Support batched upserts and batched deletes where possible.
- Correctly implement the Signal key store's `get(type, ids)` and `set(data)` semantics, including deletions represented by `null`.
- Ensure the returned key object matches the installed Baileys `AuthenticationState` type. Avoid `any` unless a documented library typing limitation requires a narrow adapter.
- Ensure all credential and key writes are awaited or queued with a controlled, flushable write queue. Do not create uncontrolled fire-and-forget writes that can be lost during shutdown.
- Handle concurrent auth writes safely within one process.
- Add database connectivity checks and useful redacted errors.
- Never log auth values.
- Add an explicit `clearAuthState(sessionId)` operation used only during intentional logout/reset.
- Do not delete auth data just because the socket temporarily disconnects.
- Consider a schema migration/version field if the auth serialization format changes. Do not silently attempt to decode incompatible data.

### Important concurrency constraint

One WhatsApp session must have one active writer. The first implementation should support one Render instance and one `WHATSAPP_SESSION_ID`. Document that Render scaling / multiple instances / preview deployments must not run the same session simultaneously. If necessary, implement a Supabase-backed lease/lock with expiry and owner token before allowing multiple instances. Do not pretend that a simple in-memory boolean protects across instances.

## 7. Phase-by-phase implementation plan

Each phase is a gate. Complete the work, run checks, report results, and fix failures before moving on.

---

# Phase 0 — Repository audit and recovery plan

### Tasks

1. Inspect:
   - `git status`
   - current branch and remotes
   - `package.json`
   - lockfile (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`)
   - `tsconfig.json`
   - all files under `src/`
   - `.gitignore`
   - `.env.example`
   - installed Node and npm versions
   - installed Baileys version and package declarations.
2. Run the existing typecheck/build without changing code, if scripts exist.
3. Capture and classify every current error:
   - package/module mismatch
   - TypeScript type mismatch
   - ESM/CJS mismatch
   - invalid Baileys API usage
   - Supabase typing/runtime issue
   - Express middleware typing issue
   - missing environment configuration
   - logic/lifecycle bug.
4. Check whether any secrets or auth data have already been committed. If so, stop and tell the user to rotate the exposed secrets; do not reproduce them.
5. Create a concise audit report: `docs/initial-audit.md`.

### Acceptance criteria

- Current state is understood.
- A list of concrete errors exists.
- Package versions and Baileys API surface are known.
- No secret is printed or committed.
- No feature code is rewritten before the audit is complete.

---

# Phase 1 — Stable project foundation and configuration

### Tasks

1. Normalize package scripts and TypeScript configuration to one compatible ESM setup.
2. Keep the existing package manager and lockfile.
3. Confirm Node engine version against the installed Baileys version and Render runtime.
4. Add environment schema validation (Zod or equivalent).
5. Add a minimal Express server with:
   - JSON body limit
   - Helmet
   - explicit CORS allowlist
   - request ID
   - structured logging with redaction
   - `/health/live`
   - `/health/ready`
   - not-found handler
   - centralized error handler.
6. Add graceful shutdown with a timeout and idempotent shutdown guard.
7. Add `.gitignore` entries for `.env*` except `.env.example`, `auth/`, logs, build output, and local artifacts.

### Acceptance criteria

- `npm ci` (or the repository's correct frozen-lockfile command) succeeds.
- `npm run typecheck` succeeds.
- `npm run build` succeeds.
- Server starts without Supabase or WhatsApp being connected if the architecture allows dependency health to be reported separately; otherwise fail fast only for missing required configuration, not temporary remote outages.
- `/health/live` responds.
- `/health/ready` reports dependency state honestly.
- No secrets are logged.

---

# Phase 2 — Correct Baileys connection lifecycle and QR pairing

### Tasks

1. Build a single `WhatsAppConnectionManager` that owns exactly one socket.
2. Implement states such as:
   - `starting`
   - `connecting`
   - `qr_required`
   - `connected`
   - `reconnecting`
   - `logged_out`
   - `stopped`
   - `error`.
3. Create the socket using the installed Baileys version's documented API.
4. Subscribe to `connection.update` and `creds.update` exactly once per socket.
5. Convert QR strings to a QR data URL using `qrcode`; do not log raw QR data.
6. Expose QR only through an authenticated, rate-limited route.
7. Clear QR data after successful pairing or expiry.
8. Handle disconnect reason codes using the installed version's exported constants/types:
   - logged out: stop reconnecting and require explicit re-pairing
   - restart required: close old socket and create a new one
   - transient network/server close: bounded exponential backoff with jitter
   - bad session/forbidden/unsupported state: report a clear error and do not create an infinite reconnect loop.
9. Prevent duplicate concurrent starts and duplicate sockets.
10. Make start/stop idempotent.
11. Ensure shutdown closes the socket without deleting auth state.
12. Keep the HTTP server responsive during QR pairing and reconnects.

### Acceptance criteria

- Local start creates one socket.
- QR endpoint returns a valid QR data URL when pairing is required.
- QR scan links the device.
- Status changes to `connected`.
- QR is no longer available after connection.
- A transient disconnect triggers one controlled reconnect sequence.
- Logout does not accidentally reconnect using stale state.
- Restarting the Node process restores the session if WhatsApp still recognizes it.
- No raw QR or auth data appears in logs.

---

# Phase 3 — Supabase-backed encrypted authentication persistence

### Tasks

1. Add the SQL migration and setup instructions.
2. Implement an isolated crypto module using AES-256-GCM:
   - 12-byte random IV per encryption
   - authentication tag
   - versioned serialized envelope
   - strict key validation
   - authenticated decryption
   - no static IVs.
3. Implement a Supabase auth repository.
4. Implement Baileys auth state and Signal key store adapters using exact installed types.
5. Persist:
   - initial credentials
   - all `creds.update` changes
   - Signal key updates
   - Signal key deletions.
6. Restore credentials and keys before opening the socket.
7. Ensure write errors are surfaced and observable.
8. Ensure pending writes flush before shutdown where feasible.
9. Add a safe session reset/logout operation.
10. Add tests for serialization, encryption/decryption, tamper detection, key reads/writes/deletes, and database adapter behavior using mocks.

### Acceptance criteria

- New session creates initial auth data.
- A QR-paired session persists credentials.
- Signal keys are saved and can be read back.
- Stored database values are encrypted and not readable as raw JSON.
- Tampering with ciphertext causes decryption failure.
- Restart restores the same session.
- A temporary Supabase outage does not silently corrupt or erase the session.
- Logout deletes only the selected session's auth records.
- Encryption key loss is documented as unrecoverable without re-pairing.

---

# Phase 4 — Messaging API, validation, and incoming events

### Tasks

1. Implement a typed messaging service.
2. Implement endpoints:
   - `GET /api/whatsapp/status`
   - `GET /api/whatsapp/qr`
   - `POST /api/whatsapp/send`
   - `POST /api/whatsapp/send-image`
   - `POST /api/whatsapp/send-document`
   - `POST /api/whatsapp/logout`
3. Use E.164-style phone number validation and normalize to the JID format expected by the installed Baileys version. Validate recipient existence/registration where supported by the library and avoid assuming every number maps to a valid WhatsApp account.
4. Validate message text, filename, MIME type, and payload size.
5. Prefer multipart upload or bounded Base64 payloads; if Base64 is used, account for Base64 expansion in Express body limits and reject oversized input before expensive processing.
6. For media:
   - allowlist MIME types
   - inspect file signatures where practical
   - enforce a conservative file size limit
   - never accept arbitrary filesystem paths
   - never fetch arbitrary user-provided URLs.
7. Return a message ID and a truthful status such as `accepted`/`submitted`; do not claim delivered/read without receipt events.
8. Normalize incoming Baileys messages into a documented webhook event shape:
   - event type
   - message ID
   - chat JID
   - sender/participant
   - group flag
   - timestamp
   - message type
   - extracted text/caption when available.
9. Handle messages with no text, media, protocol messages, status broadcasts, groups, and messages sent by the linked account.
10. Add message receipt/status event handling only if supported by the installed version and expose it accurately.

### Acceptance criteria

- Authenticated text send works to a test recipient.
- Missing/invalid API key returns 401.
- Invalid phone number/body returns 400.
- Sending while disconnected returns a clear 503/409 response.
- Media MIME/size validation works.
- Incoming message creates a normalized event.
- No message content is logged by default.
- Unit tests cover valid and invalid payloads.

---

# Phase 5 — API security and webhook delivery

### Tasks

1. Add API-key authentication using a constant-time comparison.
2. Apply rate limits:
   - general API limit
   - stricter send-message limit
   - QR endpoint limit
   - login/logout/reset protection.
3. Add Zod request schemas or equivalent.
4. Add CORS allowlisting; CORS is not authentication.
5. Add Helmet and safe HTTP headers.
6. Add request IDs and structured logs with sensitive-field redaction.
7. Add webhook delivery service:
   - HTTPS-only in production
   - secret/signature header
   - request timeout
   - bounded retry with exponential backoff and jitter
   - delivery result logging without sensitive body content
   - bounded queue or durable outbox if delivery guarantees are required.
8. Document that simple in-memory retries are lost on process restart. If reliable delivery across restarts is a requirement, implement a Supabase outbox table and worker with idempotency.
9. Protect against SSRF if webhook destinations are configurable through an API. Prefer a server environment variable controlled by the operator.
10. Add safe error handling and ensure production responses do not leak stack traces.

### Acceptance criteria

- All sensitive routes require API key.
- Rate limit tests pass.
- Webhook requests include the configured verification secret/signature.
- Failed webhook responses are retried within configured bounds.
- Invalid webhook URL/config is rejected.
- No secrets or message bodies appear in logs.
- No open QR endpoint or unauthenticated send endpoint exists.

---

# Phase 6 — Automated tests and quality gates

### Tasks

Use the repository's test framework if already configured. Otherwise choose Vitest or Node's built-in test runner with minimal extra dependencies.

Add tests for:

- Environment parsing and invalid configuration.
- Encryption round trip and tamper rejection.
- Auth serializer/reviver with Buffer values.
- Supabase repository operations (mocked).
- Signal key store get/set/delete semantics.
- API authentication.
- Request validation.
- Rate limiting.
- Health endpoints.
- Disconnected send behavior.
- Message service payload construction (mock Baileys socket).
- Webhook success, timeout, retry, and failure.
- Connection manager duplicate-start prevention and reconnect policy (mock socket/events).

### Quality gates

Before deployment, all must pass:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

If the repository does not have a lint script, add a suitable one or explicitly document why it is omitted. Do not leave a broken script in `package.json`.

Also run:

```bash
git diff --check
git status --short
```

Do not mark a phase complete if a required command fails. Fix the underlying issue and rerun the full relevant gate.

### Integration test plan

Use a real WhatsApp test account and a real Supabase test project:

1. Start locally.
2. Confirm health endpoint.
3. Pair using QR.
4. Confirm auth records are encrypted in Supabase.
5. Send a test text to a consenting recipient.
6. Send an image and a PDF.
7. Send a message to the linked account from another test account and confirm webhook event.
8. Stop and restart the process.
9. Confirm reconnection without QR.
10. Simulate temporary Supabase/network failure where practical.
11. Confirm logged-out state requires a fresh QR.
12. Confirm API authentication and rate limits.

Do not send unsolicited messages or test against recipients who have not consented.

---

# Phase 7 — Render deployment and operations

### Render constraints

- Render Free web services sleep after inactivity and do not provide persistent disks. Supabase persistence helps restore auth state after a wake/restart, but it does **not** make a sleeping service continuously available to receive WhatsApp messages.
- For continuous operation, use a paid always-on Render instance. A persistent disk is optional if all required state is in Supabase and no other local durable files are needed.
- Deploy exactly one active instance for the same WhatsApp session.
- Do not enable autoscaling or multiple instances for this single-session implementation.
- Render deploys/restarts can interrupt the WhatsApp connection; reconnection should restore the saved session.

### Tasks

1. Confirm the correct Render service and repository/branch.
2. Confirm build command and start command:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
3. Configure Render environment variables in the Render dashboard or supported CLI secret mechanism. Never put secret values in shell history, source files, or logs.
4. Set health check path to `/health/ready` only if readiness semantics are appropriate for Render deployment. Otherwise use `/health/live` for process liveness and expose dependency readiness separately.
5. Confirm `process.env.PORT` is used and server binds to `0.0.0.0`.
6. Deploy only after all local quality gates pass.
7. Inspect Render deployment logs for startup errors without printing secrets.
8. Test health, authenticated status, QR, send, incoming webhook, and restart recovery.
9. Confirm one active service instance.
10. Record Render service name/ID and deployment procedure in `docs/deployment.md`.

### Render CLI

Codex must inspect the installed CLI version and use its actual supported commands. Do not invent CLI syntax. If the service is already linked, inspect the link/status and deployment target before running a deploy command. Ask the user before deploying or changing a live service. Prefer Render dashboard environment-variable management or a documented secure secret workflow. Never pass secret values as command-line arguments.

### Acceptance criteria

- GitHub repository contains only source and safe example configuration.
- Render build succeeds.
- Render service starts and health endpoint responds.
- Supabase auth persistence works in deployed environment.
- QR pairing works through protected endpoint.
- Session recovers after a Render restart/redeploy, provided WhatsApp has not invalidated the linked device.
- No second instance competes for the same session.
- Logs are free of secrets and QR data.
- Document actual plan limitations and service costs; do not call Render Free always-on.

---

# Phase 8 — Integration readiness and documentation

### Tasks

1. Document how an external app calls the REST API.
2. Provide cURL examples for status, QR, text, image, document, and webhook testing.
3. Document incoming webhook payloads and verification.
4. Add an `.env.example` with no real values.
5. Add `README.md` with local setup, database setup, pairing, tests, and deployment.
6. Add `docs/api.md`, `docs/deployment.md`, `docs/troubleshooting.md`, and `docs/security.md`.
7. Add an example integration for an AI agent that:
   - receives an incoming event
   - verifies webhook authenticity
   - calls the agent
   - sends a reply through the REST API
   - prevents loops by ignoring messages from the linked account
   - includes per-user rate limits and safe fallback behavior.
8. Do not add an autonomous bulk messaging feature.

### Acceptance criteria

A new developer can clone the repository, install dependencies, configure Supabase and environment variables, run tests, pair a test account, send a test message, and deploy using the documentation without guessing.

## 8. API contract

Use a consistent response shape.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "WHATSAPP_NOT_CONNECTED",
    "message": "WhatsApp is not connected."
  },
  "requestId": "..."
}
```

Suggested routes:

| Method | Route | Authentication | Purpose |
|---|---|---:|---|
| GET | `/health/live` | No | Process liveness |
| GET | `/health/ready` | No | Dependency readiness |
| GET | `/api/whatsapp/status` | Yes | Connection state |
| GET | `/api/whatsapp/qr` | Yes | Pairing QR |
| POST | `/api/whatsapp/send` | Yes | Send text |
| POST | `/api/whatsapp/send-image` | Yes | Send image |
| POST | `/api/whatsapp/send-document` | Yes | Send document |
| POST | `/api/whatsapp/logout` | Yes | Logout and clear session |
| GET | `/api/webhook/status` | Yes | Webhook configuration status |
| POST | `/api/webhook/test` | Yes | Test configured webhook |

If existing route names differ, either maintain compatibility or document the migration. Do not change routes casually after consumers start using the API.

## 9. Connection lifecycle requirements

The connection manager must be explicit and testable.

- Only one socket may be active for the session.
- `start()` must be idempotent.
- A socket's event listeners must not be duplicated.
- On `connection: close`, clear the old socket reference and classify the reason.
- On a restart-required code, recreate the socket after closing the old one.
- On logged-out, clear in-memory QR and mark the state as requiring re-pairing; do not repeatedly reconnect.
- On transient network failure, retry with exponential backoff and jitter, with a maximum delay and reset after a stable connection.
- On successful open, clear QR and reset retry counters.
- On process shutdown, cancel timers, stop new work, flush auth writes, and close the socket without deleting persisted auth.
- Do not treat Render health checks as a reason to reconnect or re-pair.
- Expose last connection time, current state, and a redacted last error.

## 10. Observability

Implement:

- `/health/live`: process is running.
- `/health/ready`: reports whether critical dependencies are available; do not make this endpoint require WhatsApp connected if that would cause deployment restart loops.
- Structured logs with timestamp, level, request ID, event name, and safe metadata.
- Counters or logs for connection attempts, reconnects, webhook failures, message send failures, and auth persistence failures.
- Redaction of authorization headers, API keys, webhook secrets, phone numbers where practical, message contents, QR strings, and auth state.

## 11. Security and privacy checklist

- [ ] `.env` is ignored.
- [ ] No real secret exists in Git history (if exposed, rotate it).
- [ ] Supabase service-role key is backend-only.
- [ ] Auth and Signal keys are encrypted before storage.
- [ ] AES key is backed up securely outside Supabase.
- [ ] QR endpoint is authenticated and rate-limited.
- [ ] Send endpoints are authenticated and rate-limited.
- [ ] Webhook URL is HTTPS in production.
- [ ] Webhook requests are authenticated.
- [ ] Request body and media sizes are bounded.
- [ ] File MIME types are allowlisted.
- [ ] Production errors do not leak internals.
- [ ] Logs do not contain message bodies or secrets.
- [ ] One active instance owns a session.
- [ ] No unsolicited bulk messaging is implemented.

## 12. Final delivery report required from Codex

At the end, provide:

1. Summary of the original errors found.
2. Files created, changed, or removed.
3. Exact dependency versions and why they are compatible.
4. Supabase SQL migration and whether it was applied (do not claim it was applied unless verified).
5. Commands run and their actual results:
   - install
   - typecheck
   - lint
   - tests
   - build
   - diff check.
6. Local integration test results, clearly distinguishing mocked tests from real WhatsApp/Supabase tests.
7. Render deployment result, only if the user authorized deployment and the CLI confirms success.
8. Any remaining limitations or manual actions required.
9. Exact next steps for the user.

Never report a test as passed unless it was actually executed and passed. Never report successful WhatsApp pairing or message delivery unless it was tested with a real account and recipient.

## 13. Recommended execution order

Execute in this exact order:

1. Phase 0 audit.
2. Phase 1 foundation.
3. Phase 2 connection lifecycle.
4. Phase 3 encrypted Supabase auth persistence.
5. Phase 4 messaging and incoming events.
6. Phase 5 security and webhooks.
7. Phase 6 tests and quality gates.
8. Phase 7 Render deployment after user approval.
9. Phase 8 documentation and integration readiness.

Do not try to implement every phase in one giant edit. Make a small coherent set of changes, run checks, fix errors, and continue.

---

## Official references to consult

Always prefer documentation and declarations matching the exact installed version:

- Baileys repository: https://github.com/WhiskeySockets/Baileys
- Baileys documentation: https://baileys.wiki/
- Supabase JavaScript client: https://supabase.com/docs/reference/javascript/introduction
- Supabase database: https://supabase.com/docs/guides/database
- Render web services: https://render.com/docs/web-services
- Render CLI: https://render.com/docs/cli
- Express: https://expressjs.com/
- Node.js: https://nodejs.org/docs/latest/api/

**Final principle:** Correctness is demonstrated by typechecking, tests, real integration checks, and verified deployment—not by generating a large amount of code or claiming that the code should work.
