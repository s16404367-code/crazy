// DUSK APEX — original circuit definition (Master Prompt §18).
//
// ONE data source drives everything: rendering, AI racing line, sectors,
// checkpoints, minimap, positioning and timing all read these samples.
//
// Layout (100% original, ~3.5 km): main straight → fast sweepers → LONG back
// straight → tight HAIRPIN → mid straight → CHICANE → final corner.
// Coordinates are metres in the XZ plane; travel direction follows the
// control-point order. The spline is auto-scaled so lap length ≈ 3.5 km.

import * as THREE from 'three';
import { CONFIG } from '../config/config.js';

// Original control points [x, z]. See header for the layout story.
const RAW_POINTS = [
  [180, 302], // A main straight (westbound)
  [-60, 308], // B
  [-300, 300], // C
  [-430, 215], // D turn 1
  [-482, 40], // E west sweepers (northbound)
  [-468, -150], // F
  [-365, -265], // G onto the back straight
  [-40, -305], // H LONG BACK STRAIGHT (eastbound)
  [260, -295], // I
  [425, -230], // J hairpin entry / heavy braking
  [492, -162], // K HAIRPIN apex (tight)
  [425, -96], // L hairpin exit (westbound)
  [238, -52], // M mid straight
  [125, -88], // N kink turning south
  [88, 8], // O  CHICANE swing 1
  [168, 82], // P  CHICANE swing 2
  [92, 152], // Q  CHICANE swing 3
  [150, 222], // R chicane exit
  [215, 268] // S final-corner entry → back to A
];
const START_REF = [60, 307]; // start/finish line reference on main straight

export function wrapS(s, L) {
  s = s % L;
  return s < 0 ? s + L : s;
}
/** Signed shortest delta from a→b along the lap, in [-L/2, L/2]. */
export function deltaS(a, b, L) {
  let d = wrapS(b - a, L);
  if (d > L / 2) d -= L;
  return d;
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function smoothCircular(arr, window, passes) {
  const n = arr.length;
  const half = Math.floor(window / 2);
  let cur = arr.slice();
  for (let p = 0; p < passes; p++) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -half; k <= half; k++) sum += cur[(i + k + n) % n];
      out[i] = sum / window;
    }
    cur = out;
  }
  return cur;
}

/** Max lateral accel the car model can use at speed v (downforce grows ~v²).
 *  Mirrors the vehicle model so AI corner speeds match real capability. */
export function maxLateralAccel(v, grip = 1) {
  const df = Math.min((v / 60) * (v / 60), 1.5);
  return (11 + 27 * df) * grip;
}
function cornerSpeed(curvAbs) {
  if (curvAbs < 1e-5) return 96;
  let v = 40;
  for (let i = 0; i < 4; i++) v = Math.sqrt((maxLateralAccel(v) * 0.9) / curvAbs);
  return clamp(v, 12.5, 96);
}

let _track = null;
export function getTrack() {
  if (_track) return _track;
  const T = CONFIG.track;

  // --- scale control points about their centroid so lap ≈ target length ---
  let cx = 0, cz = 0;
  for (const p of RAW_POINTS) { cx += p[0]; cz += p[1]; }
  cx /= RAW_POINTS.length; cz /= RAW_POINTS.length;
  const probe = new THREE.CatmullRomCurve3(
    RAW_POINTS.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal'
  );
  const scale = T.targetLengthM / probe.getLength();
  const tf = (p) => [cx + (p[0] - cx) * scale, cz + (p[1] - cz) * scale];
  const points = RAW_POINTS.map(tf);
  const startRef = tf(START_REF);

  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal'
  );
  const roughLen = curve.getLength();
  const N = Math.max(600, Math.round(roughLen / T.sampleSpacingM));
  const pts = curve.getSpacedPoints(N); // N+1 pts, last duplicates first
  pts.pop();

  // --- per-sample frames ---
  const n = pts.length;
  const xs = new Float64Array(n), zs = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = pts[i].x; zs[i] = pts[i].z; }
  const tx = new Float64Array(n), tz = new Float64Array(n);
  const phi = new Float64Array(n); // heading angle: forward=(sinφ, cosφ) in XZ
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let dx = xs[b] - xs[a], dz = zs[b] - zs[a];
    const m = Math.hypot(dx, dz) || 1;
    tx[i] = dx / m; tz[i] = dz / m;
    phi[i] = Math.atan2(tx[i], tz[i]);
  }
  // cumulative distance
  const sArr = new Float64Array(n);
  let L = 0;
  for (let i = 1; i < n; i++) { L += Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]); sArr[i] = L; }
  L += Math.hypot(xs[0] - xs[n - 1], zs[0] - zs[n - 1]);

  // --- rotate samples so index 0 is the start/finish line ---
  let startIdx = 0, best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = (xs[i] - startRef[0]) ** 2 + (zs[i] - startRef[1]) ** 2;
    if (d < best) { best = d; startIdx = i; }
  }
  const rot = (arr) => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = arr[(startIdx + i) % n];
    return out;
  };
  const X = rot(xs), Z = rot(zs), TX = rot(tx), TZ = rot(tz), PHI = rot(phi);
  const sOff = sArr[startIdx];
  const S = new Float64Array(n);
  for (let i = 0; i < n; i++) S[i] = wrapS(sArr[(startIdx + i) % n] - sOff, L);

  // left normal (driver's left): for heading φ, left = (cosφ, -sinφ) in XZ
  const NX = new Float64Array(n), NZ = new Float64Array(n);
  for (let i = 0; i < n; i++) { NX[i] = Math.cos(PHI[i]); NZ[i] = -Math.sin(PHI[i]); }

  // --- signed curvature ( + = left turn ) and corner target speeds ---
  const ds = L / n;
  let curv = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 2 + n) % n, b = (i + 2) % n;
    curv[i] = wrapAngle(PHI[b] - PHI[a]) / (4 * ds);
  }
  curv = smoothCircular(curv, 9, 2);
  const targetSpeed = new Float64Array(n);
  for (let i = 0; i < n; i++) targetSpeed[i] = cornerSpeed(Math.abs(curv[i]));
  // backward braking-feasibility pass (AI can always slow in time @13 m/s²)
  for (let k = 0; k < 2; k++) {
    for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n;
      const feas = Math.sqrt(targetSpeed[j] * targetSpeed[j] + 2 * 13 * ds);
      if (feas < targetSpeed[i]) targetSpeed[i] = feas;
    }
  }

  // --- racing line: swing to the inside of curvature, heavily smoothed ---
  let line = curv.map((c) => clamp(c * 230, -(T.roadHalfWidth - 1.9), T.roadHalfWidth - 1.9));
  line = smoothCircular(line, 45, 3);
  const lineLat = new Float64Array(n);
  for (let i = 0; i < n; i++) lineLat[i] = clamp(line[i], -(T.roadHalfWidth - 1.9), T.roadHalfWidth - 1.9);

  // helper: lap-distance s nearest to a raw (unscaled) control reference
  const sAtRaw = (raw) => {
    const p = tf(raw);
    let bi = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = (X[i] - p[0]) ** 2 + (Z[i] - p[1]) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return S[bi];
  };

  // --- active-aero zones (§15): main straight + back straight ---
  const aeroZones = [
    { name: 'Main Straight', start: sAtRaw([205, 285]), end: sAtRaw([-250, 301]) },
    { name: 'Back Straight', start: sAtRaw([-340, -278]), end: sAtRaw([330, -282]) }
  ];

  // --- pit lane: south/outside of the main straight. The final corner is a
  // right-hander whose exit line runs to this same side, so entry is a
  // natural drift outward instead of crossing the whole track width. ---
  const s0i = 0;
  const pitSideSign = NZ[s0i] > 0 ? 1 : -1; // choose side with larger z (south)
  const pit = {
    lat: pitSideSign * CONFIG.pit.latOffset,
    entryS: sAtRaw([150, 303]), // on the main straight, AFTER the final corner
    boxS: sAtRaw([-120, 306]),
    exitS: sAtRaw([-265, 302]),
    limitMS: CONFIG.pit.speedLimitMS
  };
  const inPitRange = (s) => deltaS(pit.entryS, s, L) >= 0 && deltaS(s, pit.exitS, L) >= 0;

  // --- per-sample barrier distances (extended on pit side + corner outsides)
  const barrierL = new Float64Array(n), barrierR = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let bl = T.barrierHalfWidth, br = T.barrierHalfWidth;
    if (curv[i] > 0.007) br += 4.5; // left turn → more runoff on the right
    if (curv[i] < -0.007) bl += 4.5;
    if (inPitRange(S[i])) {
      if (pit.lat > 0) bl = Math.max(bl, Math.abs(pit.lat) + 6);
      else br = Math.max(br, Math.abs(pit.lat) + 6);
    }
    barrierL[i] = bl; barrierR[i] = br;
  }

  // --- grid slots (behind start line, staggered pairs) ---
  const gridSlots = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 2);
    gridSlots.push({ s: -15 - row * 9.5, lat: i % 2 === 0 ? -3.1 : 3.1 });
  }

  // bounds for minimap / ground plane
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    if (X[i] < minX) minX = X[i]; if (X[i] > maxX) maxX = X[i];
    if (Z[i] < minZ) minZ = Z[i]; if (Z[i] > maxZ) maxZ = Z[i];
  }

  _track = {
    samples: { x: X, z: Z, tx: TX, tz: TZ, nx: NX, nz: NZ, phi: PHI, s: S, curv: Float64Array.from(curv), targetSpeed, lineLat, barrierL, barrierR },
    count: n,
    length: L,
    ds,
    roadHalfWidth: T.roadHalfWidth,
    kerbWidth: T.kerbWidth,
    runoffWidth: T.runoffWidth,
    sectorLength: L / 3,
    aeroZones,
    pit,
    inPitRange,
    gridSlots,
    controlPoints: points,
    rawPoints: RAW_POINTS,
    sAtRaw,
    bounds: { minX, maxX, minZ, maxZ },
    // named reference distances (for scenery / brake boards)
    refs: {
      hairpinS: sAtRaw([492, -162]),
      chicaneS: sAtRaw([128, 80]),
      turn1S: sAtRaw([-430, 215]),
      backStraightS: sAtRaw([-40, -305])
    }
  };
  return _track;
}

/** Is lap-distance s inside an active-aero zone? (handles wrap) */
export function inAeroZone(track, s) {
  for (const z of track.aeroZones) {
    if (deltaS(z.start, s, track.length) >= 0 && deltaS(s, z.end, track.length) >= 0) return z;
  }
  return null;
}

/** Interpolated track point at lap-distance s with lateral offset lat
 *  (+lat = driver's left). Single source for AI aim points & rendering. */
export function getPointAt(track, s, lat = 0, out = {}) {
  const { samples, count, length } = track;
  const f = (wrapS(s, length) / length) * count;
  const i = Math.floor(f) % count;
  const j = (i + 1) % count;
  const t = f - Math.floor(f);
  const lerp = (a, b) => a + (b - a) * t;
  const nx = lerp(samples.nx[i], samples.nx[j]);
  const nz = lerp(samples.nz[i], samples.nz[j]);
  out.x = lerp(samples.x[i], samples.x[j]) + nx * lat;
  out.z = lerp(samples.z[i], samples.z[j]) + nz * lat;
  out.tx = lerp(samples.tx[i], samples.tx[j]);
  out.tz = lerp(samples.tz[i], samples.tz[j]);
  out.nx = nx; out.nz = nz;
  out.phi = lerp(samples.phi[i], samples.phi[j]);
  out.targetSpeed = lerp(samples.targetSpeed[i], samples.targetSpeed[j]);
  out.lineLat = lerp(samples.lineLat[i], samples.lineLat[j]);
  out.curv = lerp(samples.curv[i], samples.curv[j]);
  out.idx = i;
  return out;
}

/** Project a world position onto the centreline near a hint sample index.
 *  Search window keeps this O(window) — cheap at 120 Hz for 9 cars. */
export function projectToTrack(track, x, z, hintIdx = 0, window = 90) {
  const { samples, count, length } = track;
  let bi = hintIdx, bd = Infinity;
  for (let k = -window; k <= window; k++) {
    const i = (hintIdx + k + count) % count;
    const dx = x - samples.x[i], dz = z - samples.z[i];
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  // refine on the two adjacent segments for a continuous s / lat
  const seg = (a, b) => {
    const ax = samples.x[a], az = samples.z[a];
    const abx = samples.x[b] - ax, abz = samples.z[b] - az;
    const len2 = abx * abx + abz * abz || 1e-6;
    let t = ((x - ax) * abx + (z - az) * abz) / len2;
    t = clamp(t, 0, 1);
    const px = ax + abx * t, pz = az + abz * t;
    return { t, px, pz, d2: (x - px) ** 2 + (z - pz) ** 2, segLen: Math.sqrt(len2) };
  };
  const next = (bi + 1) % count, prev = (bi - 1 + count) % count;
  const rNext = seg(bi, next), rPrev = seg(prev, bi);
  let s, px, pz, idx = bi;
  if (rNext.d2 <= rPrev.d2) {
    s = samples.s[bi] + rNext.t * rNext.segLen; px = rNext.px; pz = rNext.pz;
  } else {
    s = samples.s[prev] + rPrev.t * rPrev.segLen; px = rPrev.px; pz = rPrev.pz; idx = prev;
  }
  s = wrapS(s, length);
  const lat = (x - px) * samples.nx[bi] + (z - pz) * samples.nz[bi];
  return { idx: bi, s, lat, dist: Math.sqrt(Math.min(rNext.d2, rPrev.d2)) };
}
