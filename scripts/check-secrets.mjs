import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';

const values = dotenv.parse(fs.readFileSync('.env'));
const secrets = Object.entries(values).filter(([name, value]) => /SECRET|KEY|TOKEN|PASSWORD/.test(name) && value.length >= 16).map(([, value]) => value);
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const findings = [];
const forbidden = /(^|\/)(\.env(?:\..+)?|auth\/|auth_info(?:_baileys)?\/|codex-session-.*\.md$)/;
for (const file of files) {
  if (file !== '.env.example' && forbidden.test(file)) findings.push(`${file}: private path`);
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (secrets.some(value => content.includes(value))) findings.push(`${file}: configured secret value`);
}
const history = git(['log', '--all', '-p', '--format=commit %h']);
if (secrets.some(value => history.includes(value))) findings.push('Git history contains a configured secret value');
const historicalPaths = git(['log', '--all', '--format=', '--name-only']).split(/\r?\n/).filter(Boolean);
if (historicalPaths.some(file => file !== '.env.example' && forbidden.test(file))) findings.push('Git history contains a private path');
for (const finding of findings) console.log(finding);
console.log(`Scanned ${files.length} publishable files and ${git(['rev-list', '--count', '--all']).trim()} commits; ${findings.length} findings.`);
console.log('This checks configured secret values and private paths; it is not a universal credential audit.');
if (findings.length) process.exitCode = 1;
