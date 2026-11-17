# Deployment

Render build: `npm ci && npm run build`. Start: `npm start`.

Configure secrets only in Render’s environment UI, keep one instance, and use `/health/live` for liveness. Render Free services can sleep and cannot continuously receive WhatsApp messages. No Render service was deployed or modified by this work.
