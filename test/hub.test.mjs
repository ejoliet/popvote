import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, loadApp } from './helpers.mjs';

const PV = loadCore();
const msg = o => JSON.stringify(o);

test('one vote per guest, revote replaces (last value wins)', () => {
  const hub = PV.createHub({ maxGuests: 100 });
  const a = hub.addActivity({ kind: 'poll', title: 'p', opts: ['a', 'b', 'c', 'd'] });
  hub.activate(a.id, 0);
  const last = {};
  for (let i = 1; i <= 100; i++) {
    const pid = 'g' + i;
    hub.addGuest(pid, 0);
    for (let k = 0; k < 4; k++) {
      const v = (i + k) % 4;
      hub.handle(pid, msg({ t: 'vote', a: a.id, v }), 0);
      last[pid] = v;
    }
  }
  assert.equal(a.votes.size, 100);
  for (const pid in last) assert.equal(a.votes.get(pid), last[pid]);
});

test('upvote dedupe per guest per question', () => {
  const hub = PV.createHub({ maxGuests: 10 });
  const a = hub.addActivity({ kind: 'qa', title: 'q' });
  hub.activate(a.id, 0);
  hub.addGuest('p1', 0); hub.addGuest('p2', 0);
  hub.handle('p1', msg({ t: 'q', a: a.id, txt: 'hi?' }), 0);
  const qid = a.questions[0].qid;
  const r1 = hub.handle('p2', msg({ t: 'up', a: a.id, qid }), 0);
  assert.equal(r1.drop, undefined);
  const r2 = hub.handle('p2', msg({ t: 'up', a: a.id, qid }), 0);
  assert.equal(r2.drop, 'dupe');
  assert.equal(a.questions[0].up.size, 2); // p1 (asker) + p2
});

test('oversize message dropped and counted', () => {
  const hub = PV.createHub({ maxGuests: 5 });
  hub.addGuest('p1', 0);
  const r = hub.handle('p1', msg({ t: 'hi', n: 'x'.repeat(3000) }), 0);
  assert.equal(r.drop, 'oversize');
  assert.equal(hub.dropped.oversize, 1);
});

test('rate limit: 6th message within 1s dropped, resets after 1s', () => {
  const hub = PV.createHub({ maxGuests: 5 });
  hub.addGuest('p1', 0);
  for (let i = 0; i < 5; i++) assert.equal(hub.handle('p1', msg({ t: 'hi' }), 0).drop, undefined);
  assert.equal(hub.handle('p1', msg({ t: 'hi' }), 0).drop, 'rate');
  assert.equal(hub.handle('p1', msg({ t: 'hi' }), 1000).drop, undefined);
});

test('ArrayBuffer and Uint8Array payloads are parsed', async () => {
  // AIDEV-NOTE: `data instanceof ArrayBuffer` inside PV.normalizeMsg checks
  // against the realm it runs in. jsdom's window.TextEncoder is Node's own
  // TextEncoder (cross-realm), so build the bytes with window.Uint8Array
  // directly (ASCII-only JSON) to get a same-realm ArrayBuffer.
  const { window, PV: appPV } = await loadApp();
  const hub = appPV.createHub({ maxGuests: 5 });
  hub.addGuest('p1', 0);
  const json = msg({ t: 'hi' });
  const bytes = new window.Uint8Array(Array.from(json, c => c.charCodeAt(0)));
  assert.equal(hub.handle('p1', bytes.buffer, 0).drop, undefined);
  hub.addGuest('p2', 0);
  assert.equal(hub.handle('p2', bytes, 0).drop, undefined);
});

test('votes for inactive/closed activity are dropped', () => {
  const hub = PV.createHub({ maxGuests: 5 });
  const a = hub.addActivity({ kind: 'poll', title: 'p', opts: ['a', 'b'] });
  hub.addGuest('p1', 0);
  assert.equal(hub.handle('p1', msg({ t: 'vote', a: a.id, v: 0 }), 0).drop, 'inactive');
  hub.activate(a.id, 0); hub.close(0);
  assert.equal(hub.handle('p1', msg({ t: 'vote', a: a.id, v: 0 }), 0).drop, 'inactive');
});

test('Q&A cap and text length limits', () => {
  const hub = PV.createHub({ maxGuests: 250 });
  const a = hub.addActivity({ kind: 'qa', title: 'q' });
  hub.activate(a.id, 0);
  for (let i = 0; i < 200; i++) {
    const pid = 'p' + i;
    hub.addGuest(pid, 0);
    assert.equal(hub.handle(pid, msg({ t: 'q', a: a.id, txt: 'q' + i }), 0).drop, undefined);
  }
  hub.addGuest('p200', 0);
  assert.equal(hub.handle('p200', msg({ t: 'q', a: a.id, txt: 'one more' }), 0).drop, 'qa-full');
  const hub2 = PV.createHub({ maxGuests: 5 });
  const a2 = hub2.addActivity({ kind: 'qa', title: 'q' });
  hub2.activate(a2.id, 0);
  hub2.addGuest('p1', 0);
  assert.equal(hub2.handle('p1', msg({ t: 'q', a: a2.id, txt: 'x'.repeat(501) }), 0).drop, 'length');
});

test('unknown guest, guest cap, vote range, hi effect, rx-rate', () => {
  const hub = PV.createHub({ maxGuests: 2 });
  assert.equal(hub.handle('nobody', msg({ t: 'hi' }), 0).drop, 'unknown-guest');
  assert.equal(hub.addGuest('g1', 0), true);
  assert.equal(hub.addGuest('g2', 0), true);
  assert.equal(hub.addGuest('g3', 0), false);
  assert.equal(hub.peak, 2);

  const poll = hub.addActivity({ kind: 'poll', title: 'p', opts: ['a', 'b'] });
  const rating = hub.addActivity({ kind: 'rating', title: 'r' });
  hub.activate(poll.id, 0);
  assert.equal(hub.handle('g1', msg({ t: 'vote', a: poll.id, v: 5 }), 0).drop, 'range');
  hub.activate(rating.id, 0);
  assert.equal(hub.handle('g1', msg({ t: 'vote', a: rating.id, v: 0 }), 0).drop, 'range');
  assert.equal(hub.handle('g1', msg({ t: 'vote', a: rating.id, v: 6 }), 0).drop, 'range');

  const hi = hub.handle('g1', msg({ t: 'hi' }), 0);
  assert.equal(hi.effects.some(e => e.kind === 'send' && e.msg.t === 'state'), true);

  // fresh guest so the general 5-msgs/sec limit doesn't mask the rx-specific one.
  // AIDEV-NOTE: this exposes a real app bug (see report) — `hub.rxLast.get(pid) || -1e9`
  // treats a stored timestamp of 0 as "no previous reaction", so rx rate-limiting
  // never engages for a guest whose first reaction lands at t=0. Left failing on purpose.
  hub.maxGuests = 3; hub.addGuest('g4', 0);
  assert.equal(hub.handle('g4', msg({ t: 'rx', e: PV.REACTIONS[0] }), 0).drop, undefined);
  assert.equal(hub.handle('g4', msg({ t: 'rx', e: PV.REACTIONS[0] }), 100).drop, 'rx-rate');
});
