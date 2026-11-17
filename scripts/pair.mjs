import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const apiPort = Number(process.env.PORT || 5000);
const pairPort = Number(process.env.PAIR_PORT || 5001);
if (!process.env.API_SECRET) throw new Error('Configure API_SECRET in .env first.');

// Loopback only. The API key stays on the server and is never included in HTML.
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link WhatsApp</title>
<style>body{font:18px system-ui;max-width:620px;margin:48px auto;padding:20px;text-align:center;background:#f0f5f3;color:#142b21}img{width:min(100%,400px);image-rendering:pixelated}p{line-height:1.6}#state{font-weight:bold}</style>
<h1>Link your WhatsApp</h1><p>On your phone, open WhatsApp → Linked devices → Link a device and scan the current code.</p>
<p id="state">Checking connection…</p><img id="qr" hidden alt="WhatsApp pairing QR"><p>This page refreshes the code automatically. Keep this local page private.</p>
<script>const state=document.getElementById('state'),qr=document.getElementById('qr');async function refresh(){try{const r=await fetch('/state',{cache:'no-store'});const d=await r.json();state.textContent=d.connected?'Connected — you can close this page.':d.state;qr.hidden=!d.qrDataUrl;if(d.qrDataUrl)qr.src=d.qrDataUrl;}catch{state.textContent='Cannot reach the API. Start it with npm start.';qr.hidden=true;}}refresh();setInterval(refresh,10000);</script></html>`;

const server = createServer(async (req, res) => {
  const allowedHosts = new Set([`127.0.0.1:${pairPort}`, `localhost:${pairPort}`]);
  if (!allowedHosts.has(req.headers.host)) { res.writeHead(403).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'");
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page); return; }
  if (req.url !== '/state') { res.writeHead(404).end(); return; }
  try {
    const headers = { 'x-api-key': process.env.API_SECRET };
    const request = path => fetch(`http://127.0.0.1:${apiPort}/api/whatsapp/${path}`, { headers, signal: AbortSignal.timeout(5_000) });
    const status = await request('status');
    if (!status.ok) throw new Error('Status unavailable');
    const { data } = await status.json();
    let qrDataUrl;
    if (data.qrAvailable) {
      const qr = await request('qr');
      if (qr.ok) {
        qrDataUrl = (await qr.json()).data.qrDataUrl;
        await mkdir('auth', { recursive: true });
        await writeFile('auth/pairing-qr.png', Buffer.from(qrDataUrl.split(',')[1], 'base64'));
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ state: data.state, connected: data.connected, qrDataUrl }));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ state: 'API unavailable — run npm start', connected: false }));
  }
});
server.listen(pairPort, '127.0.0.1', () => console.log(`Pair WhatsApp at http://127.0.0.1:${pairPort}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
