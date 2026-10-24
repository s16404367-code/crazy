// Headless simulation smoke test (no rendering).
// Verifies: track length ≈3.5 km, a full 9-car AI race progresses without
// NaN/invalid states, cars complete laps, lap times are sane, race finishes.
// Run: npm run smoke
import { getTrack } from '../src/track/trackData.js';
import { Vehicle, resolveCarCollisions } from '../src/physics/vehicle.js';
import { AIDriver } from '../src/ai/aiDriver.js';
import { RaceManager } from '../src/race/raceManager.js';
import { AI_DRIVERS, CONFIG } from '../src/config/config.js';

const track = getTrack();
console.log(`Track length: ${track.length.toFixed(1)} m  samples=${track.count}  ds=${track.ds.toFixed(2)}m`);
console.log(`Aero zones: ${track.aeroZones.map(z => `${z.name} [${z.start.toFixed(0)}→${z.end.toFixed(0)}]`).join('  ')}`);
console.log(`Pit: lat=${track.pit.lat} entry=${track.pit.entryS.toFixed(0)} box=${track.pit.boxS.toFixed(0)} exit=${track.pit.exitS.toFixed(0)}`);
// min corner speed on the lap (hairpin check)
let minV = 1e9, minI = 0;
for (let i = 0; i < track.count; i++) if (track.samples.targetSpeed[i] < minV) { minV = track.samples.targetSpeed[i]; minI = i; }
console.log(`Slowest corner target: ${(minV * 3.6).toFixed(0)} km/h at s=${track.samples.s[minI].toFixed(0)}m`);

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

check(Math.abs(track.length - 3500) < 120, `lap length ≈3.5 km (got ${track.length.toFixed(0)} m)`);
check(minV < 24, `hairpin is genuinely slow (target ${(minV * 3.6).toFixed(0)} km/h < 86 km/h)`);
check(track.aeroZones.length === 2, 'two active-aero zones defined');
// ribbon winding sanity: indexed (a,c,b) the road's face normal must point UP
{
  const smp = track.samples, i = 100, j = 102;
  const pt = (k, lat) => [smp.x[k] + smp.nx[k] * lat, 0, smp.z[k] + smp.nz[k] * lat];
  const a = pt(i, -7), b = pt(i, 7), c = pt(j, -7);
  const u = [c[0] - a[0], 0, c[2] - a[2]], w = [b[0] - a[0], 0, b[2] - a[2]];
  const ny = u[2] * w[0] - u[0] * w[2]; // y of u × w for triangle (a,c,b)
  check(ny > 0, `road ribbon winding faces UP (normal y=${ny.toFixed(1)} > 0) — road visible, not grass`);
}
check(track.pit.boxes.length === 9 && track.inPitWallRange(track.pit.boxS), '9 individual pit boxes + divider wall range defined');

// ---- build a 9-car field, all AI-driven (player car is AI-driven here) ----
const profiles = [{ name: 'YOU', skill: 0.985, aggression: 0.6, tyre: 'soft' }, ...AI_DRIVERS];
const cars = [];
const drivers = [];
profiles.forEach((p, i) => {
  const v = new Vehicle(track, { name: p.name, isPlayer: i === 0, tyre: p.tyre });
  v.pitBoxIndex = i;
  v.pitBoxS = track.pit.boxes[i].s;
  cars.push(v);
  drivers.push(new AIDriver(v, p, track));
});
// grid: player P9 like the real game
const LAPS = 3;
const race = new RaceManager(track);
// place AI cars in slots 0..7, "player" test car in slot 8
const order = [1, 2, 3, 4, 5, 6, 7, 8, 0];
order.forEach((carIdx, slot) => cars[carIdx].resetToGrid(track.gridSlots[slot], profiles[carIdx].tyre));
race.setup(cars, LAPS);
// force two AI onto worn tyres so the pit system is genuinely exercised
cars[1].tyreWear = 22; cars[2].tyreWear = 27;
const gridDist = new Map(cars.map(c => [c, c.totalDist]));
race.beginCountdown();

const dt = 1 / CONFIG.physicsHz;
const ctx = { cars, totalRaceM: LAPS * track.length, yellowSector: -1, raceTime: 0 };
let simT = 0;
const MAX_T = 420; // seconds of simulated time budget
let nanSeen = false;
let gridHoldChecked = false, gridHoldOk = true;
let maxWallImpact = 0;

while (simT < MAX_T) {
  race.update(dt);
  ctx.yellowSector = race.yellowSector; ctx.raceTime = race.raceTime;
  const locked = race.state === 'countdown';
  // slipstream flags (simple version of the game's logic)
  for (const v of cars) {
    v.slipstream = false;
    for (const o of cars) {
      if (o === v) continue;
      const d = o.totalDist - v.totalDist;
      if (d > 4 && d < 28 && Math.abs(o.lat - v.lat) < 2 && Math.abs(v.u) > 25) v.slipstream = true;
    }
  }
  for (let i = 0; i < cars.length; i++) {
    const inp = drivers[i].update(dt, ctx);
    cars[i].step(dt, inp, { weatherGrip: 1, damageEnabled: true, locked });
    for (const e of cars[i].events) if (e.type === 'wall') maxWallImpact = Math.max(maxWallImpact, e.impact);
    cars[i].events.length = 0;
    if (!Number.isFinite(cars[i].x + cars[i].z + cars[i].totalDist)) nanSeen = true;
  }
  resolveCarCollisions(cars, true);
  simT += dt;
  if (!gridHoldChecked && race.state === 'racing') {
    gridHoldChecked = true;
    for (const c of cars) if (c.totalDist < gridDist.get(c) - 0.6) gridHoldOk = false;
  }
  if (race.state === 'finished') break;
}

check(!nanSeen, 'no NaN/invalid physics states during full race');
check(gridHoldChecked && gridHoldOk, 'countdown holds every car on its grid slot (no rolling backwards)');
const pittedCars = cars.filter(c => c.pitStops > 0);
check(pittedCars.length >= 1, `pit system exercised: ${pittedCars.length} car(s) completed a pit stop (${pittedCars.map(c => c.name).join(', ')})`);
check(race.state === 'finished', `race reached finish state (state=${race.state}, simT=${simT.toFixed(0)}s)`);
const res = race.results();
console.log(`\nClassification (${LAPS} laps, all AI):`);
for (const r of res) {
  console.log(`  P${r.pos} ${r.name.padEnd(11)} best=${r.bestLap ? r.bestLap.toFixed(2) + 's' : '  —   '} total=${r.totalTime.toFixed(1)}s${r.estimated ? ' (est)' : ''} wear=${r.car.tyreWear.toFixed(0)}% dmg=L${r.car.damageLevel} pits=${r.car.pitStops}`);
}
const finisher = res.find(r => r.bestLap);
check(!!finisher && finisher.bestLap > 55 && finisher.bestLap < 150, `sane lap time (best=${finisher ? finisher.bestLap.toFixed(1) : '?'}s, expect 55–150s)`);
const allProgressed = cars.every(c => c.totalDist > track.length * 0.9);
check(allProgressed, 'every car completed at least ~1 lap (none permanently stuck)');
check(race.fastestLap && race.fastestLap.time > 55, `fastest lap recorded (${race.fastestLap ? race.fastestLap.car.name + ' ' + race.fastestLap.time.toFixed(2) + 's' : 'none'})`);
console.log(`Max wall impact seen: ${maxWallImpact.toFixed(1)} m/s | player-test car finished P${res.findIndex(r => r.isPlayer) + 1}`);

console.log(failures === 0 ? '\nSMOKE TEST: ALL PASS' : `\nSMOKE TEST: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
