// DUSK APEX — arcade-simulation hybrid vehicle model (§14).
//
// Model summary (stable at a fixed 120 Hz step):
//  • World velocity vector, decomposed each step into forward/lateral parts.
//  • Bicycle-style yaw from the steering angle, clamped by a speed-dependent
//    lateral-acceleration limit (downforce grows with v²) → real grip limit.
//  • Lateral velocity is damped by tyre/surface/weather/damage grip.
//  • Longitudinal: engine taper to an effective top speed (aero, slipstream,
//    damage and pit limiter all act here), strong brakes, reverse gear.
//  • Track position comes from projecting onto the shared centreline data.
//
// The car can always recover: NaN guard + resetToTrack() (§11, no soft-locks).

import { CONFIG, TYRES, TYRE_WEAR } from '../config/config.js';
import { getPointAt, projectToTrack, inAeroZone, deltaS, maxLateralAccel } from '../track/trackData.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export class Vehicle {
  constructor(track, opts = {}) {
    this.track = track;
    this.name = opts.name || 'CAR';
    this.isPlayer = !!opts.isPlayer;
    this.x = 0; this.z = 0; this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.u = 0; // forward speed m/s
    this.w = 0; // lateral speed m/s (+ = sliding to driver's right)
    this.steer = 0; // smoothed steering -1..1 (+ = left)
    this.yawRate = 0;
    this.wheelAngle = 0;
    this.braking = false;
    this.sampleIdx = 0;
    this.s = 0; // lap distance 0..L
    this.lat = 0; // lateral offset (+ = left of centreline)
    this.totalDist = 0; // unwrapped distance (negative on the grid)
    this._prevS = 0;
    this.gear = 1; this.rpm = CONFIG.gears.rpmIdle;
    this.compound = opts.tyre || 'medium';
    this.nextCompound = this.compound;
    this.tyreWear = 100; // health %
    this.tyreAgeM = 0;
    this.damageLevel = 0; // 0 none, 1 light, 2 medium, 3 heavy
    this.aeroActive = false;
    this.aeroAvailable = false;
    this.slipstream = false;
    this.surface = 'road'; // road | kerb | off | pit
    this.offTrack = false;
    this.onKerb = false;
    this.inPitLane = false;
    this.pitState = 'none'; // none | lane | servicing
    this.pitTimer = 0;
    this.pitStops = 0;
    this.pitBoxIndex = -1; // assigned garage (set by Game / tests)
    this.pitBoxS = null;
    this._prevLat = 0;
    this.servicedThisVisit = false; // one service per pit-lane visit (latch)
    this.wrongWay = false;
    this.stuckTimer = 0;
    this.stoppedTimer = 0;
    this.events = []; // {type:'wall'|'car'|'shift'|'pitdone', impact}
    this.visual = null; // three.js group, set by renderer layer
    // interpolation snapshots (§13)
    this.prevX = 0; this.prevZ = 0; this.prevHeading = 0;
  }

  get speedMS() { return Math.hypot(this.vx, this.vz); }
  get speedKmh() { return Math.abs(this.u) * 3.6; }
  get tyre() { return TYRES[this.compound]; }
  get tyreAgeLaps() { return this.tyreAgeM / this.track.length; }

  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  placeAt(s, lat, speedMS = 0) {
    const p = getPointAt(this.track, s, lat, {});
    this.x = p.x; this.z = p.z; this.heading = p.phi;
    this.vx = p.tx * speedMS; this.vz = p.tz * speedMS;
    this.u = speedMS; this.w = 0;
    const proj = projectToTrack(this.track, this.x, this.z, p.idx, 120);
    this.sampleIdx = proj.idx; this.s = proj.s; this.lat = proj.lat;
    this._prevLat = proj.lat;
    this._prevS = proj.s;
    this.prevX = this.x; this.prevZ = this.z; this.prevHeading = this.heading;
  }

  resetToGrid(slot, compound) {
    if (compound) { this.compound = compound; this.nextCompound = compound; }
    this.tyreWear = 100; this.tyreAgeM = 0;
    this.damageLevel = 0;
    this.aeroActive = false; this.slipstream = false;
    this.pitState = 'none'; this.pitTimer = 0; this.pitStops = 0; this.servicedThisVisit = false;
    this.stuckTimer = 0; this.stoppedTimer = 0;
    this.events.length = 0;
    this.placeAt(slot.s, slot.lat, 0);
    this.totalDist = slot.s; // grid sits behind the line → negative
  }

  /** Recovery: nearest centreline point at current progress, slow speed.
   *  Used for stuck cars / invalid states — never gains distance (§11). */
  resetToTrack() {
    const keepS = this.s;
    this.placeAt(keepS, 0, 6);
    this._prevS = this.s; // totalDist unchanged apart from projection jitter
  }

  applyDamage(impact, enabled) {
    if (!enabled || impact < CONFIG.damage.thresholds[0]) return;
    const lvl = impact > CONFIG.damage.thresholds[2] ? 3
      : impact > CONFIG.damage.thresholds[1] ? 2 : 1;
    if (lvl > this.damageLevel) this.damageLevel = lvl;
  }

  startPitService() {
    if (this.servicedThisVisit || this.pitState === 'servicing') return;
    this.servicedThisVisit = true;
    this.pitState = 'servicing';
    this.pitTimer = CONFIG.pit.serviceTimeS * (this.isPlayer ? 1 : 1.15);
    this.vx = 0; this.vz = 0; this.u = 0; this.w = 0;
  }

  snapshotPrev() {
    this.prevX = this.x; this.prevZ = this.z; this.prevHeading = this.heading;
  }

  /**
   * @param dt fixed step seconds
   * @param input {steer -1..1 (+left), throttle 0..1, brake 0..1, aeroDesired bool}
   * @param env {weatherGrip, damageEnabled, locked}
   */
  step(dt, input, env) {
    const V = CONFIG.vehicle;
    const track = this.track;

    if (this.pitState === 'servicing') {
      this._prevLat = this.lat;
      this.pitTimer -= dt;
      this.rpm = CONFIG.gears.rpmIdle;
      if (this.pitTimer <= 0) {
        this.compound = this.nextCompound;
        this.tyreWear = 100; this.tyreAgeM = 0;
        this.damageLevel = 0;
        this.pitStops++;
        this.pitState = 'lane';
        this.events.push({ type: 'pitdone' });
      }
      return;
    }

    const locked = !!env.locked;
    const throttle = locked ? 0 : clamp(input.throttle || 0, 0, 1);
    const brake = locked ? 0 : clamp(input.brake || 0, 0, 1); // locked handled below — holding still, never reversing
    const steerTarget = locked ? 0 : clamp(input.steer || 0, -1, 1);

    // --- frame decomposition ---
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -Math.cos(this.heading), rz = Math.sin(this.heading); // right
    let u = this.vx * fx + this.vz * fz;
    let w = this.vx * rx + this.vz * rz;

    // --- grip stack ---
    const wearFactor = TYRE_WEAR.gripFloorFactor + (1 - TYRE_WEAR.gripFloorFactor) * (this.tyreWear / 100);
    const dmg = CONFIG.damage;
    const surfaceGrip = this.surface === 'off' ? V.offTrackGrip : this.surface === 'kerb' ? V.kerbGrip : 1;
    const totalGrip = this.tyre.grip * wearFactor * surfaceGrip * (env.weatherGrip || 1) * dmg.gripFactor[this.damageLevel];

    // --- steering / yaw (grip-limited) ---
    const steerRate = this.isPlayer ? 5.2 : 7.5;
    this.steer += clamp(steerTarget - this.steer, -steerRate * dt, steerRate * dt);
    const speedFade = Math.pow(clamp(1 - Math.abs(u) / 62, 0, 1), 1.55);
    const maxSteer = V.maxSteerHighRad + (V.maxSteerLowRad - V.maxSteerHighRad) * speedFade;
    const wheelAngle = this.steer * maxSteer;
    this.wheelAngle = wheelAngle;
    this.braking = brake > 0.12 && u > 1;
    let maxLat = maxLateralAccel(Math.abs(u), totalGrip);
    maxLat *= (this.aeroActive ? 0.92 : 1) * (0.6 + 0.4 * dmg.downforceFactor[this.damageLevel]);
    const desiredYaw = (u / V.wheelBaseM) * Math.tan(wheelAngle);
    const yawMax = Math.min(maxLat / Math.max(Math.abs(u), 3.5), 2.4);
    this.yawRate = clamp(desiredYaw, -yawMax, yawMax);
    if (Math.abs(u) < 0.2) this.yawRate = 0;
    this.wheelAngle = 0;
    this.braking = false;
    this.heading += this.yawRate * dt;

    // --- lateral damping (tyre grip pulls velocity in line with heading) ---
    const latRate = V.baseLatGripRate * totalGrip * (this.aeroActive ? 0.92 : 1);
    w *= Math.exp(-latRate * dt);

    // --- longitudinal ---
    let topEff = V.topSpeedMS * dmg.topSpeedFactor[this.damageLevel];
    if (this.aeroActive) topEff *= V.aeroTopSpeedFactor;
    if (this.slipstream) topEff *= V.slipstreamTopSpeedFactor;
    if (this.inPitLane) topEff = Math.min(topEff, CONFIG.pit.speedLimitMS); // auto limiter
    let acc = 0;
    if (locked) acc = -u * 10; // countdown: hold the car exactly on its grid slot
    else if (throttle > 0) {
      let ea = throttle * V.engineAccel * clamp(1 - u / topEff, 0, 1);
      ea = Math.min(ea, 5.5 + maxLat * 0.5); // traction limit
      if (this.slipstream && u > 20) ea += V.slipstreamAccelBonus * throttle;
      acc += ea;
    }
    if (!locked && brake > 0) {
      if (u > 0.35) acc -= brake * V.brakeDecel * clamp(totalGrip, 0.45, 1.1);
      else acc -= brake * 6.5 * clamp(1 + u / V.reverseMaxMS, 0, 1); // reverse
    }
    if (!locked && throttle < 0.05 && brake < 0.05) acc -= clamp(u * 0.035, -2.2, 2.2); // engine braking
    acc -= u * 0.012; // rolling resistance
    if (this.surface === 'off') acc -= Math.sign(u) * V.offTrackDrag;
    u += acc * dt;
    if (u < -V.reverseMaxMS) u = -V.reverseMaxMS;

    // --- recompose velocity in the new heading frame ---
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = -Math.cos(this.heading), nrz = Math.sin(this.heading);
    this.vx = nfx * u + nrx * w;
    this.vz = nfz * u + nrz * w;
    this.u = u; this.w = w;

    // --- integrate position (time-based, fixed step) ---
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // --- track projection / progress ---
    const proj = projectToTrack(track, this.x, this.z, this.sampleIdx, 70);
    const dsTotal = deltaS(this._prevS, proj.s, track.length);
    this.totalDist += dsTotal;
    this._prevS = proj.s;
    this.sampleIdx = proj.idx;
    this.s = proj.s;
    this.lat = proj.lat;

    // --- surface & pit-lane state ---
    const alat = Math.abs(this.lat);
    const pit = track.pit;
    const inPitBand = track.inPitRange(this.s) &&
      Math.sign(this.lat) === Math.sign(pit.lat) &&
      Math.abs(alat - Math.abs(pit.lat)) < 4.4;
    this.inPitLane = inPitBand;
    if (inPitBand) {
      this.surface = 'pit';
      if (this.pitState === 'none') this.pitState = 'lane';
    } else {
      if (this.pitState === 'lane' && deltaS(pit.exitS, this.s, track.length) > 0 && deltaS(pit.exitS, this.s, track.length) < 300) { this.pitState = 'none'; this.servicedThisVisit = false; }
      else if (this.pitState === 'lane' && alat <= track.roadHalfWidth && deltaS(this.pitBoxS ?? pit.boxS, this.s, track.length) > 25) { this.pitState = 'none'; this.servicedThisVisit = false; }
      this.surface = alat <= track.roadHalfWidth ? 'road'
        : alat <= track.roadHalfWidth + track.kerbWidth ? 'kerb' : 'off';
    }
    if (this.pitState === 'lane' && !inPitBand && track.inPitRange(this.s) && alat > track.roadHalfWidth) {
      this.surface = 'off'; // gravel between road and pit lane
    }
    this.offTrack = this.surface === 'off';
    this.onKerb = this.surface === 'kerb';

    // --- pit divider wall: cannot cross except at the entry/exit gaps ---
    if (track.inPitWallRange && track.inPitWallRange(this.s)) {
      const wallLat = track.pit.wallLat;
      const prevSide = Math.sign(this._prevLat - wallLat);
      const curSide = Math.sign(this.lat - wallLat);
      if (prevSide !== 0 && curSide !== 0 && prevSide !== curSide) {
        const wnx = track.samples.nx[this.sampleIdx], wnz = track.samples.nz[this.sampleIdx];
        const targetLat = wallLat + prevSide * 1.05;
        const corr = targetLat - this.lat;
        this.x += wnx * corr; this.z += wnz * corr;
        const vn = this.vx * wnx + this.vz * wnz;
        if (Math.sign(vn) === curSide && vn !== 0) {
          this.vx -= wnx * vn * 1.25; this.vz -= wnz * vn * 1.25;
          this.vx *= 0.9; this.vz *= 0.9;
          this.applyDamage(Math.abs(vn), env.damageEnabled);
          if (Math.abs(vn) > 1.5) this.events.push({ type: 'wall', impact: Math.abs(vn) });
        }
        this.lat = targetLat;
      }
    }

    // --- barrier collision ---
    const smp = track.samples;
    const barrier = (this.lat >= 0 ? smp.barrierL[this.sampleIdx] : smp.barrierR[this.sampleIdx]) - 1.0;
    if (alat > barrier) {
      const outSign = Math.sign(this.lat) || 1;
      const nx = smp.nx[this.sampleIdx], nz = smp.nz[this.sampleIdx];
      const excess = alat - barrier;
      this.x -= nx * outSign * excess;
      this.z -= nz * outSign * excess;
      const vnOut = (this.vx * nx + this.vz * nz) * outSign;
      if (vnOut > 0) {
        this.vx -= nx * outSign * vnOut * 1.3;
        this.vz -= nz * outSign * vnOut * 1.3;
        this.vx *= 0.86; this.vz *= 0.86;
        this.applyDamage(vnOut, env.damageEnabled);
        if (vnOut > 1.2) this.events.push({ type: 'wall', impact: vnOut });
      }
      this.lat = outSign * barrier;
    }

    // --- active aero (§15: zones, same rules for everyone) ---
    const zone = inAeroZone(track, this.s);
    this.aeroAvailable = !!zone;
    if (input.aeroDesired && zone && brake < 0.08 && Math.abs(this.steer) < 0.55 && u > 16) {
      this.aeroActive = true;
    } else if (!input.aeroDesired || !zone || brake > 0.08 || Math.abs(this.steer) > 0.65) {
      this.aeroActive = false;
    }

    // --- gear / RPM (automatic; drives HUD + audio) ---
    const G = CONFIG.gears;
    const spd = Math.abs(u);
    let g = 0;
    while (g < G.tops.length - 1 && spd > G.tops[g]) g++;
    if (g + 1 !== this.gear && spd > 3) this.events.push({ type: 'shift' });
    this.gear = u < -0.3 ? 0 : g + 1; // 0 = reverse
    const lo = g === 0 ? 0 : G.tops[g - 1];
    const band = clamp((spd - lo) / Math.max(G.tops[g] - lo, 1), 0, 1);
    this.rpm = spd < 0.4 && throttle < 0.05 ? G.rpmIdle
      : lerp(G.rpmMin, G.rpmMax, Math.pow(band, 0.8)) + throttle * 250;

    // --- tyre wear (gradual, §16) ---
    if (spd > 4) {
      const slipTerm = clamp(Math.abs(w) / 6, 0, 1.5) * TYRE_WEAR.slipPerSecond
        + (this.offTrack ? 0.45 : 0)
        + clamp(Math.abs(this.yawRate * u) / 45, 0, 0.5);
      this.tyreWear = Math.max(0, this.tyreWear - dt * this.tyre.wearRate * (TYRE_WEAR.basePerSecond + slipTerm));
      this.tyreAgeM += spd * dt;
    }

    // --- state flags ---
    const txv = smp.tx[this.sampleIdx], tzv = smp.tz[this.sampleIdx];
    this.wrongWay = (nfx * txv + nfz * tzv) < -0.25 && spd > 3;
    if (spd < 0.7 && throttle > 0.25) this.stuckTimer += dt; else this.stuckTimer = 0;
    if (spd < 0.7) this.stoppedTimer += dt; else this.stoppedTimer = 0;

    // --- NaN / invalid-state recovery (§39) ---
    if (!Number.isFinite(this.x + this.z + this.vx + this.vz + this.heading)) {
      this.resetToTrack();
    }
    this._prevLat = this.lat;
  }
}

/** Pairwise car↔car collision: two circles per car, impulse + push-apart. */
export function resolveCarCollisions(cars, damageEnabled) {
  const R = CONFIG.vehicle.collisionRadius;
  const OFF = CONFIG.vehicle.collisionOffset;
  const minD = R * 2;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.pitState === 'servicing') continue;
    const af = a.forward();
    const ac = [
      { x: a.x + af.x * OFF, z: a.z + af.z * OFF },
      { x: a.x - af.x * OFF, z: a.z - af.z * OFF }
    ];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.pitState === 'servicing') continue;
      const dx0 = b.x - a.x, dz0 = b.z - a.z;
      if (dx0 * dx0 + dz0 * dz0 > 64) continue; // >8 m apart: skip detail
      const bf = b.forward();
      const bc = [
        { x: b.x + bf.x * OFF, z: b.z + bf.z * OFF },
        { x: b.x - bf.x * OFF, z: b.z - bf.z * OFF }
      ];
      for (const pa of ac) {
        for (const pb of bc) {
          let dx = pb.x - pa.x, dz = pb.z - pa.z;
          let d2 = dx * dx + dz * dz;
          if (d2 >= minD * minD || d2 === 0) continue;
          const d = Math.sqrt(d2);
          dx /= d; dz /= d;
          const push = (minD - d) / 2;
          a.x -= dx * push; a.z -= dz * push;
          b.x += dx * push; b.z += dz * push;
          const relV = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
          if (relV < 0) {
            const impulse = -relV * 0.62; // slight bounce, mostly scrub
            a.vx -= dx * impulse; a.vz -= dz * impulse;
            b.vx += dx * impulse; b.vz += dz * impulse;
            a.vx *= 0.94; a.vz *= 0.94; b.vx *= 0.94; b.vz *= 0.94;
            const impact = -relV;
            a.applyDamage(impact * 0.58, damageEnabled); // glancing car contact < wall hit (§15 boundaries: minor contact must not wreck a race)
            b.applyDamage(impact * 0.58, damageEnabled);
            if (impact > 1.4) {
              a.events.push({ type: 'car', impact });
              b.events.push({ type: 'car', impact });
            }
          }
        }
      }
    }
  }
}
