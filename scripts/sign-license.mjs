#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign as edSign } from 'node:crypto';

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseArgs(argv) {
  const out = { days: 0, key: 'keys/private.pem' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--days') out.days = Number(argv[++i]);
    else if (a === '--key') out.key = argv[++i];
    else {
      console.error(`ERROR: unknown argument "${a}"`);
      process.exit(1);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!args.email) {
  console.error('Usage: node scripts/sign-license.mjs --email a@b.c [--days 0] [--key keys/private.pem]');
  process.exit(1);
}
if (!Number.isFinite(args.days)) {
  console.error('ERROR: --days must be a number');
  process.exit(1);
}

let privateKeyPem;
try {
  privateKeyPem = readFileSync(args.key, 'utf8');
} catch (err) {
  console.error(`ERROR: could not read private key at ${args.key}: ${err.message}`);
  process.exit(1);
}

const privateKey = createPrivateKey(privateKeyPem);

const iat = Math.floor(Date.now() / 1000);
const exp = args.days === 0 ? 0 : iat + Math.round(args.days * 86400);

const payload = { v: 1, plan: 'pro', email: args.email, iat, exp };
const payloadJson = JSON.stringify(payload);
const payloadB64 = base64url(Buffer.from(payloadJson, 'utf8'));

// AIDEV: per spec we sign the UTF-8 bytes of the base64url payload STRING
// (not the raw JSON bytes), so verification must re-derive the same string
// and sign/verify over that exact byte sequence.
const sig = edSign(null, Buffer.from(payloadB64, 'utf8'), privateKey);
const sigB64 = base64url(sig);

console.error(`Signed license for ${args.email}, exp=${exp === 0 ? 'never' : exp}`);
process.stdout.write(`PV1.${payloadB64}.${sigB64}\n`);
