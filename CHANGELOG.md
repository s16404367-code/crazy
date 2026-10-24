# Changelog

## v0.11.0 — Handling, daylight and two-lane pit upgrade (2026-10-24)

Second owner-feedback release: stagnant front tyres, poor cornering
sensitivity/dynamics, sunset lighting, request for an SVG-style circuit,
visible sector lines, missing yellow flags, soil gaps at pit entry/exit,
and a single-file pit lane where a serviced car blocked the next car.

### Fixed
- Removed a physics bug that set `wheelAngle` and `braking` back to zero
  immediately after calculating them, so the renderer's front wheels and
  brake light now receive the real values
- Reworked steering/dynamics: faster lock and return, sensitivity now also
  changes lock speed for keyboard users, less aggressive speed fade, yaw
  inertia, stronger brakes/lateral limit, trail-brake/power load effects
  and controlled slip beyond ~72% of the lateral limit
- Front wheels now show Ackermann angles and camber; tread grooves plus a
  bright tread block make rolling visible from chase view; left/right wheel
  speeds differ in corners; cockpit wheel follows driver input to ~±155°
- Removed the two painted sector-change lines (sector timing still works)

### Added / changed
- Clear daylight scene for Clear/Overcast/Light Rain: blue sky, white
  clouds, high sun, pale daylight fog and brighter grass/hills
- New Aurelia Park layout: a fresh fictional closed control-point design
  (fast Turn 1, west esses, long back straight, hairpin, return straight,
  chicane). `docs/original-circuit.svg` is generated from the same data.
  No real circuit/web SVG was copied, preserving the originality boundary
- Waved yellow flags: 12 animated marshal posts (4 per sector), HUD flag,
  race-control messages and AI slow-downs; multiple sectors can now be
  yellow at once
- Continuous tapered asphalt aprons connect road and pit complex 120 m
  before entry through 120 m after exit — the soil gap is gone, and the
  apron is a paved physics surface
- Two-lane pit complex: FAST lane at 10.8 m for through traffic and BOX
  lane at 15.4 m for service, separated by a painted yellow line. AI and
  player autopilot remain in the fast lane, blend to their own box only in
  the last ~58 m, then blend back after service

### Verification
- CODE VERIFIED: three consecutive `npm run smoke` full races passed
  (best laps ~74 s), plus focused front-wheel, yellow-sector and
  fast-lane-passing checks (4.6 m separation beside a servicing car);
  production build 605 KB / 162 KB gzip; original-circuit SVG is valid
  XML; local `/crazy/` serve HTTP 200 on load/refresh with no 404s; DOM
  ID cross-check 99/99.
- NOT TESTED: real-browser driving feel/appearance, player autopilot from
  a human entry, live GitHub Pages deployment after changing the Pages
  source to GitHub Actions, and physical Chromebook/touch performance.

## v0.10.0 — Visual and pit-autopilot upgrade (2026-10-24)

Owner feedback release focused on the road appearing as grass, unclear pit
lane separation, static-looking cars, general graphics quality and manual
pit-box stopping.

### Fixed
- Corrected track ribbon triangle winding: road, runoff, kerbs and pit-lane
  faces now point upward instead of being culled and showing grass through;
  ground ribbon materials also render double-sided as a safety net
- Pit autopilot now refuses/aborts an impossible entry once the divider wall
  has begun, and resetting the car cancels autopilot cleanly

### Added / improved
- Richer asphalt and grass textures, painted sector lines, pit entry/exit
  lines, dusk cloud sprites and environment reflections for car paint
- Physical/visual pit divider wall with yellow marker panels, entry/exit
  gaps and orange cones; the wall is collidable in vehicle physics
- Nine individual labelled garages and floor boxes, with the player's garage
  and floor box highlighted orange; every AI uses its own assigned box
- Player pit autopilot: press P, it takes over near pit entry, stops at the
  player's own garage, waits for service, exits under the limiter and then
  hands control back; manual stopped-at-own-box service remains as fallback
- Animated cars: canvas spoked wheel faces with a bright rotation marker,
  cockpit steering wheel, helmet look/bob, opening rear aero flap, wheel
  suspension bounce, stronger roll/pitch and a visual slip-angle offset
- Fictional racing numbers on all cars; browser F11 full-screen guidance in
  the menu/help (no custom in-game fullscreen button, per the boundaries)

### Verification
- CODE VERIFIED: `npm run smoke` passed three consecutive full-race runs
  (individual AI pit boxes and divider-wall physics active); production
  build is 599 KB single-file (160 KB gzip); local `/crazy/` subdirectory
  serve returned HTTP 200 on load/refresh with no 404 log entries; DOM ID
  cross-check 99/99.
- NOT TESTED: v0.10.0 appearance and player autopilot in a real browser,
  live GitHub Pages deployment after switching Pages source to GitHub
  Actions, and physical Chromebook/touch performance. Owner verification is
  the next gate.

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
