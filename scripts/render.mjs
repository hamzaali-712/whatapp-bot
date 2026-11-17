import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const [action = 'plan', id, argument] = process.argv.slice(2);
const local = dotenv.parse(fs.readFileSync('.env'));
const sensitive = Object.entries({ ...local, RENDER_API_KEY: process.env.RENDER_API_KEY ?? '' })
  .filter(([name, value]) => /SECRET|KEY|TOKEN|PASSWORD/.test(name) && value.length >= 16).map(([, value]) => value);
const print = value => {
  let text = JSON.stringify(value, null, 2);
  for (const secret of sensitive) text = text.replaceAll(secret, '[REDACTED]');
  console.log(text);
};
const settings = {
  name: 'whatapp-bot', type: 'web_service', repo: 'https://github.com/hamzaali-712/whatapp-bot',
  branch: 'main', autoDeployTrigger: 'off',
  serviceDetails: { runtime: 'node', plan: 'free', region: 'singapore', numInstances: 1,
    healthCheckPath: '/health/live', envSpecificDetails: {
      buildCommand: 'npm ci --include=dev && npm run build', startCommand: 'npm start',
    } },
};
const api = async (path, method = 'GET', body) => {
  if (!process.env.RENDER_API_KEY) throw new Error('Save RENDER_API_KEY in the project .env. It is not API_SECRET.');
  const form = body instanceof FormData;
  const response = await fetch(`https://api.render.com/v1${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, Accept: 'application/json',
      ...(!form && body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? form ? body : JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : null; } catch { result = { message: 'Non-JSON Render response' }; }
  if (!response.ok) { print({ error: 'Render request failed', httpStatus: response.status, detail: result }); throw new Error('Render operation did not succeed.'); }
  return result;
};
const summary = service => ({ id: service.id, name: service.name, repo: service.repo,
  plan: service.serviceDetails?.plan, region: service.serviceDetails?.region,
  url: service.serviceDetails?.url, suspended: service.suspended });

try {
  if (action === 'plan') print({ ...settings, authenticationConfigured: Boolean(process.env.RENDER_API_KEY),
    requiredEnvironment: ['API_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_ENCRYPTION_KEY'],
    note: 'Render Free only. Stop the local WhatsApp process before create or deploy.' });
  else if (action === 'workspaces') {
    print((await api('/owners?limit=100')).map(row => ({ id: row.owner.id, name: row.owner.name, type: row.owner.type })));
  } else if (action === 'services') {
    print((await api(`/services?limit=100${id ? `&ownerId=${encodeURIComponent(id)}` : ''}`)).map(row => summary(row.service)));
  } else if (action === 'validate') {
    if (!id) throw new Error('Usage: npm run render -- validate WORKSPACE_ID');
    const form = new FormData();
    form.set('ownerId', id);
    form.set('file', new Blob([fs.readFileSync('render.yaml')], { type: 'application/yaml' }), 'render.yaml');
    const result = await api('/blueprints/validate', 'POST', form);
    print(result);
    if (!result.valid) process.exitCode = 1;
  } else if (action === 'projects') {
    print(await api(`/projects?limit=100${id ? `&ownerId=${encodeURIComponent(id)}` : ''}`));
  } else if (action === 'create-project') {
    if (!id) throw new Error('Usage: npm run render -- create-project WORKSPACE_ID');
    print(await api('/projects', 'POST', { name: 'whatapp-bot', ownerId: id, environments: [{ name: 'Production' }] }));
  } else if (action === 'create-service') {
    if (!id || !argument) throw new Error('Usage: npm run render -- create-service WORKSPACE_ID ENVIRONMENT_ID');
    let localRunning = false;
    try { localRunning = (await fetch(`http://127.0.0.1:${local.PORT || 5000}/health/live`, { signal: AbortSignal.timeout(1_000) })).ok; } catch { /* no local API */ }
    if (localRunning) throw new Error('Stop the local WhatsApp API before creating the cloud service.');
    const required = ['API_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_ENCRYPTION_KEY'];
    if (required.some(name => !local[name])) throw new Error('A required application environment variable is missing.');
    const values = { NODE_ENV: 'production', NODE_VERSION: '24.22.0', WHATSAPP_SESSION_ID: local.WHATSAPP_SESSION_ID || 'main' };
    for (const name of [...required, 'WEBHOOK_URL', 'WEBHOOK_SECRET', 'CORS_ORIGINS']) if (local[name]) values[name] = local[name];
    const response = await api('/services', 'POST', { ...settings, ownerId: id, environmentId: argument,
      envVars: Object.entries(values).map(([key, value]) => ({ key, value })) });
    const service = response.service || response;
    const result = { ...summary(service), deployId: response.deployId };
    fs.mkdirSync('.tools', { recursive: true });
    fs.writeFileSync('.tools/render-service.json', JSON.stringify(result, null, 2));
    print(result);
  } else if (action === 'status') {
    if (!id) throw new Error('A service ID is required.');
    print(summary(await api(`/services/${encodeURIComponent(id)}`)));
    print(await api(`/services/${encodeURIComponent(id)}/deploys?limit=5`));
  } else if (action === 'logs') {
    if (!id || !argument) throw new Error('Usage: npm run render -- logs WORKSPACE_ID SERVICE_ID');
    const result = await api(`/logs?ownerId=${encodeURIComponent(id)}&resource=${encodeURIComponent(argument)}&limit=60`);
    print({ hasMore: result.hasMore, logs: result.logs.map(entry => ({ time: entry.timestamp, message: entry.message })) });
  } else if (action === 'deploy') {
    if (!id || !argument) throw new Error('Usage: npm run render -- deploy SERVICE_ID COMMIT_SHA');
    print(await api(`/services/${encodeURIComponent(id)}/deploys`, 'POST', { commitId: argument, clearCache: 'do_not_clear' }));
  } else if (action === 'credentials') {
    const service = JSON.parse(fs.readFileSync('.tools/render-service.json', 'utf8'));
    if (!service.url?.startsWith('https://')) throw new Error('A verified deployed service URL is required.');
    fs.writeFileSync('.env.client', `WHATSAPP_API_URL=${service.url}\nWHATSAPP_API_KEY=${local.API_SECRET}\n`);
    print({ credentialFile: '.env.client', note: 'Private local file, ignored by Git. Copy these two values to your other backend.' });
  } else throw new Error('Actions: plan, workspaces, services, projects, validate, create-project, create-service, status, logs, deploy, credentials');
} catch (error) {
  print({ error: error instanceof Error ? error.message : 'Render operation failed' });
  process.exitCode = 1;
}
