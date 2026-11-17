# Deployment and real message test

Recorded 2026-11-18 (Asia/Karachi).

## Render result

- Authenticated from the terminal with the user's locally saved Render API key.
- Workspace: Hamza Ali, `tea-d7m9l57avr4c73evg9p0`.
- Created project `whatapp-bot`: `prj-dbua547f3r2c73dghndg`.
- Created its Production environment: `evm-dbua547f3r2c73dghneg`.
- Requested a **Free** Node web service in Singapore with manual deployments.
- An initial validation and service-creation attempt required payment information
  (HTTP 402). That account requirement subsequently cleared, and revalidation
  returned `valid: true`. The compute plan remained Free throughout.
- Created Free service `srv-dbua96nf3r2c73dgs810`, region Singapore.
- Deployment `dep-dbua97nf3r2c73dgsaig` completed with status **live**.
- Deployed commit: `91afd935147245d715392ba8dae3f0a2acbe3315`.
- Public base URL: https://whatapp-bot-xnb0.onrender.com.
- No paid compute was selected or created. Automatic deployment is disabled.
- The official CLI binary was downloaded and its SHA256 verified, but Windows
  Application Control blocked execution. Terminal commands use the official
  Render API through `npm run render -- ...`; security policy was not modified.

The local process was restored after the first rejected request, then stopped
before successful cloud creation. The cloud instance restored the encrypted
Supabase session without another QR scan. Leave the local API stopped while
the cloud instance owns this session.

Public `/health/live` and `/health/ready` returned HTTP 200. Authenticated
`/api/whatsapp/status` returned `connected: true`; unauthenticated access returned
HTTP 401. Supabase readiness was available.

## Real WhatsApp test

- Sender: the paired account whose saved identity matches the user's number.
- Recipient: the number explicitly authorized by the user in this conversation.
- Send endpoint: local `POST /api/whatsapp/send`.
- Response: HTTP 202, `accepted`.
- Message ID: `3EB00D6B6A349C2F06C0E3`.
- Subsequent authenticated receipt queries returned **delivered**, then **read**.
- Read receipt timestamp: `2026-11-17T19:00:04.662Z`.
- This was a real send and recipient-device delivery acknowledgement. It was not
  a cloud send or a mocked test. A read acknowledgement was subsequently observed.

After successful deployment, a separate cloud test was sent to the same
user-authorized recipient:

- Send endpoint: public `POST /api/whatsapp/send` using the client API key.
- Response: HTTP 202, `accepted`.
- Message ID: `3EB0E8A183EF4C755BD990`.
- Receipt: **delivered** at `2026-11-17T19:05:16.237Z`.
- This verifies a real send and recipient-device acknowledgement through the
  deployed Render service. Two test messages were sent in total: one local and
  one cloud.

## Client configuration

The private ignored `.env.client` file contains the working cloud URL
and the existing client API key. Copy its two values into another backend's
environment. It must not be committed or exposed in frontend code.
See [integration instructions](integration.md).

## Operating limits

Render Free can sleep and is not an always-on hosting service. Receipt metadata
is held in memory and expires after one hour or process termination. Supabase
preserves encrypted authentication. No incoming webhook or automatic AI reply
workflow is configured. Automatic deploys remain off. Concurrent local/cloud
owners and rolling replacements still need a database-backed ownership lease
before they can be supported safely. A separate cloud restart/redeploy recovery
test was not performed; local restart and local-to-cloud recovery both passed.

## Checks

The clean dependency installation, TypeScript typecheck, lint, 13 automated tests,
build, and Git diff checks passed. A runtime-only npm audit reported zero
vulnerabilities. The full dependency install reported 11 high findings in the
development dependency tree; these were not automatically upgraded.
