# DUSK APEX — Single-Seater Racing

An original, lightweight 3D single-seater racing game for the browser.
Race 8 AI rivals around an original ~3.5 km dusk circuit with a hairpin,
chicane and long back straight — with tyre strategy, active aero, optional
damage, pit stops, live timing and a full race-results loop.

**No F1 branding, no copied circuits, no external assets.** Every model,
texture and sound is generated procedurally in code (see `ASSET_CREDITS.md`).
The whole game ships as **one self-contained `index.html` (~580 KB,
~155 KB gzipped)** — far below the 50 MB budget.

## ▶ How to play (for the project owner)

**Option A — GitHub Pages (primary test environment):**
After the Pull Request is merged, the game deploys automatically to:

**https://s16404367-code.github.io/crazy/**

Just open that URL in Chrome/Edge and click **RACE**.

**Option B — ZIP file:**
Extract `DUSK_APEX_v0.9.0_playable.zip` and double-click `index.html`.
No install, no server needed.

## 🎮 Controls

| Action | Key |
|---|---|
| Steer | A / D or ← → |
| Accelerate | W or ↑ |
| Brake / Reverse | S or ↓ |
| Active Aero (straights only) | Space |
| Camera (Chase / Far / Cockpit) | C |
| Request pit stop | P |
| Choose next pit tyre | T |
| Reset car to track | R |
| Pause | Esc |

Touch devices get on-screen buttons (optional tilt steering in Settings).
Gamepad: left stick + RT/LT. You start **P9 of 9** — fight through the field!

## ✨ Features (v0.9.0 — Phases 1–4 combined, owner-approved)

- Original 3,501 m circuit: hairpin, chicane, long back straight, sweepers,
  kerbs, runoff, barriers, pit lane, grid, grandstand, floodlights
- Fixed-timestep (120 Hz) arcade-sim physics — identical at any refresh rate
- 8 AI rivals: racing line, braking, overtaking, defending, recovery,
  pit strategy — same physics/tyres/aero rules as the player, no rubber-banding
- Countdown lights, 3 sectors, live positions/gaps, timing tower, minimap,
  fastest lap, yellow flags, race-control messages, results & restart
- Tyres: Soft / Medium / Hard with gradual degradation + pit stops
- Active aero zones on both straights (player + AI, same rules)
- Optional damage (ON/OFF): light/medium/heavy with grip & top-speed loss,
  visible front-wing damage, pit to repair
- Dusk identity + weather: Clear / Overcast / Light Rain (grip changes)
- Procedural audio: RPM engine, shifts, skid, kerbs, impacts, UI
- Settings persist locally; Low/Medium/High quality (Low targets 4 GB Chromebooks)
- CrazyGames SDK wrapper isolated and safe without the SDK (see `src/sdk/`)

## 🧪 Testing status (honest evidence labels)

- **CODE VERIFIED:** production build succeeds; automated headless race
  simulation (`npm run smoke`) drives a full 9-car, 3-lap race — lap/sector
  timing, countdown grid-hold, pit stops, no stuck cars, no NaN states;
  built file served from a `/crazy/` subdirectory returns 200 with no 404s.
- **NOT TESTED (yet):** real-browser rendering/gameplay feel, GitHub Pages
  deployment (needs the PR merge), physical Chromebook performance, touch
  devices, CrazyGames environment. These need owner testing per the spec —
  see the PR description for the exact test script.

## 🛠 Develop

```bash
npm install
npm run dev      # local dev server
npm run smoke    # headless 9-car race simulation test
npm run build    # production build → dist/index.html (single file)
```

Key docs: `ARCHITECTURE.md`, `CHANGELOG.md`, `ASSET_CREDITS.md`, and the
governing spec in `docs/MASTER_PROMPT_v3.0.md` + `docs/BOUNDARIES_v3.0.md`.

## 📋 Project governance note

The Master Prompt (§50) prescribes incremental phase-by-phase delivery.
On 2026-10-24 the project owner explicitly approved building Phases 1–4 in
one delivery instead (Conflict Resolution Protocol, §44). This is recorded
in `CHANGELOG.md`. From here the normal loop resumes:
**BUILD → COMMIT → PUSH → GITHUB PAGES → TEST → REPORT → FIX → REPEAT.**
