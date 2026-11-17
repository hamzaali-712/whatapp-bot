import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const base = `http://127.0.0.1:${process.env.PORT || 5000}`;
const headers = { 'x-api-key': process.env.API_SECRET };
for (const path of ['/health/live', '/health/ready']) {
  const response = await fetch(`${base}${path}`);
  console.log(`${path}: HTTP ${response.status}`);
  assert.equal(response.status, 200);
}
const denied = await fetch(`${base}/api/whatsapp/status`);
assert.equal(denied.status, 401);
console.log('Unauthenticated status: HTTP 401 (expected)');
const status = await fetch(`${base}/api/whatsapp/status`, { headers });
assert.equal(status.status, 200);
console.log('WhatsApp status:', JSON.stringify((await status.json()).data));
if (process.argv.includes('--pair')) {
  const response = await fetch(`http://127.0.0.1:${process.env.PAIR_PORT || 5001}/state`);
  const data = await response.json();
  console.log(JSON.stringify({ pairingPage: response.status, state: data.state, connected: data.connected, qrAvailable: Boolean(data.qrDataUrl) }));
}
