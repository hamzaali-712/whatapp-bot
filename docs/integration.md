# Connect another project

The service is an authenticated WhatsApp REST API. A separate bot/AI application
can call it to send messages, and receive incoming events at its webhook URL.
The API itself does not implement automatic conversational replies.

The deployed base URL is `https://whatapp-bot-xnb0.onrender.com`.
The local API is stopped so the cloud service owns the WhatsApp session.

Opening the base URL returns public API information and endpoint paths. It does
not open a chat interface. To send a message, your backend must make a `POST`
request to `/api/whatsapp/send` with its API key and `{number,message}` body.
Use `/health/live` to check the service in a browser without an API key.

Set these values only in the other project's backend environment:

```dotenv
WHATSAPP_API_URL=https://whatapp-bot-xnb0.onrender.com
WHATSAPP_API_KEY=THE_EXISTING_API_SECRET_FROM_THIS_PROJECT_ENV
```

`WHATSAPP_API_KEY` must equal this service's `API_SECRET`. Render's management key,
Supabase service-role key, and auth encryption key are not client credentials.
Do not put API keys into frontend bundles, public URLs, Git, or screenshots.

## Terminal client

Run `npm run whatsapp -- status` or `npm run whatsapp -- health`.
The client reads `.env` and an optional ignored `.env.client` for deployment URL
and credentials. One explicit send command is:

```text
npm run whatsapp -- send +COUNTRYNUMBER Your test message
```

Inspect its receipt using the returned `messageId`:

```text
npm run whatsapp -- receipt MESSAGE_ID
```

Do not resend automatically after an HTTP timeout: WhatsApp may have accepted the
first request. The API does not yet provide client-request idempotency.

## Node.js backend

```js
const response = await fetch(`${process.env.WHATSAPP_API_URL}/api/whatsapp/send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.WHATSAPP_API_KEY,
  },
  body: JSON.stringify({ number: '+COUNTRYNUMBER', message: 'Hello from my project' }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error?.message ?? 'WhatsApp send failed');
console.log(result.data.messageId);
```

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process health, no key |
| GET | `/health/ready` | Supabase readiness, no key |
| GET | `/api/whatsapp/status` | Connected account state |
| POST | `/api/whatsapp/send` | Send `{number,message}` |
| GET | `/api/whatsapp/messages/:messageId` | Last observed outgoing receipt |
| POST | `/api/whatsapp/send-image` | Send Base64 image |
| POST | `/api/whatsapp/send-document` | Send Base64 document |

All `/api/*` routes require `x-api-key` or `Authorization: Bearer KEY`.
`202 accepted` only confirms the send operation returned. Receipt status
`server_ack` is a server acknowledgement; `delivered` means the recipient device
acknowledged receipt; `read` means a read acknowledgement was observed. Read
receipts depend on WhatsApp settings. Receipts are bounded in memory to 1,000
messages for one hour and disappear on restart, redeploy, or Free-service sleep.

## Incoming messages

Set `WEBHOOK_URL` to the other project's HTTPS webhook endpoint and set a
`WEBHOOK_SECRET` on the WhatsApp service. Verify `x-webhook-signature-256` as an
HMAC SHA256 of the exact raw JSON bytes before parsing. The JSON payload includes
the event, timestamp, messageId, chatJid, sender, isGroup, messageType, and text.
Delivery retries are limited and are not durable across restart.

Render Free can sleep after idle periods and take time to wake up. Client
requests should allow a longer first-request timeout. This hosting choice does
not provide a continuously available bot. See [Render's Free limits](https://render.com/docs/free).
