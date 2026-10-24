// DUSK APEX — CrazyGames SDK isolation layer (§30, §22 boundaries).
//
// The game NEVER depends on this to run. Every method no-ops safely when
// the CrazyGames SDK script is absent (GitHub Pages, local file, etc.).
// For a CrazyGames Full Launch build, include the official SDK script in
// index.html BEFORE the game bundle:
//   <script src="https://sdk.crazyGames.com/crazyGames-sdk-v3.js"></script>
// and this wrapper will start reporting loading/gameplay events.
// No external ads of any kind are implemented (§31) — ad hooks exist only
// as guarded no-ops until Full Launch integration is deliberately done.

import { CONFIG } from '../config/config.js';

function sdk() {
  try {
    if (!CONFIG.sdk.crazyGamesEnabled) return null;
    return (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) || null;
  } catch (e) { return null; }
}
function safe(fn) {
  try { const s = sdk(); if (s) fn(s); } catch (e) { /* SDK errors must not break the race */ }
}

export const CrazyGamesSDK = {
  available() { return !!sdk(); },
  async init() {
    const s = sdk();
    if (!s || typeof s.init !== 'function') return false;
    try { await s.init(); return true; } catch (e) { return false; }
  },
  loadingStart() { safe((s) => s.game && s.game.loadingStart && s.game.loadingStart()); },
  loadingStop() { safe((s) => s.game && s.game.loadingStop && s.game.loadingStop()); },
  gameplayStart() { safe((s) => s.game && s.game.gameplayStart && s.game.gameplayStart()); },
  gameplayStop() { safe((s) => s.game && s.game.gameplayStop && s.game.gameplayStop()); },
  happytime() { safe((s) => s.game && s.game.happytime && s.game.happytime()); },
  /** Register a mute handler if the platform asks us to mute. cb(muted:boolean) */
  onMuteChange() { /* wired during Full Launch integration; safe no-op for now */ }
};
