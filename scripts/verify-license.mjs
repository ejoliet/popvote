#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createPublicKey, verify as edVerify } from 'node:crypto';

function base64urlToBuffer(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pub') out.pub = argv[++i];
    else if (a === '--pubpem') out.pubpem = argv[++i];
    else out._.push(a);
  }
  return out;
}

function fail(reason) {
  console.log(JSON.stringify({ ok: false, reason, payload: null }));
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const license = args._[0];

if (!license) {
  console.error('Usage: node scripts/verify-license.mjs <license> [--pub <base64url raw pubkey>|--pubpem keys/public.pem]');
  process.exit(1);
}
if (!args.pub && !args.pubpem) {
  console.error('ERROR: must provide --pub <base64url> or --pubpem <path>');
  process.exit(1);
}

const parts = license.split('.');
if (parts.length !== 3 || parts[0] !== 'PV1' || !parts[1] || !parts[2]) {
  fail('format');
}
const [, payloadB64, sigB64] = parts;

let payload;
try {
  payload = JSON.parse(base64urlToBuffer(payloadB64).toString('utf8'));
} catch {
  fail('format');
}

let publicKey;
try {
  if (args.pubpem) {
    publicKey = createPublicKey(readFileSync(args.pubpem, 'utf8'));
  } else {
    const jwk = { kty: 'OKP', crv: 'Ed25519', x: args.pub };
    publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  }
} catch (err) {
  console.error(`ERROR: could not load public key: ${err.message}`);
  process.exit(1);
}

// AIDEV: signature covers the UTF-8 bytes of the base64url payload STRING,
// matching sign-license.mjs — must not re-encode the parsed JSON.
const sig = base64urlToBuffer(sigB64);
const valid = edVerify(null, Buffer.from(payloadB64, 'utf8'), publicKey, sig);
if (!valid) {
  fail('signature');
}

if (payload.plan !== 'pro') {
  fail('plan');
}

if (payload.exp !== 0 && payload.exp < Math.floor(Date.now() / 1000)) {
  fail('expired');
}

console.log(JSON.stringify({ ok: true, reason: null, payload }));
process.exit(0);
