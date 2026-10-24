// DUSK APEX — central tuning configuration.
// All important gameplay/physics numbers live here (Master Prompt §14:
// no magic numbers scattered through the code).

export const CONFIG = {
  version: '0.11.0',
  title: 'DUSK APEX',

  // Fixed-timestep simulation (§13). Render rate is independent.
  physicsHz: 120,
  maxFrameTime: 0.1, // clamp: prevents spiral-of-death

  track: {
    targetLengthM: 3500, // ≈3.5 km (§18)
    roadHalfWidth: 7, // 14 m wide road
    kerbWidth: 1.6,
    runoffWidth: 6.5,
    barrierHalfWidth: 16.5, // default wall distance from centreline
    sampleSpacingM: 2 // centreline resample resolution
  },

  vehicle: {
    topSpeedMS: 91, // ≈328 km/h
    engineAccel: 13.1, // m/s² at low speed, tapers to top speed
    brakeDecel: 19.5,
    reverseMaxMS: 9,
    dragK: 0.0, // drag is modelled via the top-speed taper + aero multiplier
    aeroTopSpeedFactor: 1.065, // active-aero top-speed benefit (balanced, §15)
    aeroDownforceFactor: 0.82, // downforce trade-off while active
    slipstreamTopSpeedFactor: 1.035,
    slipstreamAccelBonus: 1.4, // m/s²
    baseLatGripRate: 7.6, // lateral velocity damping; softened at the limit for controllable slip
    offTrackGrip: 0.55,
    kerbGrip: 0.92,
    offTrackDrag: 2.2, // extra m/s² on grass/gravel
    maxSteerLowRad: 0.62, // ≈36° at parking speed — front wheels visibly turn
    maxSteerHighRad: 0.125, // ≈7° at top speed
    steerRatePlayer: 8.6, // normalized lock/sec before sensitivity
    steerRateAI: 9.2,
    steerReturnRate: 11.5,
    yawResponse: 11.5, // yaw-inertia rate (1/s): present, but not sluggish
    wheelBaseM: 3.0,
    collisionRadius: 1.18, // two circles per car
    collisionOffset: 1.55
  },

  gears: {
    // Top speed (m/s) of each gear — automatic gearbox, HUD + audio model.
    tops: [26, 38, 50, 62, 73, 82, 89, 97],
    rpmIdle: 4200,
    rpmMin: 5200,
    rpmMax: 13500
  },

  damage: {
    // impact-speed thresholds (m/s of closing/outward velocity) → level
    thresholds: [3.5, 7.5, 12],
    // level multipliers: [none, light, medium, heavy]
    gripFactor: [1, 0.97, 0.92, 0.84],
    topSpeedFactor: [1, 0.99, 0.95, 0.88],
    downforceFactor: [1, 0.96, 0.88, 0.72]
  },

  pit: {
    speedLimitMS: 22, // ≈80 km/h
    serviceTimeS: 3.0,
    latOffset: 15.4, // SERVICE/BOX lane centre (signed later once track side is known)
    fastLatOffset: 10.8, // through-traffic FAST lane centre
    laneDividerOffset: 13.1,
    innerLatOffset: 8.25,
    outerLatOffset: 18.8,
    playerBoxIndex: 4 // the player's own garage (highlighted orange)
  },

  ai: {
    thinkHz: 12, // decision rate; steering runs every physics step (§12)
    latAccelForCornerSpeed: 30 // m/s² used to derive corner target speeds
  },

  weather: {
    clear: { grip: 1, label: 'Clear (Day)' },
    overcast: { grip: 0.97, label: 'Overcast' },
    rain: { grip: 0.82, label: 'Light Rain' }
  },

  race: {
    defaultLaps: 3,
    lapOptions: [3, 5, 10],
    countdownLights: 5,
    playerGridSlot: 8 // P9 of 9 — fight through the field
  },

  sdk: {
    // CrazyGames SDK stays isolated (§30). The wrapper no-ops when the SDK
    // script is absent, so GitHub Pages testing never depends on it.
    crazyGamesEnabled: true // only activates if the SDK global exists
  }
};

// Tyre compounds (§16). Degradation is gradual; a worn tyre never makes the
// car impossible to drive (wear grip floor is enforced in vehicle physics).
export const TYRES = {
  soft: { id: 'soft', label: 'Soft', letter: 'S', color: '#e33f36', grip: 1.06, wearRate: 1.0 },
  medium: { id: 'medium', label: 'Medium', letter: 'M', color: '#f2c230', grip: 1.0, wearRate: 0.55 },
  hard: { id: 'hard', label: 'Hard', letter: 'H', color: '#e8e8e8', grip: 0.95, wearRate: 0.32 }
};
export const TYRE_ORDER = ['soft', 'medium', 'hard'];

// Wear: health 100 → 0. Base loss per second at race pace (scaled by slip).
export const TYRE_WEAR = {
  basePerSecond: 0.2, // soft lasts ~4 hard laps before the pit window; slip adds more
  slipPerSecond: 0.6, // extra when sliding / off-track
  gripFloorFactor: 0.8 // worn-out tyre still retains 80% of its grip factor
};

// Fictional drivers & liveries — 100% original, no real names/teams (§10).
export const PLAYER_PROFILE = { name: 'YOU', number: 27, color: 0xff7a1a, accent: 0xffffff };
export const AI_DRIVERS = [
  { name: 'K. VARGA', number: 3, color: 0x2050d8, accent: 0xffd23e, skill: 0.995, aggression: 0.75, tyre: 'soft' },
  { name: 'L. MORETTI', number: 5, color: 0xd8232f, accent: 0xffffff, skill: 0.988, aggression: 0.65, tyre: 'medium' },
  { name: 'S. KADE', number: 11, color: 0x10a8a0, accent: 0x10222e, skill: 0.982, aggression: 0.55, tyre: 'soft' },
  { name: 'R. ILVES', number: 16, color: 0x38b83e, accent: 0xffffff, skill: 0.976, aggression: 0.5, tyre: 'medium' },
  { name: 'T. OKAFOR', number: 21, color: 0xf2c230, accent: 0x1a1a22, skill: 0.97, aggression: 0.7, tyre: 'hard' },
  { name: 'D. MARSH', number: 34, color: 0x8a3fd1, accent: 0xffffff, skill: 0.963, aggression: 0.45, tyre: 'medium' },
  { name: 'Y. HARA', number: 48, color: 0xe8e8f2, accent: 0xd8232f, skill: 0.956, aggression: 0.6, tyre: 'soft' },
  { name: 'P. NOVAK', number: 55, color: 0x3e9bd8, accent: 0xffffff, skill: 0.948, aggression: 0.4, tyre: 'hard' }
];

export const QUALITY_PRESETS = {
  low: { label: 'Low (Chromebook)', pixelRatio: 1, shadows: false, shadowMap: 512, fogFar: 700, treeCount: 60, antialias: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: true, shadowMap: 1024, fogFar: 1100, treeCount: 140, antialias: true },
  high: { label: 'High', pixelRatio: 2, shadows: true, shadowMap: 2048, fogFar: 1600, treeCount: 240, antialias: true }
};

export function detectDefaultQuality() {
  try {
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const coarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (mem <= 4 || cores <= 4) return 'low';
    if (coarse) return 'low';
    return 'medium';
  } catch (e) {
    return 'low';
  }
}
