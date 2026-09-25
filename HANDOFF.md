# HANDOFF

## State (2026-09-24)
- Phase 0 spike: **GO** (Chrome only). `spike.html` is throwaway.
- Phase 1 core loop: built in `index.html` (host, 4 activity types, guest join/vote, canvas live viz, reactions, caps, reconnect guard). Verified with an in-page fake Peer harness + headless Chrome screenshots, NOT with real WebRTC between two devices.
- Phase 2 Instant Recap: built. Shared layout fns (`PV.layoutWordCloud/layoutBars/layoutDist`) drive both canvas and SVG. Deterministic (tests + spike).
- Phase 3 monetization: keygen/sign/verify scripts, `PV.PUBLIC_KEY` baked in (keypair generated locally on 2026-09-24, private half in ignored `keys/`), free gates with toasts, `window.POPVOTE_PEER_OPTIONS` seam. Buy link points at a placeholder Lemon Squeezy URL.
- Phase 4: 34 jsdom/vm tests pass (`npm test`), syntax check (`npm run check`), GitHub Action `.github/workflows/ci.yml`.

## Phase 0 numbers (HeadlessChrome 154, macOS)
Command: `chrome --headless --disable-gpu --virtual-time-budget=20000 --dump-dom spike.html`

| Metric | Value | Criterion |
|---|---|---|
| distinct voters | 100 | 100 |
| tally sum | 100 (25/25/25/25) | 100, zero loss |
| worst main-thread gap | 4.8 ms (5.8 ms in a second run) | < 50 ms |
| oversize (3 KB) dropped | 10 / 10 | 10 |
| rate-limited spam dropped | 75 | informational |
| recap byte-identical across 2 runs | true | true |
| words placed / overlaps | 50 / 0 | ≥ 45 / 0 |
| recap size | 8.5 KB | self-contained |

## Burned items
- Spiral step sizes matter: coarse steps fail to place 50 words. Product layout uses 0.2 rad / 0.5 px steps, x stretched 1.4×aspect, plus an adaptive font scale (total box area ≤ 40% of canvas) → 50/50 and 100/100 placed.
- Canvas cloud was blank: draw loop cleared every frame but only redrew when dirty. Now layout is cached and drawn every frame.
- `Map.get(pid) || -1e9` treated a timestamp of 0 as missing → reaction rate limit never engaged for that guest. Use `.has()`.
- Base64url "last char flip" is not a forgery (padding bits). Forge tests must alter a middle char.
- `node --test test/` fails on Node 26 (directory positional); package.json uses an explicit glob.
- Hub checks message size before consuming a rate-limit token.

## Untested paths (be explicit before shipping)
- Real two-device session over PeerJS Cloud / WebRTC (only fake in-page Peer used).
- Firefox and iOS Safari: spike and app not run. Ed25519 WebCrypto on iOS Safari < 17 will report "unsupported".
- Multi-guest reconnect storms; host `peer.reconnect()` after signaling drop.
- Clipboard fallback and native share sheet on mobile.
- CI workflow has not executed on GitHub yet.
- Recap download via Blob URL in Safari (known to sometimes open in-tab instead of downloading).

## Manual two-machine checklist
1. Deploy `index.html` over HTTPS. Host: New session → code appears, QR renders.
2. Phone: scan QR → lands on guest view "Connected · CODE".
3. Host adds poll, cloud, rating, Q&A (4th blocked on Free with toast; enter license → allowed).
4. Poll: vote from phone, change vote, host sees count update; Reveal → phone shows bars.
5. Cloud: send word, host canvas shows it; second word replaces.
6. Rating: 1–5 tap, host avg updates.
7. Q&A: ask with name, upvote (button disables), host marks answered → phone list shows "answered", host Hide removes it.
8. Reactions: tap emoji, floats on host; spam taps throttled.
9. Phone: airplane mode 5 s → reconnects, vote re-sent, status returns to Connected.
10. Host: End session → Free shows preview + CTA; Pro downloads `popvote-recap-*.html`, opens offline, matches what the room saw.
11. Host: attempt tab close during session → beforeunload prompt.

## Open questions (resolved for v1 by the implementing agent, revisit if wrong)
- Name: kept `popvote`; domain/collision check not done. Footer/buy links are placeholders (`popvote.app`, `popvote.lemonsqueezy.com`).
- Free guest cap: **30**.
- Recap on free tier: **locked with rendered preview thumbnail**.

## Exact next step
Run the two-machine checklist above on real devices (Chrome desktop host + iOS Safari guest), then re-run `spike.html` in Firefox and iOS Safari and record numbers here.
