import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './helpers.mjs';

const PV = loadCore();

function buildSession() {
  const hub = PV.createHub({ maxGuests: 60, now: 0 });
  const poll = hub.addActivity({ kind: 'poll', title: 'Poll', opts: ['a', 'b', 'c', 'd'] });
  const cloud = hub.addActivity({ kind: 'cloud', title: 'Cloud' });
  const rating = hub.addActivity({ kind: 'rating', title: 'Rating' });
  const qa = hub.addActivity({ kind: 'qa', title: 'QA' });
  let n = 0;
  const send = (a, pid, m) => { hub.addGuest(pid, 0); hub.handle(pid, JSON.stringify({ a: a.id, ...m }), n++); };
  hub.activate(poll.id, 0); for (let i = 0; i < 8; i++) send(poll, 'pp' + i, { t: 'vote', v: i % 4 });
  hub.activate(cloud.id, 0); for (let i = 0; i < 20; i++) send(cloud, 'pc' + i, { t: 'vote', v: 'w' + (i % 7) });
  hub.activate(rating.id, 0); for (let i = 0; i < 5; i++) send(rating, 'pr' + i, { t: 'vote', v: (i % 5) + 1 });
  hub.activate(qa.id, 0);
  const texts = ['first', 'second', 'third', 'fourth', 'fifth'];
  texts.forEach((txt, i) => send(qa, 'pq' + i, { t: 'q', txt }));
  const qids = qa.questions.map(q => q.qid);
  // give distinct upvote counts: last question gets most upvotes
  qids.forEach((qid, i) => { for (let u = 0; u <= i; u++) send(qa, 'up' + qid + u, { t: 'up', qid }); });
  hub.markAnswered(qa.id, qids[0]);
  return hub.export({ title: 'My Session', code: 'ABCD', endedAt: 60000 });
}

test('buildRecap is deterministic and contains expected structure', () => {
  const S = buildSession();
  const html1 = PV.buildRecap(S);
  const html2 = PV.buildRecap(S);
  assert.equal(html1, html2);

  const svgCount = (html1.match(/<svg/g) || []).length;
  assert.ok(svgCount >= 4, `expected >=4 <svg, got ${svgCount}`);
  assert.equal(/<script/i.test(html1), false);
  assert.ok(html1.includes('Made with'));

  const httpCount = (html1.match(/http/g) || []).length;
  assert.equal(httpCount, svgCount + 1); // one xmlns per svg + one footer link

  // Q&A ordered by upvotes descending: 'fifth' had most upvotes, 'first' fewest.
  // Match the rendered question text node (`>word<`), not the "first-child" CSS rule.
  const iFifth = html1.indexOf('>fifth<');
  const iFirst = html1.indexOf('>first<');
  assert.ok(iFifth > -1 && iFirst > -1 && iFifth < iFirst);

  // the answered question ('first', fewest upvotes) is marked with class "ans"
  const ansIdx = html1.indexOf('class="ans"');
  assert.ok(ansIdx > -1 && ansIdx < iFirst);
});

test('recapFilename is lowercase and dated', () => {
  const S = buildSession();
  const name = PV.recapFilename(S);
  assert.match(name, /^popvote-recap-\d{4}-\d{2}-\d{2}-abcd\.html$/);
});
