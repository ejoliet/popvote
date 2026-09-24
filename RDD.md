# popvote — Agent Build Prompt

> Zero-backend live audience polling (polls, word clouds, Q&A) that runs entirely in the presenter's browser tab. One HTML file. Audience joins via QR/link. No accounts, no server, no monthly meter.
>
> **Killer premium feature: Instant Recap** — one click at session end generates a beautiful, self-contained HTML report of the entire session (every poll chart, word cloud SVG, Q&A ranked by upvotes, participation timeline). Generated 100% client-side. This is the feature Slido/Mentimeter paywall hardest and the artifact professional trainers need to justify their fee.

---

## Why this wins

| Incumbent pain (verified 2026) | popvote answer |
|---|---|
| Mentimeter free: 50 participants/**month** cumulative, then 30-day lockout | No meter. P2P = capacity is the host's browser (~100 guests), every session, forever |
| Slido free: 3 polls per event; exports paid-only | Unlimited activities on Pro; Recap is the one-time-purchase hook |
| Both: annual-only billing, $150–336/yr | One-time Ed25519 license, ~$49, offline verification |
| Data goes to vendor cloud (blocker for gov/edu/corp) | Data literally never leaves the room. Privacy is structural, not a policy |

**Payer**: the presenter/trainer/teacher (host seat). **Pain**: monthly meters + paywalled exports. **Reuse**: every workshop. **Moat**: zero-backend privacy story + one-time pricing incumbents cannot copy without destroying their SaaS revenue.

**Viral loop built in**: every session puts the join URL + QR in front of 20–100 people, several of whom are themselves presenters.

---

## Locked stack — do not renegotiate

- Vanilla JS, single `index.html`, no build step. HTTPS deploy (GitHub Pages / Netlify Drop).
- PeerJS **1.5.5**, CDN-pinned (cdnjs). Free PeerJS Cloud for free tier only; config seam `window.POPVOTE_PEER_OPTIONS` for self-hosted signaling (Pro).
- Star topology, host as hub, host-authoritative state. Capacity target 100 guests; hard-cap and show "room full" (visible feedback, never silent).
- Canvas 2D for live visualizations (bar race, word cloud). Emoji as sprites for reactions.
- `localStorage` namespaced `pv.*`, in-memory fallback (artifact preview blocks localStorage).
- Seeded PRNG (mulberry32) for any randomized layout (word cloud placement) so host and recap render identically.
- `AIDEV-` comments for non-obvious mechanisms; `AIDEV-TODO` for deferred work.

## Onboarding — copy verbatim from proven pattern

1. Host clicks "New session" → 4-char ambiguity-free room code (no 0/O/1/l/I).
2. Big on-screen QR + link with `?j=CODE` autofill. Clipboard API with `execCommand` fallback; native share sheet on mobile.
3. Guest opens link → auto-connects → votes immediately. No name prompt unless they post to Q&A (lazy collection).

---

## Product scope (v1)

### Activity types (host creates, reorders, activates one at a time)
1. **Multiple choice poll** — live bar chart, animated.
2. **Word cloud** — free text ≤ 30 chars, spiral-placement layout, seeded.
3. **Open Q&A** — guests submit questions, upvote others; host can mark answered/hide.
4. **Rating scale** — 1–5, live average + distribution.

### Live reactions
Guests tap emoji → floats up on host screen. Throttle client-side (max 1/sec/guest) and drop excess at hub.

### Free vs Pro gating (gate the host seat, never participation)

| | Free | Pro (one-time license) |
|---|---|---|
| Activities per session | 3 | Unlimited |
| Guests | 30 | 100 (browser ceiling) |
| Instant Recap | Locked — show preview thumbnail + upgrade CTA | Full |
| Signaling | PeerJS Cloud | Self-hosted config seam |

Blocked actions show visible, friendly feedback ("Free plan: 3 activities. Unlock unlimited + Instant Recap").

### Licensing
- Ed25519 offline license keys. Public key baked into client. Validate once at session creation; cache result in `pv.license`.
- **Security invariant: write `.gitignore` for `*.pem` and any `keys/` dir in the FIRST commit, BEFORE generating any keypair.** Private PEM is local-only, never committed. (Prior incident: cullroom. Non-negotiable.)
- Merchant of record: Lemon Squeezy.

---

## Killer feature spec — Instant Recap

**Trigger**: host clicks "End session → Generate Recap".

**Output**: single self-contained `popvote-recap-<date>-<code>.html` file, downloaded via Blob URL. No external assets — inline CSS, inline SVG charts, inline data. Opens offline forever.

**Contents, in order**:
1. Header: session title, date, peak guest count, total responses.
2. Per activity, in session order: title, final chart (bar/word cloud/distribution rendered as **SVG**, not canvas snapshot — must be crisp at any size), response count, and for polls the winning option highlighted.
3. Q&A section: all questions ranked by upvotes, answered ones badged.
4. Participation timeline: SVG sparkline of responses/minute across the session.
5. Footer: "Made with popvote" + link (free advert in every shared recap — this is the second viral loop).

**Rendering rule**: recap SVG generation must reuse the same layout code as the live view (shared pure functions, seeded PRNG) so the recap matches what the room saw. `AIDEV-` comment the seam.

**Quality bar**: the recap must look like a deliverable a paid trainer forwards to a client unedited. Spend real effort on its typography and layout. This file IS the product.

---

## Wire protocol

JSON, short type tags. Normalize incoming ArrayBuffer → string before parse. All schemas exact:

```
guest → host
{t:"hi", n?:string}                          // join; name optional
{t:"vote", a:string, v:number|string}        // a=activityId, v=optionIdx|word|rating
{t:"q", a:string, txt:string, n:string}      // Q&A submit
{t:"up", a:string, qid:string}               // upvote
{t:"rx", e:string}                           // reaction emoji

host → guest
{t:"state", act:{id,kind,title,opts?}|null, closed?:true}  // current activity (never raw tallies to guests unless host reveals)
{t:"reveal", a:string, agg:{...}}            // host-triggered result reveal
{t:"qs", a:string, list:[{qid,txt,n,up,ans}]}// Q&A snapshot (throttled, max 1/sec)
{t:"full"}                                   // room at cap
{t:"end"}                                    // session over
```

Rules:
- One vote per guest per activity (keyed by peer ID at hub; re-vote replaces).
- Dedupe upvotes per guest per question at hub.
- Q&A broadcast is throttled/coalesced at 1 Hz — never per-message fan-out.

## Inbound data caps (mandatory — host memory protection)

- Max message size 2 KB; drop and warn oversize.
- Max 200 Q&A entries per session, 500 char reject on `txt` (UI cap 240).
- Max 5 in-flight messages per guest per second at hub; excess dropped silently except votes (votes get a "slow down" toast client-side).
- XSS-escape nothing on `textContent` assignment (no double-escape); never `innerHTML` with peer strings.

## Resilience — copy verbatim

- Single peer instance, `once('open')`, `retryPending` guard, backoff reconnect capped at 6 attempts.
- Guest auto-rejoin on drop; on rejoin host re-sends `state`.
- Host `beforeunload` guard ("Session is live — leaving ends it").
- Host tab holds all state; guests hold nothing durable. Host refresh = session over in v1 (host-reclaim is `AIDEV-TODO` v2 — do NOT build now).

---

## Build phases — GO/NO-GO gated

### Phase 0 — Spike (no product code until this passes)
Single throwaway `spike.html` proving the two hardest primitives:
1. **Burst fan-in**: 100 synthetic guest connections (or loopback-simulated messages) delivering votes within a 2-second window; hub aggregates with zero loss, UI stays responsive (measure with `performance.now`, log worst frame).
2. **Recap generation**: serialize a fake session (3 activities, 50 words, 20 questions) → self-contained HTML with inline SVG word cloud + bar chart → downloads and opens offline, seeded layout identical across two runs.

**GO criteria**: both pass in Chrome + Firefox + iOS Safari. Log burned items to `HANDOFF.md`. NO-GO → stop, report.

### Phase 1 — Core loop
Host creates session, 4 activity types, guest join/vote, live viz, reactions, caps, resilience. Done when a two-device manual test runs a full 4-activity session cleanly.

### Phase 2 — Instant Recap
Shared layout functions extracted, recap generator, download flow. Done when recap of a real Phase-1 session passes the "forward to a client unedited" bar.

### Phase 3 — Monetization
Gitignore check FIRST. Keygen script (local-only), license validation, free-tier gates with visible feedback, upgrade CTA, `window.POPVOTE_PEER_OPTIONS` seam. Done when: forged key rejected, valid key unlocks, free gates show friendly messages.

### Phase 4 — Polish + tests
- jsdom test suite: seeded word-cloud determinism, localStorage roundtrip + in-memory fallback, XSS handling of peer names/questions, reconnect guard, one-vote-per-guest dedupe, upvote dedupe, message-size cap rejection, license signature verify (valid/forged/expired).
- Node syntax check in CI (single GitHub Action).
- Manual two-machine checklist in `HANDOFF.md`, explicitly flagging untested paths (multi-guest reconnect storms).

---

## Commit hygiene

- First commit: `.gitignore` (`*.pem`, `keys/`, `.env`, `CLAUDE.local.md`) + `README.md` stub + `HANDOFF.md`.
- Conventional commits, one concern per commit.
- `HANDOFF.md` updated at every phase boundary: state, burned items, open questions, exact next step.
- Never commit: private keys, test license keys, personal URLs.

## Acceptance criteria (final)

- [ ] Single `index.html`, no build step, works from `file://` for host-only demo and HTTPS for real sessions
- [ ] Phase 0 spike results recorded in `HANDOFF.md` with numbers
- [ ] 100-guest burst fan-in: zero vote loss, main thread never blocked > 50 ms
- [ ] Instant Recap: self-contained, offline, crisp SVG, deterministic layout, footer link
- [ ] Free gates visible and friendly; Pro unlock via Ed25519 offline key; forged keys rejected
- [ ] No `*.pem` anywhere in git history
- [ ] All jsdom tests pass; untested paths named in `HANDOFF.md`

## Non-goals (v1)

- Host refresh/reclaim survival (v2)
- Quizzes/leaderboards (v2 — biggest expansion candidate)
- PowerPoint/Slides integration
- Persistent Q&A between sessions (impossible without relay — synchronous-only is a stated design decision)
- Audiences > ~100 (star ceiling; do not pitch conferences)

## Open questions (resolve before Phase 1)

- [ ] Final name (`popvote` placeholder — check domain/collisions)
- [ ] Free guest cap: 30 vs 25 (pick one, keep gating copy consistent)
- [ ] Recap in free tier: fully locked vs watermarked first activity (recommend: locked with rendered preview thumbnail — show, don't tell)
