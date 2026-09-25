# popvote

Live audience polling that never leaves the room — one HTML file, no server, no accounts, no monthly meter.

## What it is

**Four activity types** that run live in the host's browser:
- **Multiple-choice poll** — live bar chart, animated
- **Word cloud** — free text (≤30 chars), spiral-placement layout, seeded for determinism
- **Open Q&A** — guests submit questions, upvote others; host marks answered/hides
- **Rating scale** — 1–5, live average + distribution

Live **emoji reactions** float up on the host screen. **Instant Recap** generates a self-contained, shareable HTML report at session end.

**How it works**: the presenter's tab is the hub (PeerJS/WebRTC star topology). Guests connect peer-to-peer; host holds all state, never uploaded. Nothing leaves the room — data is structural privacy, not a policy.

**Caveats**: synchronous only (host refresh ends the session in v1). Capacity ceiling is ~100 guests in the browser. Guests auto-rejoin on network drop (6 attempts, backoff).

## Quick start (host)

1. Deploy `index.html` to any HTTPS static host (GitHub Pages, Netlify Drop).
2. Open it in a browser.
3. Click **"New session"** → generates a 4-character room code (no 0/O/1/l/I ambiguity).
4. Share the **QR code** or **link** (includes `?j=CODE` auto-join parameter).
5. Add activities, set titles, configure options.
6. Click **Start** to activate an activity. Guests vote immediately.
7. Click **Close voting** to halt submissions. Click **Reveal results** when ready.
8. At session end, click **End session → Generate Recap** to download a single-file HTML report.

## Joining (guest)

1. Scan the QR code or enter the room code.
2. Vote immediately — no name required unless posting to Q&A (lazy collection).
3. If network drops, auto-rejoin happens silently (6 attempts with backoff).

## Free vs Pro

| | Free | Pro (one-time license) |
|---|---|---|
| Activities per session | 3 | Unlimited |
| Guests | 30 | 100 |
| Instant Recap | Locked — preview thumbnail + upgrade prompt | Full, offline-ready |
| Signaling | PeerJS Cloud | Self-hosted or Cloud |

Blocked actions show friendly feedback: _"Free plan: 3 activities. Unlock unlimited + Instant Recap."_

## Instant Recap

At session end, one click generates `popvote-recap-<date>-<code>.html` — a self-contained report containing:

- **Header**: session title, date, peak guest count, total responses
- **Per-activity charts**: title, final result (poll bars / word cloud / rating distribution) rendered as **SVG** for crisp scaling, response count, winning option highlighted
- **Q&A section**: all questions ranked by upvotes, answered ones badged
- **Participation timeline**: sparkline of responses-per-minute across the session
- **Footer**: "Made with popvote" link (free advert; viral loop #2)

**Offline forever** — no external assets, inline CSS and SVG, opens in any browser. The recap SVG generation reuses the same layout code as the live view with a seeded PRNG (mulberry32), so the report matches exactly what the room saw.

## Licensing (Pro)

Ed25519 offline keys. Host enters a license key once; verified with WebCrypto in-browser; cached in localStorage `pv.license`. No accounts, no server-side validation.

**For maintainers**:
```bash
# Generate keypair (refuses unless .gitignore has *.pem and keys/)
node scripts/keygen.mjs
# Output: prints PV_PUBLIC_KEY to paste into index.html (already done for this repo)

# Sign a license
node scripts/sign-license.mjs --email buyer@example.com [--days 0]
# Output: PV1.<payload>.<sig> — give to customer

# Verify a license (for testing)
node scripts/verify-license.mjs <key> --pubpem keys/public.pem
# Output: JSON { ok, reason, payload }
```

**Browser support**: in-browser verification needs WebCrypto Ed25519 (current Chrome, Firefox 130+, Safari 17+). Older browsers get an "unsupported" message and stay on the free tier.

**Security invariant**: `.gitignore` must contain `*.pem` and `keys/` **before** any keypair is generated. Private PEM is local-only, never committed.

## Self-hosted signaling

Free tier uses PeerJS Cloud. For Pro or self-hosted deployments, set options before the app runs:

```html
<script>
window.POPVOTE_PEER_OPTIONS = {
  host: 'peer.example.com',
  port: 443,
  secure: true,
  path: '/'
};
</script>
```

(PeerJS constructor options; see [PeerJS docs](https://peerjs.com).)

## Limits & safety

- **Message size**: 2 KB max; oversize dropped.
- **Rate limit**: 5 messages/guest/sec at hub; excess dropped silently (except votes, which show "slow down" toast).
- **Emoji reactions**: 1/guest/sec; excess dropped.
- **Q&A**: 200 entries max per session; 500-char reject on submission (UI cap 240).
- **Words**: 30 chars max.
- **Options per poll**: 8 max.
- **One vote per guest per activity**: re-vote replaces; keyed by peer ID at hub.
- **XSS safety**: peer names and questions use `textContent` only, never `innerHTML`.
- **Room full**: visible feedback when capacity is reached.

## Development

No build step.

```bash
npm install      # jsdom (dev only)
npm test         # node:test + jsdom; seeded determinism, XSS, dedupe, license validation
npm run check    # syntax check of inline scripts
```

**Files**:
- `index.html` — entire app
- `spike.html` — Phase-0 spike (throwaway; proved burst fan-in + recap generation)
- `scripts/keygen.mjs`, `sign-license.mjs`, `verify-license.mjs` — license tooling
- `test/` — test suite (reconnect, license, layout determinism, rate limits)

**Docs**:
- `RDD.md` — full product spec (wire protocol, gating logic, acceptance criteria)
- `HANDOFF.md` — phase progress, test numbers, known gaps

**CI**: GitHub Actions runs `npm test` + `npm run check`.

## Non-goals (v1)

- Host refresh/reclaim survival (v2)
- Quizzes / leaderboards (v2 expansion candidate)
- PowerPoint / Slides integration
- Persistent Q&A between sessions (impossible without relay; synchronous-only is structural)
- Audiences > ~100 (star topology ceiling)

## License

**Source code**: see repository license file.

**popvote Pro license keys**: separate commercial license (one-time purchase, offline Ed25519 verification).
