// DUSK APEX — original low-poly single-seater built from primitives.
// No external models (§10 originality). Car faces +Z (matches heading φ).
// ~35 small meshes per car; 9 cars stay well inside the draw-call budget
// on Low because geometry/materials are shared where possible.

import * as THREE from 'three';

const carbon = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.75, metalness: 0.25 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.96, metalness: 0 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.5, metalness: 0.6 });

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

function makeWheel(radius, width, accentMat) {
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  steer.add(spin);
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tyreMat);
  tyre.rotation.z = Math.PI / 2; // cylinder axis → X (axle)
  tyre.castShadow = true;
  spin.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width + 0.03, 10), accentMat);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);
  return { steer, spin, radius };
}

export function buildCar(colorHex, accentHex) {
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.42, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.5, metalness: 0.3 });
  const paintDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex).multiplyScalar(0.55), roughness: 0.55, metalness: 0.3 });

  // floor + monocoque + nose (nose toward +Z)
  box(1.9, 0.1, 4.7, carbon, 0, 0.14, -0.1, body);
  box(1.05, 0.55, 2.7, paint, 0, 0.48, -0.25, body);
  const nose = box(0.4, 0.28, 2.3, paint, 0, 0.44, 1.45, body);
  nose.rotation.x = 0.045;
  box(0.15, 0.05, 2.1, accent, 0, 0.6, 1.4, body, false); // nose stripe
  // sidepods
  box(0.55, 0.48, 1.9, paintDark, -0.68, 0.42, -0.55, body);
  box(0.55, 0.48, 1.9, paintDark, 0.68, 0.42, -0.55, body);
  box(0.5, 0.3, 0.08, carbon, -0.68, 0.46, 0.42, body, false); // pod inlets
  box(0.5, 0.3, 0.08, carbon, 0.68, 0.46, 0.42, body, false);
  // engine cover + airbox + fin
  box(0.58, 0.55, 1.9, paint, 0, 0.72, -1.25, body);
  box(0.38, 0.3, 0.75, carbon, 0, 1.06, -0.72, body);
  box(0.05, 0.42, 1.25, accent, 0, 1.02, -1.5, body, false);
  // cockpit + driver
  box(0.72, 0.18, 1.15, carbon, 0, 0.8, 0.22, body, false);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), accent);
  helmet.position.set(0, 0.96, 0.02);
  helmet.castShadow = true;
  body.add(helmet);
  box(0.3, 0.09, 0.06, carbon, 0, 0.98, 0.2, body, false); // visor
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

  // rear wing + diffuser
  box(0.08, 0.55, 0.08, darkMetal, -0.14, 0.78, -2.45, body, false);
  box(0.08, 0.55, 0.08, darkMetal, 0.14, 0.78, -2.45, body, false);
  box(1.05, 0.05, 0.42, paint, 0, 1.04, -2.55, body);
  const flap = box(1.0, 0.04, 0.3, accent, 0, 1.2, -2.62, body);
  flap.rotation.x = -0.18;
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
    const w = makeWheel(isFront ? 0.36 : 0.38, isFront ? 0.4 : 0.45, accent);
    w.steer.position.set(x, y, z);
    car.add(w.steer);
    wheels[key] = w;
    // suspension arm hint
    const arm = box(Math.abs(x) - 0.2, 0.05, 0.05, darkMetal, x / 2, y + 0.05, z, car, false);
    arm.position.x = x * 0.55;
  }

  car.userData = { body, wheels, frontWing, brakeMat, spinAngle: 0, rollSmooth: 0, pitchSmooth: 0 };
  return car;
}

/** Wheels, steering, body lean and damage visuals (position set by Game). */
export function updateCarVisual(carGroup, vehicle, dt) {
  const ud = carGroup.userData;
  ud.spinAngle += (vehicle.u / 0.37) * dt;
  for (const w of Object.values(ud.wheels)) w.spin.rotation.x = ud.spinAngle;
  const steerVis = vehicle.wheelAngle || 0;
  ud.wheels.fl.steer.rotation.y = steerVis;
  ud.wheels.fr.steer.rotation.y = steerVis;

  // body roll from lateral accel, pitch from longitudinal accel (weight transfer §14)
  const latAcc = vehicle.yawRate * vehicle.u;
  const targetRoll = THREE.MathUtils.clamp(latAcc * 0.0016, -0.05, 0.05);
  const accel = (vehicle.u - (ud._lastU ?? vehicle.u)) / Math.max(dt, 1e-4);
  ud._lastU = vehicle.u;
  const targetPitch = THREE.MathUtils.clamp(-accel * 0.0012, -0.035, 0.045);
  ud.rollSmooth += (targetRoll - ud.rollSmooth) * Math.min(dt * 8, 1);
  ud.pitchSmooth += (targetPitch - ud.pitchSmooth) * Math.min(dt * 8, 1);
  // kerb shake
  const shake = vehicle.onKerb && Math.abs(vehicle.u) > 8 ? (Math.random() - 0.5) * 0.02 : 0;
  ud.body.rotation.z = ud.rollSmooth + shake;
  ud.body.rotation.x = ud.pitchSmooth;
  ud.body.position.y = vehicle.onKerb && Math.abs(vehicle.u) > 8 ? Math.random() * 0.03 : 0;

  // damage: front wing droops/tilts
  const d = vehicle.damageLevel;
  ud.frontWing.rotation.z = d >= 3 ? 0.15 : d === 2 ? 0.06 : 0;
  ud.frontWing.rotation.x = d >= 3 ? 0.14 : d === 2 ? 0.05 : 0;
  ud.frontWing.position.y = d >= 2 ? -0.04 : 0;

  ud.brakeMat.emissiveIntensity = vehicle.braking ? 2.2 : 0.4;
}
