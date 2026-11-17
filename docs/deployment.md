# Deployment

Target repository: https://github.com/hamzaali-712/whatapp-bot.
Deployment remains a separate step after the user's deploy command.

`render.yaml` proposes one Node 24.22.0 web service, manual deploys,
`npm ci --include=dev && npm run build`, `npm start`, and `/health/live`.
The user selected the Free compute plan. No paid service is authorized.
Render Free can spin down after
15 minutes without inbound traffic and loses local files on restart/redeploy;
Supabase holds the encrypted WhatsApp credentials and Signal keys.
See [Render's limits](https://render.com/docs/free).

Before deployment:

1. Complete the remaining production work in [the audit](current-audit-and-plan.md).
2. The official Windows CLI archive was downloaded and checksum-verified, but
   Windows Application Control blocked execution. No security policy was changed.
   Terminal automation instead uses `npm run render -- ACTION` with the official
   Render API, following its published schema.
3. Configure `RENDER_API_KEY` locally and run `npm run render -- workspaces`.
   Do not commit or paste credentials into chat.
4. Run `npm run render -- validate WORKSPACE_ID` to validate the Blueprint via API.
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

Terminal commands support `plan`, `workspaces`, `projects`, `services`,
`create-project WORKSPACE_ID`, `create-service WORKSPACE_ID ENVIRONMENT_ID`,
`status SERVICE_ID`, and `deploy SERVICE_ID COMMIT_SHA`. The service creation
command reads application secrets locally and uploads only the required backend
configuration; it does not upload the Render management key. It refuses to run
while the local API is listening. Creation starts the initial Render deployment.

After service creation, `npm run render -- credentials` writes the service URL
and existing API key into the ignored `.env.client` file for local integration
testing. See [integration instructions](integration.md).

One configured instance alone does not prevent overlap during rolling deploys,
separate services, or a simultaneous local process. A database-backed ownership
lease is still needed to enforce one session owner during these transitions.
Do not enable automatic deploys or scale horizontally before that is addressed.

No local auth directory or persistent Render disk is required for session storage.
Readiness checks Supabase and reports WhatsApp state separately. Use `/health/live`
for Render health checks so an unpaired phone does not cause deployment loops.
