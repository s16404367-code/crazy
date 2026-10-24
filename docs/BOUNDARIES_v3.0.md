# SINGLE-SEATER RACING GAME — HARD BOUNDARIES
## v3.0 — GITHUB-TEST-FIRST / CRAZYGAMES-READY

This document contains the hard boundaries for the project.

If a development decision conflicts with these rules, stop and flag the conflict rather than silently violating them.

---

# 1. ABSOLUTE TECHNICAL LIMITS

- Initial download: **≤50 MB**
- Preferred initial download: **≤20 MB**
- Total build with CrazyGames SDK: **≤250 MB**
- File count: **≤1,500**
- Use relative/correctly based paths.
- Must work from GitHub Pages subdirectory hosting.
- No dependency on localhost.
- No backend unless explicitly approved.
- No paid APIs.
- No unnecessary external services.
- No frame-rate-dependent physics.
- Low graphics mode must target 4 GB Chromebook-class hardware.

---

# 2. GITHUB PAGES BOUNDARY

GitHub Pages is an official testing environment.

The game must not be considered stable merely because it works on:

- localhost
- a development server
- an AI preview
- a developer's machine

A meaningful build must be deployed and checked on the actual GitHub Pages URL.

Never assume:

`localhost == GitHub Pages`

---

# 3. GITHUB DEPLOYMENT RULES

Before asking the owner to test:

- Build must complete.
- Git commit must exist.
- Changes must be pushed.
- GitHub Pages deployment must complete.
- Deployed URL must be known.
- Asset paths must be appropriate for repository subdirectory hosting.
- No known critical console errors.
- No known critical 404/403 asset failures.

---

# 4. PROHIBITED PATHS

Never ship:

```text
C:\
D:\
file:///
C:/Users/...
C:\Users\...
```

Never hardcode the developer's machine path.

Never assume the website is hosted at `/`.

---

# 5. CRITICAL GITHUB TESTS

Every major build must check:

- First load.
- Hard refresh.
- Reload.
- Race start.
- Controls.
- 3D scene.
- Assets.
- Audio.
- AI.
- Lap detection.
- Sector detection.
- Finish.
- Results.
- Restart.
- Settings.
- Browser console.
- Network failures.

---

# 6. NO FALSE TEST CLAIMS

The development agent must never say:

- “tested”
- “working”
- “fully compatible”
- “CrazyGames ready”
- “Chromebook verified”

unless the relevant test was actually performed.

Use:

- VERIFIED
- PARTIALLY VERIFIED
- NOT TESTED
- UNVERIFIED

---

# 7. TEST OWNERSHIP

The AI/developer may perform code/build checks.

The project owner may perform real-device/browser tests.

If the AI cannot access the owner's physical device:

**it must not claim physical-device verification.**

---

# 8. ORIGINAL CONTENT ONLY

Prohibited:

- F1 logos.
- F1 team branding.
- Real driver likenesses.
- Real sponsor logos.
- Unlicensed commercial car models.
- Copied real-world circuit geometry.
- Unlicensed music.
- Unlicensed sound effects.
- Unlicensed textures.
- Unlicensed fonts.

Keep asset licensing information in:

`ASSET_CREDITS.md`

---

# 9. TRACK BOUNDARY

The circuit may use high-speed European motorsport design ideas.

It must not be a copied reconstruction of a real circuit.

Required identity:

- approximately 3.5 km
- hairpin
- chicane
- long straight
- high-speed section
- overtaking opportunities
- runoff
- barriers
- kerbs
- pit lane
- grid
- finish line

---

# 10. GAMEPLAY BOUNDARIES

The game must remain playable even after:

- collision
- spin
- off-track excursion
- temporary stop
- minor damage

Never create an unavoidable soft-lock.

---

# 11. PHYSICS BOUNDARIES

Physics must:

- use time-based simulation.
- use fixed timestep or equivalent robust architecture.
- remain stable across render rates.
- avoid frame-based movement.
- prevent NaN/invalid states.
- provide recovery if the car becomes stuck.

Do not pretend to implement full real-world vehicle simulation.

---

# 12. AI BOUNDARIES

AI may be simplified.

AI may not:

- teleport.
- phase through barriers.
- use impossible speeds.
- magically gain speed solely because the player is ahead.
- intentionally create unavoidable collisions.
- become permanently stuck.

Rubber-banding must not replace actual racing behavior.

---

# 13. ACTIVE AERO BOUNDARIES

Active aero must be:

- understandable.
- balanced.
- visible in HUD.
- available to AI under the same rules.

No hidden player-only speed multiplier.

---

# 14. TYRE BOUNDARIES

Minimum compounds:

- Soft
- Medium
- Hard

Degradation must be gradual.

Tyre wear must not make the vehicle completely uncontrollable.

---

# 15. DAMAGE BOUNDARIES

Damage is optional through:

`OFF / ON`

Damage must not:

- instantly destroy the race from a minor contact.
- permanently trap the car.
- require expensive deformable-body physics.

---

# 16. GRAPHICS BOUNDARIES

Target:

- stylized realism.
- strong dusk identity.
- readable track.
- readable HUD.
- good performance.

Do not sacrifice frame rate for:

- excessive reflections.
- huge textures.
- unnecessary particles.
- expensive post-processing.
- massive scenery density.

---

# 17. PERFORMANCE BOUNDARIES

Avoid:

- memory leaks.
- unnecessary allocations every frame.
- excessive draw calls.
- huge textures.
- unnecessary DOM updates.
- expensive per-frame AI calculations.
- unbounded particle systems.

Provide:

- Low
- Medium
- High

quality presets.

Low mode is specifically for weaker hardware.

---

# 18. AUDIO BOUNDARIES

Audio must not block gameplay.

If an audio file fails:

- log safely where appropriate.
- continue gameplay.

Never crash because one sound asset is missing.

---

# 19. UI BOUNDARIES

HUD must not:

- overlap.
- cover critical driving view unnecessarily.
- become unreadable on supported resolutions.
- depend only on red/green color differences.

No custom fullscreen button.

---

# 20. MOBILE BOUNDARIES

Mobile support is secondary.

Do not damage desktop gameplay merely to support mobile.

If touch is implemented:

- controls must be readable.
- buttons must be large enough.
- controls must not cover essential HUD.
- tilt must have an enable/disable option.

---

# 21. CRAZYGAMES AD BOUNDARIES

Allowed:

- CrazyGames SDK advertising.

Prohibited:

- AdSense.
- third-party ad networks.
- fake ads.
- fake rewarded ads.
- ads during inappropriate active gameplay interruptions.

Failed ads must not break the race.

---

# 22. CRAZYGAMES SDK BOUNDARY

SDK must be isolated.

GitHub Pages must still work without CrazyGames SDK.

The game must not become dependent on SDK calls merely to start a race during development.

---

# 23. ACCOUNT / LOGIN BOUNDARY

Never require:

- Google login.
- Facebook login.
- email registration.
- external account creation.

Guest play must remain possible.

---

# 24. PRIVACY BOUNDARY

Collect the minimum possible data.

Do not add:

- unnecessary analytics.
- hidden tracking.
- unnecessary personal data collection.

If additional data collection is introduced, privacy requirements must be reviewed before release.

---

# 25. LOADING BOUNDARY

Never intentionally create artificial long loading delays.

Do not show a blank white page while assets load.

Show:

- game identity
- loading state
- meaningful progress where possible

The player should reach gameplay quickly.

---

# 26. FEATURE BOUNDARY

Do not add a feature simply because it sounds impressive.

Before adding anything ask:

> Does this improve the core game enough to justify its CPU, GPU, memory, download and maintenance cost?

If not, reject it.

---

# 27. CODE CHANGE BOUNDARY

Do not rewrite working systems unnecessarily.

Before modifying:

1. inspect.
2. understand.
3. isolate.
4. change minimally.
5. test.
6. regression test.

A full rewrite requires explicit justification.

---

# 28. DEVELOPMENT ORDER BOUNDARY

Do not skip ahead merely because later features are exciting.

Order:

1. Core driving.
2. Racing.
3. Simulation depth.
4. Presentation.
5. Optimization.
6. CrazyGames.

A later phase must not hide an earlier broken phase.

---

# 29. RELEASE BOUNDARY

The project is not release-ready until applicable gates pass.

Minimum:

```text
CORE WORKS
↓
GITHUB DEPLOYMENT WORKS
↓
OWNER CAN PLAY
↓
PERFORMANCE ACCEPTABLE
↓
NO CRITICAL BUGS
↓
CRAZYGAMES REQUIREMENTS VERIFIED
```

---

# 30. VERSION / ROLLBACK BOUNDARY

Always preserve a known-good version.

Before risky changes:

- commit
- tag where appropriate
- record version

Never make experimental work impossible to roll back.

---

# 31. BUG-FIX BOUNDARY

A bug is not fixed merely because one line changed.

A proper fix requires:

1. Reproduction.
2. Root cause.
3. Fix.
4. Build.
5. GitHub deployment.
6. Original test repeated.
7. Regression test.

---

# 32. OWNER TESTING BOUNDARY

When asking the owner to test, provide only:

- URL
- version
- exact steps
- expected result
- what to report

Do not make the owner search through source code to diagnose ordinary gameplay behavior.

---

# 33. CRAZYGAMES STORE ASSET BOUNDARIES

Covers:

- 1920×1080 landscape
- 800×1200 portrait
- 800×800 square

Must:

- represent actual game.
- use original visuals.
- contain only permitted title text.
- contain no misleading claims.
- contain no unrelated logos.

Preview videos:

- actual gameplay.
- landscape 1080p 16:9.
- portrait 1080p 2:3 where required.
- ≤20 seconds.
- ≤50 MB.

---

# 34. CONTENT BOUNDARIES

No:

- graphic gore.
- sexual content.
- gambling.
- inappropriate material.
- misleading advertising.
- copied branding.

Keep content appropriate for the CrazyGames audience and applicable rating requirements.

---

# 35. FINAL NON-NEGOTIABLE RULE

Never optimize for the appearance of completion.

Optimize for:

**WORKING → TESTED → STABLE → FAST → FUN → POLISHED**

If something cannot be verified, label it:

**NOT TESTED / UNVERIFIED**

Never invent success.

---

**END OF SINGLE-SEATER RACING GAME HARD BOUNDARIES v3.0**
