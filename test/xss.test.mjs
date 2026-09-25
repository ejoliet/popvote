import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('PV.esc escapes & < > " \'', async () => {
  const { PV } = await loadApp();
  assert.equal(PV.esc('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
});

test('recap escapes malicious Q&A text and reaction/cloud words', async () => {
  const { PV } = await loadApp();
  const hub = PV.createHub({ maxGuests: 5 });
  const qa = hub.addActivity({ kind: 'qa', title: 'QA' });
  const cloud = hub.addActivity({ kind: 'cloud', title: 'Cloud' });
  hub.addGuest('p1', 0); hub.addGuest('p2', 0);

  hub.activate(qa.id, 0);
  hub.handle('p1', JSON.stringify({ t: 'q', a: qa.id, txt: '<img src=x onerror=alert(1)>', n: '<b>bob</b>' }), 0);

  hub.activate(cloud.id, 0);
  hub.handle('p2', JSON.stringify({ t: 'vote', a: cloud.id, v: '<script>' }), 0);

  const html = PV.buildRecap(hub.export({ title: 'S', code: 'ABCD', endedAt: 1 }));
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<b>bob'), false);
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(/<script/i.test(html), false);
});

test('index.html assigns innerHTML only from the trusted QR SVG output', () => {
  const assigns = [...indexHtml.matchAll(/\.innerHTML\s*=\s*([^;]+);/g)].map(m => m[1].trim());
  assert.equal(assigns.length, 1);
  assert.match(assigns[0], /^q\.createSvgTag\(/);
});
