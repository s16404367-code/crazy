// DUSK APEX — game orchestrator.
// Fixed-timestep simulation (120 Hz accumulator, §13) with interpolated
// rendering, so driving is identical at 30/60/120/144 Hz displays.
// States: menu (attract orbit) → countdown → racing ⇄ paused → finished.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG, AI_DRIVERS, PLAYER_PROFILE, QUALITY_PRESETS, TYRE_ORDER } from '../config/config.js';
import { getTrack, deltaS, getPointAt } from '../track/trackData.js';
import { buildEnvironment, buildTrack, applyWeather } from '../track/trackBuilder.js';
import { buildCar, updateCarVisual } from '../render/carBuilder.js';
import { Vehicle, resolveCarCollisions } from '../physics/vehicle.js';
import { AIDriver } from '../ai/aiDriver.js';
import { RaceManager, formatTime } from '../race/raceManager.js';
import { InputManager } from '../input/input.js';
import { AudioEngine } from '../audio/audio.js';
import { HUD } from '../ui/hud.js';
import { CrazyGamesSDK } from '../sdk/crazyGames.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }
function wrapAnglePi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

export class Game {
  constructor(container, settings, hooks = {}) {
    this.container = container;
    this.settings = settings;
    this.hooks = hooks;
    this.state = 'menu'; // menu | countdown | racing | paused | finished
    this.track = getTrack();
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.race = new RaceManager(this.track);
    this.raceConfig = { laps: settings.laps, tyre: settings.tyre, weather: settings.weather, damage: settings.damage === 'ON' };
    this.cameraMode = 0; // 0 chase, 1 far, 2 cockpit
    this.playerAeroDesired = false;
    this.playerPitRequested = false;
    this._pitAuto = 'off'; // off | approach | in | out (pit autopilot)
    this._autoAim = {};
    this._accumulator = 0;
    this._lastTs = 0;
    this._menuAngle = 0;
    this._finishTimer = -1;
    this._lastLightsOn = 0;
    this._wasAeroActive = false;
    this._camPos = new THREE.Vector3(0, 6, -14);
    this._camLook = new THREE.Vector3();
    this._fov = 62;
    this._shake = 0;

    this._bindInputActions();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'racing' || this.state === 'countdown')) this.setPaused(true);
    });
    window.addEventListener('resize', () => this._onResize());
  }

  _bindInputActions() {
    this.input.on('pause', () => {
      if (this.state === 'racing' || this.state === 'countdown') this.setPaused(true);
      else if (this.state === 'paused') this.setPaused(false);
    });
    this.input.on('camera', () => {
      if (this.state === 'racing' || this.state === 'countdown') {
        this.cameraMode = (this.cameraMode + 1) % 3;
        this.audio.click();
        if (this.hud) this.hud.showMessage(['CAMERA: CHASE', 'CAMERA: FAR', 'CAMERA: COCKPIT'][this.cameraMode], 1200);
      }
    });
    this.input.on('aeroToggle', () => {
      if (this.state !== 'racing') return;
      this.playerAeroDesired = !this.playerAeroDesired;
      if (this.playerAeroDesired && !this.player.aeroAvailable && this.hud) {
        this.hud.showMessage('AERO: ONLY IN AERO ZONES (STRAIGHTS)', 1600);
      }
    });
    this.input.on('reset', () => {
      if (this.state === 'racing' && this.player.pitState !== 'servicing') {
        this._pitAuto = 'off';
        this.playerPitRequested = false;
        this.player.resetToTrack();
        if (this.hud) this.hud.showMessage('CAR RESET TO TRACK', 1400);
      }
    });
    this.input.on('pitRequest', () => {
      if (this.state !== 'racing') return;
      if (this._pitAuto === 'approach') { // still on circuit: allow cancel
        this._pitAuto = 'off';
        this.playerPitRequested = false;
        if (this.hud) this.hud.showMessage('PIT AUTOPILOT CANCELLED', 1800);
        return;
      }
      if (this._pitAuto !== 'off') {
        if (this.hud) this.hud.showMessage('AUTOPILOT ACTIVE — IT WILL EXIT SAFELY', 1800);
        return;
      }
      this.playerPitRequested = !this.playerPitRequested;
      if (this.hud) this.hud.showMessage(this.playerPitRequested
        ? `PIT REQUESTED — AUTOPILOT TAKES OVER AT PIT ENTRY → YOUR GARAGE (BOX ${this.player.pitBoxIndex + 1})`
        : 'PIT REQUEST CANCELLED', 2600);
    });
    this.input.on('cycleTyre', () => {
      if (!this.player) return;
      const i = TYRE_ORDER.indexOf(this.player.nextCompound);
      this.player.nextCompound = TYRE_ORDER[(i + 1) % TYRE_ORDER.length];
      this.audio.click();
    });
  }

  async init(progress) {
    const step = async (pct, label) => { if (progress) progress(pct, label); await new Promise((r) => requestAnimationFrame(r)); };
    await step(8, 'Building renderer…');
    const q = QUALITY_PRESETS[this.settings.quality];
    this.renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.5;
    } catch (e) { /* reflections optional — game continues without them */ }
    this.camera = new THREE.PerspectiveCamera(62, this.container.clientWidth / Math.max(this.container.clientHeight, 1), 0.1, 6000);
    this.camera.position.copy(this._camPos);

    await step(25, 'Dusk sky & lighting…');
    this.env = buildEnvironment(this.scene, this.settings.quality);
    applyWeather(this.env, this.scene, this.raceConfig.weather, this.settings.quality);

    await step(45, 'Laying 3.5 km of tarmac…');
    buildTrack(this.scene, this.track, this.settings.quality);

    await step(68, 'Preparing 9 cars…');
    this._createCars();
    this._createParticles();

    await step(85, 'Race control systems…');
    this.hud = new HUD(this.track);
    this.hud.hide();
    this._placeGrid(this.raceConfig.tyre);
    this._snapAllVisuals();
    this._onResize();

    await step(100, 'Ready');
    CrazyGamesSDK.init();
    this._lastTs = performance.now();
    const loop = (ts) => { requestAnimationFrame(loop); this._frame(ts); };
    requestAnimationFrame(loop);
  }

  _createCars() {
    this.player = new Vehicle(this.track, { name: PLAYER_PROFILE.name, isPlayer: true, tyre: this.raceConfig.tyre });
    this.player.colorCss = css(PLAYER_PROFILE.color);
    this.player.visual = buildCar(PLAYER_PROFILE.color, PLAYER_PROFILE.accent, PLAYER_PROFILE.number);
    this.scene.add(this.player.visual);

    this.aiCars = [];
    this.aiDrivers = [];
    for (const p of AI_DRIVERS) {
      const v = new Vehicle(this.track, { name: p.name, tyre: p.tyre });
      v.colorCss = css(p.color);
      v.visual = buildCar(p.color, p.accent, p.number);
      this.scene.add(v.visual);
      this.aiCars.push(v);
      this.aiDrivers.push(new AIDriver(v, p, this.track));
    }
    // every driver gets their OWN garage/pit box
    this.player.pitBoxIndex = CONFIG.pit.playerBoxIndex;
    this.player.pitBoxS = this.track.pit.boxes[this.player.pitBoxIndex].s;
    const spareBoxes = this.track.pit.boxes.map((b) => b.index).filter((i) => i !== this.player.pitBoxIndex);
    this.aiCars.forEach((car, k) => {
      car.pitBoxIndex = spareBoxes[k];
      car.pitBoxS = this.track.pit.boxes[car.pitBoxIndex].s;
    });
    this.allCars = [this.player, ...this.aiCars];
    this._driverOf = new Map(this.aiDrivers.map((d) => [d.vehicle, d]));
  }

  _createParticles() {
    const COUNT = 260;
    this._particleCount = COUNT;
    this._pPos = new Float32Array(COUNT * 3);
    this._pCol = new Float32Array(COUNT * 3);
    this._pVel = new Float32Array(COUNT * 3);
    this._pLife = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) this._pPos[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this._pCol, 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false
    }));
    this.particles.frustumCulled = false;
    this._pCursor = 0;
    this.scene.add(this.particles);
  }

  _spawnParticles(x, y, z, n, colorHex, spread = 2.2, up = 2.1, life = 0.7) {
    const c = new THREE.Color(colorHex);
    for (let k = 0; k < n; k++) {
      const i = this._pCursor;
      this._pCursor = (this._pCursor + 1) % this._particleCount;
      this._pPos[i * 3] = x; this._pPos[i * 3 + 1] = y; this._pPos[i * 3 + 2] = z;
      this._pVel[i * 3] = (Math.random() - 0.5) * spread;
      this._pVel[i * 3 + 1] = Math.random() * up;
      this._pVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this._pCol[i * 3] = c.r; this._pCol[i * 3 + 1] = c.g; this._pCol[i * 3 + 2] = c.b;
      this._pLife[i] = life * (0.5 + Math.random() * 0.7);
    }
  }

  _updateParticles(dt) {
    for (let i = 0; i < this._particleCount; i++) {
      if (this._pLife[i] <= 0) continue;
      this._pLife[i] -= dt;
      if (this._pLife[i] <= 0) { this._pPos[i * 3 + 1] = -100; continue; }
      this._pVel[i * 3 + 1] -= 2.2 * dt;
      this._pPos[i * 3] += this._pVel[i * 3] * dt;
      this._pPos[i * 3 + 1] += this._pVel[i * 3 + 1] * dt;
      this._pPos[i * 3 + 2] += this._pVel[i * 3 + 2] * dt;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  _placeGrid(playerTyre) {
    // AI ordered by skill (with a light shuffle), player at the back (P9).
    const ordered = this.aiCars.slice().sort((a, b) => {
      const sa = this._driverOf.get(a).skill, sb = this._driverOf.get(b).skill;
      return sb - sa;
    });
    for (let k = 0; k < 3; k++) {
      const i = (Math.random() * ordered.length) | 0;
      const j = (Math.random() * ordered.length) | 0;
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
    ordered.forEach((car, slot) => {
      const profile = AI_DRIVERS.find((p) => p.name === car.name);
      car.resetToGrid(this.track.gridSlots[slot], profile.tyre);
    });
    this.player.resetToGrid(this.track.gridSlots[CONFIG.race.playerGridSlot], playerTyre);
    this.aiDrivers.forEach((d) => d.reset());
    this.playerAeroDesired = false;
    this.playerPitRequested = false;
    this._pitAuto = 'off'; // off | approach | in | out (pit autopilot)
    this._autoAim = {};
  }

  _snapAllVisuals() {
    for (const car of this.allCars) {
      car.visual.position.set(car.x, 0, car.z);
      car.visual.rotation.set(0, car.heading, 0);
      car.snapshotPrev();
    }
  }

  // ---------------- public control ----------------
  applySettings() {
    const s = this.settings;
    this.audio.setVolumes({ master: s.masterVolume, engine: s.engineVolume, sfx: s.sfxVolume, music: s.musicVolume });
    this.input.setTiltEnabled(!!s.tiltSteering).then((ok) => { if (s.tiltSteering && !ok) s.tiltSteering = false; });
    if (this.renderer) {
      const q = QUALITY_PRESETS[s.quality];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      if (this.env) {
        this.env.sun.castShadow = q.shadows;
        applyWeather(this.env, this.scene, this.raceConfig.weather, s.quality);
      }
    }
  }

  startRace(cfg) {
    this.raceConfig = { laps: cfg.laps, tyre: cfg.tyre, weather: cfg.weather, damage: !!cfg.damage };
    applyWeather(this.env, this.scene, cfg.weather, this.settings.quality);
    this._placeGrid(cfg.tyre);
    this.race.setup(this.allCars, cfg.laps);
    this._snapAllVisuals();
    this._finishTimer = -1;
    this._accumulator = 0;
    this._lastLightsOn = 0;
    this.state = 'countdown';
    this.race.beginCountdown();
    this.hud.show();
    this.hud.setLights(0);
    this.audio.init();
    this.audio.stopMusic();
    this.audio.startEngine();
    // snap chase camera behind the player
    const f = this.player.forward();
    this._camPos.set(this.player.x - f.x * 10, 3.4, this.player.z - f.z * 10);
    this.camera.position.copy(this._camPos);
    CrazyGamesSDK.gameplayStart();
  }

  restartRace() { this.startRace(this.raceConfig); }

  quitToMenu() {
    this.state = 'menu';
    this.hud.hide();
    this.hud.hideLights();
    this.audio.stopEngine();
    this.audio.startMusic();
    this._placeGrid(this.raceConfig.tyre);
    this._snapAllVisuals();
    CrazyGamesSDK.gameplayStop();
    if (this.hooks.onStateChange) this.hooks.onStateChange('menu');
  }

  setPaused(paused) {
    if (paused && (this.state === 'racing' || this.state === 'countdown')) {
      this._prePauseState = this.state;
      this.state = 'paused';
      this.audio.updateEngine(0, 0, 0, 0, 0);
      CrazyGamesSDK.gameplayStop();
      if (this.hooks.onPauseChange) this.hooks.onPauseChange(true);
    } else if (!paused && this.state === 'paused') {
      this.state = this._prePauseState || 'racing';
      this._lastTs = performance.now();
      CrazyGamesSDK.gameplayStart();
      if (this.hooks.onPauseChange) this.hooks.onPauseChange(false);
    }
  }

  // ---------------- simulation ----------------
  _physicsStep(dt) {
    const locked = this.race.state === 'countdown';
    this.race.update(dt);
    if (this.race.state === 'racing' && this.state === 'countdown') {
      this.state = 'racing';
      this.hud.hideLights();
    }
    this._consumeRaceEvents();

    const env = {
      weatherGrip: CONFIG.weather[this.raceConfig.weather].grip,
      damageEnabled: this.raceConfig.damage,
      locked
    };
    const ctx = {
      cars: this.allCars,
      totalRaceM: this.race.totalRaceM,
      yellowSector: this.race.yellowSector,
      raceTime: this.race.raceTime
    };

    // slipstream (same for everyone): close behind another car at speed
    for (const v of this.allCars) {
      v.slipstream = false;
      if (Math.abs(v.u) < 24) continue;
      for (const o of this.allCars) {
        if (o === v) continue;
        const d = o.totalDist - v.totalDist;
        if (d > 4 && d < 30 && Math.abs(o.lat - v.lat) < 2.1) { v.slipstream = true; break; }
      }
    }

    for (const car of this.allCars) {
      let inp;
      if (car.isPlayer) {
        inp = this._playerInput(dt);
      } else {
        inp = this._driverOf.get(car).update(dt, ctx);
      }
      car.step(dt, inp, env);
    }
    resolveCarCollisions(this.allCars, env.damageEnabled);

    // clearing aero "desired" when the car drops out (brake / zone end)
    if (this._wasAeroActive && !this.player.aeroActive) this.playerAeroDesired = false;
    this._wasAeroActive = this.player.aeroActive;

    // player pit service (manual fallback): stopped near OWN garage → service.
    // With autopilot engaged, _playerInput starts the service itself.
    const p = this.player;
    if (this._pitAuto === 'off' && !p.servicedThisVisit && p.pitState === 'lane' && p.inPitLane && p.stoppedTimer > 0.7) {
      const toBox = Math.abs(deltaS(p.s, p.pitBoxS ?? this.track.pit.boxS, this.track.length));
      if (toBox < 30) {
        p.startPitService();
        this.playerPitRequested = false;
        this.hud.showMessage('PIT STOP — FRESH TYRES' + (this.raceConfig.damage && p.damageLevel > 0 ? ' + REPAIRS' : ''), 2200);
      }
    }

    this._consumeVehicleEvents();
  }

  _consumeRaceEvents() {
    for (const e of this.race.events) {
      switch (e.type) {
        case 'go':
          this.audio.beep(true);
          this.hud.showMessage('LIGHTS OUT — GO!', 2000);
          break;
        case 'sector':
          if (e.car.isPlayer) this.hud.sectorFlash(e.sector, e.time);
          break;
        case 'lap':
          if (e.car.isPlayer) {
            const remaining = this.race.totalLaps - e.lap;
            if (remaining === 1) this.hud.showMessage(`LAP ${formatTime(e.time)} — FINAL LAP!`, 3000);
            else if (remaining > 0) this.hud.showMessage(`LAP ${formatTime(e.time)}`, 2200);
          }
          break;
        case 'fastest':
          this.hud.showMessage(e.car.isPlayer
            ? `★ FASTEST LAP — ${formatTime(e.time)}`
            : `Fastest lap: ${e.car.name} ${formatTime(e.time)}`, 2400);
          break;
        case 'yellow':
          this.hud.showMessage(`⚠ YELLOW FLAG — SECTOR ${e.sector + 1}`, 2600);
          break;
        case 'green':
          this.hud.showMessage('GREEN FLAG — RACING', 1800);
          break;
        case 'finish':
          if (e.car.isPlayer) {
            const pos = this.race.positionOf(this.player);
            this.hud.showMessage(`🏁 CHEQUERED FLAG — YOU FINISH P${pos}`, 4000);
            this._finishTimer = 1.8;
            CrazyGamesSDK.happytime();
          } else {
            this.hud.showMessage(`${e.car.name} finishes P${this.race.positionOf(e.car)}`, 1800);
          }
          break;
      }
    }
    this.race.events.length = 0;
  }

  _consumeVehicleEvents() {
    let playerCrash = 0;
    for (const car of this.allCars) {
      for (const e of car.events) {
        if (e.type === 'wall' || e.type === 'car') {
          this._spawnParticles(car.x, 0.5, car.z, 7, 0xffc873, 3.2, 2.6, 0.45);
          if (car.isPlayer) playerCrash = Math.max(playerCrash, e.impact / 14);
        } else if (e.type === 'shift' && car.isPlayer) {
          this.audio.shift();
        } else if (e.type === 'pitdone') {
          if (car.isPlayer) this.hud.showMessage('PIT STOP COMPLETE — GO!', 2000);
          else this.hud.showMessage(`${car.name} pits`, 1500);
        }
      }
      car.events.length = 0;
    }
    if (playerCrash > 0.08) {
      this.audio.crash(playerCrash);
      this._shake = Math.min(this._shake + playerCrash * 0.55, 0.8);
    }
  }

  /**
   * Player input with pit autopilot. When a stop is requested, the car
   * drives itself from pit entry to the player's OWN garage, stops exactly,
   * waits for service, then exits under the limiter and hands control back.
   * Mirrors the proven AI pit logic so behaviour is consistent.
   */
  _playerInput(dt) {
    const p = this.player;
    const track = this.track;
    const raw = this.input.getState(this.settings.steeringSensitivity);
    const manual = { ...raw, aeroDesired: this.playerAeroDesired };
    if (p.pitState === 'servicing') return { steer: 0, throttle: 0, brake: 0, aeroDesired: false };

    const toEntry = deltaS(p.s, track.pit.entryS, track.length);
    const sinceEntry = deltaS(track.pit.entryS, p.s, track.length);
    const inRange = track.inPitRange(p.s);
    if (this._pitAuto === 'off') {
      const canEngageInLane = p.inPitLane || (inRange && sinceEntry >= 0 && sinceEntry < 55);
      if (this.playerPitRequested && (canEngageInLane || (toEntry > 0 && toEntry < 210))) {
        this._pitAuto = canEngageInLane ? 'in' : 'approach';
        this.playerAeroDesired = false;
        this.hud.showMessage('🤖 PIT AUTOPILOT ENGAGED — HANDS OFF!', 2600);
      } else {
        return manual;
      }
    }

    const speed = Math.abs(p.u);
    const lookahead = clamp(9 + speed * 0.52, 11, 46);
    const myBox = p.pitBoxS ?? track.pit.boxS;
    const toBox = deltaS(p.s, myBox, track.length);
    const pastEntry = toEntry <= 0 || p.inPitLane || inRange;
    if (this._pitAuto === 'approach' && pastEntry) this._pitAuto = 'in';
    if (this._pitAuto === 'in' && p.servicedThisVisit) this._pitAuto = 'out';

    // If the divider wall has begun and the car is still on the circuit side,
    // entry is no longer physically possible. Abort cleanly and keep the
    // request ready for the next lap instead of scraping the wall/stopping.
    if (this._pitAuto === 'in' && !p.servicedThisVisit && !p.inPitLane && track.inPitWallRange(p.s)) {
      const pitSide = Math.sign(track.pit.lat - track.pit.wallLat);
      const carSide = Math.sign(p.lat - track.pit.wallLat);
      if (carSide !== pitSide) {
        this._pitAuto = 'off';
        this.hud.showMessage('PIT ENTRY MISSED — AUTOPILOT WILL TRY NEXT LAP', 2600);
        return manual;
      }
    }

    let aimLat, targetSpeed, aimDist = Math.min(lookahead, 22);
    if (this._pitAuto === 'approach') {
      const blend = clamp(1 - Math.max(toEntry, 0) / 150, 0, 1);
      const base = getPointAt(track, p.s + lookahead, 0, this._autoAim);
      aimLat = base.lineLat + (track.pit.lat - base.lineLat) * blend;
      const raceSpeed = Math.min(track.samples.targetSpeed[p.sampleIdx], base.targetSpeed + 4) * 0.97;
      targetSpeed = Math.min(raceSpeed, CONFIG.pit.speedLimitMS + (1 - blend * blend) * 55);
      aimDist = lookahead;
    } else if (this._pitAuto === 'in') {
      aimLat = track.pit.lat;
      targetSpeed = CONFIG.pit.speedLimitMS - 1;
      if (!p.servicedThisVisit && toBox < 42 && toBox > -8) {
        targetSpeed = clamp(Math.max(toBox, 0) * 0.55, 0, CONFIG.pit.speedLimitMS);
        if (Math.abs(toBox) < 4.5 && speed < 2.4) {
          p.startPitService();
          this.playerPitRequested = false;
          this.hud.showMessage(`PIT STOP — YOUR GARAGE CREW AT WORK${this.raceConfig.damage && p.damageLevel > 0 ? ' (incl. repairs)' : ''}`, 2400);
          return { steer: 0, throttle: 0, brake: 1, aeroDesired: false };
        }
      } else if (!p.servicedThisVisit && toBox <= -8) {
        targetSpeed = 0; // failsafe: slightly past the box — stop here, crew services anyway
        if (speed < 1 && p.inPitLane) {
          p.startPitService();
          this.playerPitRequested = false;
          return { steer: 0, throttle: 0, brake: 1, aeroDesired: false };
        }
      }
    } else { // out
      const pastWallEnd = deltaS(p.s, track.pit.wallEndS, track.length) < 0;
      aimLat = pastWallEnd ? Math.sign(track.pit.lat) * (track.roadHalfWidth - 1.6) : track.pit.lat;
      targetSpeed = pastWallEnd ? Math.min(track.samples.targetSpeed[p.sampleIdx], 42) : CONFIG.pit.speedLimitMS;
      const pastExit = deltaS(track.pit.exitS, p.s, track.length);
      if (pastExit > 0 && pastExit < 250 && Math.abs(p.lat) < track.roadHalfWidth) {
        this._pitAuto = 'off';
        this.hud.showMessage('PIT EXIT — YOU HAVE CONTROL. GO!', 2400);
        return manual;
      }
    }

    const aim = getPointAt(track, p.s + aimDist, aimLat, this._autoAim);
    const err = wrapAnglePi(Math.atan2(aim.x - p.x, aim.z - p.z) - p.heading);
    const steer = clamp(err * 2.1 - p.yawRate * 0.04, -1, 1);
    let throttle = 0, brake = 0;
    const u = p.u;
    if (u < targetSpeed - 0.4) throttle = clamp((targetSpeed - u) / 6, 0.25, 1);
    else if (u > targetSpeed + 0.6) brake = clamp((u - targetSpeed) / 7, 0.15, 1);
    else throttle = 0.55;
    if (Math.abs(u) < 1 && targetSpeed > 3) { throttle = 1; brake = 0; }
    return { steer, throttle, brake, aeroDesired: false };
  }

  _pitGuidance() {
    const p = this.player;
    if (p.pitState === 'servicing') return `🔧 SERVICING AT YOUR GARAGE… ${Math.max(p.pitTimer, 0).toFixed(1)}s`;
    if (this._pitAuto === 'approach') return '🤖 PIT AUTOPILOT — ENTERING THE PIT LANE';
    if (this._pitAuto === 'in') return `🤖 AUTOPILOT — STOPPING AT YOUR GARAGE (BOX ${p.pitBoxIndex + 1})`;
    if (this._pitAuto === 'out') return '🤖 AUTOPILOT — EXITING… CONTROL RETURNS AT PIT EXIT';
    if (p.inPitLane) {
      const toBox = deltaS(p.s, p.pitBoxS ?? this.track.pit.boxS, this.track.length);
      return toBox > 0 && toBox < 400
        ? `PIT LANE — STOP AT YOUR ORANGE BOX ${p.pitBoxIndex + 1} (${Math.round(toBox)} m) — or press P for autopilot`
        : 'PIT LANE — LIMITER ON (80 KM/H)';
    }
    if (this.playerPitRequested) return 'PIT REQUESTED — AUTOPILOT ENGAGES AT PIT ENTRY [P to cancel]';
    if (p.tyreWear < 22) return 'TYRES VERY WORN — CONSIDER PITTING [P]';
    return '';
  }

  // ---------------- frame ----------------
  _frame(ts) {
    let frameDt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (!(frameDt > 0)) frameDt = 0.016;
    frameDt = Math.min(frameDt, CONFIG.maxFrameTime); // clamp: no spiral-of-death

    const simActive = this.state === 'countdown' || this.state === 'racing';
    if (simActive) {
      for (const car of this.allCars) car.snapshotPrev();
      const stepDt = 1 / CONFIG.physicsHz;
      this._accumulator += frameDt;
      let n = 0;
      while (this._accumulator >= stepDt && n < 24) {
        this._physicsStep(stepDt);
        this._accumulator -= stepDt;
        n++;
      }
      if (n === 24) this._accumulator = 0; // drop backlog rather than spiral
    }

    const alpha = simActive ? clamp(this._accumulator / (1 / CONFIG.physicsHz), 0, 1) : 1;
    this._updateVisuals(frameDt, alpha, simActive);
    this.renderer.render(this.scene, this.camera);

    // countdown light beeps
    if (this.state === 'countdown') {
      const on = this.race.lightsOn;
      if (on > this._lastLightsOn) { this.audio.beep(false); this._lastLightsOn = on; }
      this.hud.setLights(on);
    }

    // finish → results after a short celebration roll
    if (this._finishTimer > 0) {
      this._finishTimer -= frameDt;
      if (this._finishTimer <= 0) {
        this.state = 'finished';
        this.audio.stopEngine();
        CrazyGamesSDK.gameplayStop();
        if (this.hooks.onRaceFinished) {
          this.hooks.onRaceFinished(this.race.results(), this.race.fastestLap);
        }
      }
    }
  }

  _updateVisuals(dt, alpha, simActive) {
    // interpolated car transforms
    for (const car of this.allCars) {
      const x = lerp(car.prevX, car.x, alpha);
      const z = lerp(car.prevZ, car.z, alpha);
      car.visual.position.set(x, 0, z);
      const slipYaw = clamp(0.55 * Math.atan2(car.w, Math.max(Math.abs(car.u), 4)), -0.32, 0.32);
      car.visual.rotation.set(0, lerpAngle(car.prevHeading, car.heading, alpha) + slipYaw, 0);
      updateCarVisual(car.visual, car, dt);
      // dust off-track / smoke with heavy damage
      if (simActive && car.offTrack && Math.abs(car.u) > 9 && Math.random() < 0.5) {
        this._spawnParticles(car.x, 0.3, car.z, 1, 0x8a7f6f, 1.4, 1.6, 0.8);
      }
      if (simActive && car.damageLevel >= 3 && Math.random() < 0.4) {
        this._spawnParticles(car.x, 0.9, car.z, 1, 0x555560, 0.7, 1.9, 0.9);
      }
    }
    this._updateParticles(dt);

    const p = this.player;
    // sun shadow follows the action
    const focus = this.state === 'menu' ? p : p;
    this.env.sun.position.copy(new THREE.Vector3(focus.x, 0, focus.z).addScaledVector(this.env.sunDir, 260));
    this.env.sun.target.position.set(focus.x, 0, focus.z);

    // rain follows player
    if (this.env.rain.visible) {
      const pos = this.env.rain.geometry.attributes.position;
      const arr = this.env.rainPos;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= 34 * dt;
        if (arr[i + 1] < 0) arr[i + 1] += 55;
      }
      pos.needsUpdate = true;
      this.env.rain.position.set(p.x, 0, p.z);
    }

    this._updateCamera(dt);

    // HUD + audio during play
    if (simActive || this.state === 'paused') {
      const st = this.race.stat(p);
      this.hud.update(dt, {
        vehicle: p,
        race: this.race,
        stat: st,
        position: this.race.positionOf(p),
        gapAhead: this.race.gapAhead(p),
        gapBehind: this.race.gapBehind(p),
        standings: this.race.standings,
        currentLapTime: st && st.timingLive ? this.race.raceTime - st.lapStartT : null,
        damageEnabled: this.raceConfig.damage,
        pitGuidance: this._pitGuidance()
      });
      if (this.state !== 'paused') {
        const rpm01 = clamp((p.rpm - 4200) / (13500 - 4200), 0, 1);
        const raw = this.input.getState(this.settings.steeringSensitivity);
        this.audio.updateEngine(
          rpm01,
          this.race.state === 'countdown' ? raw.throttle * 0.7 : raw.throttle,
          clamp(Math.abs(p.w) / 7, 0, 1) * (Math.abs(p.u) > 12 ? 1 : 0),
          p.onKerb && Math.abs(p.u) > 8 ? 0.8 : 0,
          clamp(Math.abs(p.u) / CONFIG.vehicle.topSpeedMS, 0, 1)
        );
      }
    }
  }

  _updateCamera(dt) {
    const p = this.player;
    if (this.state === 'menu' || this.state === 'finished') {
      // slow orbit around the player's grid slot
      this._menuAngle += dt * 0.11;
      const r = 21;
      const tx = p.x + Math.cos(this._menuAngle) * r;
      const tz = p.z + Math.sin(this._menuAngle) * r;
      this._camPos.x = damp(this._camPos.x, tx, 1.6, dt);
      this._camPos.y = damp(this._camPos.y, 6.5, 1.6, dt);
      this._camPos.z = damp(this._camPos.z, tz, 1.6, dt);
      this.camera.position.copy(this._camPos);
      this._camLook.set(p.x, 1.1, p.z);
      this.camera.lookAt(this._camLook);
      this._setFov(55);
      return;
    }

    const f = p.forward();
    const speed01 = clamp(Math.abs(p.u) / CONFIG.vehicle.topSpeedMS, 0, 1);
    if (this.cameraMode === 2) {
      // cockpit: hard-attached, slight look-into-corner
      this.camera.position.set(p.x + f.x * 0.15, 1.08, p.z + f.z * 0.15);
      const lookH = p.heading + p.steer * 0.12;
      this._camLook.set(p.x + Math.sin(lookH) * 40, 0.95, p.z + Math.cos(lookH) * 40);
      this.camera.lookAt(this._camLook);
      this._camPos.copy(this.camera.position);
      this._setFov(68 + speed01 * 6);
    } else {
      const back = this.cameraMode === 1 ? 15.5 : 9.8;
      const up = this.cameraMode === 1 ? 5.6 : 3.3;
      const tx = p.x - f.x * back;
      const tz = p.z - f.z * back;
      const lambda = this.cameraMode === 1 ? 3.2 : 4.6;
      this._camPos.x = damp(this._camPos.x, tx, lambda, dt);
      this._camPos.z = damp(this._camPos.z, tz, lambda, dt);
      this._camPos.y = damp(this._camPos.y, up, 4.2, dt);
      if (this._camPos.y < 1.1) this._camPos.y = 1.1;
      this.camera.position.copy(this._camPos);
      // impact shake
      if (this._shake > 0.01) {
        this.camera.position.x += (Math.random() - 0.5) * this._shake * 0.5;
        this.camera.position.y += (Math.random() - 0.5) * this._shake * 0.4;
        this._shake = damp(this._shake, 0, 7, dt);
      }
      this._camLook.set(p.x + f.x * 7.5, 1.0, p.z + f.z * 7.5);
      this.camera.lookAt(this._camLook);
      this._setFov(62 + speed01 * 8);
    }
  }

  _setFov(fov) {
    if (Math.abs(fov - this._fov) > 0.15) {
      this._fov = fov;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _onResize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth, h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
