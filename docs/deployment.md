# Deployment

Target repository: https://github.com/hamzaali-712/whatapp-bot.
Deployment remains a separate step after the user's deploy command.

`render.yaml` proposes one Node 24.22.0 web service, manual deploys,
`npm ci --include=dev && npm run build`, `npm start`, and `/health/live`.
It specifies the paid Starter compute plan as the proposed always-on option.
Confirm the plan before creating the service. Render Free can spin down after
15 minutes without inbound traffic and loses local files on restart/redeploy;
Supabase holds the encrypted WhatsApp credentials and Signal keys.
See [Render's limits](https://render.com/docs/free).

Before deployment:

1. Complete the remaining production work in [the audit](current-audit-and-plan.md).
2. Install the official Windows CLI after the review, following
   [Render's CLI documentation](https://render.com/docs/cli). Confirm with `render version`.
3. Authenticate with `render login` and select the intended workspace, or configure
   `RENDER_API_KEY` locally for automation. Do not commit or paste credentials into chat.
4. Run `render blueprints validate render.yaml`. This file has not yet been validated by the CLI.
5. Confirm the service name, workspace, region, compute plan, and session ID.
6. Stop the local WhatsApp process before enabling the cloud instance. Preserve
   the existing `WHATSAPP_SESSION_ID` and `AUTH_ENCRYPTION_KEY`. Never pair two
   concurrent processes to the same stored session.
7. Configure `API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `AUTH_ENCRYPTION_KEY` securely on Render. Optional integrations also need
   `WEBHOOK_URL`, `WEBHOOK_SECRET`, and browser frontend `CORS_ORIGINS`.
8. On the user's deploy command, create the service and deploy the tested commit.
9. Check live/readiness endpoints and authenticated WhatsApp status. Test a normal
   restart with the phone still linked and confirm no new scan is required.

One configured instance alone does not prevent overlap during rolling deploys,
separate services, or a simultaneous local process. A database-backed ownership
lease is still needed to enforce one session owner during these transitions.
Do not enable automatic deploys or scale horizontally before that is addressed.

No local auth directory or persistent Render disk is required for session storage.
Readiness checks Supabase and reports WhatsApp state separately. Use `/health/live`
for Render health checks so an unpaired phone does not cause deployment loops.
