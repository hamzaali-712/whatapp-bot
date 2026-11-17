# Initial repository audit

Date: 2026-11-17

## Scope

This report records the repository state before feature-code changes. It was
prepared against the WhatsApp-specific `implementation.md` in this repository.
No `.env` values, QR data, auth records, or credentials were read or included.

## Repository and tooling

- Branch: `main`, tracking `origin/main`.
- Tracked history: one initial commit (`5e293a6`).
- Working tree before this report: untracked `docs/` and
  `implementation.md`; no tracked source modifications.
- Node.js: `v22.20.0`; npm: `10.9.3`.
- Render CLI: `v2.28.0`; no `render.yaml` or checked-in Render linkage was
  found. No live Render service was inspected or changed.
- TypeScript uses strict `NodeNext` ESM settings with explicit `.js` source
  import suffixes. This is a sound starting direction.

## Dependency and build findings

`package.json` contains application scripts but declares neither dependencies
nor devDependencies. `package-lock.json` resolves only the root package, and
`npm ls --depth=0` reports an empty tree. In particular,
`@whiskeysockets/baileys`, TypeScript, Express, Supabase, Pino, QRCode,
Helmet, CORS, dotenv, and express-rate-limit are imported by source files but
are not declared or installed.

Consequences observed before changes:

```text
npm ci
up to date, audited 1 package

npm run typecheck
'tsc' is not recognized as an internal or external command

npm run build
'tsc' is not recognized as an internal or external command
```

The installed Baileys package and its TypeScript declarations cannot be
inspected yet because the package is absent. Therefore the current Baileys API
calls are unverified and must not be trusted until a compatible version is
installed and its declarations are reviewed.

## Existing source findings

### Foundation and configuration

- `.env.example` is empty and cannot guide secure configuration.
- `env.ts` requires Supabase variables at import time, preventing the HTTP
  process from starting to report liveness when configuration is intentionally
  absent; it also lacks `AUTH_ENCRYPTION_KEY` validation.
- There are no lint or test scripts, test framework, formatter, or CI checks.
- `server.ts` uses `console` rather than redacted structured logging, has no
  request ID, and exits before HTTP close or pending persistence work is
  guaranteed to finish.
- The existing health route only provides `GET /health`; required distinct
  live/readiness endpoints are absent.

### WhatsApp lifecycle and persistence

- `connection.ts` is empty; socket lifecycle is an unstructured module-global
  implementation in `client.ts`.
- Socket reconnects use fixed, unlimited retries. Restart-required and several
  terminal disconnect reasons are not classified, so it can loop indefinitely.
- Credential writes are fire-and-forget and cannot be flushed during shutdown.
- Raw serialized Baileys credentials and Signal keys are written to Supabase
  without encryption. This violates the AES-256-GCM persistence requirement.
- The Signal-key adapter uses an `as any` cast. Its compatibility cannot be
  evaluated without Baileys declarations.
- Normal shutdown does not close the socket or coordinate authentication
  persistence. Intentional logout is implemented as `/disconnect`, not the
  specified `/logout` contract.

### HTTP API, webhook, and security

- Routes use inconsistent response/error shapes and map expected validation or
  disconnected-state failures to generic HTTP 500 responses.
- Handwritten validation does not consistently bound captions, MIME values, or
  Base64 input before decoding. File signature checks are absent.
- The QR route returns both raw QR data and an image. Although protected by the
  current middleware, raw QR exposure is unnecessary and should be removed.
- Rate limiting is only general; send, QR, and logout routes lack distinct
  limits.
- Webhook delivery uses a shared-secret header, does not sign the body, and
  retries in the message event handler. There is no isolation, bounded queue,
  SSRF validation, or redacted structured delivery telemetry.
- Incoming event handling logs contacts and message metadata; its privacy and
  logging behavior does not meet the requested redaction policy.

### Data, deployment, and documentation

- No Supabase migration or documented RLS setup exists.
- No encrypted auth format, migration versioning, persistence tests, or
  database health check exists.
- No Render deployment configuration/linkage is committed.
- `README.md` is only a placeholder. Required API, deployment, security, and
  troubleshooting documents do not yet exist.

## Secret exposure check

The local `.env` and `auth/` directory are ignored. They were not read.
Tracked-file and history checks found no tracked assignments for the named
secret environment variables. This does not prove no secret exists elsewhere
in Git history, but there is no evidence of a tracked secret in the available
initial history.

## Required recovery plan

1. Add and lock the missing, compatible runtime and development dependencies;
   then inspect Baileys declarations before writing against its API.
2. Establish strict configuration parsing, redacted logs, health endpoints,
   error mapping, and graceful shutdown as the Phase 1 foundation.
3. Replace the module-global connection implementation with a testable,
   bounded-retry connection manager.
4. Add AES-256-GCM encryption, a Supabase migration, typed auth repository,
   serialized persistence queue, and tests before relying on session recovery.
5. Add validated messaging, secure webhook delivery, test coverage, and the
   required deployment/integration documentation.

## Phase 0 result

Phase 0 is complete: the starting errors and their causes are identified. The
repository cannot progress until its declared dependency foundation is restored.
