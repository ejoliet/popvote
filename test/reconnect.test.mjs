import { test } from 'node:test';
// AIDEV-NOTE: objects created inside the jsdom window realm have a different
// Object prototype than this file's literals, so use loose deepEqual (see
// store.test.mjs for the same cross-realm note).
import assert from 'node:assert';
import { loadApp } from './helpers.mjs';

class FakeConn {
  constructor(peer) { this.peer = peer; this.open = true; this.sent = []; this.listeners = {}; }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...args) { (this.listeners[evt] || []).forEach(fn => fn(...args)); }
  send(m) { this.sent.push(m); }
  close() { this.open = false; }
}
class FakePeer {
  constructor(id) { this.id = id; this.listeners = {}; this.disconnected = false; this.destroyed = false; FakePeer.instances.push(this); }
  once(evt, fn) { (this.listeners[evt + ':once'] ||= []).push(fn); }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...args) {
    (this.listeners[evt + ':once'] || []).splice(0).forEach(fn => fn(...args));
    (this.listeners[evt] || []).forEach(fn => fn(...args));
  }
  connect(id) { const c = new FakeConn(id); FakePeer.conns.push(c); return c; }
  reconnect() { this.disconnected = false; }
  destroy() { this.destroyed = true; }
}

async function setup() {
  FakePeer.instances = []; FakePeer.conns = [];
  const scheduled = [];
  const { window } = await loadApp({
    url: 'https://example.test/index.html?j=ABCD',
    beforeParse(win) {
      win.Peer = FakePeer;
      win.setTimeout = (fn, ms) => { scheduled.push({ fn, ms }); return scheduled.length; };
    },
  });
  const peer = FakePeer.instances[0];
  peer.emit('open'); // -> connectToHost()
  const conn = FakePeer.conns[0];
  conn.emit('open'); // -> sends {t:'hi'}
  return { window, peer, conn, scheduled };
}

test('guest sends hi on connect', async () => {
  const { conn } = await setup();
  assert.equal(conn.sent.length, 1);
  assert.equal(conn.sent[0].t, 'hi');
});

test('a burst of close events schedules exactly one reconnect', async () => {
  const { conn, scheduled } = await setup();
  const before = scheduled.length;
  for (let i = 0; i < 5; i++) conn.emit('close');
  assert.equal(scheduled.length - before, 1);
});

test('poll vote click sends vote; rapid second click is rate-limited', async () => {
  const { window, conn } = await setup();
  conn.emit('data', { t: 'state', act: { id: 'a1', kind: 'poll', title: 'x', opts: ['a', 'b'] } });
  const buttons = window.document.querySelectorAll('#gMain .opts button');
  assert.equal(buttons.length, 2);

  buttons[0].click();
  assert.equal(conn.sent.length, 2); // hi + vote
  assert.deepEqual(conn.sent[1], { t: 'vote', a: 'a1', v: 0 });

  buttons[0].click();
  assert.equal(conn.sent.length, 2); // second click did not send
  assert.ok(window.document.querySelector('.toast.warn'));
});
