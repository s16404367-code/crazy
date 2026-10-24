# Asset Credits & Licensing

DUSK APEX contains **no third-party game assets**. Everything visual and
audible in the game is generated procedurally by the project's own code:

| Item | Source | Licence |
|---|---|---|
| Car model | Built in code from Three.js primitives (`src/render/carBuilder.js`) | Original to this project |
| Circuit & scenery | Built in code from original spline data (`src/track/`) | Original to this project |
| Textures (asphalt, kerbs, grass, boards…) | Procedural canvas painting in `src/track/trackBuilder.js` | Original to this project |
| Engine/SFX/music | Synthesised live with WebAudio (`src/audio/audio.js`) — no audio files | Original to this project |
| Fonts | System font stack only (no downloaded fonts) | n/a |
| Driver names / board brands | Fictional names invented for this game | Original to this project |

## Open-source libraries (code dependencies, not assets)

| Library | Use | Licence |
|---|---|---|
| Three.js (`three`) | WebGL rendering | MIT |
| Vite (`vite`) | Build tooling (dev only) | MIT |
| vite-plugin-singlefile | Single-file build output (dev only) | MIT |

No F1 logos, team names, real driver likenesses, sponsor logos, commercial
car models or copied real-world circuit geometry are used anywhere
(Master Prompt §10). The circuit layout is an original design.
