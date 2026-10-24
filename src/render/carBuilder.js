// DUSK APEX — original low-poly single-seater built from primitives.
// No external models (§10 originality). Car faces +Z (matches heading φ).
//
// v0.10 visual upgrade: wheels use canvas-drawn spoked rim faces + a bright
// marker so rotation is unmistakable; cockpit steering wheel turns; the
// driver's helmet looks into corners; the rear aero flap physically opens;
// wheels bounce on suspension; body roll/pitch is stronger. Textures keep
// this cheap for Chromebook-class hardware (one canvas per car).

import * as THREE from 'three';

const carbon = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.65, metalness: 0.35 });
const tyreSide = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.96, metalness: 0 });
let _tyreTreadMat = null;
function tyreTreadMaterial() {
  if (_tyreTreadMat) return _tyreTreadMat;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#101114'; x.fillRect(0, 0, 256, 64);
  x.strokeStyle = '#2c2f36'; x.lineWidth = 7;
  for (let i = -1; i < 9; i++) { // angled tread grooves: rolling reads from behind too
    x.beginPath(); x.moveTo(i * 32, 66); x.lineTo(i * 32 + 18, -2); x.stroke();
  }
  x.fillStyle = '#ffd23e'; x.fillRect(0, 25, 12, 14); // one bright tread block per revolution
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _tyreTreadMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.96, metalness: 0 });
  return _tyreTreadMat;
}
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.45, metalness: 0.65 });

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

/** Wheel face: tyre ring + spoked rim + yellow marker → spin is obvious. */
function wheelFaceTexture(accentHex) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const cx = 128, cy = 128;
  x.fillStyle = '#0b0b0d';
  x.beginPath(); x.arc(cx, cy, 128, 0, 7); x.fill();
  // sidewall ring
  x.strokeStyle = '#33363e'; x.lineWidth = 12;
  x.beginPath(); x.arc(cx, cy, 104, 0, 7); x.stroke();
  // rim
  x.fillStyle = '#454b57';
  x.beginPath(); x.arc(cx, cy, 82, 0, 7); x.fill();
  x.fillStyle = '#20242c';
  x.beginPath(); x.arc(cx, cy, 74, 0, 7); x.fill();
  // spokes
  x.fillStyle = '#cfd5df';
  for (let i = 0; i < 5; i++) {
    x.save();
    x.translate(cx, cy);
    x.rotate((i / 5) * Math.PI * 2);
    x.fillRect(-11, -74, 22, 68);
    x.restore();
  }
  // centre nut
  x.fillStyle = css(accentHex);
  x.beginPath(); x.arc(cx, cy, 17, 0, 7); x.fill();
  x.fillStyle = '#14161c';
  x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
  // bright rotation marker on the tyre (top)
  x.fillStyle = '#ffd23e';
  x.fillRect(cx - 16, 1, 32, 34);
  x.fillStyle = '#ffffff';
  x.fillRect(cx - 9, 226, 18, 24); // smaller opposite marker
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function numberTexture(num, accentHex) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 160);
  x.font = '900 108px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 16; x.strokeStyle = css(accentHex);
  x.strokeText(String(num), 128, 84);
  x.fillStyle = '#ffffff';
  x.fillText(String(num), 128, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

function makeWheel(radius, width, faceMat) {
  const steer = new THREE.Group();
  const camber = new THREE.Group(); // slight negative camber, set by side in buildCar
  const spin = new THREE.Group();
  steer.add(camber); camber.add(spin);
  // one cylinder, 3 material groups: tread | outer face | inner face
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 22),
    [tyreTreadMaterial(), faceMat, faceMat]
  );
  tyre.rotation.z = Math.PI / 2; // cylinder axis → X (axle)
  tyre.castShadow = true;
  spin.add(tyre);
  return { steer, camber, spin, radius, baseY: 0, x: 0, _spin: 0 };
}

export function buildCar(colorHex, accentHex, number = 7) {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.42, metalness: 0.35 });
  const paintDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex).multiplyScalar(0.55), roughness: 0.48, metalness: 0.35 });
  const faceMat = new THREE.MeshStandardMaterial({ map: wheelFaceTexture(accentHex), roughness: 0.55, metalness: 0.35 });

  // floor + monocoque + nose (nose toward +Z)
  box(1.9, 0.1, 4.7, carbon, 0, 0.14, -0.1, body);
  box(1.05, 0.55, 2.7, paint, 0, 0.48, -0.25, body);
  const nose = box(0.4, 0.28, 2.3, paint, 0, 0.44, 1.45, body);
  nose.rotation.x = 0.045;
  box(0.15, 0.05, 2.1, accent, 0, 0.6, 1.4, body, false); // nose stripe
  // sidepods + number decals
  box(0.55, 0.48, 1.9, paintDark, -0.68, 0.42, -0.55, body);
  box(0.55, 0.48, 1.9, paintDark, 0.68, 0.42, -0.55, body);
  box(0.5, 0.3, 0.08, carbon, -0.68, 0.46, 0.42, body, false); // pod inlets
  box(0.5, 0.3, 0.08, carbon, 0.68, 0.46, 0.42, body, false);
  const decalMat = new THREE.MeshStandardMaterial({
    map: numberTexture(number, accentHex), transparent: true, roughness: 0.45,
    polygonOffset: true, polygonOffsetFactor: -1
  });
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.66), decalMat);
    decal.position.set(side * 0.962, 0.44, -0.55);
    decal.rotation.y = side * Math.PI / 2;
    body.add(decal);
  }
  // engine cover + airbox + fin
  box(0.58, 0.55, 1.9, paint, 0, 0.72, -1.25, body);
  box(0.38, 0.3, 0.75, carbon, 0, 1.06, -0.72, body);
  box(0.05, 0.42, 1.25, accent, 0, 1.02, -1.5, body, false);
  // cockpit + driver + steering wheel
  box(0.72, 0.18, 1.15, carbon, 0, 0.8, 0.22, body, false);
  const helmet = new THREE.Group();
  helmet.position.set(0, 0.92, 0.02);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 11), accent);
  shell.castShadow = true;
  helmet.add(shell);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.06), carbon);
  visor.position.set(0, 0.03, 0.18);
  helmet.add(visor);
  body.add(helmet);
  const steerColumn = new THREE.Group();
  steerColumn.position.set(0, 0.88, 0.52);
  steerColumn.rotation.x = -0.5;
  const steerWheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 18), carbon);
  steerWheel.add(rim);
  const spokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.03), accent);
  steerWheel.add(spokeBar);
  steerColumn.add(steerWheel);
  body.add(steerColumn);
  // halo (stylised)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 18), carbon);
  halo.rotation.x = Math.PI / 2;
  halo.scale.set(1, 1.45, 1);
  halo.position.set(0, 1.02, 0.18);
  body.add(halo);
  const strut = box(0.06, 0.34, 0.06, carbon, 0, 0.88, 0.72, body, false);
  strut.rotation.x = 0.5;
  // mirrors + antenna
  box(0.16, 0.07, 0.05, accent, -0.55, 0.92, 0.55, body, false);
  box(0.16, 0.07, 0.05, accent, 0.55, 0.92, 0.55, body, false);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), darkMetal);
  ant.position.set(0.18, 1.15, -0.5);
  body.add(ant);

  // front wing (group so damage can tilt/drop it)
  const frontWing = new THREE.Group();
  frontWing.position.set(0, 0, 2.55);
  body.add(frontWing);
  box(2.0, 0.05, 0.55, carbon, 0, 0.1, 0, frontWing);
  box(1.9, 0.04, 0.3, paint, 0, 0.2, -0.14, frontWing);
  box(0.04, 0.24, 0.55, accent, -0.99, 0.16, 0, frontWing, false);
  box(0.04, 0.24, 0.55, accent, 0.99, 0.16, 0, frontWing, false);

  // rear wing with ANIMATED aero flap (opens when active aero is on)
  box(0.08, 0.55, 0.08, darkMetal, -0.14, 0.78, -2.45, body, false);
  box(0.08, 0.55, 0.08, darkMetal, 0.14, 0.78, -2.45, body, false);
  box(1.05, 0.05, 0.42, paint, 0, 1.04, -2.55, body);
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 1.16, -2.5);
  flapPivot.rotation.x = -0.15;
  const flap = box(1.0, 0.04, 0.32, accent, 0, 0.02, -0.14, flapPivot);
  flap.castShadow = true;
  body.add(flapPivot);
  box(0.04, 0.42, 0.55, paintDark, -0.54, 1.08, -2.57, body, false);
  box(0.04, 0.42, 0.55, paintDark, 0.54, 1.08, -2.57, body, false);
  const diffuser = box(1.3, 0.28, 0.5, carbon, 0, 0.24, -2.5, body);
  diffuser.rotation.x = 0.35;
  // rain/brake light
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 0.4 });
  box(0.18, 0.1, 0.04, brakeMat, 0, 0.62, -2.72, body, false);

  // wheels
  const wheels = {};
  const positions = {
    fl: [-0.95, 0.36, 1.55], fr: [0.95, 0.36, 1.55],
    rl: [-0.97, 0.38, -1.55], rr: [0.97, 0.38, -1.55]
  };
  for (const [key, [x, y, z]] of Object.entries(positions)) {
    const isFront = key[0] === 'f';
    const w = makeWheel(isFront ? 0.36 : 0.38, isFront ? 0.4 : 0.45, faceMat);
    w.steer.position.set(x, y, z);
    w.baseY = y; w.x = x;
    w.camber.rotation.z = Math.sign(x) * 0.045;
    car.add(w.steer);
    wheels[key] = w;
    const arm = box(Math.abs(x) - 0.2, 0.05, 0.05, darkMetal, x / 2, y + 0.05, z, car, false);
    arm.position.x = x * 0.55;
  }

  car.userData = {
    body, wheels, frontWing, brakeMat, helmet, steerWheel, flapPivot,
    spinAngle: 0, rollSmooth: 0, pitchSmooth: 0,
    _phase: Math.random() * 6, _helmetYaw: 0, _flap: -0.15, _lastU: 0
  };
  return car;
}

const clampN = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Wheels, steering, driver, aero flap, suspension, body lean, damage. */
export function updateCarVisual(carGroup, vehicle, dt) {
  const ud = carGroup.userData;
  const speed = Math.abs(vehicle.u);

  // Wheel spin (with left/right speed difference in a turn) + REAL front
  // steering. vehicle.wheelAngle is the physical road-wheel angle; the
  // v0.10 physics bug that zeroed it every step is fixed in vehicle.js.
  for (const w of Object.values(ud.wheels)) {
    const wheelSpeed = vehicle.u - vehicle.yawRate * w.x;
    w._spin += (wheelSpeed / w.radius) * dt;
    w.spin.rotation.x = w._spin;
  }
  ud.spinAngle = ud.wheels.fl._spin;
  const steerVis = vehicle.wheelAngle || 0;
  const ackermann = (angle, x) => {
    if (Math.abs(angle) < 0.001) return 0;
    const wheelBase = 3.1, halfTrack = 0.95;
    const radius = wheelBase / Math.tan(Math.abs(angle));
    const inner = Math.sign(angle) === Math.sign(x); // +x is the driver's left here
    const wheelRadius = Math.max(radius + (inner ? -halfTrack : halfTrack), wheelBase * 0.55);
    return Math.sign(angle) * Math.atan(wheelBase / wheelRadius);
  };
  ud.wheels.fl.steer.rotation.y = ackermann(steerVis, ud.wheels.fl.x);
  ud.wheels.fr.steer.rotation.y = ackermann(steerVis, ud.wheels.fr.x);

  // suspension: wheels bounce over kerbs/grass, gentle tremor at speed
  ud._phase += dt * (4 + speed * 0.55);
  const amp = vehicle.onKerb && speed > 6 ? 0.03
    : vehicle.offTrack && speed > 4 ? 0.045
    : Math.min(speed / 90, 1) * 0.006;
  const offs = [0, 1.7, 3.4, 5.1];
  Object.values(ud.wheels).forEach((w, i) => {
    w.steer.position.y = w.baseY + Math.sin(ud._phase * 2.2 + offs[i]) * amp;
  });

  // cockpit steering wheel turns with driver input (~3.5× road-wheel angle)
  ud.steerWheel.rotation.z = -vehicle.steer * 2.7; // driver input ≈ ±155° at full lock

  // driver looks into the corner + subtle helmet bob
  const targetYaw = clampN(vehicle.steer * 0.42 + vehicle.yawRate * 0.1, -0.55, 0.55);
  ud._helmetYaw += (targetYaw - ud._helmetYaw) * Math.min(dt * 7, 1);
  ud.helmet.rotation.y = ud._helmetYaw;
  ud.helmet.position.y = 0.92 + Math.sin(ud._phase * 2.2) * amp * 0.7;

  // aero flap physically opens when active aero is engaged
  const flapTarget = vehicle.aeroActive ? -0.62 : -0.15;
  ud._flap += (flapTarget - ud._flap) * Math.min(dt * 9, 1);
  ud.flapPivot.rotation.x = ud._flap;

  // body roll/pitch (weight transfer, stronger than v0.9)
  const latAcc = vehicle.yawRate * vehicle.u;
  const targetRoll = clampN(latAcc * 0.0028, -0.075, 0.075);
  const accel = vehicle.longitudinalAccel ?? ((vehicle.u - (ud._lastU ?? vehicle.u)) / Math.max(dt, 1e-4));
  ud._lastU = vehicle.u;
  const targetPitch = clampN(-accel * 0.0021, -0.05, 0.062);
  ud.rollSmooth += (targetRoll - ud.rollSmooth) * Math.min(dt * 8, 1);
  ud.pitchSmooth += (targetPitch - ud.pitchSmooth) * Math.min(dt * 8, 1);
  const shake = vehicle.onKerb && speed > 8 ? Math.sin(ud._phase * 9) * 0.012 : 0;
  ud.body.rotation.z = ud.rollSmooth + shake;
  ud.body.rotation.x = ud.pitchSmooth;
  ud.body.position.y = Math.sin(ud._phase * 2.2 + 0.8) * amp * 0.55;

  // damage: front wing droops/tilts
  const d = vehicle.damageLevel;
  ud.frontWing.rotation.z = d >= 3 ? 0.15 : d === 2 ? 0.06 : 0;
  ud.frontWing.rotation.x = d >= 3 ? 0.14 : d === 2 ? 0.05 : 0;
  ud.frontWing.position.y = d >= 2 ? -0.04 : 0;

  // brake light + flashing while aero is open (like a rain light warning)
  ud.brakeMat.emissiveIntensity = vehicle.braking ? 2.4
    : vehicle.aeroActive ? (Math.sin(ud._phase * 14) > 0 ? 2.0 : 0.4) : 0.4;
}
