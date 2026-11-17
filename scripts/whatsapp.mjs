import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
if (fs.existsSync('.env.client')) dotenv.config({ path: '.env.client', quiet: true });
const base = (process.env.WHATSAPP_API_URL || `http://127.0.0.1:${process.env.PORT || 5000}`).replace(/\/$/, '');
const key = process.env.WHATSAPP_API_KEY || process.env.API_SECRET;
if (!key) throw new Error('Configure WHATSAPP_API_KEY or API_SECRET locally.');
const [action = 'status', ...args] = process.argv.slice(2);
const paths = { status: '/api/whatsapp/status', health: '/health/ready', receipt: `/api/whatsapp/messages/${encodeURIComponent(args[0] || '')}` };
let path = paths[action];
const options = { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(90_000), redirect: 'error' };
if (action === 'send') {
  const [number, ...message] = args;
  if (!number || !message.length) throw new Error('Usage: npm run whatsapp -- send +COUNTRYNUMBER Your message');
  path = '/api/whatsapp/send';
  options.method = 'POST';
  options.headers['Content-Type'] = 'application/json';
  options.body = JSON.stringify({ number, message: message.join(' ') });
}
if (!path) throw new Error('Actions: status, health, send <number> <message>, receipt <messageId>');
const response = await fetch(`${base}${path}`, options);
const result = await response.json();
console.log(JSON.stringify({ httpStatus: response.status, ...result }, null, 2));
if (!response.ok) process.exitCode = 1;
