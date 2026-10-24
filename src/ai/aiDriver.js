// DUSK APEX — AI opponents (§19).
//
// Decisions (overtake/defend/pit/recovery) run at ~12 Hz; steering/throttle
// control runs every physics step. AI cars use the SAME Vehicle physics,
// tyre wear and active-aero rules as the player — no teleporting, no
// impossible speeds, no rubber-banding. Pace differences come only from a
// per-driver skill factor applied to corner target speeds.

import { CONFIG } from '../config/config.js';
import { getPointAt, deltaS } from '../track/trackData.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class AIDriver {
  constructor(vehicle, profile, track) {
    this.vehicle = vehicle;
    this.profile = profile;
    this.track = track;
    this.skill = profile.skill;
    this.aggression = profile.aggression;
    // map skill 0.948..0.995 → corner-speed factor ≈0.88..0.99
    this.paceFactor = 0.905 + 0.085 * clamp((this.skill - 0.94) / 0.06, 0, 1);
    this.lineBias = ((profile.name.charCodeAt(0) * 7) % 10) / 10 - 0.5; // ±0.4 m deterministic
    this.thinkTimer = Math.random() / CONFIG.ai.thinkHz;
    this.latOffset = 0; // added to racing line (overtake/defend)
    this.latOffsetTarget = 0;
    this.speedCap = Infinity; // following / yellow-flag cap
    this.mode = 'race'; // race | pit-in | pit | pit-out
    this.pitRequested = false;
    this.overtakeSide = 0;
    this.overtakeHoldT = 0;
    this.pitOutT = 0; // seconds of careful merging after a pit exit
    this._aim = {};
    this._input = { steer: 0, throttle: 0, brake: 0, aeroDesired: false };
  }

  reset() {
    this.mode = 'race';
    this.pitRequested = false;
    this.latOffset = 0; this.latOffsetTarget = 0;
    this.speedCap = Infinity;
    this.overtakeSide = 0; this.overtakeHoldT = 0; this.pitOutT = 0;
  }

  think(ctx) {
    const v = this.vehicle;
    const track = this.track;
    const L = track.length;
    this.latOffsetTarget = 0;
    this.speedCap = Infinity;
    if (this.overtakeHoldT > 0) this.overtakeHoldT -= 1 / CONFIG.ai.thinkHz;

    // nearest cars ahead/behind by race distance
    let ahead = null, aheadDelta = Infinity;
    let behind = null, behindDelta = Infinity;
    for (const other of ctx.cars) {
      if (other === v) continue;
      const d = other.totalDist - v.totalDist;
      if (d > 0 && d < aheadDelta) { aheadDelta = d; ahead = other; }
      if (d < 0 && -d < behindDelta) { behindDelta = -d; behind = other; }
    }
    this._ahead = ahead; this._aheadDelta = aheadDelta;

    // ---- pit strategy: pit once tyres are worn if enough race remains ----
    const raceRemainingM = ctx.totalRaceM - v.totalDist;
    if (this.pitRequested && this.mode === 'race' && raceRemainingM < L * 0.9) {
      this.pitRequested = false; // too late in the race — stay out
    }
    if (this.mode === 'race' && !this.pitRequested &&
        v.tyreWear < 30 && raceRemainingM > L * 0.9 &&
        (v.pitStops === 0 || raceRemainingM > L * 2.2)) {
      this.pitRequested = true;
      v.nextCompound = raceRemainingM > L * 3 ? 'hard' : 'medium';
    }
    if (this.pitRequested && this.mode === 'race') {
      const toEntry = deltaS(v.s, track.pit.entryS, L);
      if (toEntry > 0 && toEntry < 260) this.mode = 'pit-in';
    }
    if (this.mode === 'pit-in' && v.inPitLane) this.mode = 'pit';
    if (this.mode === 'pit' && v.pitState === 'none') { this.mode = 'race'; this.pitRequested = false; this.pitOutT = 6; }
    if (this.mode !== 'race') return; // pit steering handled in control()

    // orderly launch: hold the racing line for the first seconds
    if ((ctx.raceTime || 0) < 5) {
      if (ahead && aheadDelta < 11) this.speedCap = Math.min(this.speedCap, Math.max(ahead.u, 6));
      return;
    }

    // car ahead is in/entering the pit lane: pass on the clean (non-pit) side
    if (ahead && ahead.pitState !== 'none' && aheadDelta < 48) {
      const lineHere = getPointAt(track, v.s + 25, 0, this._aim).lineLat;
      const want = clamp(-Math.sign(track.pit.lat) * 3.2, -track.roadHalfWidth + 1.4, track.roadHalfWidth - 1.4);
      this.latOffsetTarget = want - lineHere;
    }

    // ---- overtaking ----
    if (ahead && aheadDelta < 30 && ahead.pitState === 'none') {
      const closing = v.u - ahead.u;
      if (aheadDelta < 8 && Math.abs(ahead.lat - v.lat) < 2.4) {
        // too close & no room yet: match speed instead of ramming
        this.speedCap = Math.min(this.speedCap, Math.max(ahead.u - 0.5, 8));
      }
      if ((closing > -1 || aheadDelta < 16) && this.overtakeHoldT <= 0) {
        // pick the side with more room to the road edge
        const roomLeft = track.roadHalfWidth - ahead.lat;
        const roomRight = ahead.lat + track.roadHalfWidth;
        this.overtakeSide = roomLeft > roomRight ? 1 : -1;
        this.overtakeHoldT = 1.6;
      }
      if (aheadDelta < 24) {
        const want = clamp(ahead.lat + this.overtakeSide * 3.4, -track.roadHalfWidth + 1.4, track.roadHalfWidth - 1.4);
        const lineHere = getPointAt(track, v.s + 25, 0, this._aim).lineLat;
        this.latOffsetTarget = (want - lineHere) * (0.5 + this.aggression * 0.5);
      }
    }

    // ---- defending: cover the inside when a rival is right behind ----
    if (behind && behindDelta < 13 && behind.u > v.u - 1 && this.aggression > 0.45) {
      const aheadPt = getPointAt(track, v.s + 70, 0, this._aim);
      if (Math.abs(aheadPt.curv) > 0.004) {
        this.latOffsetTarget += Math.sign(aheadPt.curv) * 1.6 * this.aggression;
      }
    }

    // ---- yellow flag in my sector: back off ----
    if (ctx.yellowSector >= 0) {
      const mySector = Math.floor((((v.totalDist % L) + L) % L) / track.sectorLength);
      if (mySector === ctx.yellowSector) this.speedCap = Math.min(this.speedCap, 26);
    }

    // ---- recovery assist: long-stuck AI rejoin at same progress ----
    if (v.stoppedTimer > 6 && v.pitState !== 'servicing') v.resetToTrack();
  }

  /** @returns input for Vehicle.step */
  update(dt, ctx) {
    const v = this.vehicle;
    const track = this.track;
    const inp = this._input;
    inp.steer = 0; inp.throttle = 0; inp.brake = 0; inp.aeroDesired = false;

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 1 / CONFIG.ai.thinkHz;
      this.think(ctx);
    }
    // smooth lateral offset changes (no teleporting sideways)
    this.latOffset += clamp(this.latOffsetTarget - this.latOffset, -3.2 * dt, 3.2 * dt);

    if (v.pitState === 'servicing') return inp;

    const speed = Math.abs(v.u);
    const lookahead = clamp(9 + speed * 0.52, 11, 46);
    let aimLat, targetSpeed;

    if (this.mode === 'pit-in' || this.mode === 'pit') {
      // Two-phase pit entry (like a real driver):
      //  A) before the entry line: stay near racing pace, only gradually
      //     migrate toward the lane over the last ~220 m — slowing to the
      //     limit too early makes the car a roadblock and causes pile-ups.
      //  B) inside the lane: obey the limit and stop on the box (with a
      //     generous window + retry-next-lap if the box is overshot).
      const toEntry = deltaS(v.s, track.pit.entryS, track.length);
      const toBox = deltaS(v.s, track.pit.boxS, track.length);
      const pastEntry = toEntry <= 0 || v.inPitLane;
      const aimBase = getPointAt(track, v.s + lookahead, 0, this._aim);
      if (!pastEntry) {
        const blend = clamp(1 - Math.max(toEntry, 0) / 150, 0, 1);
        aimLat = aimBase.lineLat + (track.pit.lat - aimBase.lineLat) * blend;
        const raceSpeed = Math.min(track.samples.targetSpeed[v.sampleIdx], aimBase.targetSpeed + 4) * this.paceFactor;
        const approachCap = CONFIG.pit.speedLimitMS + (1 - blend * blend) * 55;
        targetSpeed = Math.min(raceSpeed, approachCap);
        const aim = getPointAt(track, v.s + lookahead, aimLat, this._aim);
        this._steerToward(aim, inp);
        this._speedControl(targetSpeed, inp);
        return inp;
      }
      this.mode = 'pit';
      aimLat = track.pit.lat;
      targetSpeed = CONFIG.pit.speedLimitMS - 1;
      if (v.inPitLane && !v.servicedThisVisit && toBox < 40 && toBox > -8) {
        targetSpeed = clamp(Math.max(toBox, 0) * 0.55, 0, CONFIG.pit.speedLimitMS);
        if (!v.servicedThisVisit && Math.abs(toBox) < 5.5 && speed < 2.2) { v.startPitService(); return inp; }
      } else if (!v.servicedThisVisit && toBox <= -8 && v.pitState === 'lane') {
        this.mode = 'race'; // overshot the box WITHOUT service — stay out, retry next lap
      }
      const aim = getPointAt(track, v.s + Math.min(lookahead, 20), aimLat, this._aim);
      this._steerToward(aim, inp);
      this._speedControl(targetSpeed, inp);
      return inp;
    }

    // racing aim point on the (offset) racing line
    const aimBase = getPointAt(track, v.s + lookahead, 0, this._aim);
    aimLat = clamp(aimBase.lineLat + this.lineBias * 0.8 + this.latOffset,
      -track.roadHalfWidth + 1.2, track.roadHalfWidth - 1.2);
    if (this.pitOutT > 0) {
      this.pitOutT -= dt;
      const pitSideLat = Math.sign(track.pit.lat) * (track.roadHalfWidth - 1.3);
      aimLat = aimLat + (pitSideLat - aimLat) * 0.85; // stay aside while slow
    }
    if (v.offTrack || v.wrongWay) aimLat = 0; // head back to the middle
    const aim = getPointAt(track, v.s + lookahead, aimLat, this._aim);
    this._steerToward(aim, inp);

    // target speed: braking-feasible profile × skill, capped by traffic/flags
    const hereSpeed = track.samples.targetSpeed[v.sampleIdx];
    targetSpeed = Math.min(hereSpeed, aim.targetSpeed + 4) * this.paceFactor;
    // worn tyres cost the AI pace exactly like the player (via grip), plus caution
    targetSpeed *= 0.94 + 0.06 * (v.tyreWear / 100);
    if (v.offTrack) targetSpeed = Math.min(targetSpeed, 17);
    if (v.wrongWay) targetSpeed = 6;
    targetSpeed = Math.min(targetSpeed, this.speedCap);
    // per-step emergency follow: never plough into a slower car ahead
    if (this._ahead) {
      const dNow = this._ahead.totalDist - v.totalDist;
      const closing = v.u - this._ahead.u;
      const horizon = clamp(11 + Math.max(closing, 0) * 1.15, 11, 72);
      if (dNow > 0 && dNow < horizon && Math.abs(this._ahead.lat - v.lat) < 2.8) {
        targetSpeed = Math.min(targetSpeed,
          Math.max(this._ahead.u + Math.max(dNow - 9, 0) * 0.45 - Math.max(11 - dNow, 0) * 0.35, 5));
      }
    }
    this._speedControl(targetSpeed, inp);

    // active aero on straights when running at full throttle (§15: same rules)
    inp.aeroDesired = v.aeroAvailable && inp.throttle > 0.9 && Math.abs(inp.steer) < 0.35;
    return inp;
  }

  _steerToward(aim, inp) {
    const v = this.vehicle;
    const dx = aim.x - v.x, dz = aim.z - v.z;
    const desired = Math.atan2(dx, dz); // heading convention: φ=atan2(x,z)
    const err = wrapAngle(desired - v.heading);
    inp.steer = clamp(err * 2.1 - v.yawRate * 0.04, -1, 1);
  }

  _speedControl(targetSpeed, inp) {
    const u = this.vehicle.u;
    if (u < targetSpeed - 0.4) {
      inp.throttle = clamp((targetSpeed - u) / 6, 0.25, 1);
      inp.brake = 0;
    } else if (u > targetSpeed + 0.6) {
      inp.throttle = 0;
      inp.brake = clamp((u - targetSpeed) / 7, 0.15, 1);
    } else {
      inp.throttle = 0.55;
      inp.brake = 0;
    }
    // standing-start / recovery nudge
    if (Math.abs(u) < 1 && targetSpeed > 3) { inp.throttle = 1; inp.brake = 0; }
  }
}
