# DUSK APEX — Single-Seater Racing

An original, lightweight 3D single-seater racing game for the browser.
Race 8 AI rivals around Aurelia Park, an original ~3.5 km daylight
circuit with west esses, a hairpin, chicane and long back straight — with tyre strategy, active aero, optional
damage, pit stops, live timing and a full race-results loop.

**No F1 branding, no copied circuits, no external assets.** Every model,
texture and sound is generated procedurally in code (see `ASSET_CREDITS.md`).
The whole game ships as **one self-contained `index.html` (~605 KB,
~162 KB gzipped)** — far below the 50 MB budget.

## ▶ How to play (for the project owner)

**Option A — GitHub Pages (primary test environment):**
After the Pull Request is merged, the game deploys automatically to:

**https://s16404367-code.github.io/crazy/**

In the repository's **Settings → Pages**, the source must be **GitHub Actions**
(not "Deploy from a branch"). Then open that URL in Chrome/Edge, click **RACE**,
and press **F11** for a true full-screen gaming view (F11 again exits).

**Option B — ZIP file:**
Extract `DUSK_APEX_v0.11.0_playable.zip` and double-click `index.html`.
No install, no server needed.

## 🎮 Controls

| Action | Key |
|---|---|
| Steer | A / D or ← → |
| Accelerate | W or ↑ |
| Brake / Reverse | S or ↓ |
| Active Aero (straights only) | Space |
| Camera (Chase / Far / Cockpit) | C |
| Request pit stop | P — autopilot uses fast lane, then YOUR orange box lane/garage |
| Choose next pit tyre | T |
| Reset car to track | R |
| Pause | Esc |
| Full screen (browser) | F11 |

Touch devices get on-screen buttons (optional tilt steering in Settings).
Gamepad: left stick + RT/LT. You start **P9 of 9** — fight through the field!

## ✨ Features (v0.11.0)

- Original fictional 3,502 m Aurelia Park circuit: fast Turn 1, west
  esses, long back straight, hairpin, chicane, final corner; source outline
  is documented in `docs/original-circuit.svg` (not copied from the web)
- Fixed-timestep (120 Hz) arcade-sim physics — v0.11 steering lock speed,
  yaw inertia, load-sensitive grip and controlled slip; identical at any
  refresh rate
- 8 AI rivals: racing line, braking, overtaking, defending, recovery,
  pit strategy — same physics/tyres/aero rules as the player, no rubber-banding
- Countdown lights, invisible 3-sector timing (no painted sector lines),
  live positions/gaps, timing tower, minimap, fastest lap, HUD + waved
  marshal-post yellow flags, race-control messages, results & restart
- Tyres: Soft / Medium / Hard with gradual degradation + pit stops
- Two-lane pits: a FAST lane for through traffic and a BOX/service lane;
  nine individual garages. Press P and autopilot uses the fast lane, blends
  into YOUR orange box, services, exits and returns control
- Continuous paved entry/exit aprons aligned with the road (no soil gap),
  physical divider wall with marked gaps and cones
- Animated cars: tread/spokes/markers make rotation visible; front wheels
  use the real physics steering angle with Ackermann geometry and camber;
  turning cockpit wheel, driver movement, suspension and opening aero flap
- Active aero zones on both straights (player + AI, same rules)
- Optional damage (ON/OFF): light/medium/heavy with grip & top-speed loss,
  visible front-wing damage, pit to repair
- Daylight scene in every weather: Clear Day / Overcast / Light Rain
- Procedural audio: RPM engine, shifts, skid, kerbs, impacts, UI
- Settings persist locally; Low/Medium/High quality (Low targets 4 GB Chromebooks)
- CrazyGames SDK wrapper isolated and safe without the SDK (see `src/sdk/`)

## 🧪 Testing status (honest evidence labels)

- **CODE VERIFIED (v0.11.0):** production build succeeds (605 KB single
  file, 162 KB gzip); three consecutive headless 9-car/3-lap races passed,
  including a front-wheel-angle regression check, yellow-sector detection,
  individual boxes, and a focused test where a fast-lane car passes a car
  being serviced with 4.6 m lane separation and stops at its later box.
  The generated original-circuit SVG validates as XML; a local `/crazy/`
  subdirectory serve returned HTTP 200 on load/refresh with no 404 log
  entries; DOM ID cross-check 99/99.
- **OWNER-REPORTED / FIXED IN CODE:** v0.10 testing found stagnant-looking
  front wheels, weak cornering response, sunset lighting, visible sector
  lines, a soil break at pit entry/exit and one-lane pit blocking. v0.11
  fixes the wheel-angle zeroing bug, retunes dynamics, uses daylight,
  removes sector paint, paves/tapers the aprons, and adds fast + box lanes.
- **NOT TESTED (yet):** v0.11 real-browser appearance and human driving
  feel, live GitHub Pages deployment from the **GitHub Actions** source,
  physical Chromebook/touch performance, CrazyGames environment. Owner
  browser testing remains the next gate — see the PR description.
- **Track-source boundary:** no real-world circuit SVG was copied. The
  layout is newly authored fictional geometry, exported to
  `docs/original-circuit.svg` for inspection.

## 🛠 Develop

```bash
npm install
npm run dev      # local dev server
npm run smoke    # headless 9-car race simulation test
npm run build    # production build → dist/index.html (single file)
```

Key docs: `ARCHITECTURE.md`, `CHANGELOG.md`, `ASSET_CREDITS.md`,
`docs/original-circuit.svg`, and the
governing spec in `docs/MASTER_PROMPT_v3.0.md` + `docs/BOUNDARIES_v3.0.md`.

## 📋 Project governance note

The Master Prompt (§50) prescribes incremental phase-by-phase delivery.
On 2026-10-24 the project owner explicitly approved building Phases 1–4 in
one delivery instead (Conflict Resolution Protocol, §44). This is recorded
in `CHANGELOG.md`. From here the normal loop resumes:
**BUILD → COMMIT → PUSH → GITHUB PAGES → TEST → REPORT → FIX → REPEAT.**
