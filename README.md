# WhatsApp REST API

An Express/TypeScript REST API using Baileys with encrypted Supabase-backed authentication state. Baileys is unofficial; use only with consenting recipients.

## Local setup

1. Copy `.env.example` to `.env` and configure values locally. Do not commit it.
2. Apply `supabase/migrations/001_whatsapp_auth.sql` with a server-side Supabase service-role client only.
3. Run `npm ci`, `npm run dev`, then authenticate with `x-api-key: <API_SECRET>`.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before deployment. See [API](docs/api.md), [deployment](docs/deployment.md), [security](docs/security.md), and [troubleshooting](docs/troubleshooting.md).
