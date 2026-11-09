//#region PHONE
// Camera AR for phones: getUserMedia video behind a transparent canvas, device-orientation camera, tap to place on the
// floor, a retractable bottom menu, and MediaPipe hand tracking turned into the same hand colliders / pinch grabs as WebXR.
Object.assign(PHN, {
  mode: 'play', pos: [0, 0, -1.5], yaw: 0, scale: 0.28, floor: 1.0, fy: 1.0, hands: true, Rm: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  h0: null, ori: null, noSensor: false, lookYaw: 0, lookPitch: -0.35, hl: null, handRes: null, handT: 0, detT: 0, lastVT: -1,
  hg: new Map(), hprev: new Map(), zs: new Map(), pinchOn: new Map(), H: [], pt: null, stream: null, hintT: 0, fake: null,
});
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MP_VER = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

// ---- 3x3 helpers (row-major)
const m3 = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
const rX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mv3 = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

function phoneRot() {
  const o = PHN.ori, D = Math.PI / 180;
  let R;
  if (o) {
    const orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * D;
    R = m3(m3(m3(m3(rY(o.alpha * D), rX(o.beta * D)), rZ(-o.gamma * D)), rX(-Math.PI / 2)), rZ(-orient));
    if (PHN.h0 === null) { const fy = -R[5]; if (Math.abs(fy) < 0.85) PHN.h0 = Math.atan2(-R[2], R[8]); } // forward at start = -z
    if (PHN.h0 !== null) R = m3(rY(PHN.h0), R);
  } else R = m3(rY(PHN.lookYaw), rX(PHN.lookPitch));
  PHN.Rm = R; return R;
}
function phoneUpdateFov() { const asp = canvas.width / Math.max(1, canvas.height), L = 1.15; PHN.fy = asp < 1 ? L : 2 * Math.atan(Math.tan(L / 2) / asp); }
function phoneView() {
  const R = PHN.Rm, e = [0, PHN.floor, 0], V = new Float32Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) V[c * 4 + r] = R[c * 3 + r];
  for (let r = 0; r < 3; r++) V[12 + r] = -(R[r] * e[0] + R[3 + r] * e[1] + R[6 + r] * e[2]);
  V[15] = 1; return V;
}
function phoneBasis() {
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  phoneUpdateFov();
  const asp = canvas.width / Math.max(1, canvas.height), P = M4.persp(PHN.fy, asp, 0.04, 40), R = PHN.Rm;
  return { eye: M4.pt(XR_MI, [0, PHN.floor, 0]), fwd: nrm(M4.dir(XR_MI, [-R[2], -R[5], -R[8]])), vp: M4.mul(M4.mul(P, phoneView()), XR_M) };
}
function phoneRay(cx, cy) {
  const r = canvas.getBoundingClientRect(), nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2, t = Math.tan(PHN.fy / 2);
  return { ro: [0, PHN.floor, 0], rd: nrm(mv3(PHN.Rm, [nx * t * r.width / r.height, ny * t, -1])) };
}
function groundHit(rd) {
  if (rd[1] < -0.05) { const t = Math.min(3.2, -PHN.floor / rd[1]); return [rd[0] * t, 0, rd[2] * t]; }
  const l = Math.hypot(rd[0], rd[2]) || 1; return [rd[0] / l * 2, 0, rd[2] / l * 2];
}
const simRay = r => { if (!XR_MI) XR_MI = M4.inv(XR_M); return { ro: M4.pt(XR_MI, r.ro), rd: nrm(M4.dir(XR_MI, r.rd)) }; };
const simFwd = () => { if (!XR_MI) XR_MI = M4.inv(XR_M); const R = PHN.Rm; return nrm(M4.dir(XR_MI, [-R[2], -R[5], -R[8]])); };

// ---- hand landmarks -> world points (metres, camera at (0,floor,0))
function handWorld(lm, key) {
  const r = canvas.getBoundingClientRect(), v = $('phVid'), vw = v.videoWidth, vh = v.videoHeight; if (!vw || !vh) return null;
  const sc = Math.max(r.width / vw, r.height / vh), ox = r.left + (r.width - vw * sc) / 2, oy = r.top + (r.height - vh * sc) / 2;
  const X = i => ox + lm[i].x * vw * sc, Y = i => oy + lm[i].y * vh * sc, fpx = (r.height / 2) / Math.tan(PHN.fy / 2);
  const d1 = Math.hypot(X(0) - X(9), Y(0) - Y(9)), d2 = Math.hypot(X(5) - X(17), Y(5) - Y(17));
  let Z = Math.min(fpx * 0.095 / Math.max(d1, 1), fpx * 0.078 / Math.max(d2, 1)); Z = clamp(Z, 0.15, 1.3);
  const zp = PHN.zs.get(key); Z = zp ? zp + (Z - zp) * 0.45 : Z; PHN.zs.set(key, Z);
  const cxs = r.left + r.width / 2, cys = r.top + r.height / 2, pts = [], R = PHN.Rm;
  for (let i = 0; i < 21; i++) {
    const Zi = Math.max(0.08, Z * (1 + lm[i].z * vw * sc / fpx)), c = [(X(i) - cxs) / fpx * Zi, -(Y(i) - cys) / fpx * Zi, -Zi], w = mv3(R, c);
    pts.push([w[0], w[1] + PHN.floor, w[2]]);
  }
  const dp = Math.hypot(X(4) - X(8), Y(4) - Y(8)) / Math.max(d1, 1);
  return { pts, ratio: dp, Z };
}
const HMAP = { thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
function phoneColliders(hands) {
  let n = 0; const sc = PHN.scale;
  for (const h of hands) {
    if (PHN.hg.has(h.key) || !PHN.hands) continue;
    const P = {}, Rr = {}; P.wrist = h.pts[0];
    for (const f of Object.keys(HJ)) {
      const names = HJ[f], idx = HMAP[f];
      if (names.length === 4) names.forEach((nm, i) => { P[nm] = h.pts[idx[i]]; });
      else { P[names[0]] = [0, 1, 2].map(k => (h.pts[0][k] + h.pts[idx[0]][k]) / 2); for (let i = 0; i < 4; i++) P[names[i + 1]] = h.pts[idx[i]]; }
    }
    for (const k of Object.keys(P)) Rr[k] = 0.011;
    const pv = PHN.hprev.get(h.key) || new Map(), nx = new Map();
    const add = (key, p, r) => {
      if (n >= 160) return; const q = M4.pt(XR_MI, p), o = n * 8, old = pv.get(key) || q;
      CB[o] = q[0]; CB[o + 1] = q[1]; CB[o + 2] = q[2]; CB[o + 3] = r * 1.15 / sc; CB[o + 4] = old[0]; CB[o + 5] = old[1]; CB[o + 6] = old[2]; n++; nx.set(key, q);
    };
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    add('wrist', P.wrist, 0.03);
    for (const f of Object.keys(HJ)) {
      const ch = HJ[f];
      for (let i = 0; i < ch.length; i++) {
        const a = P[ch[i]]; if (!a) continue;
        if (i > 0 && P[ch[i - 1]]) add(f + 'm' + i, mid(P[ch[i - 1]], a), 0.011);
        add(f + i, a, i === 0 ? 0.014 : Rr[ch[i]]);
      }
    }
    const base = ['index', 'middle', 'ring', 'pinky'].map(f => P[HJ[f][0]]), k1 = ['index', 'middle', 'ring', 'pinky'].map(f => P[HJ[f][1]]);
    const c = [0, 1, 2].map(k => (P.wrist[k] + base[0][k] + base[1][k] + base[2][k] + base[3][k]) / 5);
    add('palm', c, 0.035);
    for (let i = 0; i < 4; i++) add('pw' + i, mid(P.wrist, base[i]), 0.026);
    for (let i = 0; i < 3; i++) { add('kn' + i, mid(k1[i], k1[i + 1]), 0.014); add('bb' + i, mid(base[i], base[i + 1]), 0.02); }
    for (let i = 0; i < 4; i++) add('pm' + i, mid(base[i], k1[i]), 0.016);
    PHN.hprev.set(h.key, nx);
  }
  world.setColliders(CB, n);
}

// ---- pinch grabs
function phonePinchStart(h, ps) {
  const rd = simFwd();
  if (ST.lure && lure.s > 0.3 && Math.hypot(ps[0] - lure.p[0], ps[1] - lure.p[1], ps[2] - lure.p[2]) < 0.3) { lure.grab = true; PHN.hg.set(h.key, { type: 'lure', off: [lure.p[0] - ps[0], lure.p[1] - ps[1], lure.p[2] - ps[2]], id: lure.id }); return; }
  let best = -1, bd = 0.6;
  for (const v of world.surfV) { const d = Math.hypot(world.pos[3 * v] - ps[0], world.pos[3 * v + 1] - ps[1], world.pos[3 * v + 2] - ps[2]); if (d < bd) { bd = d; best = v; } }
  if (best >= 0) { const id = PHN.hg.size ? 2 : 1, c = world.beginGrab(best, rd, id).c0; PHN.hg.set(h.key, { type: 'shark', id, off: [c[0] - ps[0], c[1] - ps[1], c[2] - ps[2]] }); return; }
  if (ST.kelp) { const kc = kelp.pick(null, null, 0.2, ps); if (kc >= 0) { const r0 = kelp.root(kc); PHN.hg.set(h.key, { type: 'kelp', c: kc, off: [r0[0] - ps[0], r0[1] - ps[2]] }); } }
}
function phonePinchEnd(key) {
  const g = PHN.hg.get(key); if (!g) return;
  if (g.type === 'shark') world.endGrab(g.id); else if (g.type === 'lure') lure.grab = false;
  PHN.hg.delete(key);
}
function phoneGrabMove(h, ps) {
  const g = PHN.hg.get(h.key); if (!g) return;
  if (g.type === 'shark') {
    const gr = world.S.grabs.get(g.id); if (!gr) { PHN.hg.delete(h.key); return; }
    const tg = [ps[0] + g.off[0], Math.max(0.03, ps[1] + g.off[1]), ps[2] + g.off[2]], c0 = gr.c0, o = [tg[0] - c0[0], tg[1] - c0[1], tg[2] - c0[2]], l = Math.hypot(...o), k = l > 1.4 ? 1.4 / l : 1;
    world.moveGrab([c0[0] + o[0] * k, c0[1] + o[1] * k, c0[2] + o[2] * k], 0, g.id);
  } else if (g.type === 'lure') { if (g.id !== lure.id) PHN.hg.delete(h.key); else lureSet(ps[0] + g.off[0], ps[1] + g.off[1], ps[2] + g.off[2]); }
  else if (g.type === 'kelp') kelp.move(g.c, ps[0] + g.off[0], ps[2] + g.off[1]);
}

// ---- per-frame update (called from frame() before the sim advances)
function phoneUpdate(now) {
  phoneRot(); phoneUpdateFov();
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  if (PHN.mode === 'place') {
    const r = canvas.getBoundingClientRect(), ray = phoneRay(r.left + r.width / 2, r.top + r.height / 2), gp = groundHit(ray.rd);
    for (let i = 0; i < 3; i++) PHN.pos[i] += (gp[i] - PHN.pos[i]) * (PHN.placed ? 0.3 : 1);
    PHN.placed = true; PHN.yaw = faceYaw([0, PHN.floor, 0], PHN.pos); applyPlace({ pos: PHN.pos, yaw: PHN.yaw, scale: PHN.scale });
  }
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  // hand tracking
  let res = PHN.fake;
  if (!res && PHN.hl && PHN.hands) {
    const v = $('phVid');
    if (v.readyState >= 2 && v.currentTime !== PHN.lastVT && now - PHN.detT > 45) { PHN.detT = now; PHN.lastVT = v.currentTime; try { PHN.handRes = PHN.hl.detectForVideo(v, now); PHN.handT = now; } catch (e) { } }
    res = now - PHN.handT < 300 ? PHN.handRes : null;
  }
  const hands = [];
  if (res && res.landmarks && PHN.hands && PHN.mode === 'play') res.landmarks.forEach((lm, i) => {
    const hd = res.handedness && res.handedness[i] && res.handedness[i][0], key = (hd && (hd.categoryName || hd.displayName)) || ('h' + i);
    const w = handWorld(lm, key); if (!w) return; hands.push(Object.assign({ key }, w));
  });
  const seen = new Set();
  for (const h of hands) {
    seen.add(h.key);
    const was = PHN.pinchOn.get(h.key) || false, on = was ? h.ratio < 0.42 : h.ratio < 0.28;
    h.pinch = on; PHN.pinchOn.set(h.key, on);
    const pw = [(h.pts[4][0] + h.pts[8][0]) / 2, (h.pts[4][1] + h.pts[8][1]) / 2, (h.pts[4][2] + h.pts[8][2]) / 2]; h.pp = pw;
    const ps = M4.pt(XR_MI, pw);
    if (on && !was) phonePinchStart(h, ps); else if (!on && was) phonePinchEnd(h.key);
    if (on) phoneGrabMove(h, ps);
  }
  for (const k of [...PHN.hg.keys()]) if (!seen.has(k)) { phonePinchEnd(k); PHN.pinchOn.set(k, false); }
  if (!hands.length) PHN.hprev.clear();
  phoneColliders(hands);
  PHN.H = hands;
  // virtual fingertip dots
  xiN = 0;
  const rr = r => r / PHN.scale, push = (p, r, shade) => { if (xiN >= 64) return; const q = M4.pt(XR_MI, p), o = xiN * 12; XI[o] = q[0]; XI[o + 1] = q[1]; XI[o + 2] = q[2]; XI[o + 3] = 2; XI[o + 4] = 0; XI[o + 5] = 0; XI[o + 6] = 0; XI[o + 7] = 1; XI[o + 8] = XI[o + 9] = XI[o + 10] = rr(r); XI[o + 11] = shade; xiN++; };
  for (const h of hands) { for (const i of [0, 4, 8, 12, 16, 20]) push(h.pts[i], 0.005, 0); if (h.pinch) push(h.pp, 0.012, 0); }
  if (PHN.hintT && now > PHN.hintT) { PHN.hintT = 0; $('phHint').style.opacity = 0; }
}

// ---- touch / mouse on the canvas
function phoneBindPointer() {
  let ax = 0;
  const movePt = e => {
    const pt = PHN.pt; if (!pt || pt.id !== e.pointerId) return;
    const dx = e.clientX - pt.x, dy = e.clientY - pt.y; pt.x = e.clientX; pt.y = e.clientY;
    if (pt.mode === 'look') { PHN.lookYaw -= dx * 0.005; PHN.lookPitch = clamp(PHN.lookPitch + dy * 0.005, -1.4, 1.2); return; }
    const sr = simRay(phoneRay(e.clientX, e.clientY)), f = simFwd(), den = Math.max(0.2, sr.rd[0] * f[0] + sr.rd[1] * f[1] + sr.rd[2] * f[2]);
    if (pt.mode === 'lure') { const t = pt.t / den; lureSet(sr.ro[0] + sr.rd[0] * t, sr.ro[1] + sr.rd[1] * t, sr.ro[2] + sr.rd[2] * t); }
    else if (pt.mode === 'kelp') { if (sr.rd[1] < -0.02) { const t = -sr.ro[1] / sr.rd[1]; kelp.move(pt.c, sr.ro[0] + sr.rd[0] * t, sr.ro[2] + sr.rd[2] * t); } }
    else if (pt.mode === 'grab') {
      const t = pt.t / den; let tg = [sr.ro[0] + sr.rd[0] * t, sr.ro[1] + sr.rd[1] * t, sr.ro[2] + sr.rd[2] * t];
      const o = [tg[0] - pt.c[0], tg[1] - pt.c[1], tg[2] - pt.c[2]], l = Math.hypot(...o); if (l > 1.2) tg = [pt.c[0] + o[0] / l * 1.2, pt.c[1] + o[1] / l * 1.2, pt.c[2] + o[2] / l * 1.2];
      tg[1] = Math.max(0.02, tg[1]); world.moveGrab(tg, 0);
    }
  };
  canvas.addEventListener('pointerdown', e => {
    if (!PHN.on || PHN.pt) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
    const ray = phoneRay(e.clientX, e.clientY); PHN.pt = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null };
    if (PHN.mode === 'place') { // tap = put the shark on the surface under the finger
      const gp = groundHit(ray.rd); PHN.pos = gp; PHN.yaw = faceYaw([0, PHN.floor, 0], gp); applyPlace({ pos: gp, yaw: PHN.yaw, scale: PHN.scale });
      PHN.mode = 'play'; $('phRet').style.display = 'none'; $('phSheet').classList.add('closed'); phoneHint('Placed. Pinch the shark with your fingers, or drag it on screen.', 5000); PHN.pt = null; return;
    }
    const sr = simRay(ray), f = simFwd();
    if (ST.lure && lure.s > 0.3) {
      const vx = lure.p[0] - sr.ro[0], vy = lure.p[1] - sr.ro[1], vz = lure.p[2] - sr.ro[2], tt = vx * sr.rd[0] + vy * sr.rd[1] + vz * sr.rd[2];
      if (tt > 0 && Math.hypot(vx - sr.rd[0] * tt, vy - sr.rd[1] * tt, vz - sr.rd[2] * tt) < 0.2) { lure.grab = true; PHN.pt.mode = 'lure'; PHN.pt.t = vx * f[0] + vy * f[1] + vz * f[2]; return; }
    }
    const v = world.pickVertex(sr.ro, sr.rd);
    if (v >= 0) { world.beginGrab(v, f); const c = world.S.grab.c0; PHN.pt.mode = 'grab'; PHN.pt.c = c; PHN.pt.t = (c[0] - sr.ro[0]) * f[0] + (c[1] - sr.ro[1]) * f[1] + (c[2] - sr.ro[2]) * f[2]; if (ST.pause) { ST.pause = false; $('cPause').checked = false; } return; }
    if (ST.kelp) { const kc = kelp.pick(sr.ro, sr.rd, 0.12); if (kc >= 0) { PHN.pt.mode = 'kelp'; PHN.pt.c = kc; return; } }
    if (PHN.noSensor) PHN.pt.mode = 'look';
  });
  canvas.addEventListener('pointermove', movePt);
  const up = e => { const pt = PHN.pt; if (!pt || pt.id !== e.pointerId) return; if (pt.mode === 'grab') world.endGrab(); else if (pt.mode === 'lure') lure.grab = false; PHN.pt = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}

// ---- hand model
async function phoneHandsInit() {
  const st = $('phSt'); st.textContent = 'Hands: loading model…';
  try {
    let mod; try { mod = await import(MP_VER + '/vision_bundle.mjs'); } catch (e1) { mod = await import(MP_VER + '/vision_bundle.js'); }
    const fs = await mod.FilesetResolver.forVisionTasks(MP_VER + '/wasm');
    const mk = d => mod.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d }, runningMode: 'VIDEO', numHands: 2 });
    try { PHN.hl = await mk('GPU'); } catch (e) { PHN.hl = await mk('CPU'); }
    st.textContent = 'Hands: ready — show your hand to the camera';
  } catch (e) { st.textContent = 'Hands unavailable (' + String(e && e.message || e).slice(0, 70) + '). Drag the shark on screen instead.'; }
}
function phoneHint(t, ms) { const h = $('phHint'); h.textContent = t; h.style.opacity = 1; PHN.hintT = ms ? performance.now() + ms : 0; }

// ---- enter / exit
function onOri(e) { if (e.alpha == null || e.beta == null) return; PHN.ori = { alpha: e.alpha, beta: e.beta, gamma: e.gamma || 0 }; PHN.noSensor = false; }
async function phoneStart() {
  if (PHN.on || !gpuOK) return;
  const hint = $('phHint');
  try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') await DeviceOrientationEvent.requestPermission(); } catch (e) { }
  try {
    PHN.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const v = $('phVid'); v.srcObject = PHN.stream; await v.play().catch(() => { });
  } catch (e) { alert('Camera unavailable: ' + (e && e.message || e)); return; }
  if (ST.cell < 0.06) { ST.cell = 0.06; $('sDetail').value = '0.06'; loadWorld(0.06); }
  PHN.on = true; PHN.mode = 'place'; PHN.placed = false; PHN.h0 = null; PHN.ori = null; PHN.lookYaw = 0; PHN.lookPitch = -0.35; PHN.hg.clear(); PHN.pinchOn.clear();
  document.body.classList.add('ph'); document.body.classList.remove('camhash');
  window.addEventListener('deviceorientation', onOri); window.addEventListener('deviceorientationabsolute', onOri);
  $('phRet').style.display = 'block'; $('phSheet').classList.add('closed'); phoneHint('Aim at the floor or a table and tap the screen to place the shark', 0);
  setTimeout(() => { if (PHN.on && !PHN.ori) { PHN.noSensor = true; phoneHint('No motion sensor found — drag on empty space to look around, then tap to place', 0); } }, 1500);
  phoneSync(); resize(); setTimeout(resize, 200);
  if (PHN.hands && !PHN.hl) phoneHandsInit();
}
function phoneExit() {
  if (!PHN.on) return;
  for (const k of [...PHN.hg.keys()]) phonePinchEnd(k);
  if (PHN.pt && PHN.pt.mode === 'grab') world.endGrab(); lure.grab = false; PHN.pt = null;
  PHN.on = false; document.body.classList.remove('ph'); world.setColliders(CB, 0); xiN = 0; XI.fill(0);
  window.removeEventListener('deviceorientation', onOri); window.removeEventListener('deviceorientationabsolute', onOri);
  if (PHN.stream) { PHN.stream.getTracks().forEach(t => t.stop()); PHN.stream = null; } $('phVid').srcObject = null;
  resize();
}
function phoneSync() {
  const set = (id, on) => $(id).setAttribute('aria-pressed', !!on);
  set('pSwish', ST.swishT); set('pOcean', ST.ocean); set('pSwim', ST.swim); set('pLure', ST.lure); set('pKelp', ST.kelp); set('pLight', ST.luT); set('pHands', PHN.hands);
}
function phoneBindUI() {
  $('bCam').onclick = phoneStart;
  
  $('phHandle').onclick = () => $('phSheet').classList.toggle('closed');
  const b = (id, fn) => { $(id).onclick = () => { fn(); phoneSync(); }; };
  b('pGulp', A.gulp); b('pSwish', A.swish); b('pOcean', A.ocean); b('pSwim', A.swim); b('pLure', A.lure); b('pKrill', A.krill); b('pLight', A.light); b('pReset', A.reset);
  b('pKelp', () => { ST.kelp = !ST.kelp; $('cKelp').checked = ST.kelp; });
  b('pHands', () => { PHN.hands = !PHN.hands; if (PHN.hands && !PHN.hl) phoneHandsInit(); else if (!PHN.hands) { for (const k of [...PHN.hg.keys()]) phonePinchEnd(k); } });
  b('pMove', () => { PHN.mode = 'place'; PHN.placed = true; $('phRet').style.display = 'block'; $('phSheet').classList.add('closed'); phoneHint('Aim at a new spot and tap to place', 0); });
  b('pExit', phoneExit);
  const sc = v => 0.06 * Math.pow(8, v / 100);
  $('pSize').value = String(Math.round(Math.log(PHN.scale / 0.06) / Math.log(8) * 100));
  $('pSize').oninput = e => { PHN.scale = sc(+e.target.value); applyPlace({ pos: PHN.pos, yaw: PHN.yaw, scale: PHN.scale }); };
  $('pFloor').oninput = e => { PHN.floor = 0.4 + e.target.value / 100 * 1.6; };
  $('pFirm').oninput = e => { ST.firm = e.target.value / 100; $('sFirm').value = e.target.value; $('oFirm').textContent = e.target.value; };
  phoneBindPointer();
  window.__phone = { start: phoneStart, exit: phoneExit, PHN, setFake: f => { PHN.fake = f; } };
}
phoneBindUI();
//#endregion
