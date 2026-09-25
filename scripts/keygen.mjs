#!/usr/bin/env node
// AIDEV: generates the Ed25519 signing keypair used by sign-license.mjs / verify-license.mjs.
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const force = process.argv.includes('--force');
const keysDir = join(cwd, 'keys');
const privPath = join(keysDir, 'private.pem');
const pubPath = join(keysDir, 'public.pem');
const gitignorePath = join(cwd, '.gitignore');

// Security invariant: never generate keys unless the repo is set up to ignore them.
function assertGitignoreSafe() {
  if (!existsSync(gitignorePath)) {
    console.error('ERROR: .gitignore not found. Refusing to generate keys until *.pem and keys/ are ignored.');
    process.exit(2);
  }
  const lines = readFileSync(gitignorePath, 'utf8')
    .split('\n')
    .map((l) => l.trim());
  const hasPem = lines.includes('*.pem');
  const hasKeysDir = lines.includes('keys/');
  if (!hasPem || !hasKeysDir) {
    console.error(
      'ERROR: .gitignore must contain both "*.pem" and "keys/" lines before keys can be generated. ' +
        `Missing: ${[!hasPem && '*.pem', !hasKeysDir && 'keys/'].filter(Boolean).join(', ')}`
    );
    process.exit(2);
  }
}

assertGitignoreSafe();

if (existsSync(privPath) && !force) {
  console.error(`ERROR: ${privPath} already exists. Use --force to overwrite.`);
  process.exit(1);
}

mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

writeFileSync(privPath, privatePem, { mode: 0o600 });
chmodSync(privPath, 0o600);
writeFileSync(pubPath, publicPem);

const jwk = publicKey.export({ format: 'jwk' });
console.log(`Keys written to ${keysDir}/`);
console.log('');
console.log(`PV_PUBLIC_KEY = ${jwk.x}`);
console.log('Paste into index.html as PV_PUBLIC_KEY');
