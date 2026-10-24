// DUSK APEX — racing HUD + minimap (§23, §24).
// Minimap geometry comes from the same centreline samples as the 3D track.
// Text updates are throttled; RPM/speed stay smooth. Player is marked with a
// ring + larger dot (never colour alone, §34).

import { formatTime, formatGap } from '../race/raceManager.js';
import { TYRES } from '../config/config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(track) {
    this.track = track;
    this.el = {
      root: $('hud'),
      pos: $('hud-pos'), lap: $('hud-lap'), sector: $('hud-sector'),
      curLap: $('hud-curlap'), bestLap: $('hud-bestlap'), lastLap: $('hud-lastlap'),
      gapAhead: $('hud-gap-ahead'), gapBehind: $('hud-gap-behind'),
      speed: $('hud-speed'), gear: $('hud-gear'), rpmFill: $('rpm-fill'),
      shift: $('shift-light'),
      tyreBadge: $('hud-tyre'), tyreWear: $('tyre-wear-fill'), tyreAge: $('hud-tyre-age'),
      nextTyre: $('hud-next-tyre'),
      aero: $('hud-aero'),
      damageWrap: $('hud-damage-wrap'), damageFill: $('damage-fill'), damageLabel: $('hud-damage-label'),
      message: $('hud-message'), flag: $('hud-flag'), warn: $('hud-warn'),
      pit: $('hud-pit'), tower: $('hud-tower'),
      lights: $('lights'), sectorFlash: $('hud-sector-flash'),
      raceClock: $('hud-clock')
    };
    this._textT = 0; this._mapT = 0; this._towerT = 0;
    this._msgQueue = []; this._msgT = 0; this._msgActive = null;
    this._sectorFlashT = 0;

    // timing tower rows
    this._towerRows = [];
    if (this.el.tower) {
      for (let i = 0; i < 9; i++) {
        const row = document.createElement('div');
        row.className = 'tower-row';
        row.innerHTML = '<span class="tw-pos"></span><span class="tw-name"></span><span class="tw-gap"></span>';
        this.el.tower.appendChild(row);
        this._towerRows.push(row);
      }
    }

    // minimap static geometry
    this.map = $('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    if (this.mapCtx) {
      const W = this.map.width, H = this.map.height, pad = 14;
      const b = track.bounds;
      const sx = (W - pad * 2) / (b.maxX - b.minX);
      const sz = (H - pad * 2) / (b.maxZ - b.minZ);
      const sc = Math.min(sx, sz);
      const ox = (W - (b.maxX - b.minX) * sc) / 2;
      const oz = (H - (b.maxZ - b.minZ) * sc) / 2;
      this._mapPt = (x, z) => [ox + (x - b.minX) * sc, oz + (z - b.minZ) * sc];
      this._trackPts = [];
      for (let i = 0; i < track.count; i += 6) {
        this._trackPts.push(this._mapPt(track.samples.x[i], track.samples.z[i]));
      }
    }
    this._lightEls = this.el.lights ? Array.from(this.el.lights.querySelectorAll('.light')) : [];
  }

  show() { if (this.el.root) this.el.root.classList.remove('hidden'); }
  hide() { if (this.el.root) this.el.root.classList.add('hidden'); }

  showMessage(text, ms = 2600) {
    this._msgQueue.push({ text, ms });
    if (!this._msgActive) this._nextMessage();
  }
  _nextMessage() {
    this._msgActive = this._msgQueue.shift() || null;
    this._msgT = 0;
    if (this.el.message) {
      if (this._msgActive) {
        this.el.message.textContent = this._msgActive.text;
        this.el.message.classList.remove('hidden');
      } else {
        this.el.message.classList.add('hidden');
      }
    }
  }

  sectorFlash(sectorIdx, time) {
    if (!this.el.sectorFlash) return;
    this.el.sectorFlash.textContent = `SECTOR ${sectorIdx + 1}  ${formatTime(time)}`;
    this.el.sectorFlash.classList.remove('hidden');
    this._sectorFlashT = 3.2;
  }

  setLights(n) {
    if (!this.el.lights) return;
    this.el.lights.classList.remove('hidden');
    this._lightEls.forEach((el, i) => el.classList.toggle('on', i < n));
  }
  hideLights() { if (this.el.lights) this.el.lights.classList.add('hidden'); }

  update(dt, d) {
    const v = d.vehicle, race = d.race, st = d.stat;

    // message queue
    if (this._msgActive) {
      this._msgT += dt * 1000;
      if (this._msgT >= this._msgActive.ms) this._nextMessage();
    }
    if (this._sectorFlashT > 0) {
      this._sectorFlashT -= dt;
      if (this._sectorFlashT <= 0 && this.el.sectorFlash) this.el.sectorFlash.classList.add('hidden');
    }

    // smooth items every frame
    if (this.el.speed) this.el.speed.textContent = Math.round(v.speedKmh);
    if (this.el.gear) this.el.gear.textContent = v.gear === 0 ? 'R' : String(v.gear);
    if (this.el.rpmFill) {
      const rpm01 = Math.max(0, Math.min(1, (v.rpm - 4200) / (13500 - 4200)));
      this.el.rpmFill.style.width = `${Math.round(rpm01 * 100)}%`;
      this.el.rpmFill.classList.toggle('hot', rpm01 > 0.86);
      if (this.el.shift) this.el.shift.classList.toggle('on', rpm01 > 0.9);
    }

    this._textT -= dt;
    if (this._textT <= 0) {
      this._textT = 0.1;
      const set = (el, txt) => { if (el && el.textContent !== txt) el.textContent = txt; };
      set(this.el.pos, `P${d.position}`);
      set(this.el.lap, `LAP ${st ? st.lap : 1}/${race.totalLaps}`);
      set(this.el.sector, `SECTOR ${st ? st.sector + 1 : 1}`);
      set(this.el.raceClock, formatTime(race.raceTime));
      set(this.el.curLap, formatTime(d.currentLapTime));
      set(this.el.bestLap, formatTime(st ? st.bestLap : null));
      set(this.el.lastLap, formatTime(st ? st.lastLap : null));
      set(this.el.gapAhead, d.gapAhead == null ? '—' : formatGap(d.gapAhead));
      set(this.el.gapBehind, d.gapBehind == null ? '—' : formatGap(d.gapBehind));

      const tyre = TYRES[v.compound];
      if (this.el.tyreBadge) {
        this.el.tyreBadge.textContent = tyre.letter;
        this.el.tyreBadge.style.background = tyre.color;
        this.el.tyreBadge.style.color = v.compound === 'medium' ? '#1a1a22' : '#fff';
      }
      if (this.el.tyreWear) this.el.tyreWear.style.width = `${Math.round(v.tyreWear)}%`;
      set(this.el.tyreAge, `${v.tyreAgeLaps.toFixed(1)} laps`);
      if (this.el.nextTyre) {
        const nt = TYRES[v.nextCompound];
        set(this.el.nextTyre, `NEXT: ${nt.label} [T]`);
      }

      if (this.el.aero) {
        const state = v.aeroActive ? 'AERO OPEN' : v.aeroAvailable ? 'AERO AVAILABLE' : 'AERO CLOSED';
        set(this.el.aero, state);
        this.el.aero.classList.toggle('active', v.aeroActive);
        this.el.aero.classList.toggle('available', !v.aeroActive && v.aeroAvailable);
      }

      if (this.el.damageWrap) {
        this.el.damageWrap.classList.toggle('hidden', !d.damageEnabled);
        if (d.damageEnabled && this.el.damageFill) {
          const pct = [0, 30, 62, 100][v.damageLevel];
          this.el.damageFill.style.width = `${pct}%`;
          set(this.el.damageLabel, ['DAMAGE: NONE', 'DAMAGE: LIGHT', 'DAMAGE: MEDIUM', 'DAMAGE: HEAVY — PIT TO REPAIR'][v.damageLevel]);
        }
      }

      if (this.el.flag) {
        const yellowSectors = race.yellowSectors || (race.yellowSector >= 0 ? [race.yellowSector] : []);
        if (yellowSectors.length) {
          this.el.flag.textContent = `🟨 YELLOW FLAG — SECTOR ${yellowSectors.map((x) => x + 1).join(' + ')}`;
          this.el.flag.classList.remove('hidden');
        } else this.el.flag.classList.add('hidden');
      }
      if (this.el.warn) {
        const warn = v.wrongWay ? '⚠ WRONG WAY' : v.stuckTimer > 2 ? 'PRESS R TO RESET CAR' : '';
        set(this.el.warn, warn);
        this.el.warn.classList.toggle('hidden', !warn);
      }
      if (this.el.pit) {
        const txt = d.pitGuidance || '';
        set(this.el.pit, txt);
        this.el.pit.classList.toggle('hidden', !txt);
      }
    }

    this._towerT -= dt;
    if (this._towerT <= 0 && this._towerRows.length) {
      this._towerT = 0.4;
      const leader = d.standings[0];
      d.standings.forEach((car, i) => {
        const row = this._towerRows[i];
        if (!row) return;
        const cStat = race.stat(car);
        row.classList.toggle('is-player', car.isPlayer);
        row.children[0].textContent = String(i + 1);
        row.children[1].textContent = car.name;
        let gapTxt = '—';
        if (i === 0) gapTxt = cStat && cStat.finished ? 'FINISH' : 'LEADER';
        else if (cStat && cStat.finished && leader && race.stat(leader).finished) {
          gapTxt = formatGap(cStat.finishTime - race.stat(leader).finishTime);
        } else if (leader) {
          const distGap = leader.totalDist - car.totalDist;
          gapTxt = distGap > race.track.length ? `+${Math.floor(distGap / race.track.length)} LAP`
            : formatGap(distGap / Math.max(Math.abs(car.u), 14));
        }
        if (car.pitState === 'servicing') gapTxt = 'IN PIT';
        row.children[2].textContent = gapTxt;
      });
    }

    this._mapT -= dt;
    if (this._mapT <= 0 && this.mapCtx) {
      this._mapT = 0.066;
      this._drawMinimap(d.standings, v);
    }
  }

  _drawMinimap(standings, player) {
    const ctx = this.mapCtx, W = this.map.width, H = this.map.height;
    ctx.clearRect(0, 0, W, H);
    // track ribbon
    ctx.beginPath();
    this._trackPts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(220,225,235,0.25)';
    ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(235,240,250,0.85)';
    ctx.lineWidth = 2.4; ctx.stroke();
    // start tick
    const [sx, sy] = this._mapPt(this.track.samples.x[0], this.track.samples.z[0]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 3, sy - 1.5, 6, 3);
    // cars
    for (const car of standings) {
      const [x, y] = this._mapPt(car.x, car.z);
      if (car.isPlayer) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = car.colorCss || '#9ab';
      ctx.fill();
    }
    // player: orange dot, white ring, heading tick (shape + colour)
    const [px, py] = this._mapPt(player.x, player.z);
    ctx.beginPath(); ctx.arc(px, py, 5.4, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff7a1a'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(player.heading) * 9, py + Math.cos(player.heading) * 9);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
  }
}
