// DUSK APEX — bootstrap & menu wiring.
// One click from menu to gameplay (§26). All failures are surfaced honestly
// (loading-screen error box / toast) instead of a silent blank page.

import './styles.css';
import { Game } from './core/Game.js';
import { loadSettings, saveSettings } from './settings/settings.js';
import { CONFIG, TYRES } from './config/config.js';
import { formatTime, formatGap } from './race/raceManager.js';
import { CrazyGamesSDK } from './sdk/crazyGames.js';

const $ = (id) => document.getElementById(id);
const settings = loadSettings();

let toastTimer = 0;
function toast(msg, ms = 4500) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
}
window.addEventListener('error', (e) => {
  // non-blocking: a broken optional feature must not kill the race (§39)
  if (e && e.message) toast(`Something hiccuped (${String(e.message).slice(0, 90)}). The race continues — please report this if it repeats.`);
});

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

// ---------- populate UI from settings ----------
function syncSetupUI() {
  $('setup-laps').value = String(settings.laps);
  $('setup-tyre').value = settings.tyre;
  $('setup-weather').value = settings.weather;
  $('setup-damage').value = settings.damage;
}
function syncSettingsUI() {
  $('set-sensitivity').value = settings.steeringSensitivity;
  $('sens-val').textContent = Number(settings.steeringSensitivity).toFixed(2);
  $('set-quality').value = settings.quality;
  $('set-damage').value = settings.damage;
  $('set-master').value = settings.masterVolume;
  $('set-engine').value = settings.engineVolume;
  $('set-sfx').value = settings.sfxVolume;
  $('set-music').value = settings.musicVolume;
  $('set-tilt').checked = !!settings.tiltSteering;
}
function persist() { saveSettings(settings); }

let game = null;
let settingsReturn = 'menu'; // 'menu' | 'pause'
let resultsVisible = false;

function raceConfigFromUI() {
  return {
    laps: parseInt($('setup-laps').value, 10) || 3,
    tyre: $('setup-tyre').value,
    weather: $('setup-weather').value,
    damage: settings.damage === 'ON'
  };
}

function enterRaceUI() {
  hide('main-menu'); hide('results-panel'); hide('pause-menu'); hide('settings-panel'); hide('help-panel');
  resultsVisible = false;
  document.body.classList.add('in-race');
}
function showMainMenu() {
  hide('results-panel'); hide('pause-menu'); hide('settings-panel'); hide('help-panel');
  resultsVisible = false;
  document.body.classList.remove('in-race');
  show('main-menu');
}

async function boot() {
  CrazyGamesSDK.loadingStart();
  $('version-label').textContent = `v${CONFIG.version}`;
  syncSetupUI();
  syncSettingsUI();
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
    document.body.classList.add('touch');
  }

  game = new Game($('game-container'), settings, {
    onPauseChange(paused) {
      if (paused) show('pause-menu'); else hide('pause-menu');
    },
    onStateChange(state) {
      if (state === 'menu') showMainMenu();
    },
    onRaceFinished(results, fastest) {
      resultsVisible = true;
      document.body.classList.remove('in-race');
      const body = $('results-body');
      body.innerHTML = '';
      const playerResult = results.find((r) => r.isPlayer);
      $('results-title').textContent = playerResult
        ? `🏁 YOU FINISHED P${playerResult.pos} OF ${results.length}`
        : '🏁 RACE RESULTS';
      for (const r of results) {
        const tr = document.createElement('tr');
        if (r.isPlayer) tr.className = 'is-player';
        tr.innerHTML = `<td>P${r.pos}</td><td>${r.name}</td><td>${formatTime(r.bestLap)}</td>` +
          `<td>${r.pos === 1 ? formatTime(r.totalTime) : formatGap(r.gap) + (r.estimated ? ' *' : '')}</td>`;
        body.appendChild(tr);
      }
      $('results-fastest').textContent = fastest
        ? `★ Fastest lap: ${fastest.car.name} — ${formatTime(fastest.time)}${results.some((r) => r.estimated) ? '   (* estimated gap)' : ''}`
        : '';
      show('results-panel');
    }
  });

  try {
    await game.init((pct, label) => {
      $('load-bar-fill').style.width = `${pct}%`;
      $('load-pct').textContent = `${pct}%`;
      $('load-label').textContent = label;
    });
  } catch (err) {
    const box = $('load-error');
    box.textContent = 'The game could not start WebGL on this device/browser. Please try Chrome or Edge with hardware acceleration enabled. (' + (err && err.message ? err.message : 'unknown error') + ')';
    box.classList.remove('hidden');
    $('load-label').textContent = 'Failed to start';
    return;
  }

  game.applySettings();
  bindUI(game);
  hide('loading');
  showMainMenu();
  game.audio.startMusic(); // starts after first gesture if blocked — retried on click handlers
  CrazyGamesSDK.loadingStop();
}

function bindUI(game) {
  const audioKick = () => { game.audio.init(); game.audio.click(); if (game.state === 'menu') game.audio.startMusic(); };

  // menu setup changes persist immediately
  $('setup-laps').addEventListener('change', () => { settings.laps = parseInt($('setup-laps').value, 10) || 3; persist(); });
  $('setup-tyre').addEventListener('change', () => { settings.tyre = $('setup-tyre').value; persist(); });
  $('setup-weather').addEventListener('change', () => { settings.weather = $('setup-weather').value; persist(); });
  $('setup-damage').addEventListener('change', () => { settings.damage = $('setup-damage').value; syncSettingsUI(); persist(); });

  $('btn-play').addEventListener('click', () => {
    audioKick();
    enterRaceUI();
    game.startRace(raceConfigFromUI());
  });
  game.input.on('confirm', () => {
    if (!$('main-menu').classList.contains('hidden')) $('btn-play').click();
    else if (resultsVisible) $('btn-results-restart').click();
  });

  $('btn-settings').addEventListener('click', () => { audioKick(); settingsReturn = 'menu'; hide('main-menu'); syncSettingsUI(); show('settings-panel'); });
  $('btn-pause-settings').addEventListener('click', () => { audioKick(); settingsReturn = 'pause'; hide('pause-menu'); syncSettingsUI(); show('settings-panel'); });
  $('btn-settings-back').addEventListener('click', () => {
    audioKick();
    hide('settings-panel');
    if (settingsReturn === 'pause') show('pause-menu'); else showMainMenu();
  });
  $('btn-help').addEventListener('click', () => { audioKick(); hide('main-menu'); show('help-panel'); });
  $('btn-help-back').addEventListener('click', () => { audioKick(); hide('help-panel'); showMainMenu(); });

  $('btn-resume').addEventListener('click', () => { audioKick(); game.setPaused(false); });
  $('btn-restart').addEventListener('click', () => {
    audioKick();
    game.setPaused(false);
    enterRaceUI();
    game.restartRace();
  });
  $('btn-quit-menu').addEventListener('click', () => {
    audioKick();
    hide('pause-menu');
    game.quitToMenu();
  });

  $('btn-results-restart').addEventListener('click', () => {
    audioKick();
    enterRaceUI();
    game.restartRace();
  });
  $('btn-results-menu').addEventListener('click', () => {
    audioKick();
    hide('results-panel');
    resultsVisible = false;
    game.quitToMenu();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && resultsVisible) $('btn-results-restart').click();
  });

  // settings controls
  $('set-sensitivity').addEventListener('input', () => {
    settings.steeringSensitivity = parseFloat($('set-sensitivity').value);
    $('sens-val').textContent = settings.steeringSensitivity.toFixed(2);
    persist();
  });
  $('set-quality').addEventListener('change', () => {
    settings.quality = $('set-quality').value;
    persist(); game.applySettings();
    toast('Graphics quality applied (anti-aliasing & scenery density apply on next load).', 3200);
    $('toast').style.background = 'rgba(20,60,40,0.92)';
  });
  $('set-damage').addEventListener('change', () => {
    settings.damage = $('set-damage').value;
    syncSetupUI(); persist();
  });
  const vol = (id, key) => $(id).addEventListener('input', () => {
    settings[key] = parseFloat($(id).value);
    persist(); game.applySettings();
  });
  vol('set-master', 'masterVolume'); vol('set-engine', 'engineVolume');
  vol('set-sfx', 'sfxVolume'); vol('set-music', 'musicVolume');
  $('set-tilt').addEventListener('change', async () => {
    settings.tiltSteering = $('set-tilt').checked;
    persist();
    await game.input.setTiltEnabled(settings.tiltSteering);
    settings.tiltSteering = game.input.tiltEnabled;
    $('set-tilt').checked = settings.tiltSteering;
    persist();
  });

  // touch controls
  game.input.bindTouchButton($('tc-leftbtn'), 'left');
  game.input.bindTouchButton($('tc-rightbtn'), 'right');
  game.input.bindTouchButton($('tc-throttle'), 'throttle');
  game.input.bindTouchButton($('tc-brake'), 'brake');
  game.input.bindTouchAction($('tc-aero'), 'aeroToggle');
  game.input.bindTouchAction($('tc-camera'), 'camera');
  game.input.bindTouchAction($('tc-pit'), 'pitRequest');
  game.input.bindTouchAction($('tc-pause'), 'pause');

  window.addEventListener('beforeunload', persist);
}

boot();
