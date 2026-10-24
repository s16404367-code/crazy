# DUSK APEX — Architecture

Stack: HTML + CSS + JavaScript (ES modules) + Three.js (WebGL), built with
Vite using `base: './'` so the game works from any GitHub Pages repository
subdirectory. `vite-plugin-singlefile` inlines everything into one
`dist/index.html`, which also makes the playable ZIP work from `file://`
with no local server.

## Module map (responsibilities are separated per Master Prompt §11)

```
index.html                 page shell: loading screen, menus, HUD DOM, touch UI
src/
  main.js                  bootstrap, menu/settings/results wiring, error toast
  core/Game.js             orchestrator: state machine, fixed-step loop, camera,
                           particles, slipstream, pit service, event routing
  config/config.js         ALL tuning numbers, tyre compounds, driver roster,
                           quality presets (no magic numbers elsewhere)
  track/trackData.js       THE circuit: spline → ~1,750 centreline samples with
                           frames, curvature, corner speeds, racing line,
                           barriers, aero zones, pit lane, grid, sectors.
                           Rendering, AI, timing, minimap all read THIS data.
  track/trackBuilder.js    3D circuit + dusk environment from those samples;
                           procedural canvas textures; weather looks
  physics/vehicle.js       arcade-sim vehicle (grip-limited bicycle yaw,
                           downforce, aero, tyres, damage, barriers),
                           fixed-step stable, NaN-guarded, car↔car collision
  ai/aiDriver.js           12 Hz decisions (overtake/defend/pit/follow) +
                           per-step steering/speed control; same Vehicle
  race/raceManager.js      countdown, laps/sectors, standings/gaps, fastest
                           lap, yellow flag, finish + classification
  render/carBuilder.js     original low-poly single-seater (primitives),
                           wheel/steer/body-lean/damage visuals
  ui/hud.js                HUD, timing tower, messages, minimap (from samples)
  input/input.js           keyboard / touch / gamepad / optional tilt
  audio/audio.js           procedural WebAudio (engine, skid, kerb, impacts)
  settings/settings.js     localStorage settings, fail-safe
  sdk/crazyGames.js        isolated CrazyGames wrapper — no-ops without SDK
scripts/smoke-test.mjs     headless full-race simulation test (CI + local)
.github/workflows/pages.yml build (and smoke test) on PR; deploy on main
```

## Key design decisions

- **Fixed timestep 120 Hz** with an accumulator, frame-time clamp and
  visual interpolation → identical driving at 30/60/120/144 Hz (§13).
- **One track data source.** The centreline samples drive rendering, AI,
  sectors, checkpoints, minimap, positions and timing — they cannot drift
  apart (§18). Lap length is auto-scaled to 3,501 m.
- **Corner speeds** are derived from curvature using the same lateral-accel
  model as the car physics, then made braking-feasible — AI pace therefore
  matches what the car can actually do, at every skill level.
- **No external assets.** Models are primitives, textures are canvas art,
  audio is synthesised. Download ≈ 155 KB gzipped; licensing risk = 0.
- **Graceful degradation:** storage/audio/SDK failures never block a race;
  invalid physics states recover to the centreline (no soft-locks, §39).
- **Pit lane** sits on the final-corner exit side of the main straight so
  entry is a natural drift outward on the straight (learned from testing:
  corner-entry designs caused AI wall strikes — see CHANGELOG).
