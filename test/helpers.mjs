// AIDEV-NOTE: test-only harness. Never write keys or license material to disk.
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function readIndex() {
  return readFileSync(INDEX_PATH, 'utf8');
}

// AIDEV-NOTE: matches bare `<script>` blocks only (no `src=`), so the two CDN
// <script src=...> tags are skipped and blocks[0]/[1] are core + license/recap.
function inlineScriptBlocks(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}

export function loadCore() {
  const blocks = inlineScriptBlocks(readIndex());
  const sandbox = {
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(blocks[0], context, { filename: 'pv-core.js' });
  vm.runInContext(blocks[1], context, { filename: 'pv-recap-license.js' });
  return context.PV;
}

export async function loadApp(opts = {}) {
  const { url = 'https://example.test/index.html', beforeParse: userBeforeParse } = opts;
  const html = readIndex();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: undefined, // AIDEV-NOTE: do NOT fetch the CDN <script src> tags
    url,
    pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, 'crypto', { value: globalThis.crypto, configurable: true });
      if (!window.TextEncoder) window.TextEncoder = TextEncoder;
      if (!window.TextDecoder) window.TextDecoder = TextDecoder;
      window.requestAnimationFrame = fn => setTimeout(fn, 16);
      // AIDEV-NOTE: jsdom has no canvas backend; stub getContext so drawLoop no-ops.
      if (window.HTMLCanvasElement) window.HTMLCanvasElement.prototype.getContext = () => null;
      if (userBeforeParse) userBeforeParse(window);
    },
  });
  const { window } = dom;
  // let the boot script's synchronous work (and any queued microtasks) settle
  await new Promise(resolve => setTimeout(resolve, 0));
  return { window, PV: window.PV, dom };
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// AIDEV-NOTE: throwaway in-memory Ed25519 keypair per call; matches the wire
// format produced by scripts/sign-license.mjs. Never persisted to disk.
export function makeLicense({ email, days } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const iat = Math.floor(Date.now() / 1000);
  const exp = days === undefined ? 0 : iat + Math.round(days * 86400);
  const payload = { v: 1, plan: 'pro', email, iat, exp };
  const payloadJson = JSON.stringify(payload);
  const payloadB64url = base64url(Buffer.from(payloadJson, 'utf8'));
  const sig = edSign(null, Buffer.from(payloadB64url, 'utf8'), privateKey);
  const sigB64url = base64url(sig);
  const key = `PV1.${payloadB64url}.${sigB64url}`;
  const pub = publicKey.export({ format: 'jwk' }).x;
  return { key, pub };
}
