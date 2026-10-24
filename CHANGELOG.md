# Changelog

## v0.9.0 — First full playtest build (2026-10-24)

Initial playable game, covering Master Prompt Phases 1–4 in a single
delivery at the project owner's explicit request (deviation from §50
incremental delivery, approved by the owner on 2026-10-24 per the §44
Conflict Resolution Protocol). Incremental GitHub-test-first development
resumes from this baseline.

### Added
- Original 3,501 m dusk circuit (hairpin, chicane, long back straight,
  sweepers) generated from one data-driven centreline definition
- Fixed-timestep (120 Hz) arcade-sim vehicle physics: grip limits,
  downforce, weight-transfer visuals, kerb/off-track behaviour, collisions
- 8 AI rivals with racing line, braking, overtaking, defending, traffic
  anticipation, recovery and pit strategy (same rules as the player)
- Full race loop: grid, 5-light countdown, laps, 3 sectors, live
  positions/gaps, timing tower, minimap, fastest lap, yellow flags,
  results, restart, return to menu
- Tyre compounds (Soft/Medium/Hard) with gradual degradation; pit stops
  (lane, limiter, box, ~3 s service, damage repair) for player and AI
- Active aero zones on both straights with HUD state (player + AI)
- Optional damage OFF/ON (light/medium/heavy, performance + visual effects)
- Weather: Clear (dusk) / Overcast / Light Rain with grip changes
- Procedural WebAudio: engine, gear shifts, skid, kerb, wind, impacts, UI
- Settings: steering sensitivity, quality (Low/Medium/High), damage, four
  volume sliders, tilt steering; persisted locally with graceful fallback
- Touch controls + landscape prompt; gamepad support; 3 cameras
- CrazyGames SDK isolation wrapper (no-ops outside CrazyGames)
- GitHub Actions: build + headless race test on PRs, deploy to Pages on main
- Headless smoke test (`npm run smoke`): full 9-car race simulation

### Fixed during development (found by the smoke test, before release)
- Countdown no longer makes locked cars reverse off the grid
- Car-to-car damage softened so minor contact cannot wreck a race
- Tyre wear rates rebalanced (softs previously died within 2 laps)
- Pit entry redesigned: moved onto the main straight on the final-corner
  exit side (corner-entry design caused AI wall strikes), two-phase
  approach so pitting cars are not roadblocks, one-service-per-visit
  latch, overshoot-retry no longer retriggers after a successful stop,
  pit-exit merge discipline

### Verification at release
- CODE VERIFIED: production build OK (single file ~580 KB / ~155 KB gzip);
  smoke test all-pass across repeated runs; served from `/crazy/`
  subdirectory with HTTP 200 and zero 404s; DOM id cross-check 99/99.
- NOT TESTED: real-browser rendering & game feel, live GitHub Pages
  deployment (requires PR merge), physical Chromebook/touch hardware,
  CrazyGames environment. Owner test script is in the release PR.
