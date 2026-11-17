# WhatsApp REST API

An Express/TypeScript REST API using Baileys with encrypted Supabase-backed authentication state. Baileys is unofficial; use only with consenting recipients.

## Local setup

1. Copy `.env.example` to `.env` and configure values locally. Do not commit it.
2. Apply `supabase/migrations/001_whatsapp_auth.sql` with a server-side Supabase service-role client only.
3. Run `npm ci`, `npm run dev`, then authenticate with `x-api-key: <API_SECRET>`.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before deployment. See [API](docs/api.md), [deployment](docs/deployment.md), [security](docs/security.md), and [troubleshooting](docs/troubleshooting.md).

Run `npm run doctor` to check configuration and Supabase access without printing credentials.
After building, run `npm start` in one terminal and `npm run pair` in another.
Open http://127.0.0.1:5001 on the same computer and scan the refreshing QR from
WhatsApp → Linked devices → Link a device. The phone used to scan determines
the account being linked; a phone number is not a WhatsApp API key.

See [the current audit and next steps](docs/current-audit-and-plan.md) for verified
results and remaining production work. The project currently provides a REST API
and incoming-message webhooks; it does not include an AI auto-reply workflow.

See [integration instructions](docs/integration.md) to call this API from another
backend or use `npm run whatsapp -- status` and the terminal send/receipt commands.
