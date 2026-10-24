// DUSK APEX — settings (§27). Persisted locally; any storage failure
// silently falls back to in-memory defaults and NEVER crashes the game.

import { detectDefaultQuality } from '../config/config.js';

const KEY = 'duskApex.settings.v1';

export const DEFAULT_SETTINGS = {
  steeringSensitivity: 1.0, // 0.6..1.5
  quality: 'medium', // replaced by auto-detect on first load
  damage: 'ON', // ON | OFF
  masterVolume: 0.8,
  engineVolume: 0.9,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  tiltSteering: false,
  // race setup remembered between sessions
  laps: 3,
  tyre: 'medium',
  weather: 'clear'
};

export function loadSettings() {
  const s = { ...DEFAULT_SETTINGS, quality: detectDefaultQuality() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (parsed[k] !== undefined) s[k] = parsed[k];
      }
    }
  } catch (e) { /* storage unavailable → session defaults (§39) */ }
  return s;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) { /* continue with session settings */ }
}
