# Security

- Keep `.env`, API secrets, service-role keys, QR values, and encryption keys out of Git and logs.
- `AUTH_ENCRYPTION_KEY` is 64 hex characters and encrypts Supabase auth records using AES-256-GCM. Losing it requires re-pairing.
- Deploy one instance per WhatsApp session.
- QR/API access requires an API key. In-memory rate limits reset after restart.
- Webhook retries are not durable across restarts; use an outbox for durable delivery.
