import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, makeLicense } from './helpers.mjs';

const PV = loadCore();
const NOW = Math.floor(Date.now() / 1000);

function base64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}
function base64urlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function flipChar(s, i) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const repl = [...alphabet].find(c => c !== s[i]);
  return s.slice(0, i) + repl + s.slice(i + 1);
}

test('valid key verifies ok with payload.email', async () => {
  const { key, pub } = makeLicense({ email: 'a@b.com', days: 30 });
  const r = await PV.license.verify(key, pub, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.payload.email, 'a@b.com');
});

test('forged signature is rejected', async () => {
  const { key, pub } = makeLicense({ email: 'a@b.com', days: 30 });
  const [p1, p2, sig] = key.split('.');
  const forged = `${p1}.${p2}.${flipChar(sig, 0)}`;
  const r = await PV.license.verify(forged, pub, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature');
});

test('tampered payload (sig kept) is rejected', async () => {
  const { key, pub } = makeLicense({ email: 'a@b.com', days: 30 });
  const [, payloadB64, sig] = key.split('.');
  const payload = JSON.parse(base64urlDecode(payloadB64));
  payload.email = 'evil@b.com';
  const newPayloadB64 = base64urlEncode(JSON.stringify(payload));
  const r = await PV.license.verify(`PV1.${newPayloadB64}.${sig}`, pub, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature');
});

test('expired license (days:-1) is rejected', async () => {
  const { key, pub } = makeLicense({ email: 'a@b.com', days: -1 });
  const r = await PV.license.verify(key, pub, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
});

test('garbage strings fail format check', async () => {
  const { pub } = makeLicense({ email: 'a@b.com' });
  assert.equal((await PV.license.verify('not-a-license', pub, NOW)).reason, 'format');
  assert.equal((await PV.license.verify('PV1.abc', pub, NOW)).reason, 'format');
});

test('verifying against a different keypair public key fails', async () => {
  const { key } = makeLicense({ email: 'a@b.com', days: 30 });
  const other = makeLicense({ email: 'b@c.com', days: 30 });
  const r = await PV.license.verify(key, other.pub, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature');
});

test('exp 0 never expires', async () => {
  const { key, pub } = makeLicense({ email: 'a@b.com' });
  const farFuture = NOW + 100 * 365 * 86400;
  const r = await PV.license.verify(key, pub, farFuture);
  assert.equal(r.ok, true);
});
