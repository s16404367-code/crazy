// DUSK APEX — circuit & environment rendering, built entirely from the
// shared centreline samples (one track definition, §18). All textures are
// procedural canvas art: zero external assets, zero licensing risk, tiny
// download. Dusk identity: warm low sun, deep-blue/orange sky, floodlights.

import * as THREE from 'three';
import { getPointAt, deltaS } from './trackData.js';
import { QUALITY_PRESETS } from '../config/config.js';

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(ctx, w, h, colors, count, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
const asphaltTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#34373e'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, ['#2c2f36', '#3d4048', '#2a2d33', '#454954'], 2600);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(5, 0, 5, h); ctx.fillRect(w - 10, 0, 5, h); // edge lines (u = across)
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(w * 0.3, 0, w * 0.12, h); ctx.fillRect(w * 0.58, 0, w * 0.12, h); // tyre darkening
});
const pitAsphaltTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#3c3f46'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, ['#33363d', '#464a52'], 2000);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(w / 2 - 2, 0, 4, h);
});
const kerbTex = () => canvasTex(64, 128, (ctx, w, h) => {
  ctx.fillStyle = '#d8232f'; ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, h / 2, w, h / 2);
});
const grassTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#2c4426'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, ['#243a20', '#35522c', '#2e4a2a', '#3d5c33'], 3200);
});
const gravelTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6d6455'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, ['#5c5347', '#7d7466', '#8a7f6f'], 2600, 3);
});
const checkerTex = () => canvasTex(128, 32, (ctx, w, h) => {
  const s = 16;
  for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#111' : '#f2f2f2';
    ctx.fillRect(x * s, y * s, s, s);
  }
}, false);
const boardTex = (text, bg, fg) => canvasTex(512, 112, (ctx, w, h) => {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = '900 58px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
}, false);

// deterministic RNG for scenery placement (same circuit every load)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- ribbon geometry from samples ----------
function buildRibbon(track, latA, latB, y, material, opts = {}) {
  const { samples, count } = track;
  const step = opts.step || 2;
  const vScale = opts.vScale || 9;
  const predicate = opts.predicate || null;
  const pos = [], uv = [], idx = [];
  let vi = 0;
  const idxList = [];
  for (let i = 0; i < count; i += step) idxList.push(i);
  idxList.push(0); // close loop
  let prevVi = -1, prevOk = false;
  for (const i of idxList) {
    const ok = !predicate || predicate(i);
    if (!ok) { prevOk = false; continue; }
    const la = typeof latA === 'function' ? latA(i) : latA;
    const lb = typeof latB === 'function' ? latB(i) : latB;
    const nx = samples.nx[i], nz = samples.nz[i];
    pos.push(samples.x[i] + nx * la, y, samples.z[i] + nz * la);
    pos.push(samples.x[i] + nx * lb, y, samples.z[i] + nz * lb);
    const v = samples.s[i] / vScale + (vi === 0 && i === 0 && prevVi >= 0 ? track.length / vScale : 0);
    uv.push(0, samples.s[i] / vScale, 1, samples.s[i] / vScale);
    void v;
    if (prevOk && prevVi >= 0) {
      const a = prevVi, b = prevVi + 1, c = vi, d = vi + 1;
      idx.push(a, b, c, b, d, c);
    }
    prevVi = vi; prevOk = true; vi += 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildEnvironment(scene, qualityKey) {
  const q = QUALITY_PRESETS[qualityKey];
  // dusk sky dome (gradient shader, fog-free)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x1c2a52) },
      mid: { value: new THREE.Color(0x7a4a6e) },
      horizon: { value: new THREE.Color(0xff9a4d) }
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22,0.75,h)) : mix(horizon, mid, smoothstep(-0.02,0.22,h));
      gl_FragColor = vec4(c,1.0); }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 20, 12), skyMat);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0x8090c8, 0x3a2c20, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.0);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(0xcf8a5e, 260, q.fogFar);

  // light rain particles (hidden unless rain weather)
  const rainCount = 850;
  const rainPos = new Float32Array(rainCount * 3);
  const rnd = mulberry32(77);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (rnd() - 0.5) * 130;
    rainPos[i * 3 + 1] = rnd() * 55;
    rainPos[i * 3 + 2] = (rnd() - 0.5) * 130;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaec6e8, size: 0.32, transparent: true, opacity: 0.55, depthWrite: false
  }));
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  return { sky, skyMat, hemi, sun, rain, rainPos, sunDir: new THREE.Vector3(-0.55, 0.38, -0.35).normalize() };
}

export function applyWeather(env, scene, weather, qualityKey) {
  const q = QUALITY_PRESETS[qualityKey];
  if (weather === 'rain') {
    env.skyMat.uniforms.top.value.set(0x2a3450);
    env.skyMat.uniforms.mid.value.set(0x4c4a5e);
    env.skyMat.uniforms.horizon.value.set(0x8a7a72);
    env.sun.intensity = 0.85; env.sun.color.set(0xd8c8b8);
    env.hemi.intensity = 0.95;
    scene.fog.color.set(0x7a7684); scene.fog.near = 150; scene.fog.far = Math.min(q.fogFar, 650);
    env.rain.visible = true;
  } else if (weather === 'overcast') {
    env.skyMat.uniforms.top.value.set(0x33406a);
    env.skyMat.uniforms.mid.value.set(0x6e5a72);
    env.skyMat.uniforms.horizon.value.set(0xd88a58);
    env.sun.intensity = 1.35; env.sun.color.set(0xffc38a);
    env.hemi.intensity = 0.95;
    scene.fog.color.set(0xbb8464); scene.fog.near = 220; scene.fog.far = q.fogFar;
    env.rain.visible = false;
  } else { // clear dusk — the game's identity
    env.skyMat.uniforms.top.value.set(0x1c2a52);
    env.skyMat.uniforms.mid.value.set(0x7a4a6e);
    env.skyMat.uniforms.horizon.value.set(0xff9a4d);
    env.sun.intensity = 2.0; env.sun.color.set(0xffb36b);
    env.hemi.intensity = 0.85;
    scene.fog.color.set(0xcf8a5e); scene.fog.near = 260; scene.fog.far = q.fogFar;
    env.rain.visible = false;
  }
}

export function buildTrack(scene, track, qualityKey) {
  const q = QUALITY_PRESETS[qualityKey];
  const g = new THREE.Group();
  const R = track.roadHalfWidth, K = track.kerbWidth, RO = track.runoffWidth;
  const smp = track.samples;

  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.94, metalness: 0 });
  const pitAsphalt = new THREE.MeshStandardMaterial({ map: pitAsphaltTex(), roughness: 0.94 });
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex(), roughness: 0.8 });
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: 1 });

  // ground
  const grassT = grassTex(); grassT.repeat.set(90, 90);
  const cx = (track.bounds.minX + track.bounds.maxX) / 2;
  const cz = (track.bounds.minZ + track.bounds.maxZ) / 2;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2000, 40),
    new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.08, cz);
  ground.receiveShadow = true;
  g.add(ground);

  // road / runoff / kerbs / pit lane
  g.add(buildRibbon(track, -R, R, 0.02, asphalt, { vScale: 9 }));
  g.add(buildRibbon(track, R, R + RO, 0.012, gravel, { vScale: 7 }));
  g.add(buildRibbon(track, -R - RO, -R, 0.012, gravel, { vScale: 7 }));
  const isCorner = (i) => Math.abs(smp.curv[i]) > 0.0042;
  g.add(buildRibbon(track, R, R + K, 0.032, kerbMat, { vScale: 4.5, predicate: isCorner }));
  g.add(buildRibbon(track, -R - K, -R, 0.032, kerbMat, { vScale: 4.5, predicate: isCorner }));
  const pit = track.pit;
  const pitA = Math.min(pit.lat - 4, pit.lat + 4), pitB = Math.max(pit.lat - 4, pit.lat + 4);
  g.add(buildRibbon(track, pitA, pitB, 0.028, pitAsphalt,
    { vScale: 9, predicate: (i) => track.inPitRange(smp.s[i]) }));

  const tmpP = {};
  const flatAt = (mesh, s, lat, y) => {
    getPointAt(track, s, lat, tmpP);
    mesh.position.set(tmpP.x, y, tmpP.z);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.rotateZ(-tmpP.phi);
    return mesh;
  };

  // start line + grid slots
  const startLine = flatAt(new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 2.4),
    new THREE.MeshStandardMaterial({ map: checkerTex(), roughness: 0.8 })), 0, 0, 0.045);
  g.add(startLine);
  const slotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  for (const slot of track.gridSlots) {
    g.add(flatAt(new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.6), slotMat), slot.s, slot.lat, 0.04));
  }
  // pit boxes
  const pitBoxMat = new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.75 });
  for (let k = -2; k <= 3; k++) {
    g.add(flatAt(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), pitBoxMat),
      pit.boxS + k * 21, pit.lat + Math.sign(pit.lat) * 1.6, 0.042));
  }

  // barriers (instanced, alternating colours via instance colour)
  const stepIdx = 4;
  const segCount = Math.ceil(track.count / stepIdx) * 2;
  const barrierGeo = new THREE.BoxGeometry(0.5, 0.95, track.ds * stepIdx + 0.25);
  const barrierMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 });
  const barriers = new THREE.InstancedMesh(barrierGeo, barrierMat, segCount);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let bi = 0;
  for (let i = 0; i < track.count; i += stepIdx) {
    for (const side of [1, -1]) {
      const dist = (side > 0 ? smp.barrierL[i] : smp.barrierR[i]) + 0.2;
      const x = smp.x[i] + smp.nx[i] * side * dist;
      const z = smp.z[i] + smp.nz[i] * side * dist;
      qt.setFromAxisAngle(up, smp.phi[i]);
      m4.compose(new THREE.Vector3(x, 0.48, z), qt, new THREE.Vector3(1, 1, 1));
      barriers.setMatrixAt(bi, m4);
      col.set((bi >> 1) % 2 === 0 ? 0xd8d8de : 0xb8352c);
      barriers.setColorAt(bi, col);
      bi++;
    }
  }
  barriers.count = bi;
  g.add(barriers);

  // tyre stacks at key corner outsides
  const stackSpots = [];
  const addStacks = (sCenter, count, spread) => {
    for (let k = 0; k < count; k++) {
      const s = sCenter + (k - count / 2) * spread;
      getPointAt(track, s, 0, tmpP);
      const outside = tmpP.curv > 0 ? -1 : 1;
      stackSpots.push({ s, lat: outside * (R + 3.2) });
    }
  };
  addStacks(track.refs.hairpinS, 9, 7);
  addStacks(track.refs.turn1S, 7, 8);
  addStacks(track.refs.chicaneS, 6, 8);
  const tyreGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.36, 10);
  const tyreInst = new THREE.InstancedMesh(tyreGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.9 }), stackSpots.length * 3);
  let ti = 0;
  for (const spot of stackSpots) {
    getPointAt(track, spot.s, spot.lat, tmpP);
    for (let lvl = 0; lvl < 3; lvl++) {
      m4.compose(new THREE.Vector3(tmpP.x, 0.18 + lvl * 0.37, tmpP.z),
        new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      tyreInst.setMatrixAt(ti, m4);
      tyreInst.setColorAt(ti, col.set(lvl % 2 ? 0xe8e8e8 : 0xc03028));
      ti++;
    }
  }
  tyreInst.count = ti;
  tyreInst.castShadow = q.shadows;
  g.add(tyreInst);

  // advertising boards (fictional brands only) along fast sections
  const boardMats = [
    new THREE.MeshStandardMaterial({ map: boardTex('DUSK APEX', '#16213e', '#ffb36b'), roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: boardTex('APEX TYRES', '#e8e8e8', '#c03028'), roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: boardTex('ORBIT FUEL', '#0d3b2e', '#7fe0b2'), roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: boardTex('VELOCE', '#3e1626', '#ffd23e'), roughness: 0.7 })
  ];
  const boardGeo = new THREE.PlaneGeometry(9, 1.15);
  let boardN = 0;
  for (let i = 0; i < track.count; i += 26) {
    if (smp.targetSpeed[i] < 52) continue;
    const side = boardN % 2 === 0 ? 1 : -1;
    const dist = (side > 0 ? smp.barrierL[i] : smp.barrierR[i]) + 1.4;
    const b = new THREE.Mesh(boardGeo, boardMats[boardN % boardMats.length]);
    b.position.set(smp.x[i] + smp.nx[i] * side * dist, 0.75, smp.z[i] + smp.nz[i] * side * dist);
    b.rotation.y = Math.atan2(-smp.nx[i] * side, -smp.nz[i] * side);
    g.add(b);
    boardN++;
  }

  // brake marker boards before the three big stops
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (const ref of [track.refs.hairpinS, track.refs.turn1S, track.refs.chicaneS]) {
    for (const back of [160, 110, 60]) {
      getPointAt(track, ref - back, 0, tmpP);
      const outside = tmpP.curv > 0 ? -1 : 1;
      getPointAt(track, ref - back, outside * (R + 1.1), tmpP);
      const mk = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), markerMat);
      mk.position.set(tmpP.x, 0.8, tmpP.z);
      mk.rotation.y = Math.atan2(-tmpP.tx, -tmpP.tz);
      g.add(mk);
    }
  }

  // start gantry
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.6 });
  getPointAt(track, 2, 0, tmpP);
  const gantry = new THREE.Group();
  gantry.position.set(tmpP.x, 0, tmpP.z);
  gantry.rotation.y = tmpP.phi;
  // legs straddle BOTH road and pit lane on the pit side (local +X = +lat)
  const pitSideX = Math.sign(track.pit.lat) * (Math.abs(track.pit.lat) + 6);
  const otherX = -Math.sign(track.pit.lat) * (R + 2);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), gantryMat);
  legL.position.set(otherX, 3.25, 0); gantry.add(legL);
  const legR = legL.clone(); legR.position.x = pitSideX; gantry.add(legR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(pitSideX - otherX) + 0.6, 1.3, 0.4),
    new THREE.MeshStandardMaterial({ map: boardTex('DUSK APEX', '#16213e', '#ffb36b'), roughness: 0.6 }));
  beam.position.set((pitSideX + otherX) / 2, 6.2, 0); beam.castShadow = q.shadows;
  gantry.add(beam);
  g.add(gantry);

  // grandstand on the main straight, north side (pits/garages are south)
  const gs = new THREE.Group();
  const GS_LAT = -30;
  getPointAt(track, 150, GS_LAT, tmpP);
  gs.position.set(tmpP.x, 0, tmpP.z);
  gs.rotation.y = tmpP.phi;
  const seatColors = [0x3050a0, 0xa03830, 0xd8d8de, 0x3050a0, 0xe0a030];
  for (let row = 0; row < 5; row++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(95, 1.1, 2.6),
      new THREE.MeshStandardMaterial({ color: seatColors[row], roughness: 0.9 }));
    // local +X = +lat direction: rows step UP and AWAY from the track
    r.position.set(Math.sign(GS_LAT) * row * 2.4, 1 + row * 1.05, 0);
    r.geometry.rotateY(Math.PI / 2);
    gs.add(r);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 97),
    new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.6, metalness: 0.4 }));
  roof.position.set(Math.sign(GS_LAT) * 5, 8.6, 0); roof.rotation.z = Math.sign(GS_LAT) * 0.08;
  roof.castShadow = q.shadows;
  gs.add(roof);
  g.add(gs);

  // pit garages beyond the pit lane
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8 });
  const doorMats = [0x2050d8, 0xd8232f, 0x10a8a0, 0xf2c230, 0x8a3fd1, 0x38b83e].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  for (let k = 0; k < 6; k++) {
    getPointAt(track, pit.boxS - 55 + k * 22, pit.lat + Math.sign(pit.lat) * 9.5, tmpP);
    const gar = new THREE.Group();
    gar.position.set(tmpP.x, 0, tmpP.z);
    gar.rotation.y = tmpP.phi;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(19, 5.5, 7), garageMat);
    shell.geometry.rotateY(Math.PI / 2);
    shell.position.y = 2.75; shell.castShadow = q.shadows;
    gar.add(shell);
    const door = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.6, 0.2), doorMats[k]);
    door.geometry.rotateY(Math.PI / 2);
    door.position.set(-Math.sign(pit.lat) * 3.6, 1.8, 0); // door faces the pit lane / track
    gar.add(door);
    g.add(gar);
  }

  // floodlight poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c414c, roughness: 0.5, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2cf, emissiveIntensity: 1.6 });
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.22, 14, 6);
  const headGeo = new THREE.BoxGeometry(1.7, 0.7, 0.3);
  let poleN = 0;
  for (let i = 20; i < track.count; i += 110) {
    const side = poleN % 2 === 0 ? 1 : -1;
    const dist = (side > 0 ? smp.barrierL[i] : smp.barrierR[i]) + 3;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(smp.x[i] + smp.nx[i] * side * dist, 7, smp.z[i] + smp.nz[i] * side * dist);
    g.add(pole);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(pole.position.x, 14.1, pole.position.z);
    head.rotation.y = Math.atan2(-smp.nx[i] * side, -smp.nz[i] * side);
    head.rotation.x = 0.5;
    g.add(head);
    poleN++;
  }

  // trees (instanced cones + trunks), kept ≥22 m from any tarmac
  const rnd = mulberry32(1234);
  const treePos = [];
  let guard = 0;
  while (treePos.length < q.treeCount && guard < q.treeCount * 30) {
    guard++;
    const i = (rnd() * track.count) | 0;
    const side = rnd() > 0.5 ? 1 : -1;
    const dist = 26 + rnd() * 110;
    const x = smp.x[i] + smp.nx[i] * side * dist;
    const z = smp.z[i] + smp.nz[i] * side * dist;
    let ok = true;
    for (let j = 0; j < track.count; j += 8) {
      const dx = x - smp.x[j], dz = z - smp.z[j];
      if (dx * dx + dz * dz < 22 * 22) { ok = false; break; }
    }
    if (ok) treePos.push({ x, z, s: 0.8 + rnd() * 0.9 });
  }
  const trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 5),
    new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }), treePos.length);
  const crownInst = new THREE.InstancedMesh(new THREE.ConeGeometry(2.3, 6.5, 7),
    new THREE.MeshStandardMaterial({ color: 0x274a24, roughness: 1 }), treePos.length);
  treePos.forEach((t, i) => {
    m4.compose(new THREE.Vector3(t.x, 1.1 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s));
    trunkInst.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(t.x, (2.2 + 3.1) * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s));
    crownInst.setMatrixAt(i, m4);
  });
  crownInst.castShadow = q.shadows && qualityKey !== 'low';
  g.add(trunkInst); g.add(crownInst);

  // distant dusk hills
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x2c3350, roughness: 1 });
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * Math.PI * 2 + 0.3;
    const rad = 1400 + (k % 3) * 220;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(420 + (k % 4) * 90, 90 + (k % 3) * 45, 7), hillMat);
    hill.position.set(cx + Math.cos(ang) * rad, 0, cz + Math.sin(ang) * rad);
    g.add(hill);
  }

  scene.add(g);
  return g;
}
