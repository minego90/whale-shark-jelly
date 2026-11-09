
// ---------------------------------------------------------------- gel jellyfish (same position-based gel: edges + volume + soft shape goal)
const JF_N = 3, JF_NS = 24, JF_NR = 6, JF_HALF = 1 + JF_NR * JF_NS, JF_PER = 2 * JF_HALF;
const JF_TENT = 16, JF_TSEG = 12, JF_ORAL = 4, JF_OSEG = 11, JF_FR = 3;
const JF_INST = JF_N * (JF_TENT * (JF_TSEG - 1) + JF_ORAL * (JF_OSEG - 1) * JF_FR + 1);
const JF_CENTER = [1.5, 0], JF_RAD = 1.85;
function jfShape(c, out) { // local rest shape (y up = apex), c = 0 relaxed .. 1 contracted; layer 0 outer, 1 inner
  // small pumpkin-like bell: 8 soft lobes, flattened crown, rim tucked just under the equator
  const TH = 1.74, Rr = 0.135 * (1 - 0.26 * c), Hh = 0.118 * (1 + 0.30 * c);
  let n = 0;
  for (let layer = 0; layer < 2; layer++) for (let r = 0; r <= JF_NR; r++) {
    const t = r / JF_NR, th = t * TH, th_ = 0.036 * (1 - 0.6 * t) * (1 + 0.15 * c);
    const R = layer ? Rr - th_ * 0.9 : Rr, H = layer ? Hh - th_ : Hh;
    const ns = r === 0 ? 1 : JF_NS;
    for (let s = 0; s < ns; s++) {
      const ph = s / JF_NS * 6.2831853, lobe = 1 + 0.075 * Math.sin(th) * (Math.pow(Math.abs(Math.cos(ph * 4)), 0.7) - 0.6) * (layer ? 0.5 : 1);
      const rr = R * Math.sin(th) * lobe * (1 + 0.06 * Math.sin(th * 2)), yy = H * Math.cos(th) * (1 - 0.10 * Math.pow(Math.cos(th), 6)); // flatter crown
      out[n++] = rr * Math.cos(ph); out[n++] = yy; out[n++] = rr * Math.sin(ph);
    }
  }
  return out;
}
function createJellies(world) {
  const NV = JF_PER, NJ = JF_N;
  // ---- topology (shared by every jelly)
  const vo = (r, s) => r === 0 ? 0 : 1 + (r - 1) * JF_NS + ((s % JF_NS) + JF_NS) % JF_NS, vi = (r, s) => JF_HALF + vo(r, s);
  const tri0 = [], edges = [], etype = [];
  const addE = (a, b, ty) => { edges.push(a, b); etype.push(ty); };
  for (let layer = 0; layer < 2; layer++) {
    const V = layer ? vi : vo, tris = [];
    for (let s = 0; s < JF_NS; s++) tris.push([V(0, 0), V(1, s), V(1, s + 1)]);
    for (let r = 1; r < JF_NR; r++) for (let s = 0; s < JF_NS; s++) { tris.push([V(r, s), V(r + 1, s), V(r + 1, s + 1)]); tris.push([V(r, s), V(r + 1, s + 1), V(r, s + 1)]); }
    for (const t of tris) tri0.push({ t: layer ? [t[0], t[2], t[1]] : t, kind: layer ? 1 : 0 });
    for (let s = 1; s < JF_NS; s++) addE(V(0, 0), V(1, s), 0);
    for (let r = 0; r <= JF_NR; r++) for (let s = 0; s < (r === 0 ? 1 : JF_NS); s++) {
      if (r > 0) addE(V(r, s), V(r, s + 1), 0);
      if (r < JF_NR) addE(V(r, s), V(r + 1, s), 0);
      if (r > 0 && r < JF_NR) { addE(V(r, s), V(r + 1, s + 1), 0); }
    }
  }
  for (let s = 0; s < JF_NS; s++) { tri0.push({ t: [vo(JF_NR, s), vi(JF_NR, s), vi(JF_NR, s + 1)], kind: 2 }); tri0.push({ t: [vo(JF_NR, s), vi(JF_NR, s + 1), vo(JF_NR, s + 1)], kind: 2 }); }
  for (let r = 0; r <= JF_NR; r++) for (let s = 0; s < (r === 0 ? 1 : JF_NS); s++) {
    addE(vo(r, s), vi(r, s), 1);
    if (r < JF_NR) { addE(vo(r, s), vi(r + 1, s), 2); addE(vo(r + 1, s), vi(r, s), 2); }
  }
  for (let s = 0; s < JF_NS; s++) { addE(vo(JF_NR, s), vi(JF_NR, s + 1), 2); addE(vo(JF_NR, s + 1), vi(JF_NR, s), 2); }
  const ne = etype.length, E = Uint16Array.from(edges), ET = Uint8Array.from(etype);
  // ---- shapes, with the centroid removed so the goal never drags the whole body
  const S0 = jfShape(0, new Float32Array(NV * 3)), S1 = jfShape(1, new Float32Array(NV * 3));
  for (const S of [S0, S1]) { let x = 0, y = 0, z = 0; for (let i = 0; i < NV; i++) { x += S[3 * i]; y += S[3 * i + 1]; z += S[3 * i + 2]; } x /= NV; y /= NV; z /= NV; for (let i = 0; i < NV; i++) { S[3 * i] -= x; S[3 * i + 1] -= y; S[3 * i + 2] -= z; } }
  // orient triangles outward using the relaxed shape
  const cav = [0, -0.05, 0];
  for (const o of tri0) {
    const a = o.t[0] * 3, b = o.t[1] * 3, c = o.t[2] * 3, ux = S0[b] - S0[a], uy = S0[b + 1] - S0[a + 1], uz = S0[b + 2] - S0[a + 2], vx = S0[c] - S0[a], vy = S0[c + 1] - S0[a + 1], vz = S0[c + 2] - S0[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (S0[a] + S0[b] + S0[c]) / 3, cy = (S0[a + 1] + S0[b + 1] + S0[c + 1]) / 3, cz = (S0[a + 2] + S0[b + 2] + S0[c + 2]) / 3;
    let ok;
    if (o.kind === 0) ok = nx * cx + ny * (cy - cav[1]) + nz * cz > 0;
    else if (o.kind === 1) ok = nx * (cav[0] - cx) + ny * (cav[1] - 0.1 - cy) + nz * (cav[2] - cz) > 0;
    else ok = ny < 0;
    if (!ok) o.t = [o.t[0], o.t[2], o.t[1]];
  }
  const tri = new Uint32Array(tri0.length * 3); tri0.forEach((o, i) => { tri[3 * i] = o.t[0]; tri[3 * i + 1] = o.t[1]; tri[3 * i + 2] = o.t[2]; });
  const nT = tri.length / 3;
  const el0 = new Float32Array(ne), el1 = new Float32Array(ne);
  for (let e = 0; e < ne; e++) { const a = E[2 * e] * 3, b = E[2 * e + 1] * 3; el0[e] = Math.hypot(S0[a] - S0[b], S0[a + 1] - S0[b + 1], S0[a + 2] - S0[b + 2]); el1[e] = Math.hypot(S1[a] - S1[b], S1[a + 1] - S1[b + 1], S1[a + 2] - S1[b + 2]); }
  const vol = (P, o) => { let v = 0; for (let t = 0; t < nT; t++) { const a = tri[3 * t] * 3 + o, b = tri[3 * t + 1] * 3 + o, c = tri[3 * t + 2] * 3 + o; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) + P[a + 1] * (P[b + 2] * P[c] - P[b] * P[c + 2]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); } return v / 6; };
  const V0 = vol(S0, 0), V1 = vol(S1, 0);
  // ---- render buffers (all jellies in one mesh): pos, normal, param (t, phi, layer, id)
  const J = { n: NJ, nv: NV * NJ, tri: new Uint32Array(nT * 3 * NJ), pos: new Float32Array(NV * NJ * 3), nrm: new Float32Array(NV * NJ * 3), rest4: new Float32Array(NV * NJ * 4), inst: new Float32Array(JF_INST * 12), count: 0, vol0: V0, tris: nT, active: 0, show: true };
  for (let j = 0; j < NJ; j++) {
    for (let i = 0; i < nT * 3; i++) J.tri[j * nT * 3 + i] = tri[i] + j * NV;
    for (let layer = 0; layer < 2; layer++) for (let r = 0; r <= JF_NR; r++) for (let s = 0; s < (r === 0 ? 1 : JF_NS); s++) {
      const v = (j * NV + (layer ? vi(r, s) : vo(r, s))) * 4; J.rest4[v] = r / JF_NR; J.rest4[v + 1] = s / JF_NS; J.rest4[v + 2] = layer; J.rest4[v + 3] = 0;
    }
  }
  // ---- per-jelly state
  const B = [];
  const P0 = [[0.6, 1.35], [2.7, 1.45], [2.0, -1.55]];
  for (let j = 0; j < NJ; j++) {
    const p = new Float32Array(NV * 3);
    B.push({ j, p, q: new Float32Array(NV * 3), v: new Float32Array(NV * 3), g: new Float32Array(NV * 3), ub: [0, 1, 0], fw: [1, 0, 0], psi: j * 2.1, ph: j * 0.37, per: 2.3 + 0.35 * j, c: 0, pc: 0, yT: 0.9 + 0.3 * j, wt: 0, tp: new Float32Array(JF_TENT * JF_TSEG * 3), tq: new Float32Array(JF_TENT * JF_TSEG * 3), op: new Float32Array(JF_ORAL * JF_OSEG * 3), oq: new Float32Array(JF_ORAL * JF_OSEG * 3), spin: 0 });
  }
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const basis = b => { // columns: right, up, fwd
    const u = b.ub; let f = [b.fw[0] - u[0] * (b.fw[0] * u[0] + b.fw[1] * u[1] + b.fw[2] * u[2]), b.fw[1] - u[1] * (b.fw[0] * u[0] + b.fw[1] * u[1] + b.fw[2] * u[2]), b.fw[2] - u[2] * (b.fw[0] * u[0] + b.fw[1] * u[1] + b.fw[2] * u[2])];
    if (Math.hypot(f[0], f[1], f[2]) < 1e-3) f = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    f = norm(f); b.fw = f;
    const r = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
    return [r, u, f];
  };
  function place(j, tilt) {
    const b = B[j], ang = j * 2.4 + 0.7; b.ub = norm([Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang)]); b.fw = [Math.cos(ang + 1.3), 0, Math.sin(ang + 1.3)];
    const [r, u, f] = basis(b), cx = P0[j][0], cz = P0[j][1];
    for (let i = 0; i < NV; i++) { const x = S0[3 * i], y = S0[3 * i + 1], z = S0[3 * i + 2]; b.p[3 * i] = cx + r[0] * x + u[0] * y + f[0] * z; b.p[3 * i + 1] = 0.30 + r[1] * x + u[1] * y + f[1] * z; b.p[3 * i + 2] = cz + r[2] * x + u[2] * y + f[2] * z; b.q[3 * i] = b.p[3 * i]; b.q[3 * i + 1] = b.p[3 * i + 1]; b.q[3 * i + 2] = b.p[3 * i + 2]; }
    b.v.fill(0); b.c = 0; b.pc = 0; b.wt = 0; b.psi = j * 2.1;
    for (let k = 0; k < JF_TENT; k++) tentInit(b, k);
    for (let k = 0; k < JF_ORAL; k++) oralInit(b, k);
  }
  const rimIdx = k => JF_HALF + vo(JF_NR, Math.round(k * JF_NS / JF_TENT)), oralIdx = k => JF_HALF + vo(1, Math.round(k * JF_NS / JF_ORAL));
  function tentInit(b, k) { const a = rimIdx(k) * 3; for (let s = 0; s < JF_TSEG; s++) { const o = (k * JF_TSEG + s) * 3; b.tp[o] = b.tq[o] = b.p[a] + (Math.sin(k + s) * 0.01); b.tp[o + 1] = b.tq[o + 1] = Math.max(0.012, b.p[a + 1] - s * 0.01); b.tp[o + 2] = b.tq[o + 2] = b.p[a + 2] + (Math.cos(k * 2 + s) * 0.01); } }
  function oralInit(b, k) { const a = oralIdx(k) * 3; for (let s = 0; s < JF_OSEG; s++) { const o = (k * JF_OSEG + s) * 3; b.op[o] = b.oq[o] = b.p[a]; b.op[o + 1] = b.oq[o + 1] = Math.max(0.012, b.p[a + 1] - s * 0.01); b.op[o + 2] = b.oq[o + 2] = b.p[a + 2]; } }
  // ---- shark spheres (subsampled surface lattice vertices) + hand colliders
  const sk = []; { const sv = world.surfV; for (let i = 0; i < sv.length; i += 4) sk.push(sv[i]); }
  const skx = new Float32Array(sk.length * 3); let sbb = [0, 0, 0, 0, 0, 0];
  const SKR = 0.5 * (world.H || 0.05) * 1.7;
  function updateShark() {
    const pos = world.pos; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < sk.length; i++) { const v = sk[i] * 3, x = pos[v], y = pos[v + 1], z = pos[v + 2]; skx[3 * i] = x; skx[3 * i + 1] = y; skx[3 * i + 2] = z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    sbb = [x0 - 0.1, y0 - 0.1, z0 - 0.1, x1 + 0.1, y1 + 0.1, z1 + 0.1];
  }
  const PR = 0.017;
  // colour ripple: every touch sends a ring of colour across the bell, then it fades back
  function touch(b, v) { if (v >= JF_HALF) v -= JF_HALF; if (tm - (b.lastEv || -9) < 0.28) return; b.lastEv = tm; (b.ev = b.ev || []).push({ v, t0: tm }); if (b.ev.length > 4) b.ev.shift(); }
  J.touch = (j, v) => touch(B[j], v);
  function ripple() {
    for (let j = 0; j < NJ; j++) {
      const b = B[j], ev = b.ev || []; while (ev.length && tm - ev[0].t0 > 2.2) ev.shift(); let gm = 0;
      for (let i = 0; i < NV; i++) {
        let g = 0;
        for (const e of ev) {
          const a = tm - e.t0, v = e.v * 3, dx = S0[3 * i] - S0[v], dy = S0[3 * i + 1] - S0[v + 1], dz = S0[3 * i + 2] - S0[v + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), f = d - 0.28 * a;
          g += Math.exp(-f * f / 0.0026) * (1 - a / 2.2) + Math.exp(-d * d / 0.003) * Math.max(0, 1 - a * 1.4) + 0.35 * Math.max(0, 1 - a / 2.2); // ring + flash + whole-bell tint that fades back
        }
        J.rest4[(j * NV + i) * 4 + 3] = Math.min(1, g); if (g > gm) gm = g;
      }
      b.glow = Math.min(1, gm);
    }
  }
  function collide(b, dt, hc, f0, f1) {
    const p = b.p, bb = sbb, ds = SKR + PR, ds2 = ds * ds;
    for (let i = 0; i < NV; i++) {
      const o = i * 3; let x = p[o], y = p[o + 1], z = p[o + 2];
      if (x > bb[0] && x < bb[3] && y > bb[1] && y < bb[4] && z > bb[2] && z < bb[5]) {
        for (let q = 0; q < sk.length; q++) {
          const dx = x - skx[3 * q]; if (dx > ds || dx < -ds) continue; const dy = y - skx[3 * q + 1]; if (dy > ds || dy < -ds) continue; const dz = z - skx[3 * q + 2]; if (dz > ds || dz < -ds) continue;
          const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= ds2) continue; const d = Math.sqrt(d2) || 1e-6, k = (ds - d) / d;
          x += dx * k; y += dy * k; z += dz * k;
        }
      }
      for (let h = 0; h < hc.n; h++) { // hand part = sphere swept from where it was to where it is in this sub-step
        const q = h * 8, A = hc.a, r = A[q + 3] + PR;
        const sx = A[q + 4] + (A[q] - A[q + 4]) * f0, sy = A[q + 5] + (A[q + 1] - A[q + 5]) * f0, sz = A[q + 6] + (A[q + 2] - A[q + 6]) * f0;
        const ex = A[q + 4] + (A[q] - A[q + 4]) * f1, ey = A[q + 5] + (A[q + 1] - A[q + 5]) * f1, ez = A[q + 6] + (A[q + 2] - A[q + 6]) * f1;
        const mx = ex - sx, my = ey - sy, mz = ez - sz, ml = Math.sqrt(mx * mx + my * my + mz * mz);
        const dx = x - ex, dy = y - ey, dz = z - ez, R = r + ml; if (dx > R || dx < -R || dy > R || dy < -R || dz > R || dz < -R) continue;
        if (ml > r * 0.15) { // moving finger: anything in its path is carried ahead of it, so a fast poke can't slip through the thin bell
          const ux = mx / ml, uy = my / ml, uz = mz / ml, al = dx * ux + dy * uy + dz * uz, lx = dx - ux * al, ly = dy - uy * al, lz = dz - uz * al, lat = Math.sqrt(lx * lx + ly * ly + lz * lz);
          if (lat < r && al > -(ml + r) && al < 0) { const ahead = Math.sqrt(Math.max(0, r * r - lat * lat)) * 0.9; x += ux * (ahead - al); y += uy * (ahead - al); z += uz * (ahead - al); touch(b, i); continue; }
        }
        const fx = x - ex, fy = y - ey, fz = z - ez, d2 = fx * fx + fy * fy + fz * fz; if (d2 >= r * r) continue; const d = Math.sqrt(d2) || 1e-6, k = (r - d) / d;
        x += fx * k; y += fy * k; z += fz * k; touch(b, i);
      }
      if (y < PR) { y = PR; const mx = x - b.q[o], mz = z - b.q[o + 2]; x = b.q[o] + mx * 0.55; z = b.q[o + 2] + mz * 0.55; }
      p[o] = x; p[o + 1] = y; p[o + 2] = z; roomPush(p, o, PR);
    }
  }
  function sub(b, dt, act, hc, centre, ub, f0, f1) {
    const p = b.p, q = b.q, v = b.v, ig = act > 0.02;
    const [R, U, F] = ub, Fm = J.firm, kg = 0.003 + 0.032 * Fm * Fm + 0.2 * act * act, ks = 0.25 + 0.75 * Fm, c = b.c, grav = 9.0 * (1 - 0.985 * act);
    // integrate
    for (let i = 0; i < NV * 3; i += 3) {
      q[i] = p[i]; q[i + 1] = p[i + 1]; q[i + 2] = p[i + 2];
      v[i + 1] -= grav * dt; const dm = Math.exp(-(0.2 + 2.6 * J.damp * (1 - 0.75 * act) + 0.45 * act) * dt); v[i] *= dm; v[i + 1] *= dm; v[i + 2] *= dm;
      p[i] += v[i] * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt;
    }
    // edges (rest lengths follow the pulse)
    for (let it = 0; it < 2; it++) {
      for (let e = 0; e < ne; e++) {
        const a = E[2 * e] * 3, bb = E[2 * e + 1] * 3, dx = p[bb] - p[a], dy = p[bb + 1] - p[a + 1], dz = p[bb + 2] - p[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
        const L = el0[e] + (el1[e] - el0[e]) * c, k = (ET[e] === 0 ? 0.55 : ET[e] === 1 ? 0.3 : 0.2) * ks * (d - L) / d * 0.5;
        p[a] += dx * k; p[a + 1] += dy * k; p[a + 2] += dz * k; p[bb] -= dx * k; p[bb + 1] -= dy * k; p[bb + 2] -= dz * k;
      }
      volumeFix(b, V0 + (V1 - V0) * c);
    }
    // soft shape goal around the current centroid
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < NV; i++) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; } cx /= NV; cy /= NV; cz /= NV;
    for (let i = 0; i < NV; i++) {
      const x = S0[3 * i] + (S1[3 * i] - S0[3 * i]) * c, y = S0[3 * i + 1] + (S1[3 * i + 1] - S0[3 * i + 1]) * c, z = S0[3 * i + 2] + (S1[3 * i + 2] - S0[3 * i + 2]) * c;
      const gx = cx + R[0] * x + U[0] * y + F[0] * z, gy = cy + R[1] * x + U[1] * y + F[1] * z, gz = cz + R[2] * x + U[2] * y + F[2] * z;
      p[3 * i] += (gx - p[3 * i]) * kg; p[3 * i + 1] += (gy - p[3 * i + 1]) * kg; p[3 * i + 2] += (gz - p[3 * i + 2]) * kg;
    }
    for (const gr of grabs.values()) if (gr.j === b.j && gr.tg) { // held by a hand/pointer: drag the nearby gel toward the target
      for (let n = 0; n < gr.idx.length; n++) { const i = gr.idx[n] * 3, w = gr.w[n] * 0.45; p[i] += (gr.tg[0] + gr.off[3 * n] - p[i]) * w; p[i + 1] += (gr.tg[1] + gr.off[3 * n + 1] - p[i + 1]) * w; p[i + 2] += (gr.tg[2] + gr.off[3 * n + 2] - p[i + 2]) * w; }
    }
    collide(b, dt, hc, f0, f1);
    const id = 1 / dt; for (let i = 0; i < NV * 3; i++) v[i] = (p[i] - q[i]) * id;
  }
  const gradv = new Float32Array(NV * 3);
  function volumeFix(b, Vt) {
    const p = b.p; let cx = 0, cy = 0, cz = 0; for (let i = 0; i < NV; i++) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; } cx /= NV; cy /= NV; cz /= NV;
    gradv.fill(0); let V = 0;
    for (let t = 0; t < nT; t++) {
      const a = tri[3 * t] * 3, bb = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
      const ax = p[a] - cx, ay = p[a + 1] - cy, az = p[a + 2] - cz, bx = p[bb] - cx, by = p[bb + 1] - cy, bz = p[bb + 2] - cz, qx = p[c] - cx, qy = p[c + 1] - cy, qz = p[c + 2] - cz;
      V += (ax * (by * qz - bz * qy) + ay * (bz * qx - bx * qz) + az * (bx * qy - by * qx)) / 6;
      gradv[a] += (by * qz - bz * qy) / 6; gradv[a + 1] += (bz * qx - bx * qz) / 6; gradv[a + 2] += (bx * qy - by * qx) / 6;
      gradv[bb] += (qy * az - qz * ay) / 6; gradv[bb + 1] += (qz * ax - qx * az) / 6; gradv[bb + 2] += (qx * ay - qy * ax) / 6;
      gradv[c] += (ay * bz - az * by) / 6; gradv[c + 1] += (az * bx - ax * bz) / 6; gradv[c + 2] += (ax * by - ay * bx) / 6;
    }
    let s = 0; for (let i = 0; i < NV * 3; i++) s += gradv[i] * gradv[i];
    if (s < 1e-12) return; const lam = (Vt - V) / s * 0.8;
    for (let i = 0; i < NV * 3; i++) p[i] += gradv[i] * lam;
  }
  function chain(P, Q, base, n, len, anchor, dt, G, drag, floorY, hc) {
    P[base] = anchor[0]; P[base + 1] = anchor[1]; P[base + 2] = anchor[2];
    for (let s = 1; s < n; s++) {
      const o = base + s * 3, x = P[o], y = P[o + 1], z = P[o + 2];
      P[o] = x + (x - Q[o]) * drag + G[0] * dt * dt; P[o + 1] = y + (y - Q[o + 1]) * drag + G[1] * dt * dt; P[o + 2] = z + (z - Q[o + 2]) * drag + G[2] * dt * dt; Q[o] = x; Q[o + 1] = y; Q[o + 2] = z;
    }
    for (let it = 0; it < 3; it++) {
      P[base] = anchor[0]; P[base + 1] = anchor[1]; P[base + 2] = anchor[2];
      for (let s = 1; s < n; s++) {
        const a = base + (s - 1) * 3, o = base + s * 3, dx = P[o] - P[a], dy = P[o + 1] - P[a + 1], dz = P[o + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - len) / d;
        if (s === 1) { P[o] -= dx * k; P[o + 1] -= dy * k; P[o + 2] -= dz * k; } else { P[a] += dx * k * 0.5; P[a + 1] += dy * k * 0.5; P[a + 2] += dz * k * 0.5; P[o] -= dx * k * 0.5; P[o + 1] -= dy * k * 0.5; P[o + 2] -= dz * k * 0.5; }
      }
      for (let s = 1; s < n; s++) { const o = base + s * 3 + 1; if (P[o] < floorY) { P[o] = floorY; } roomPush(P, o - 1, 0.004); }
      if (hc && hc.n) for (let s = 1; s < n; s++) { const o = base + s * 3; for (let h = 0; h < hc.n; h++) { const q = h * 8, r = hc.a[q + 3] + 0.008, dx = P[o] - hc.a[q], dy = P[o + 1] - hc.a[q + 1], dz = P[o + 2] - hc.a[q + 2]; if (dx > r || dx < -r || dy > r || dy < -r || dz > r || dz < -r) continue; const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r * r) continue; const d = Math.sqrt(d2) || 1e-6, k = (r - d) / d; P[o] += dx * k; P[o + 1] += dy * k; P[o + 2] += dz * k; } }
    }
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let swimOn = false, tm = 0;
  J.firm = 0.55; J.damp = 0.35;
  J.setParams = (f, d) => { J.firm = f; J.damp = d; };
  let hold = false, swish = false; // hold: swim switched off -> stay put where they are (pulse in place only while the shark swishes its tail)
  J.setSwim = (v, sw) => { v = !!v; if (swimOn && !v) { hold = true; const c = J.centres(); for (let j = 0; j < NJ; j++) { B[j].anc = c[j]; B[j].free = 0; } } if (v) hold = false; swimOn = v; swish = !!sw; };
  J.reset = () => { grabs.clear(); for (let j = 0; j < NJ; j++) place(j, 1.25 + 0.2 * j); J.active = 0; swimOn = false; hold = false; skin(); };
  function skin() {
    for (let j = 0; j < NJ; j++) J.pos.set(B[j].p, j * NV * 3);
    for (let j = 0; j < NJ; j++) {
      const o = j * NV * 3, out = J.nrm; for (let i = o; i < o + NV * 3; i++) out[i] = 0;
      for (let t = 0; t < nT; t++) {
        const a = o + tri[3 * t] * 3, b = o + tri[3 * t + 1] * 3, c = o + tri[3 * t + 2] * 3, P = J.pos;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        out[a] += nx; out[a + 1] += ny; out[a + 2] += nz; out[b] += nx; out[b + 1] += ny; out[b + 2] += nz; out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
      }
      for (let i = o; i < o + NV * 3; i += 3) { const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1; out[i] /= l; out[i + 1] /= l; out[i + 2] /= l; }
    }
  }
  J.step = (dt) => {
    dt = Math.min(dt, 1 / 30); tm += dt;
    J.active += ((swimOn || hold ? 1 : 0) - J.active) * Math.min(1, dt * (swimOn || hold ? 0.9 : 3)); const act = J.active;
    updateShark(); const hc = world.cols();
    const cen = []; for (let j = 0; j < NJ; j++) { const p = B[j].p; let x = 0, y = 0, z = 0; for (let i = 0; i < NV; i++) { x += p[3 * i]; y += p[3 * i + 1]; z += p[3 * i + 2]; } cen.push([x / NV, y / NV, z / NV]); }
    const NSUB = hc.n ? 4 : 3, h = dt / NSUB;
    for (let j = 0; j < NJ; j++) {
      const b = B[j], c0 = cen[j];
      // pulse + steering
      if (act > 0.35 && hold) {
        let held = false; for (const g of grabs.values()) if (g.j === j) held = true;
        if (held) b.free = 1.5; else if (b.free > 0) b.free -= dt;
        if (held || b.free > 0 || !b.anc) b.anc = c0.slice(); // moved/thrown by a hand: settle where it ends up
        if (swish) { b.ph += dt / b.per; const x = b.ph % 1, cc = x < 0.28 ? sm(0, 1, x / 0.28) : 1 - sm(0, 1, (x - 0.28) / 0.72); b.pc = cc; b.c = cc; }
        else { b.c *= Math.max(0, 1 - dt * 3); b.pc = b.c; }
        const kk = Math.min(1, dt * 1.2); b.ub = norm([b.ub[0] * (1 - kk), b.ub[1] + (1 - b.ub[1]) * kk, b.ub[2] * (1 - kk)]);
        const ks = swish ? 2.0 : 3.0, kd = Math.exp(-(swish ? 1.2 : 3.5) * dt), ax = (b.anc[0] - c0[0]) * ks * dt, ay = (b.anc[1] - c0[1]) * ks * dt + 0.135 * dt, az = (b.anc[2] - c0[2]) * ks * dt;
        for (let i = 0; i < NV; i++) { b.v[3 * i] = b.v[3 * i] * kd + ax; b.v[3 * i + 1] = b.v[3 * i + 1] * kd + ay; b.v[3 * i + 2] = b.v[3 * i + 2] * kd + az; }
      } else if (act > 0.35) {
        b.ph += dt / b.per; const x = b.ph % 1, cc = x < 0.28 ? sm(0, 1, x / 0.28) : 1 - sm(0, 1, (x - 0.28) / 0.72);
        const dc = Math.max(0, cc - b.pc); b.pc = cc; b.c = cc;
        // wander between random waypoints spread over the whole dish, each chosen away from the other jellies
        b.wt += dt;
        const pickW = () => { let best = null, bs = -1; for (let t = 0; t < 12; t++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * JF_RAD * 0.85, w = [JF_CENTER[0] + Math.cos(a) * r, 0.45 + Math.random() * 1.45, JF_CENTER[1] + Math.sin(a) * r]; let sc = Math.hypot(w[0] - c0[0], w[2] - c0[2]) * 0.4; for (let k = 0; k < NJ; k++) if (k !== j) { sc += Math.min(Math.hypot(w[0] - cen[k][0], w[1] - cen[k][1], w[2] - cen[k][2]), B[k].wp ? Math.hypot(w[0] - B[k].wp[0], w[1] - B[k].wp[1], w[2] - B[k].wp[2]) : 9); } if (sc > bs) { bs = sc; best = w; } } return best; };
        if (!b.wp || b.wt > 9 || Math.hypot(b.wp[0] - c0[0], b.wp[1] - c0[1], b.wp[2] - c0[2]) < 0.3) { b.wp = pickW(); b.wt = 0; }
        let hx = b.wp[0] - c0[0], hy = b.wp[1] - c0[1], hz = b.wp[2] - c0[2];
        { const l = Math.hypot(hx, hy, hz) || 1; hx /= l; hy /= l; hz /= l; }
        hx += Math.sin(tm * 0.37 + j * 2) * 0.25; hz += Math.cos(tm * 0.29 + j) * 0.25;
        for (let k = 0; k < NJ; k++) if (k !== j) { const dx = c0[0] - cen[k][0], dy = c0[1] - cen[k][1], dz = c0[2] - cen[k][2], d = Math.hypot(dx, dy, dz) || 1; if (d < 1.0) { const w = (1.0 - d) / 1.0 * 3.0; hx += dx / d * w; hy += dy / d * w; hz += dz / d * w; } }
        { const ox = c0[0] - JF_CENTER[0], oz = c0[2] - JF_CENTER[1], orr = Math.hypot(ox, oz); if (orr > JF_RAD * 0.85) { const w = (orr - JF_RAD * 0.85) * 6; hx -= ox / orr * w; hz -= oz / orr * w; } }
        if (c0[1] < 0.35) hy += 1.5; if (c0[1] > 2.0) hy -= 1.5;
        const dl = Math.hypot(hx, hy, hz) || 1; hx /= dl; hy /= dl; hz /= dl;
        b.fw = norm([hx, 0, hz]); b.psi = Math.atan2(hz, hx);
        const ud = norm([hx * 0.85, Math.max(0.35, hy + 0.55), hz * 0.85]); // apex leads the way, tilted toward travel
        const kk = Math.min(1, dt * 1.8); b.ub = norm([b.ub[0] + (ud[0] - b.ub[0]) * kk, b.ub[1] + (ud[1] - b.ub[1]) * kk, b.ub[2] + (ud[2] - b.ub[2]) * kk]);
        const th = 0.6 * act * dc * 2.4, fy = c0[1] > 2.05 ? 0 : Math.max(0, Math.min(1.2, 0.55 + (b.wp[1] - c0[1]) * 1.6));
        for (let i = 0; i < NV; i++) { b.v[3 * i] += b.ub[0] * th + hx * th * 0.35; b.v[3 * i + 1] += b.ub[1] * th * 0.8 * fy; b.v[3 * i + 2] += b.ub[2] * th + hz * th * 0.35; }
      } else { // limp: track the real posture so the goal never fights it
        const a = b.p, ux = a[0] - c0[0], uy = a[1] - c0[1], uz = a[2] - c0[2]; b.ub = norm([b.ub[0] + (ux - b.ub[0]) * 0.3, b.ub[1] + (uy - b.ub[1]) * 0.3, b.ub[2] + (uz - b.ub[2]) * 0.3]); b.c *= 0.96; b.pc = b.c;
      }
    }
    for (let s = 0; s < NSUB; s++) {
      for (let j = 0; j < NJ; j++) sub(B[j], h, act, hc, cen[j], basis(B[j]), s / NSUB, (s + 1) / NSUB);
      // jellies never merge: push whole bodies apart
      for (let a = 0; a < NJ; a++) for (let c = a + 1; c < NJ; c++) {
        let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0; const pa = B[a].p, pb = B[c].p;
        for (let i = 0; i < NV; i++) { ax += pa[3 * i]; ay += pa[3 * i + 1]; az += pa[3 * i + 2]; bx += pb[3 * i]; by += pb[3 * i + 1]; bz += pb[3 * i + 2]; }
        ax /= NV; ay /= NV; az /= NV; bx /= NV; by /= NV; bz /= NV;
        const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1e-6, D0 = 0.5;
        if (d < D0) { const k = (D0 - d) / d * 0.5; for (let i = 0; i < NV; i++) { pa[3 * i] -= dx * k; pa[3 * i + 1] -= dy * k; pa[3 * i + 2] -= dz * k; pb[3 * i] += dx * k; pb[3 * i + 1] += dy * k; pb[3 * i + 2] += dz * k; } }
      }
    }
    // tentacles
    for (let j = 0; j < NJ; j++) {
      const b = B[j], u = b.ub, gw = 0.6 + 2.6 * (1 - act), gb = 3.2 * act, G = [-u[0] * gb, -gw - u[1] * gb, -u[2] * gb], G2 = [G[0] * 1.3, G[1] * 1.3, G[2] * 1.3];
      for (let k = 0; k < JF_TENT; k++) { const a = rimIdx(k) * 3; chain(b.tp, b.tq, k * JF_TSEG * 3, JF_TSEG, 0.034 + 0.009 * ((k * 7) % 5) / 4, [b.p[a], b.p[a + 1], b.p[a + 2]], dt, G, 0.95, 0.01, hc); }
      for (let k = 0; k < JF_ORAL; k++) { const a = oralIdx(k) * 3; chain(b.op, b.oq, k * JF_OSEG * 3, JF_OSEG, 0.034, [b.p[a], b.p[a + 1], b.p[a + 2]], dt, G2, 0.94, 0.012, hc); }
    }
    ripple(); skin();
  };
  // segment as a stretched bead: local x along the segment
  const qx2d = (dx, dy, dz) => { let x = 0, y = -dz, z = dy, w = 1 + dx; if (w < 1e-4) { x = 0; y = 0; z = 1; w = 0; } const l = Math.hypot(x, y, z, w); return [x / l, y / l, z / l, w / l]; };
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  let curJ = 0;
  J.fill = () => {
    let n = 0; const I = J.inst; if (!J.show) { J.count = 0; return 0; }
    const put = (x, y, z, q, sx, sy, sz, sh) => { const o = n * 12; I[o] = x; I[o + 1] = y; I[o + 2] = z; I[o + 3] = 7 + 0.45 * (B[curJ].glow || 0); I[o + 4] = q[0]; I[o + 5] = q[1]; I[o + 6] = q[2]; I[o + 7] = q[3]; I[o + 8] = sx; I[o + 9] = sy; I[o + 10] = sz; I[o + 11] = sh; n++; };
    for (let j = 0; j < NJ; j++) {
      const b = B[j]; curJ = j;
      // long fine tentacles from the rim
      for (let k = 0; k < JF_TENT; k++) for (let s = 0; s < JF_TSEG - 1; s++) {
        const o = (k * JF_TSEG + s) * 3, o2 = o + 3, P = b.tp, dx = P[o2] - P[o], dy = P[o2 + 1] - P[o + 1], dz = P[o2 + 2] - P[o + 2], l = Math.hypot(dx, dy, dz) || 1e-6, t = s / (JF_TSEG - 2);
        put((P[o] + P[o2]) / 2, (P[o + 1] + P[o2 + 1]) / 2, (P[o + 2] + P[o2 + 2]) / 2, qx2d(dx / l, dy / l, dz / l), l * 0.62, 0.0034 * (1 - 0.5 * t), 0.0034 * (1 - 0.5 * t), 0.05 + 0.4 * t);
      }
      // frilly oral arms: twisted, ruffled ribbons hanging from the centre
      for (let k = 0; k < JF_ORAL; k++) for (let s = 0; s < JF_OSEG - 1; s++) {
        const o = (k * JF_OSEG + s) * 3, o2 = o + 3, P = b.op, dx = P[o2] - P[o], dy = P[o2 + 1] - P[o + 1], dz = P[o2 + 2] - P[o + 2], l = Math.hypot(dx, dy, dz) || 1e-6, t = s / (JF_OSEG - 2);
        const qd = qx2d(dx / l, dy / l, dz / l), wdt = 0.03 * (1 - 0.55 * t) + 0.005;
        for (let f = 0; f < JF_FR; f++) {
          const u = (f + 0.5) / JF_FR, ang = k * 1.57 + (s + u) * 1.9 + Math.sin(tm * 1.3 + s + k) * 0.35, ha = ang / 2, qr = qmul(qd, [Math.sin(ha), 0, 0, Math.cos(ha)]);
          const wob = Math.sin((s + u) * 3.1 + k * 2 + tm * 0.9) * 0.012;
          put(P[o] + dx * u + wob * (k & 1 ? 1 : -1), P[o + 1] + dy * u, P[o + 2] + dz * u + wob, qr, l * 0.85, wdt * (0.8 + 0.35 * Math.sin((s + u) * 5.3 + k)), 0.0035, 0.55 + 0.45 * t);
        }
      }
      // glowing manubrium under the bell
      { const c2 = JF_HALF * 3, u = b.ub; put(b.p[c2] - u[0] * 0.02, b.p[c2 + 1] - u[1] * 0.02, b.p[c2 + 2] - u[2] * 0.02, [0, 0, 0, 1], 0.028, 0.021, 0.028, 0.52); }
    }
    J.count = n; return n;
  };
  const grabs = new Map();
  J.pick = (ro, rd, maxPerp = 0.07) => { // ray -> nearest jelly surface vertex
    let best = null;
    for (let j = 0; j < NJ; j++) { const p = B[j].p; for (let v = 0; v < NV; v++) { const i = v * 3, vx = p[i] - ro[0], vy = p[i + 1] - ro[1], vz = p[i + 2] - ro[2], t = vx * rd[0] + vy * rd[1] + vz * rd[2]; if (t <= 0) continue; const d = Math.hypot(vx - rd[0] * t, vy - rd[1] * t, vz - rd[2] * t); if (d < maxPerp && (!best || t < best.t)) best = { j, v, t }; } }
    return best;
  };
  J.near = (q, r) => { let best = null, bd = r; for (let j = 0; j < NJ; j++) { const p = B[j].p; for (let v = 0; v < NV; v++) { const d = Math.hypot(p[3 * v] - q[0], p[3 * v + 1] - q[1], p[3 * v + 2] - q[2]); if (d < bd) { bd = d; best = { j, v, t: d }; } } } return best; };
  J.grab = (id, h) => {
    const p = B[h.j].p, cx = p[3 * h.v], cy = p[3 * h.v + 1], cz = p[3 * h.v + 2], idx = [], w = [], off = [], R0 = 0.11;
    for (let v = 0; v < NV; v++) { const d = Math.hypot(p[3 * v] - cx, p[3 * v + 1] - cy, p[3 * v + 2] - cz); if (d < R0) { idx.push(v); w.push(1 - d / R0 * 0.8); off.push(p[3 * v] - cx, p[3 * v + 1] - cy, p[3 * v + 2] - cz); } }
    touch(B[h.j], h.v);
    grabs.set(id, { j: h.j, idx, w, off, tg: [cx, cy, cz], c0: [cx, cy, cz] }); return [cx, cy, cz];
  };
  J.move = (id, tg) => { const g = grabs.get(id); if (g) g.tg = [tg[0], Math.max(0.02, tg[1]), tg[2]]; };
  J.release = id => { if (id === undefined) grabs.clear(); else grabs.delete(id); };
  J.grabbed = id => grabs.get(id);
  J.centres = () => B.map(b => { const p = b.p; let x = 0, y = 0, z = 0; for (let i = 0; i < NV; i++) { x += p[3 * i]; y += p[3 * i + 1]; z += p[3 * i + 2]; } return [x / NV, y / NV, z / NV]; });
  J.volumeRatio = () => B.map(b => vol(b.p, 0) / (V0 + (V1 - V0) * b.c));
  J.reset();
  return J;
}
