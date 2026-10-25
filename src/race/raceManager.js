// DUSK APEX — race control (§20, §21): countdown lights, laps, 3 sectors,
// live positions/gaps, fastest lap, yellow flag, finish + classification.
// A race can always reach a finish: timing is driven by unwrapped race
// distance, so spins/crashes/off-track excursions cannot soft-lock it.

import { CONFIG } from '../config/config.js';

export class RaceManager {
  constructor(track) {
    this.track = track;
    this.state = 'idle'; // idle | countdown | racing | finished
    this.cars = []; // vehicles
    this.totalLaps = CONFIG.race.defaultLaps;
    this.totalRaceM = 0;
    this.raceTime = 0;
    this.countdownT = 0;
    this.lightsOn = 0;
    this._goAt = Infinity;
    this.stats = new Map();
    this.standings = [];
    this.fastestLap = null; // {car, time}
    this.yellowSector = -1; // first yellow sector (legacy consumers)
    this.yellowSectors = []; // all sectors with a stopped/stricken car
    this.events = []; // consumed by Game for messages/audio
    this.playerFinishedAt = -1;
  }

  setup(cars, totalLaps) {
    this.cars = cars;
    this.totalLaps = totalLaps;
    this.totalRaceM = totalLaps * this.track.length;
    this.raceTime = 0;
    this.fastestLap = null;
    this.yellowSector = -1;
    this.yellowSectors = [];
    this.playerFinishedAt = -1;
    this.events.length = 0;
    this.stats.clear();
    for (const car of cars) {
      this.stats.set(car, {
        lap: 1, sector: 0,
        timingLive: false, // becomes true at first start-line crossing
        lapStartT: 0, sectorStartT: 0,
        currentSectors: [null, null, null],
        lastSectors: [null, null, null],
        lastLap: null, bestLap: null,
        nextLapLine: this.track.length, // raceDist of next lap completion
        nextSectorLine: this.track.sectorLength,
        finished: false, finishTime: null,
        prevDist: car.totalDist
      });
    }
    this._updateStandings();
  }

  beginCountdown() {
    this.state = 'countdown';
    this.countdownT = 0;
    this.lightsOn = 0;
    this._goAt = 0.55 * CONFIG.race.countdownLights + 0.45 + Math.random() * 0.55;
  }

  /** sector index 0..2 for a race distance */
  sectorOf(dist) {
    const L = this.track.length;
    const lapDist = ((dist % L) + L) % L;
    return Math.min(2, Math.floor(lapDist / this.track.sectorLength));
  }

  lapOf(dist) {
    return Math.max(1, Math.floor(Math.max(dist, 0) / this.track.length) + 1);
  }

  stat(car) { return this.stats.get(car); }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownT += dt;
      const n = CONFIG.race.countdownLights;
      this.lightsOn = Math.min(n, Math.floor(this.countdownT / 0.55));
      if (this.countdownT >= this._goAt) {
        this.state = 'racing';
        this.raceTime = 0;
        this.lightsOn = 0;
        this.events.push({ type: 'go' });
        for (const st of this.stats.values()) { st.lapStartT = 0; st.sectorStartT = 0; }
      }
      return;
    }
    if (this.state !== 'racing' && this.state !== 'finished') return;

    this.raceTime += dt;
    const L = this.track.length;
    const secLen = this.track.sectorLength;

    for (const car of this.cars) {
      const st = this.stats.get(car);
      const dist = car.totalDist;
      st.lap = Math.min(this.lapOf(dist), this.totalLaps);
      st.sector = this.sectorOf(dist);

      // first crossing of the start line arms lap timing
      if (!st.timingLive && st.prevDist < 0 && dist >= 0) {
        st.timingLive = true;
        st.lapStartT = this.raceTime;
        st.sectorStartT = this.raceTime;
      }

      // sector boundaries (at L/3, 2L/3, then the lap line)
      while (st.timingLive && dist >= st.nextSectorLine && !st.finished) {
        const idx = st.sector === 0 ? 2 : st.sector - 1; // sector just completed
        // (sector property already advanced; the completed one is previous)
        const completed = (Math.round(st.nextSectorLine / secLen) - 1) % 3;
        const t = this.raceTime - st.sectorStartT;
        st.currentSectors[completed] = t;
        st.sectorStartT = this.raceTime;
        st.nextSectorLine += secLen;
        if (car.isPlayer) {
          this.events.push({ type: 'sector', car, sector: completed, time: t });
        }
        void idx;
      }

      // lap completion
      while (st.timingLive && dist >= st.nextLapLine && !st.finished) {
        const lapTime = this.raceTime - st.lapStartT;
        st.lapStartT = this.raceTime;
        st.lastLap = lapTime;
        st.lastSectors = st.currentSectors.slice();
        st.currentSectors = [null, null, null];
        const completedLap = Math.round(st.nextLapLine / L);
        st.nextLapLine += L;
        if (lapTime > 20) { // ignore any timing artefact
          if (!st.bestLap || lapTime < st.bestLap) st.bestLap = lapTime;
          if (!this.fastestLap || lapTime < this.fastestLap.time) {
            this.fastestLap = { car, time: lapTime };
            this.events.push({ type: 'fastest', car, time: lapTime });
          }
        }
        this.events.push({ type: 'lap', car, lap: completedLap, time: lapTime });
        if (completedLap >= this.totalLaps) {
          st.finished = true;
          st.finishTime = this.raceTime;
          this.events.push({ type: 'finish', car });
          if (car.isPlayer) {
            this.state = 'finished';
            this.playerFinishedAt = this.raceTime;
          }
        }
      }
      st.prevDist = dist;
    }

    this._updateStandings();
    this._updateYellowFlag();
  }

  _updateStandings() {
    const arr = this.cars.slice();
    arr.sort((a, b) => {
      const sa = this.stats.get(a), sb = this.stats.get(b);
      if (sa.finished && sb.finished) return sa.finishTime - sb.finishTime;
      if (sa.finished) return -1;
      if (sb.finished) return 1;
      return b.totalDist - a.totalDist;
    });
    this.standings = arr;
  }

  _updateYellowFlag() {
    const sectors = new Set();
    if (this.state === 'racing' && this.raceTime > 6) {
      for (const car of this.cars) {
        const st = this.stats.get(car);
        if (!st || st.finished || car.pitState !== 'none') continue;
        // A car stopped on the racing surface OR stranded just off it both
        // justify waved yellows. Pit-lane stops are handled by pit crews.
        if (Math.abs(car.u) < 2.2 && car.stoppedTimer > 1.2) {
          sectors.add(this.sectorOf(car.totalDist));
        }
      }
    }
    const next = [...sectors].sort((a, b) => a - b);
    for (const sector of next) {
      if (!this.yellowSectors.includes(sector)) this.events.push({ type: 'yellow', sector });
    }
    for (const sector of this.yellowSectors) {
      if (!next.includes(sector)) this.events.push({ type: 'green', sector });
    }
    this.yellowSectors = next;
    this.yellowSector = next.length ? next[0] : -1;
  }

  positionOf(car) {
    return this.standings.indexOf(car) + 1;
  }

  /** time gap (s) from `car` to the car ahead; negative dist based estimate */
  gapAhead(car) {
    const i = this.standings.indexOf(car);
    if (i <= 0) return null;
    const ahead = this.standings[i - 1];
    const sa = this.stats.get(ahead), sc = this.stats.get(car);
    if (sa.finished && sc.finished) return sc.finishTime - sa.finishTime;
    const distGap = ahead.totalDist - car.totalDist;
    const refSpeed = Math.max((Math.abs(car.u) + Math.abs(ahead.u)) / 2, 14);
    return distGap / refSpeed;
  }
  gapBehind(car) {
    const i = this.standings.indexOf(car);
    if (i < 0 || i >= this.standings.length - 1) return null;
    const behind = this.standings[i + 1];
    const distGap = car.totalDist - behind.totalDist;
    const refSpeed = Math.max((Math.abs(car.u) + Math.abs(behind.u)) / 2, 14);
    return distGap / refSpeed;
  }

  /** Final classification; unfinished cars get an estimated total time. */
  results() {
    return this.standings.map((car, i) => {
      const st = this.stats.get(car);
      let total = st.finishTime;
      let estimated = false;
      if (total == null) {
        const remaining = Math.max(this.totalRaceM - car.totalDist, 0);
        total = this.raceTime + remaining / Math.max(Math.abs(car.u), 16);
        estimated = true;
      }
      return {
        pos: i + 1, car, name: car.name, isPlayer: car.isPlayer,
        bestLap: st.bestLap, totalTime: total, estimated,
        gap: i === 0 ? 0 : null // filled below
      };
    }).map((r, i, arr) => {
      if (i > 0) r.gap = r.totalTime - arr[0].totalTime;
      return r;
    });
  }
}

export function formatTime(t) {
  if (t == null || !Number.isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
export function formatGap(t) {
  if (t == null || !Number.isFinite(t)) return '—';
  return `+${t.toFixed(1)}s`;
}
