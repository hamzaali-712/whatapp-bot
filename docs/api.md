# API

All `/api/*` routes require `x-api-key` (or a Bearer token). Successful responses use `{ "success": true, "data": ... }`.

| Method | Route | Meaning |
| --- | --- | --- |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Readiness status |
| GET | `/api/whatsapp/status` | WhatsApp state |
| GET | `/api/whatsapp/qr` | Protected QR data URL |
| POST | `/api/whatsapp/send` | `{number,message}` |
| POST | `/api/whatsapp/send-image` | Base64 image |
| POST | `/api/whatsapp/send-document` | Base64 document |
| POST | `/api/whatsapp/logout` | Intentional logout |
| GET/POST | `/api/webhook/status`, `/api/webhook/test` | Webhook state/test |

Send calls return `202 accepted`, not proof of delivery. Incoming webhooks are signed with `x-webhook-signature-256` when `WEBHOOK_SECRET` is configured.
