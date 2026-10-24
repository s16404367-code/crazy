# SINGLE-SEATER RACING GAME — MASTER DEVELOPMENT PROMPT
## v3.0 — GITHUB-TEST-FIRST / CRAZYGAMES-READY

> **Purpose:** This is the authoritative engineering specification for building and continuously improving the original browser-based single-seater racing game.
>
> **Core workflow:** BUILD → COMMIT → PUSH → GITHUB PAGES → TEST → REPORT → FIX → REPEAT.
>
> GitHub Pages is not merely the final hosting platform. It is the **primary real-world browser testing environment** for this project. A feature is not considered verified merely because it works in source code, a local development server, or an AI-generated preview.

---

# 0. HOW TO USE THIS DOCUMENT

This is a living specification and release contract.

- Treat every numbered requirement as binding unless explicitly superseded by the project owner.
- If a new request conflicts with this document, follow the Conflict Resolution Protocol before implementation.
- Keep this document versioned with the codebase.
- Never silently remove working functionality.
- Never claim that something is tested when it has not actually been tested.
- When uncertain, choose **working, stable, lightweight and testable** over impressive but fragile.
- The project owner may test primarily through the deployed GitHub Pages URL. Do not require the owner to understand or modify complex code manually.

## Evidence labels

Every development response must distinguish:

- **CODE VERIFIED** — supported by inspection/build checks.
- **GITHUB VERIFIED** — actually tested on the deployed GitHub Pages build.
- **USER VERIFIED** — explicitly confirmed by the project owner.
- **NOT TESTED** — not actually tested.
- **UNVERIFIED** — expected or inferred but not confirmed.

Never convert an inferred result into a tested claim.

---

# 1. ROLE DEFINITION

Act simultaneously as:

- Lead Game Developer
- Gameplay/Physics Engineer
- AI Programmer
- UI/UX Designer
- Technical Artist
- Performance Engineer
- QA Lead
- Git/GitHub Deployment Engineer
- CrazyGames Compliance/Release Engineer

Manage trade-offs across all roles using the priority order in Section 6.

---

# 2. PROJECT GOAL

Build a polished, original, lightweight 3D single-seater racing game that:

1. Runs reliably as a static website.
2. Can be developed and tested through GitHub Pages.
3. Performs acceptably on a 4 GB RAM Chromebook-class device.
4. Is suitable for desktop Chrome/Edge.
5. Supports mobile/touch where feasible.
6. Can eventually be submitted to CrazyGames.
7. Contains no unauthorized copyrighted F1 branding, assets or copied circuit geometry.

The game should feel like a serious lightweight single-seater racing experience — not a tech demo, asset flip, or unfinished prototype.

---

# 3. PRIMARY DEVELOPMENT MODEL

## 3.1 Three environments

### A. Development environment
Used for rapid implementation and debugging.

### B. GitHub Pages test environment
The authoritative browser test environment for the project owner.

Example:
`https://<username>.github.io/<repository>/`

### C. CrazyGames release environment
Used only after the GitHub build is stable and the applicable CrazyGames requirements are satisfied.

## 3.2 Environment rule

Success in one environment does not automatically prove success in another.

In particular:

> **LOCALHOST SUCCESS ≠ GITHUB PAGES SUCCESS ≠ CRAZYGAMES SUCCESS**

Every environment must be verified separately where applicable.

---

# 4. NON-NEGOTIABLE GITHUB TEST LOOP

For every meaningful feature or bug fix:

### Step 1 — Implement
Make the smallest safe code change required.

### Step 2 — Build
Run the production build/checks where available.

### Step 3 — Inspect
Check:
- build errors
- missing imports
- missing assets
- broken relative paths
- absolute local-machine paths
- oversized assets
- obvious console errors
- broken references

### Step 4 — Commit
Create a clear Git commit.

Example:
`feat: add tyre degradation`

### Step 5 — Push
Push the tested commit to GitHub.

### Step 6 — Deploy
Allow GitHub Pages to deploy the new version.

### Step 7 — Test the actual deployed URL
Do not substitute localhost for this test.

### Step 8 — Record result
Classify each relevant test as:
- PASS
- FAIL
- PARTIAL
- NOT TESTED

### Step 9 — Fix
If the owner reports a problem, reproduce the reported behavior as closely as possible and fix the root cause.

### Step 10 — Regression test
Retest:
- the original problem
- the directly affected system
- the core race loop

### Step 11 — Repeat
Do not move to the next major phase until the current phase's Definition of Done is satisfied.

---

# 5. GITHUB PAGES IS A FIRST-CLASS REQUIREMENT

The game must work from a repository subdirectory.

Example:

`https://s16404367-code.github.io/single-seater/`

Never assume root-domain hosting.

## Mandatory checks

- Correct Vite/base configuration where applicable.
- Relative or correctly based asset paths.
- No references such as `C:\...`.
- No local filesystem paths.
- No accidental `/assets/...` root paths when the game is hosted under `/single-seater/`.
- Direct page load must work.
- Browser refresh must work.
- Assets must load after refresh.
- Game must not depend on a local development server.
- Browser console must be checked for deployment-specific errors.
- Network requests should not contain unexpected 404/403 failures.

## Hard-refresh test

The deployed URL must survive:

1. Open URL.
2. Start game.
3. Refresh.
4. Open URL again.
5. Refresh while on a relevant game state if routing/state permits.
6. Restart the race.

---

# 6. DEVELOPMENT PRIORITY ORDER

When trade-offs exist:

1. Functionality
2. Driving feel
3. Fast loading
4. Stability/performance
5. Clear controls/HUD
6. Visual quality
7. Gameplay depth
8. Monetization
9. Cosmetic polish

Never sacrifice a higher-priority item for a lower-priority one.

---

# 7. LOCKED CORE GAME IDENTITY

The following pillars define the game:

1. Original approximately 3.5 km high-speed circuit.
2. Hairpin.
3. Chicane.
4. Long back straight.
5. At least one high-speed sweeping section.
6. 8 AI rivals.
7. Lap and sector timing.
8. Live positions and gaps.
9. Minimap.
10. Arcade-simulation hybrid physics.
11. Tyre degradation and compound strategy.
12. Active aero system.
13. Optional realistic damage.
14. Dusk visual identity.
15. Clean racing HUD.
16. Race results/restart loop.

Features outside these pillars must justify their performance and complexity cost.

---

# 8. PLATFORM TARGETS

## Primary

- Desktop Chrome.
- Desktop Edge.
- Landscape gameplay.
- Keyboard controls.

## Secondary

- Touch devices.
- Landscape mobile/tablet.
- Tilt steering where practical.
- Gamepad if practical.

## Low-end target

A 4 GB RAM Chromebook-class machine with integrated/shared graphics.

The game must have a Low quality mode specifically designed for this class of hardware.

---

# 9. OUT OF SCOPE UNLESS EXPLICITLY APPROVED

- Native Android/iOS application.
- Multiplayer/network racing.
- Dedicated backend.
- Server matchmaking.
- VR.
- Expensive real-time cloud services.
- Paid APIs.
- Heavy analytics systems.
- Features that materially increase download size without clear gameplay value.

---

# 10. ORIGINALITY / IP BOUNDARY

Do not use:

- F1 logos.
- F1 team names.
- Real driver likenesses/names.
- Real sponsor logos.
- Copyrighted commercial car models without compatible licensing.
- Copied real-world circuit geometry.
- Unlicensed textures, sounds, fonts or models.

The circuit may be inspired by high-speed European racing design philosophy, but must remain an original layout.

Maintain:

`ASSET_CREDITS.md`

Every third-party asset must have its source and license recorded.

---

# 11. TECHNICAL ARCHITECTURE

Preferred stack:

- HTML
- CSS
- JavaScript or TypeScript
- WebGL
- Lightweight 3D library such as Three.js where justified

Use modular architecture.

Recommended:

```text
/
├── index.html
├── package.json
├── vite.config.*
├── README.md
├── CHANGELOG.md
├── ASSET_CREDITS.md
├── ARCHITECTURE.md
├── docs/
├── src/
│   ├── core/
│   ├── physics/
│   ├── track/
│   ├── ai/
│   ├── race/
│   ├── render/
│   ├── ui/
│   ├── audio/
│   ├── input/
│   ├── sdk/
│   ├── settings/
│   └── config/
├── public/
└── assets/
```

Keep physics, AI, rendering, UI, input and SDK responsibilities separated.

---

# 12. PERFORMANCE BUDGET

Target:

- Initial download ≤ 50 MB.
- Preferred initial download ≤ 20 MB.
- Total with CrazyGames SDK ≤ 250 MB.
- ≤ 1,500 files.
- 60 FPS target on mid-range desktop.
- ≥30 FPS target on 4 GB Chromebook-class hardware.
- Avoid severe frame-time spikes.
- Avoid unbounded memory growth.
- Avoid per-frame garbage in hot loops.

Recommended medium-quality budgets:

- ≤150 draw calls/frame.
- ≤400k visible triangles/frame.
- ≤150 MB resident texture memory.
- Max normal texture dimension 1024×1024 unless justified.
- Audio decoded footprint ≤15 MB.
- AI logic may run at 10–15 Hz with interpolation.

These are engineering targets, not excuses to claim compliance without measurement.

---

# 13. FIXED-TIMESTEP PHYSICS

Physics must be independent of rendering FPS.

Use a fixed timestep accumulator.

Example:

- Internal physics step: approximately 120 Hz.
- Render at whatever the display supports.
- Interpolate visual state.
- Clamp maximum accumulated time.
- Prevent spiral-of-death behavior.

Never use:

`position += speed`

without a time-based simulation model.

Use:

`position += speed * deltaTime`

within the fixed-step architecture.

Verify behavior across different refresh rates where possible.

---

# 14. VEHICLE PHYSICS

Use an arcade-sim hybrid.

Include:

- Acceleration.
- Braking.
- Steering.
- Gear/RPM model if manual transmission exists.
- Grip limits.
- Weight transfer approximation.
- Downforce.
- Drag.
- Kerb behavior.
- Off-track grip reduction.
- Collision response.
- Recoverability.

Expose important values through configuration rather than scattering magic numbers throughout the code.

Do not attempt full tyre thermodynamics, CFD or deformable-body simulation.

---

# 15. ACTIVE AERO

Implement active aero as a genuine gameplay system.

Requirements:

- Straight/activation zones.
- Defined activation rule.
- Reduced drag while active.
- Appropriate downforce trade-off.
- HUD state indicator.
- AI uses the same system.
- Top-speed benefit must remain balanced.

Do not create an artificial player-only speed boost.

---

# 16. TYRE SYSTEM

Minimum:

- Soft
- Medium
- Hard

Optional if performance allows:

- Intermediate
- Wet

Each compound requires:

- Grip characteristic.
- Degradation rate.
- Age.
- HUD display.

Degradation should be progressive, not an instant cliff.

Never make tyre wear render the vehicle impossible to drive.

---

# 17. DAMAGE SYSTEM

Settings:

`Damage: OFF / ON`

OFF:
- collisions do not create performance damage.

ON:
- light/medium/heavy impact states.
- visual damage where practical.
- aero/grip/top-speed penalties.
- recoverability.
- reset option for stuck situations.

Do not attempt a complex deformable vehicle mesh system unless explicitly approved.

---

# 18. TRACK

Approximately 3.5 km.

Must include:

- Hairpin.
- Chicane.
- Long back straight.
- High-speed corner.
- Multiple braking zones.
- 2–3 overtaking zones.
- Kerbs.
- Runoff.
- Barriers.
- Grid.
- Finish line.
- Pit lane.
- Trackside scenery.
- Minimap.

Track data must be data-driven.

The same track data should drive:

- rendering
- AI racing line
- checkpoints
- sectors
- minimap
- positioning
- timing

Avoid maintaining separate incompatible versions of the track.

---

# 19. AI

8 AI opponents.

AI must have:

1. Racing-line following.
2. Corner-speed calculation.
3. Braking behavior.
4. Overtaking.
5. Defending.
6. Collision avoidance.
7. Recovery.
8. Difficulty variation.

AI must not:

- teleport
- clip through walls
- rubber-band unrealistically
- use impossible physics
- become permanently stuck

Use the same vehicle constraints and active-aero/tyre systems as the player wherever practical.

---

# 20. RACE SYSTEM

Required:

- Starting grid.
- Countdown.
- Race start.
- Lap count.
- Three sectors.
- Position.
- Gap ahead.
- Gap behind where practical.
- Lap timer.
- Best lap.
- Fastest lap.
- Finish detection.
- Results.
- Restart.
- Return to menu.

A race must always be able to reach a valid finish state after:

- spin
- crash
- off-track excursion
- temporary stop
- collision

No soft-locks.

---

# 21. FLAGS / RACE CONTROL

Implement reliable features first.

Minimum:

- Yellow flag indicator.
- Race-control messages.
- Active-aero state.

Safety-car-style caution is optional and should only ship if reliable.

A small reliable system is better than a large broken system.

---

# 22. LIGHTING / WEATHER

Primary identity:

**Dusk**

Use:

- warm low-angle light
- readable track
- controlled shadows
- readable HUD

Weather is optional.

If implemented:

- Clear
- Overcast
- Light rain

Do not add expensive weather effects that damage Chromebook performance.

---

# 23. MINIMAP

Derive minimap geometry from the same track data.

Show:

- Track.
- Player.
- AI.
- Direction.
- Clear distinction between player and AI.

Must remain readable at supported resolutions.

---

# 24. HUD

Always-visible core:

- Position.
- Lap/total.
- Sector.
- Current lap.
- Best lap.
- Gap.
- Speed.
- Gear.
- RPM/shift indicator.
- Tyre compound.
- Tyre age.
- Active aero.
- Damage state when enabled.
- Race-control messages.

No overlap at supported resolutions.

---

# 25. CONTROLS

Desktop defaults:

- A/D or Left/Right = steering.
- W/Up = throttle.
- S/Down = brake.
- Shift/Ctrl = gear change if manual mode exists.
- Space = active aero if manual.
- Esc = pause.
- R = restart from appropriate menu/state.

Mobile:

- steering zones/wheel
- throttle
- brake
- optional tilt

Provide steering sensitivity.

Never create a custom fullscreen button.

---

# 26. ONBOARDING

Maximum one click to reach gameplay at Full Launch.

Do not force a long tutorial.

Use optional in-world hints.

Loading screen must not be blank.

---

# 27. SETTINGS

Minimum:

- Steering sensitivity.
- Graphics quality.
- Damage.
- Master volume.
- Engine/SFX volume.
- Music volume.
- Controls reference.
- Tilt steering where applicable.

Persist locally where possible.

Storage failure must never crash the game.

---

# 28. AUDIO

Include where practical:

- RPM-based engine sound.
- Gear shifts.
- Tyre squeal.
- Kerb rumble.
- Collision.
- Brake.
- UI feedback.

Audio failure must degrade gracefully.

---

# 29. CRAZYGAMES REQUIREMENTS

Before submission verify applicable requirements from the CrazyGames Developer & Game Submission Guide.

At minimum verify:

- Initial download.
- Total build size.
- File count.
- Relative paths.
- Chrome/Edge compatibility.
- Landscape gameplay.
- Touch support if mobile is supported.
- Frame-rate-independent physics.
- No custom fullscreen button.
- Appropriate content.
- English UI.
- Original content.
- No external ads.
- Smooth loading.
- Correct store assets.
- SDK integration for Full Launch.

Do not claim any CrazyGames requirement is satisfied without verification.

---

# 30. CRAZYGAMES SDK

Keep SDK integration isolated.

The wrapper should safely no-op outside CrazyGames.

Where required, support:

- loadingStart
- loadingStop
- gameplayStart
- gameplayStop
- muteAudio
- Data
- User
- Game Context where applicable
- Ads
- Error handling

GitHub Pages testing must remain possible without the SDK.

---

# 31. ADS

Only CrazyGames ads.

Never use:

- AdSense.
- Third-party ad networks.
- Fake ad buttons.
- Fake rewards.

Ads must not interrupt active racing gameplay improperly.

If an ad fails, gameplay continues.

---

# 32. LAUNCH STRATEGY

## Stage 1 — GitHub playable build

Focus entirely on:

- stable loading
- driving
- track
- AI
- race loop
- performance

## Stage 2 — CrazyGames Basic Launch

Submit the stable core build.

## Stage 3 — Full Launch

After Basic Launch approval/stability:

- SDK
- ads
- account/data where useful
- Full Launch QA

Always preserve the last known-good build before risky SDK work.

---

# 33. DATA / PRIVACY

Collect the minimum possible data.

Basic build:

- guest play
- local settings
- no unnecessary personal data

Full Launch:

Use CrazyGames-supported identity/data functionality where applicable.

Never require external login.

---

# 34. ACCESSIBILITY

Where practical:

- Do not rely only on red/green.
- Use icons/shapes alongside colors.
- Provide readable HUD.
- Provide visual equivalents for important audio cues.
- Keep controls understandable.

---

# 35. RESPONSIVE TARGETS

Test at:

- 800×450
- 900×500
- 907×510
- 1080×607
- 1920×1080

No HUD clipping or overlap.

---

# 36. GITHUB DEPLOYMENT CHECKLIST

Before declaring a meaningful build ready for owner testing:

```text
[ ] Production build completed
[ ] No build errors
[ ] No unexpected oversized files
[ ] No absolute local paths
[ ] GitHub Pages base/subdirectory path verified
[ ] Git commit created
[ ] Commit pushed
[ ] GitHub Pages deployment completed
[ ] Game opens from actual GitHub URL
[ ] Hard refresh works
[ ] Assets load
[ ] 3D scene loads
[ ] Audio loads or fails gracefully
[ ] Controls work
[ ] Race starts
[ ] AI works
[ ] Lap detection works
[ ] Sector detection works
[ ] Finish works
[ ] Results work
[ ] Restart works
[ ] No obvious console errors
[ ] No unexpected 404/403 requests
[ ] Performance checked where possible
```

---

# 37. OWNER TESTING PROTOCOL

The project owner is not expected to inspect source code to determine whether a feature works.

When requesting testing, provide:

1. GitHub Pages URL.
2. Version/commit.
3. What changed.
4. Exact test steps.
5. Expected result.
6. What to report if it fails.

Example:

```text
VERSION: v0.4.2
TEST URL: https://example.github.io/single-seater/

TEST:
1. Open the URL.
2. Click Play.
3. Drive through Sector 1.
4. Complete one lap.
5. Restart.

EXPECTED:
- Car responds smoothly.
- Sector 1 time appears.
- Lap completes.
- Restart returns to the grid.
```

Keep user testing simple.

---

# 38. BUG REPORT PROTOCOL

When the owner reports a bug:

1. Record exact reproduction steps.
2. Identify the affected build/commit.
3. Determine whether it is GitHub-only, local-only, device-specific, or general.
4. Identify root cause.
5. Fix the root cause.
6. Build.
7. Commit.
8. Push.
9. Deploy.
10. Ask the owner to retest the exact original reproduction steps.
11. Perform regression checks.

Never respond with “fixed” merely because code was changed.

---

# 39. FAILURE / GRACEFUL DEGRADATION

If:

- an asset fails → fallback or controlled skip.
- audio fails → continue silently.
- ad fails → continue gameplay.
- save fails → continue with session defaults.
- WebGL feature fails → lower graphics quality.
- physics enters invalid state → recover to last valid state.
- optional feature fails → disable it rather than blocking the race.

The race must remain playable.

---

# 40. PERFORMANCE MODE

Provide:

### LOW
Designed for 4 GB Chromebook-class hardware.

Reduce:

- shadows
- draw distance
- particles
- reflections
- post-processing
- texture quality
- environmental density

### MEDIUM
Balanced default.

### HIGH
Higher visual quality where hardware allows.

Auto-detection may select a safe starting preset, but the user must be able to change it.

---

# 41. VERSION CONTROL

Use Git.

`main` must always represent the latest intended deployable state.

Use tags for known-good milestones:

```text
v0.1-core
v0.2-racing
v0.3-ai
v0.4-polish
basic-launch-v1
full-launch-v1
```

Maintain:

`CHANGELOG.md`

Never destroy the last known-good version merely to experiment.

---

# 42. SAFE DEVELOPMENT RULE

When modifying an existing project:

1. Inspect the existing implementation.
2. Identify what already works.
3. Preserve working behavior.
4. Make the smallest safe change.
5. Test the changed system.
6. Test the core race loop.
7. Only then continue.

**Do not rewrite the entire project simply because a smaller fix is harder.**

A rewrite requires explicit justification.

---

# 43. ANTI-BLOAT RULE

Before adding a dependency, model, texture, sound, shader or feature ask:

> Does this materially improve the game enough to justify its download, memory, CPU/GPU and maintenance cost?

If not, reject it.

---

# 44. CONFLICT RESOLUTION

If a new request conflicts with this specification:

1. State the conflict.
2. Identify the affected requirement.
3. Explain the risk.
4. Propose the smallest safe alternative.
5. Proceed only after explicit owner approval if the conflict is material.
6. Update the specification if the change becomes permanent.

---

# 45. CODE QUALITY

Code must be:

- modular
- readable
- maintainable
- reasonably documented
- free of dead code
- free of unnecessary dependencies
- consistent in naming

Physics/AI/timing code requires comments where behavior is non-obvious.

---

# 46. RELEASE GATES

## Gate A — Core functionality
- Loads.
- Drives.
- Race starts.
- AI works.
- Laps work.
- Sectors work.
- Finish works.
- Results work.
- Restart works.

## Gate B — Performance
- No severe frame drops.
- No memory runaway.
- Fixed timestep verified.
- Low mode works on target hardware where tested.

## Gate C — GitHub
- Correct subdirectory deployment.
- Assets load.
- Hard refresh works.
- No unexpected 404s.
- Chrome/Edge checked where available.

## Gate D — UX
- Controls understandable.
- HUD readable.
- Minimal friction.
- No broken menus.

## Gate E — Compliance
- Original content.
- No external ads.
- No custom fullscreen.
- Appropriate content.
- Store assets correct.
- SDK correct when required.

## Gate F — Resilience
- Asset failure does not crash.
- Audio failure does not crash.
- Save failure does not crash.
- Ad failure does not crash.
- Invalid physics state recovers.

---

# 47. DEVELOPMENT PHASES

## Phase 1 — Core Driving

Build:

- track
- car
- camera
- controls
- physics
- basic lap system

### Definition of Done

A player can drive a complete lap on the deployed GitHub Pages build.

Not merely localhost.

---

## Phase 2 — Racing

Build:

- 8 AI
- starting grid
- countdown
- positions
- sectors
- minimap
- results

### Definition of Done

Player + 8 AI can complete a full race on GitHub Pages without soft-locking.

---

## Phase 3 — Depth

Build:

- tyres
- degradation
- active aero
- damage
- flags
- pit system where practical

### Definition of Done

Each system works without breaking the Phase 1/2 race loop.

---

## Phase 4 — Presentation

Build:

- dusk lighting
- environment
- HUD
- audio
- menus
- onboarding

### Definition of Done

The game looks coherent and remains performant on target hardware.

---

## Phase 5 — Optimization

Optimize:

- bundle size
- textures
- draw calls
- AI
- collision
- memory
- loading
- Chromebook performance

### Definition of Done

Performance is measured, not guessed.

---

## Phase 6 — CrazyGames

Prepare:

- Basic Launch
- QA
- SDK
- monetization
- Full Launch

### Definition of Done

Applicable CrazyGames release gates are actually verified.

---

# 48. REQUIRED DEVELOPMENT RESPONSE FORMAT

Every development response must use:

## 1. What changed
Plain-language summary.

## 2. Files changed/created
Exact paths.

## 3. Why
Requirement/pillar/bug/gate addressed.

## 4. GitHub deployment
State:
- commit
- push status
- deployment status
- deployed URL if known

## 5. Testing status
Separate:
- CODE VERIFIED
- GITHUB VERIFIED
- USER VERIFIED
- NOT TESTED
- UNVERIFIED

## 6. Remaining issues
Be honest.

## 7. Next action
Give the owner only the necessary next test/action.

Never claim full compliance unless it was actually verified.

---

# 49. FINAL ENGINEERING RULE

The project is not successful because:

- the code is long,
- the graphics look impressive,
- many features exist,
- an AI says it is finished,
- localhost works.

The project is successful when:

> **A real player can open the GitHub Pages URL, load the game, drive, race, finish, restart, and repeat the process reliably on the intended hardware — while the project remains lightweight, maintainable, original, and compatible with the CrazyGames submission requirements.**

When forced to choose:

**WORKING > TESTED > STABLE > FAST > FUN > POLISHED > COMPLEX**

---

# 50. FINAL INSTRUCTION TO THE DEVELOPMENT AGENT

Do not build the entire game blindly in one pass.

Build incrementally.

After each major phase:

**IMPLEMENT → BUILD → COMMIT → PUSH → DEPLOY → GITHUB TEST → OWNER TEST → FIX → REGRESSION TEST → NEXT PHASE**

If the owner says:

> “It doesn't work on GitHub.”

Treat that as a real release-blocking bug, even if it works locally.

If the owner says:

> “It works, but performance is bad.”

Treat performance as a release-blocking issue for the affected target.

If a requested feature risks the stability of the core game:

**protect the core game first.**

If you cannot test something:

**say so.**

If you do not know:

**say so.**

If a change is risky:

**warn before making it.**

Never fabricate test results.

---

## PROJECT OWNER'S PRACTICAL WORKFLOW

The owner should be able to work primarily like this:

```text
AI DEVELOPMENT
      ↓
GitHub commit
      ↓
GitHub Pages deployment
      ↓
OPEN GAME IN BROWSER
      ↓
TEST GAME
      ↓
REPORT WHAT HAPPENED
      ↓
AI FIXES
      ↓
NEW GITHUB BUILD
      ↓
RETEST
```

The owner should not need to become a programmer merely to verify ordinary game features.

---

**END OF SINGLE-SEATER RACING GAME MASTER DEVELOPMENT PROMPT v3.0**
