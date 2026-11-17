import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const values = dotenv.parse(fs.readFileSync('.env'));
const required = ['API_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_ENCRYPTION_KEY'];
for (const name of required) {
  const value = values[name] ?? '';
  const valid = name === 'AUTH_ENCRYPTION_KEY' ? /^[a-f\d]{64}$/i.test(value)
    : name === 'API_SECRET' ? value.length >= 32
      : name === 'SUPABASE_URL' ? /^https:\/\/[^/]+\.supabase\.co\/?$/.test(value)
        : Boolean(value) && !/replace_with|YOUR_PROJECT/i.test(value);
  console.log(`${name}: ${valid ? 'configured' : 'missing or invalid'}`);
}
for (const name of ['WEBHOOK_URL', 'WEBHOOK_SECRET', 'RENDER_API_KEY']) {
  console.log(`${name}: ${values[name] || process.env[name] ? 'configured' : 'not configured (optional for local pairing)'}`);
}

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
console.log('Locked direct dependencies:');
for (const name of Object.keys({ ...lock.packages[''].dependencies, ...lock.packages[''].devDependencies })) {
  console.log(`  ${name}: ${lock.packages[`node_modules/${name}`]?.version ?? 'missing'}`);
}

if (process.argv.includes('--database')) {
  const client = createClient(values.SUPABASE_URL, values.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error, status } = await client.from('whatsapp_auth').select('key,value')
    .eq('session_id', values.WHATSAPP_SESSION_ID || 'main').abortSignal(AbortSignal.timeout(15_000));
  if (error) {
    console.log(JSON.stringify({ database: 'failed', status, code: error.code || null,
      reason: /fetch failed|timeout/i.test(error.message) ? 'network or timeout' : 'database access or schema error' }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ database: 'reachable', sessionRecords: data.length,
      credentialsPresent: data.some(row => row.key === 'creds'),
      allRecordsEncrypted: data.every(row => row.value.startsWith('v1.')) }));
    const expectedIndex = process.argv.indexOf('--expected-number');
    if (expectedIndex !== -1) {
      const { decryptAuthValue, encryptionKeyFromHex } = await import('../dist/whatsapp/crypto.js');
      const row = data.find(row => row.key === 'creds');
      const creds = row ? JSON.parse(decryptAuthValue(row.value, encryptionKeyFromHex(values.AUTH_ENCRYPTION_KEY))) : {};
      const actualNumber = creds.me?.id?.split('@')[0].split(':')[0];
      const expectedNumber = (process.argv[expectedIndex + 1] ?? '').replace(/\D/g, '');
      const matches = Boolean(actualNumber && expectedNumber && actualNumber === expectedNumber);
      console.log(JSON.stringify({ linkedIdentityStored: Boolean(actualNumber), accountMatchesExpectedNumber: matches }));
      if (!matches) process.exitCode = 1;
    }
  }
}
