# HANDOFF

## State
- Phase 0 spike: **GO** (Chrome only, see numbers). `spike.html` is throwaway.
- Phase 1–4: in progress (`index.html`).

## Phase 0 numbers (HeadlessChrome 154, macOS, 2026-09-24)
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
- Spiral step sizes matter: coarse steps (0.35 rad / 2.2 px) fail to place 50 words in 900×400; fine steps (0.2 / 0.3) place all 50. Production layout scales radius with aspect ratio instead.
- Hub must check message size before consuming a rate-limit token; otherwise oversize junk starves legit votes.
- Spam guests must be excluded from voter counts in the test or they inflate "distinct voters".

## Untested (no browser available on this machine)
- Firefox and iOS Safari were NOT run for the spike. RDD asks for all three; only Chrome verified. Re-run `spike.html` on both before pitching.

## Open questions (resolved for v1 by the implementing agent, revisit if wrong)
- Name: kept `popvote`; domain/collision check not done.
- Free guest cap: **30** (gating copy uses 30).
- Recap on free tier: **locked with rendered preview thumbnail**.

## Next step
- Finish Phase 1 UI in `index.html`, then Phase 2 recap wiring, Phase 3 keygen, Phase 4 tests.
