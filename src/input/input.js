// DUSK APEX — input (§25): keyboard primary, touch secondary, gamepad and
// optional tilt where practical. Steering convention: +1 = left, -1 = right
// (matches the vehicle model). No custom fullscreen button exists anywhere.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, throttle: false, brake: false };
    this.tiltSteer = 0;
    this.tiltEnabled = false;
    this._handlers = {};
    this._onKeyDown = (e) => this._keyDown(e);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onOrient = (e) => {
      if (!this.tiltEnabled || e.gamma == null) return;
      // landscape phones: gamma tilts left/right; clamp to a sane range
      this.tiltSteer = clamp(e.gamma / 26, -1, 1) * -1; // tilt right → steer right (-)
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  on(action, cb) {
    (this._handlers[action] = this._handlers[action] || []).push(cb);
  }
  _emit(action) {
    const list = this._handlers[action];
    if (list) for (const cb of list) { try { cb(); } catch (e) { /* noop */ } }
  }

  _keyDown(e) {
    const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
    if (gameKeys.includes(e.code)) e.preventDefault();
    if (e.repeat) { this.keys.add(e.code); return; }
    this.keys.add(e.code);
    switch (e.code) {
      case 'Space': this._emit('aeroToggle'); break;
      case 'KeyC': this._emit('camera'); break;
      case 'Escape': this._emit('pause'); break;
      case 'KeyR': this._emit('reset'); break;
      case 'KeyP': this._emit('pitRequest'); break;
      case 'KeyT': this._emit('cycleTyre'); break;
      case 'Enter': this._emit('confirm'); break;
    }
  }

  bindTouchButton(el, prop) {
    if (!el) return;
    const on = (e) => { e.preventDefault(); this.touch[prop] = true; el.classList.add('active'); };
    const off = (e) => { if (e) e.preventDefault(); this.touch[prop] = false; el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindTouchAction(el, action) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); this._emit(action); });
  }

  async setTiltEnabled(enabled) {
    this.tiltEnabled = enabled;
    if (enabled) {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          await DeviceOrientationEvent.requestPermission();
        }
        window.addEventListener('deviceorientation', this._onOrient);
      } catch (e) { this.tiltEnabled = false; }
    } else {
      window.removeEventListener('deviceorientation', this._onOrient);
      this.tiltSteer = 0;
    }
    return this.tiltEnabled;
  }

  /** @param sensitivity steering multiplier from settings */
  getState(sensitivity = 1) {
    const k = this.keys;
    let steer = 0;
    if (k.has('KeyA') || k.has('ArrowLeft') || this.touch.left) steer += 1;
    if (k.has('KeyD') || k.has('ArrowRight') || this.touch.right) steer -= 1;
    let throttle = (k.has('KeyW') || k.has('ArrowUp') || this.touch.throttle) ? 1 : 0;
    let brake = (k.has('KeyS') || k.has('ArrowDown') || this.touch.brake) ? 1 : 0;

    // gamepad (standard mapping): axis0 steer, RT(7) throttle, LT(6) brake
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp) continue;
        const ax = gp.axes[0] || 0;
        if (Math.abs(ax) > 0.12) steer -= ax;
        if (gp.buttons[7]) throttle = Math.max(throttle, gp.buttons[7].value);
        if (gp.buttons[6]) brake = Math.max(brake, gp.buttons[6].value);
        break;
      }
    } catch (e) { /* gamepad optional */ }

    if (this.tiltEnabled) steer += this.tiltSteer;

    return {
      steer: clamp(steer * sensitivity, -1, 1),
      throttle: clamp(throttle, 0, 1),
      brake: clamp(brake, 0, 1)
    };
  }
}
