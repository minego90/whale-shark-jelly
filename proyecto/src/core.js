//#region CORE
'use strict';
let H = 0.04, YM = 0.10;
const YOFF = 0.32;
const LB = 3.0, G_ACC = 14.0, FLOOR_MU = 0.35;
const MOUTH = { c: [0.02, 0.55, 0.0], r: [0.26, 0.03, 0.24] };
const PROFILE = [
  [0.000, 0.240, 0.270], [0.047, 0.330, 0.320], [0.093, 0.360, 0.360], [0.137, 0.370, 0.400],
  [0.183, 0.375, 0.450], [0.227, 0.375, 0.480], [0.273, 0.370, 0.500], [0.370, 0.330, 0.470],
  [0.457, 0.250, 0.430], [0.547, 0.210, 0.370], [0.637, 0.170, 0.310], [0.727, 0.145, 0.260],
  [0.817, 0.120, 0.170], [0.907, 0.090, 0.110], [1.000, 0.055, 0.070]];
const PT = PROFILE.map(r => r[0]), PW = PROFILE.map(r => r[1]), PH = PROFILE.map(r => r[2]);
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function tang(arr, i) {
  const n = PT.length;
  if (i === 0) return (arr[1] - arr[0]) / (PT[1] - PT[0]);
  if (i === n - 1) return (arr[n - 1] - arr[n - 2]) / (PT[n - 1] - PT[n - 2]);
  return (arr[i + 1] - arr[i - 1]) / (PT[i + 1] - PT[i - 1]);
}
function interp(arr, t) {
  let i = 0; while (i < PT.length - 2 && t > PT[i + 1]) i++;
  const t0 = PT[i], t1 = PT[i + 1], u = (t - t0) / (t1 - t0), h = t1 - t0, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * arr[i] + (u3 - 2 * u2 + u) * h * tang(arr, i) + (-2 * u3 + 3 * u2) * arr[i + 1] + (u3 - u2) * h * tang(arr, i + 1);
}
function profileAt(a) {
  const t = Math.min(Math.max(a / LB, 0), 1);
  const W = interp(PW, t), Ht = interp(PH, t), b = 0.55 * Ht;
  return { W, Ht, b, cy: Ht - b };
}
const RIDGE_TH = [0.30, 0.64, 1.00];
function bodySdf(a, y, z) {
  const { W, b, cy } = profileAt(a);
  const py = y - cy;
  const k0 = Math.hypot(z / W, py / b), k1 = Math.hypot(z / (W * W), py / (b * b));
  let d = k1 < 1e-6 ? -Math.min(W, b) : k0 * (k0 - 1) / k1;
  if (py > 0) {
    const th = Math.abs(Math.atan2(z / W, py / b)), R = Math.sqrt(W * b);
    let s = 0; for (const r of RIDGE_TH) { const q = (th - r) * R / 0.016; s += Math.exp(-0.5 * q * q); }
    d -= s * 0.008 * smooth(0.05, 0.15, W) * smooth(0.0, 0.12, a);
  }
  d = Math.max(d, -y);
  d = smax(d, -(a + 0.05 * Math.min(1, (z / 0.2) * (z / 0.2))), 0.07); // rounded, shovel-shaped snout
  d = smax(d, a - 0.985 * LB, 0.05);
  return d;
}
function mouthSdf(a, y, z) {
  const px = a - MOUTH.c[0], py = y - MOUTH.c[1], pz = z, r = MOUTH.r;
  const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
  return k1 < 1e-9 ? -r[1] : k0 * (k0 - 1) / k1;
}
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// One fin recipe: triangle, convex leading edge, falcate trailing edge, thinning to the tip.
function makeFin(o) {
  const S = nrm3(o.S);
  let Cd = o.Cd || [1, 0, 0]; const dd = dot3(Cd, S); Cd = nrm3([Cd[0] - S[0] * dd, Cd[1] - S[1] * dd, Cd[2] - S[2] * dd]);
  const N = o.flat ? [0, 1, 0] : nrm3(cross3(S, Cd));
  return Object.assign({ tau0: 0.040, tauTip: 0.021 }, o, { S, Cd, N });
}
function finSdf(f, x, y, z, tk = 1, tmin = 0) {
  const rx = x - f.O[0], ry = y - f.O[1], rz = z - f.O[2];
  const q = rx * f.S[0] + ry * f.S[1] + rz * f.S[2];
  const p = rx * f.Cd[0] + ry * f.Cd[1] + rz * f.Cd[2];
  let n = rx * f.N[0] + ry * f.N[1] + rz * f.N[2];
  const eta = Math.min(Math.max(q / f.Sp, 0), 1);
  const pL = f.tipP * Math.pow(eta, 1.5), pT = f.C + (f.tipP - f.C) * (1 - (1 - eta) * (1 - eta));
  const sL = (q > 0 && q < f.Sp) ? f.tipP * 1.5 * Math.sqrt(eta) / f.Sp : 0;
  const sT = (q > 0 && q < f.Sp) ? (f.tipP - f.C) * 2 * (1 - eta) / f.Sp : 0;
  const dL = (pL - p) / Math.sqrt(1 + sL * sL), dT = (p - pT) / Math.sqrt(1 + sT * sT);
  const d2 = Math.max(dL, dT, q - f.Sp, -q - 0.05);
  const tau = Math.max(tmin, (f.tauTip + (f.tau0 - f.tauTip) * Math.pow(1 - eta, 1.2)) * tk);
  if (f.flat) n = y - tau;
  const dn = Math.abs(n) - tau;
  return Math.min(Math.max(d2, dn), 0) + Math.hypot(Math.max(d2, 0), Math.max(dn, 0));
}
const FINS = [
  // first dorsal: far back, swept; second dorsal: small
  { name: 'dorsal1', O: [1.55, 0.22, 0], S: [0.37, 1, 0], Cd: [1, 0, 0], Sp: 0.46, C: 0.40, tipP: 0.24 },
  { name: 'dorsal2', O: [2.28, 0.14, 0], S: [0.45, 1, 0], Cd: [1, 0, 0], Sp: 0.16, C: 0.15, tipP: 0.09 },
  // long sickle pectorals
  { name: 'pectL', flat: 1, O: [0.92, 0, 0.25], S: [0.12, 0, 1], Cd: [1, 0, 0], Sp: 0.50, C: 0.45, tipP: 0.29 },
  { name: 'pectR', flat: 1, O: [0.92, 0, -0.25], S: [0.12, 0, -1], Cd: [1, 0, 0], Sp: 0.50, C: 0.45, tipP: 0.29 },
  // pelvics, anal
  { name: 'pelvL', flat: 1, O: [2.05, 0, 0.08], S: [0.45, 0, 1], Cd: [1, 0, 0], Sp: 0.22, C: 0.17, tipP: 0.13 },
  { name: 'pelvR', flat: 1, O: [2.05, 0, -0.08], S: [0.45, 0, -1], Cd: [1, 0, 0], Sp: 0.22, C: 0.17, tipP: 0.13 },
  { name: 'anal', flat: 1, O: [2.38, 0, 0.04], S: [0.5, 0, 1], Cd: [1, 0, 0], Sp: 0.17, C: 0.14, tipP: 0.09 },
  // caudal keels
  { name: 'keelL', flat: 1, O: [2.70, 0, 0.04], S: [0.4, 0, 1], Cd: [1, 0, 0], Sp: 0.09, C: 0.18, tipP: 0.12 },
  { name: 'keelR', flat: 1, O: [2.70, 0, -0.04], S: [0.4, 0, -1], Cd: [1, 0, 0], Sp: 0.09, C: 0.18, tipP: 0.12 },
  // tall crescent tail: upper lobe + lower lobe along the table
  { name: 'tailUp', O: [2.74, 0.02, 0], S: [0.28, 1, 0], Cd: [1, 0, 0], Sp: 0.56, C: 0.28, tipP: 0.38 },
  { name: 'tailLo', O: [2.76, 0.0, 0], S: [1, 0.10, 0], Cd: [0, 1, 0], Sp: 0.34, C: 0.19, tipP: 0.12 },
].map(makeFin);

function gridSdf(a, y, z) {
  z = Math.abs(z); // keep the body exactly left/right symmetric
  const M = GRID_META, n = M.n, r = M.res;
  let fx = (a - M.o[0]) / r - 0.5, fy = (y - M.o[1]) / r - 0.5, fz = (z - M.o[2]) / r - 0.5;
  const cx = Math.min(Math.max(fx, 0), n[0] - 1.001), cy = Math.min(Math.max(fy, 0), n[1] - 1.001), cz = Math.min(Math.max(fz, 0), n[2] - 1.001);
  const dx = fx - cx, dy = fy - cy, dz = fz - cz;
  const i = cx | 0, j = cy | 0, k = cz | 0, u = cx - i, v = cy - j, w = cz - k, sy = n[2], sx = n[1] * n[2], g = GRID, b = i * sx + j * sy + k;
  const q = (o) => (g[b + o] - 128) * (M.sc / 127);
  const c00 = q(0) * (1 - w) + q(1) * w, c01 = q(sy) * (1 - w) + q(sy + 1) * w, c10 = q(sx) * (1 - w) + q(sx + 1) * w, c11 = q(sx + sy) * (1 - w) + q(sx + sy + 1) * w;
  const d = (c00 * (1 - v) + c01 * v) * (1 - u) + (c10 * (1 - v) + c11 * v) * u;
  return d + Math.hypot(dx, dy, dz) * r;
}
// render surface: thin, elegant fins and a clean terminal mouth (the lattice below only drives it)
function sdfRender(a, y, z) {
  let d = gridSdf(a, y, z) + 0.002;
  const u = (a - MOUTH.c[0]) / MOUTH.r[0], w = z / MOUTH.r[2];
  const dm = smax((Math.hypot(u, w) - 1) * 0.16, Math.abs(y - YM) - 0.5 * H, 0.010);
  d = smax(d, -dm, 0.005);
  return Math.max(d, -y);
}
function sdfCore(a, y, z) { // inner milky gel core (belly side), body only
  let d = gridSdf(a, y, z) + 0.05;
  d = smax(d, y - (YOFF + 0.23), 0.05); d = smax(d, 0.14 - a, 0.05); d = smax(d, a - 2.45, 0.05);
  const u = (a - MOUTH.c[0]) / MOUTH.r[0], w = z / MOUTH.r[2];
  d = smax(d, -((Math.hypot(u, w) - 1) * 0.16 - 0.05), 0.03);
  return d;
}

function sdfAll(a, y, z) {
  let d = gridSdf(a, y, z) - 0.012;
  d = smax(d, -mouthSdf(a, y, z), 0.01);
  return Math.max(d, -y);
}

// ---------------------------------------------------------------- lattice
const CORNER = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const TETS_EVEN = [[1, 2, 4, 7], [0, 1, 2, 4], [3, 1, 2, 7], [5, 1, 4, 7], [6, 2, 4, 7]];
const TETS_ODD = [[0, 3, 5, 6], [1, 0, 3, 5], [2, 0, 3, 6], [4, 0, 5, 6], [7, 3, 5, 6]];
const FACES = [[1, 3, 7, 5, 1, 0, 0], [0, 4, 6, 2, -1, 0, 0], [2, 6, 7, 3, 0, 1, 0], [0, 1, 5, 4, 0, -1, 0], [4, 5, 7, 6, 0, 0, 1], [0, 2, 3, 1, 0, 0, -1]];

function buildLattice() {
  const X0 = -0.1, NX = Math.ceil(3.6 / H), NY = Math.ceil(1.0 / H), ZH = Math.ceil(0.86 / H), NZ = 2 * ZH + 1;
  const JM = Math.max(1, Math.round(0.546 / H - 0.5)); YM = (JM + 0.5) * H; MOUTH.c[1] = YM; MOUTH.r[1] = 0.75 * H;
  const vIdx = (i, j, k) => (k * (NY + 1) + j) * (NX + 1) + i;
  const cIdx = (i, j, k) => (k * NY + j) * NX + i;
  const inc = new Uint8Array(NX * NY * NZ), inner = new Uint8Array(NX * NY * NZ), fin = new Uint8Array(NX * NY * NZ);
  const sd = new Float32Array(NX * NY * NZ);
  const cellAt = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) ? 0 : inc[cIdx(i, j, k)];
  const cx = i => X0 + (i + 0.5) * H, cy = j => (j + 0.5) * H, cz = k => (k - ZH) * H;
  const mouthCell = new Uint8Array(NX * NY * NZ);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = cx(i), y = cy(j), z = cz(k), id = cIdx(i, j, k);
    const d = sdfAll(x, y, z); sd[id] = d;
    let ok = d < 0.30 * H;
    if (j === JM) { const u = (x - MOUTH.c[0]) / MOUTH.r[0], v = z / MOUTH.r[2]; if (u * u + v * v < 1) { ok = false; mouthCell[id] = 1; } }
    inc[id] = ok ? 1 : 0;
    if (ok && bodySdf(x, y - YOFF, z) > 0.012) fin[id] = 1;
  }
  const nbOK = (i, j, k) => cellAt(i, j, k) || (i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ && mouthCell[cIdx(i, j, k)]);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const id = cIdx(i, j, k); if (!inc[id] || fin[id]) continue;
    const x = cx(i), y = cy(j), P = profileAt(x);
    if (sd[id] < -0.45 * H && y - YOFF < 0.46 * P.Ht && nbOK(i - 1, j, k) && nbOK(i + 1, j, k) && nbOK(i, j, k - 1) && nbOK(i, j, k + 1) && nbOK(i, j + 1, k) && (j === 0 || nbOK(i, j - 1, k))) inner[id] = 1;
  }
  // vertices
  const vid = new Int32Array((NX + 1) * (NY + 1) * (NZ + 1)).fill(-1), vcount = new Uint8Array(vid.length);
  let nv = 0;
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!inc[cIdx(i, j, k)]) continue;
    for (const c of CORNER) { const vi = vIdx(i + c[0], j + c[1], k + c[2]); if (vid[vi] < 0) vid[vi] = nv++; vcount[vi]++; }
  }
  const rest = new Float32Array(nv * 3), lat = new Float32Array(nv * 3), isBoundary = new Uint8Array(nv);
  for (let k = 0; k <= NZ; k++) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const vi = vIdx(i, j, k), id = vid[vi]; if (id < 0) continue;
    lat[id * 3] = rest[id * 3] = X0 + i * H; lat[id * 3 + 1] = rest[id * 3 + 1] = j * H; lat[id * 3 + 2] = rest[id * 3 + 2] = (k - ZH - 0.5) * H;
    isBoundary[id] = vcount[vi] < 8 ? 1 : 0;
  }
  // snap boundary vertices to the SDF zero set
  const eps = 0.004;
  for (let v = 0; v < nv; v++) {
    if (!isBoundary[v]) continue;
    let x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
    const ox = x, oy = y, oz = z;
    for (let it = 0; it < 3; it++) {
      const d = sdfAll(x, y, z);
      const gx = sdfAll(x + eps, y, z) - sdfAll(x - eps, y, z), gy = sdfAll(x, y + eps, z) - sdfAll(x, y - eps, z), gz = sdfAll(x, y, z + eps) - sdfAll(x, y, z - eps);
      const gl = gx * gx + gy * gy + gz * gz; if (gl < 1e-9) break;
      const s = d / (gl / (4 * eps * eps));
      x -= gx / (2 * eps) * s; y -= gy / (2 * eps) * s; z -= gz / (2 * eps) * s;
    }
    const mv = Math.hypot(x - ox, y - oy, z - oz), lim = 0.75 * H;
    if (mv > lim) { const s = lim / mv; x = ox + (x - ox) * s; y = oy + (y - oy) * s; z = oz + (z - oz) * s; }
    if (y < 0) y = 0;
    rest[v * 3] = x; rest[v * 3 + 1] = y; rest[v * 3 + 2] = z;
  }
  // tets
  const tl = [], tcell = [];
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const id = cIdx(i, j, k); if (!inc[id]) continue;
    const cid = CORNER.map(c => vid[vIdx(i + c[0], j + c[1], k + c[2])]);
    for (const t of ((i + j + k) & 1 ? TETS_ODD : TETS_EVEN)) { tl.push(cid[t[0]], cid[t[1]], cid[t[2]], cid[t[3]]); tcell.push(id); }
  }
  const nt = tl.length / 4, tet = Int32Array.from(tl);
  const vol = t => {
    const a = tet[4 * t] * 3, b = tet[4 * t + 1] * 3, c = tet[4 * t + 2] * 3, d = tet[4 * t + 3] * 3;
    const e1 = [rest[b] - rest[a], rest[b + 1] - rest[a + 1], rest[b + 2] - rest[a + 2]], e2 = [rest[c] - rest[a], rest[c + 1] - rest[a + 1], rest[c + 2] - rest[a + 2]], e3 = [rest[d] - rest[a], rest[d + 1] - rest[a + 1], rest[d + 2] - rest[a + 2]];
    return dot3(cross3(e1, e2), e3) / 6;
  };
  for (let t = 0; t < nt; t++) if (vol(t) < 0) { const q = tet[4 * t + 2]; tet[4 * t + 2] = tet[4 * t + 3]; tet[4 * t + 3] = q; }
  // repair non-positive tets by relaxing their vertices toward the lattice
  for (let pass = 0; pass < 8; pass++) {
    let bad = 0;
    for (let t = 0; t < nt; t++) if (vol(t) < 2e-8) {
      bad++; for (let q = 0; q < 4; q++) { const v = tet[4 * t + q] * 3; for (let c = 0; c < 3; c++) rest[v + c] += (lat[v + c] - rest[v + c]) * 0.5; }
    }
    if (!bad) break;
  }
  // surface quads
  const tri = [], blob = [], cavity = new Set();
  const addQuad = (arr, q) => arr.push(q[0], q[1], q[2], q[0], q[2], q[3]);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const id = cIdx(i, j, k); if (!inc[id]) continue;
    const cid = CORNER.map(c => vid[vIdx(i + c[0], j + c[1], k + c[2])]);
    for (const f of FACES) {
      const ni = i + f[4], nj = j + f[5], nk = k + f[6];
      const q = [cid[f[0]], cid[f[1]], cid[f[2]], cid[f[3]]];
      if (!cellAt(ni, nj, nk)) { addQuad(tri, q); if (nj >= 0 && nj < NY && ni >= 0 && ni < NX && nk >= 0 && nk < NZ && mouthCell[cIdx(ni, nj, nk)]) q.forEach(v => cavity.add(v)); }
      if (inner[id] && !(ni >= 0 && nj >= 0 && nk >= 0 && ni < NX && nj < NY && nk < NZ && inner[cIdx(ni, nj, nk)])) addQuad(blob, q);
    }
  }
  // round off the voxel stair-steps: tangential Laplacian smoothing of the surface, then re-project onto the SDF
  {
    const nb = Array.from({ length: nv }, () => new Set());
    for (let q = 0; q < tri.length; q += 3) { const a = tri[q], b = tri[q + 1], c = tri[q + 2]; nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b); }
    const surf = []; for (let v = 0; v < nv; v++) if (nb[v].size) surf.push(v);
    const tmp = new Float32Array(rest.length);
    for (let pass = 0; pass < 3; pass++) {
      for (const v of surf) { let x = 0, y = 0, z = 0, n = 0; for (const u of nb[v]) { x += rest[3 * u]; y += rest[3 * u + 1]; z += rest[3 * u + 2]; n++; } tmp[3 * v] = rest[3 * v] + (x / n - rest[3 * v]) * 0.5; tmp[3 * v + 1] = rest[3 * v + 1] + (y / n - rest[3 * v + 1]) * 0.5; tmp[3 * v + 2] = rest[3 * v + 2] + (z / n - rest[3 * v + 2]) * 0.5; }
      for (const v of surf) {
        let x = tmp[3 * v], y = tmp[3 * v + 1], z = tmp[3 * v + 2];
        for (let it = 0; it < 2; it++) {
          const d = sdfAll(x, y, z), gx = sdfAll(x + eps, y, z) - sdfAll(x - eps, y, z), gy = sdfAll(x, y + eps, z) - sdfAll(x, y - eps, z), gz = sdfAll(x, y, z + eps) - sdfAll(x, y, z - eps);
          const gl = gx * gx + gy * gy + gz * gz; if (gl < 1e-9) break; const sc = d / (gl / (4 * eps * eps)); x -= gx / (2 * eps) * sc; y -= gy / (2 * eps) * sc; z -= gz / (2 * eps) * sc;
        }
        const mv = Math.hypot(x - lat[3 * v], y - lat[3 * v + 1], z - lat[3 * v + 2]), lim = 0.9 * H; if (mv > lim) { const k = lim / mv; x = lat[3 * v] + (x - lat[3 * v]) * k; y = lat[3 * v + 1] + (y - lat[3 * v + 1]) * k; z = lat[3 * v + 2] + (z - lat[3 * v + 2]) * k; }
        rest[3 * v] = x; rest[3 * v + 1] = Math.max(0, y); rest[3 * v + 2] = z;
      }
    }
    for (let pass = 0; pass < 8; pass++) { // undo any tet the smoothing folded over
      let bad = 0;
      for (let t = 0; t < nt; t++) if (vol(t) < 2e-8) { bad++; for (let q = 0; q < 4; q++) { const v = tet[4 * t + q] * 3; for (let c = 0; c < 3; c++) rest[v + c] += (lat[v + c] - rest[v + c]) * 0.5; } }
      if (!bad) break;
    }
  }
  // edges
  const eset = new Set(), edges = [];
  for (let t = 0; t < nt; t++) for (let a = 0; a < 3; a++) for (let b = a + 1; b < 4; b++) {
    let p = tet[4 * t + a], q = tet[4 * t + b]; if (p > q) { const s = p; p = q; q = s; }
    const key = p * 4194304 + q; if (!eset.has(key)) { eset.add(key); edges.push(p, q); }
  }
  // per-tet metadata
  const tcen = new Float32Array(nt * 3), tkm = new Float32Array(nt), twj = new Float32Array(nt), tgm = new Float32Array(nt), tenv = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    let x = 0, y = 0, z = 0; for (let q = 0; q < 4; q++) { const v = tet[4 * t + q] * 3; x += rest[v]; y += rest[v + 1]; z += rest[v + 2]; }
    x /= 4; y /= 4; z /= 4; tcen[3 * t] = x; tcen[3 * t + 1] = y; tcen[3 * t + 2] = z;
    const id = tcell[t];
    tkm[t] = fin[id] ? 12 : (inner[id] ? 1.5 : 1);
    twj[t] = y > YM + 0.015 ? 1 : 0;
    const Wd = profileAt(x).W;
    tgm[t] = Math.exp(-Math.pow((x - 0.59) / 0.17, 4)) * smooth(0.35, 0.7, Math.abs(z) / Wd) * (fin[id] ? 0 : 1);
    tenv[t] = Math.pow(smooth(0.9, 2.8, x), 1.2);
  }
  // vertex attributes
  const finw = new Float32Array(nv);
  for (let v = 0; v < nv; v++) finw[v] = smooth(0.012, 0.045, bodySdf(rest[3 * v], rest[3 * v + 1] - YOFF, rest[3 * v + 2]));
  return { nv, nt, tet, rest, tri: Uint32Array.from(tri), blob: Uint32Array.from(blob), edges: Uint32Array.from(edges), isBoundary, cavity, tcen, tkm, twj, tgm, tenv, finw };
}


// ---------------------------------------------------------------- embedded render surface
// Surface Nets on the SDF (fine, smooth), then every vertex is bound to a lattice tet (barycentric) so the soft body skins it.
function surfaceNets(f, bx0, by0, bz0, nx, ny, nz, h) {
  const sx = nx + 1, sy = ny + 1, sz = nz + 1, val = new Float32Array(sx * sy * sz), done = new Uint8Array(val.length), idx = (i, j, k) => (k * sy + j) * sx + i;
  const B = 3, rad = h * B * 0.9 + h * 0.5, near = [], far = [];
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const c = f(bx0 + (bi + B * 0.5) * h, by0 + (bj + B * 0.5) * h, bz0 + (bk + B * 0.5) * h);
    (Math.abs(c) < rad ? near : far).push(bi, bj, bk, c);
  }
  for (let q = 0; q < near.length; q += 4) {
    const bi = near[q], bj = near[q + 1], bk = near[q + 2];
    for (let k = bk; k <= Math.min(bk + B, nz); k++) for (let j = bj; j <= Math.min(bj + B, ny); j++) for (let i = bi; i <= Math.min(bi + B, nx); i++) {
      const id = idx(i, j, k); if (done[id]) continue; val[id] = f(bx0 + i * h, by0 + j * h, bz0 + k * h); done[id] = 1;
    }
  }
  for (let q = 0; q < far.length; q += 4) {
    const bi = far[q], bj = far[q + 1], bk = far[q + 2], c = far[q + 3];
    for (let k = bk; k <= Math.min(bk + B, nz); k++) for (let j = bj; j <= Math.min(bj + B, ny); j++) for (let i = bi; i <= Math.min(bi + B, nx); i++) { const id = idx(i, j, k); if (!done[id]) val[id] = c; }
  }
  const vi = new Int32Array(nx * ny * nz).fill(-1), P = [], cidx = (i, j, k) => (k * ny + j) * nx + i;
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = val[idx(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))]; cv[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const e of E) {
      const a = cv[e[0]], b = cv[e[1]]; if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b), c0 = e[0], c1 = e[1];
      ax += (c0 & 1) + ((c1 & 1) - (c0 & 1)) * t; ay += ((c0 >> 1) & 1) + (((c1 >> 1) & 1) - ((c0 >> 1) & 1)) * t; az += (c0 >> 2) + ((c1 >> 2) - (c0 >> 2)) * t; n++;
    }
    vi[cidx(i, j, k)] = P.length / 3; P.push(bx0 + (i + ax / n) * h, by0 + (j + ay / n) * h, bz0 + (k + az / n) * h);
  }
  const T = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) T.push(a, c, b, a, d, c); else T.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const v0 = val[idx(i, j, k)] < 0;
    if (v0 !== (val[idx(i + 1, j, k)] < 0)) quad(vi[cidx(i, j - 1, k - 1)], vi[cidx(i, j, k - 1)], vi[cidx(i, j, k)], vi[cidx(i, j - 1, k)], !v0);
    if (v0 !== (val[idx(i, j + 1, k)] < 0)) quad(vi[cidx(i - 1, j, k - 1)], vi[cidx(i - 1, j, k)], vi[cidx(i, j, k)], vi[cidx(i, j, k - 1)], !v0);
    if (v0 !== (val[idx(i, j, k + 1)] < 0)) quad(vi[cidx(i - 1, j - 1, k)], vi[cidx(i, j - 1, k)], vi[cidx(i, j, k)], vi[cidx(i - 1, j, k)], !v0);
  }
  return { P: Float32Array.from(P), T: Uint32Array.from(T) };
}
function projectToSdf(f, P, eps, its) {
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2];
    for (let it = 0; it < its; it++) {
      const d = f(x, y, z); if (Math.abs(d) < 0.0008) break;
      const gx = f(x + eps, y, z) - f(x - eps, y, z), gy = f(x, y + eps, z) - f(x, y - eps, z), gz = f(x, y, z + eps) - f(x, y, z - eps), gl = (gx * gx + gy * gy + gz * gz) / (4 * eps * eps);
      if (gl < 1e-9) break; const s = d / gl; x -= gx / (2 * eps) * s; y -= gy / (2 * eps) * s; z -= gz / (2 * eps) * s;
    }
    P[v] = x; P[v + 1] = Math.max(0, y); P[v + 2] = z;
  }
}
function smoothMesh(P, T, f, passes, lam) {
  const n = P.length / 3, acc = new Float32Array(P.length), cnt = new Uint16Array(n);
  for (let p = 0; p < passes; p++) {
    acc.fill(0); cnt.fill(0);
    for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = T[t + e], b = T[t + (e + 1) % 3];
      acc[3 * a] += P[3 * b]; acc[3 * a + 1] += P[3 * b + 1]; acc[3 * a + 2] += P[3 * b + 2]; cnt[a]++; acc[3 * b] += P[3 * a]; acc[3 * b + 1] += P[3 * a + 1]; acc[3 * b + 2] += P[3 * a + 2]; cnt[b]++;
    }
    for (let v = 0; v < n; v++) if (cnt[v]) for (let c = 0; c < 3; c++) P[3 * v + c] += (acc[3 * v + c] / cnt[v] - P[3 * v + c]) * lam;
    projectToSdf(f, P, 0.003, 1);
  }
}
function orientOutward(P, T, f) { // make triangle winding agree with the SDF gradient
  let good = 0, bad = 0;
  for (let t = 0; t < T.length; t += 3) {
    if ((t / 3) % 7) continue; const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, mx = (P[a] + P[b] + P[c]) / 3, my = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3, e = 0.004;
    const gx = f(mx + e, my, mz) - f(mx - e, my, mz), gy = f(mx, my + e, mz) - f(mx, my - e, mz), gz = f(mx, my, mz + e) - f(mx, my, mz - e);
    if (nx * gx + ny * gy + nz * gz > 0) good++; else bad++;
  }
  if (bad > good) for (let t = 0; t < T.length; t += 3) { const q = T[t + 1]; T[t + 1] = T[t + 2]; T[t + 2] = q; }
}
function bindMesh(P, L, H0) {
  const nvm = P.length / 3, { tet, rest, nt } = L, ginv = 1 / H0, bucket = new Map(), key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
  const Binv = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const a = tet[4 * t] * 3, b = tet[4 * t + 1] * 3, c = tet[4 * t + 2] * 3, d = tet[4 * t + 3] * 3;
    const m = [rest[b] - rest[a], rest[c] - rest[a], rest[d] - rest[a], rest[b + 1] - rest[a + 1], rest[c + 1] - rest[a + 1], rest[d + 1] - rest[a + 1], rest[b + 2] - rest[a + 2], rest[c + 2] - rest[a + 2], rest[d + 2] - rest[a + 2]];
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]), id = 1 / det;
    Binv.set([(m[4] * m[8] - m[5] * m[7]) * id, (m[2] * m[7] - m[1] * m[8]) * id, (m[1] * m[5] - m[2] * m[4]) * id, (m[5] * m[6] - m[3] * m[8]) * id, (m[0] * m[8] - m[2] * m[6]) * id, (m[2] * m[3] - m[0] * m[5]) * id, (m[3] * m[7] - m[4] * m[6]) * id, (m[1] * m[6] - m[0] * m[7]) * id, (m[0] * m[4] - m[1] * m[3]) * id], 9 * t);
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let q = 0; q < 4; q++) { const v = tet[4 * t + q] * 3; x0 = Math.min(x0, rest[v]); y0 = Math.min(y0, rest[v + 1]); z0 = Math.min(z0, rest[v + 2]); x1 = Math.max(x1, rest[v]); y1 = Math.max(y1, rest[v + 1]); z1 = Math.max(z1, rest[v + 2]); }
    for (let k = Math.floor(z0 * ginv); k <= Math.floor(z1 * ginv); k++) for (let j = Math.floor(y0 * ginv); j <= Math.floor(y1 * ginv); j++) for (let i = Math.floor(x0 * ginv); i <= Math.floor(x1 * ginv); i++) { const kk = key(i, j, k); let l = bucket.get(kk); if (!l) bucket.set(kk, l = []); l.push(t); }
  }
  const bi = new Int32Array(nvm * 4), bw = new Float32Array(nvm * 4);
  for (let v = 0; v < nvm; v++) {
    const px = P[3 * v], py = P[3 * v + 1], pz = P[3 * v + 2], ci = Math.floor(px * ginv), cj = Math.floor(py * ginv), ck = Math.floor(pz * ginv);
    let best = -1, bs = -1e9, bl = null;
    for (let r = 0; r < 4 && best < 0; r++) {
      for (let k = ck - r; k <= ck + r; k++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (r > 0 && Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) < r) continue;
        const l = bucket.get(key(i, j, k)); if (!l) continue;
        for (const t of l) {
          const a = tet[4 * t] * 3, dx = px - rest[a], dy = py - rest[a + 1], dz = pz - rest[a + 2], o = 9 * t;
          const l1 = Binv[o] * dx + Binv[o + 1] * dy + Binv[o + 2] * dz, l2 = Binv[o + 3] * dx + Binv[o + 4] * dy + Binv[o + 5] * dz, l3 = Binv[o + 6] * dx + Binv[o + 7] * dy + Binv[o + 8] * dz, l0 = 1 - l1 - l2 - l3;
          const sc = Math.min(l0, l1, l2, l3); if (sc > bs) { bs = sc; best = t; bl = [l0, l1, l2, l3]; }
        }
      }
      if (best >= 0 && bs < -0.5) best = -1; // too far: widen the search
    }
    if (best < 0) { // fall back: nearest tet centroid
      let bd = 1e18; for (let t = 0; t < nt; t++) { const d = (L.tcen[3 * t] - px) ** 2 + (L.tcen[3 * t + 1] - py) ** 2 + (L.tcen[3 * t + 2] - pz) ** 2; if (d < bd) { bd = d; best = t; } }
      const a = tet[4 * best] * 3, dx = px - rest[a], dy = py - rest[a + 1], dz = pz - rest[a + 2], o = 9 * best;
      const l1 = Binv[o] * dx + Binv[o + 1] * dy + Binv[o + 2] * dz, l2 = Binv[o + 3] * dx + Binv[o + 4] * dy + Binv[o + 5] * dz, l3 = Binv[o + 6] * dx + Binv[o + 7] * dy + Binv[o + 8] * dz; bl = [1 - l1 - l2 - l3, l1, l2, l3];
    }
    let sw = 0; for (let q = 0; q < 4; q++) { bl[q] = Math.max(bl[q], -0.45); sw += bl[q]; }
    for (let q = 0; q < 4; q++) { bi[4 * v + q] = tet[4 * best + q]; bw[4 * v + q] = bl[q] / sw; }
  }
  return { bi, bw };
}
function buildEmbedded(L, h, f, projIts, smoothPasses) {
  const bx0 = -0.16, by0 = -2 * h, bz0 = -0.95, nx = Math.ceil(3.75 / h), ny = Math.ceil(1.1 / h), nz = Math.ceil(1.9 / h);
  const m = surfaceNets(f, bx0, by0, bz0, nx, ny, nz, h);
  projectToSdf(f, m.P, 0.003, projIts); if (smoothPasses) smoothMesh(m.P, m.T, f, smoothPasses, 0.35);
  orientOutward(m.P, m.T, f);
  const bind = bindMesh(m.P, L, H);
  return { nv: m.P.length / 3, rest: m.P, tri: m.T, bi: bind.bi, bw: bind.bw };
}
function skinMesh(M, pos, out) {
  const { bi, bw } = M, n = M.nv;
  for (let v = 0; v < n; v++) {
    const o = 4 * v, a = bi[o] * 3, b = bi[o + 1] * 3, c = bi[o + 2] * 3, d = bi[o + 3] * 3, w0 = bw[o], w1 = bw[o + 1], w2 = bw[o + 2], w3 = bw[o + 3];
    out[3 * v] = w0 * pos[a] + w1 * pos[b] + w2 * pos[c] + w3 * pos[d]; out[3 * v + 1] = w0 * pos[a + 1] + w1 * pos[b + 1] + w2 * pos[c + 1] + w3 * pos[d + 1]; out[3 * v + 2] = w0 * pos[a + 2] + w1 * pos[b + 2] + w2 * pos[c + 2] + w3 * pos[d + 2];
  }
}
function meshNormals(P, T, out) {
  out.fill(0);
  for (let i = 0; i < T.length; i += 3) {
    const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out[a] += nx; out[a + 1] += ny; out[a + 2] += nz; out[b] += nx; out[b + 1] += ny; out[b + 2] += nz; out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) { const l = Math.hypot(out[i], out[i + 1], out[i + 2]); if (l > 1e-12) { out[i] /= l; out[i + 1] /= l; out[i + 2] /= l; } }
}

// ---------------------------------------------------------------- world
function createWorld(cell) {
  H = cell || 0.04;
  const L = buildLattice(), nv = L.nv, nt = L.nt, tet = L.tet;
  const pos = Float32Array.from(L.rest), prev = new Float32Array(nv * 3), vel = new Float32Array(nv * 3);
  const iw = new Float32Array(nv), V0 = new Float32Array(nt), Bst = new Float32Array(nt * 9), BM = new Float32Array(nt * 9), V0s = new Float32Array(nt), ik = new Float32Array(nt), tq = new Float32Array(nt * 4);
  const mass = new Float32Array(nv);
  let totalV = 0;
  for (let t = 0; t < nt; t++) {
    const a = tet[4 * t] * 3, b = tet[4 * t + 1] * 3, c = tet[4 * t + 2] * 3, d = tet[4 * t + 3] * 3, r = L.rest;
    const m = [r[b] - r[a], r[c] - r[a], r[d] - r[a], r[b + 1] - r[a + 1], r[c + 1] - r[a + 1], r[d + 1] - r[a + 1], r[b + 2] - r[a + 2], r[c + 2] - r[a + 2], r[d + 2] - r[a + 2]];
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    const id = 1 / det;
    const B = [(m[4] * m[8] - m[5] * m[7]) * id, (m[2] * m[7] - m[1] * m[8]) * id, (m[1] * m[5] - m[2] * m[4]) * id,
      (m[5] * m[6] - m[3] * m[8]) * id, (m[0] * m[8] - m[2] * m[6]) * id, (m[2] * m[3] - m[0] * m[5]) * id,
      (m[3] * m[7] - m[4] * m[6]) * id, (m[1] * m[6] - m[0] * m[7]) * id, (m[0] * m[4] - m[1] * m[3]) * id];
    for (let q = 0; q < 9; q++) { Bst[9 * t + q] = B[q]; BM[9 * t + q] = B[q]; }
    V0[t] = Math.abs(det) / 6; V0s[t] = V0[t]; totalV += V0[t];
    ik[t] = 1 / (V0[t] * L.tkm[t]);
    for (let q = 0; q < 4; q++) mass[tet[4 * t + q]] += V0[t] * 0.25;
    tq[4 * t + 3] = 1;
  }
  for (let v = 0; v < nv; v++) iw[v] = 1 / mass[v];
  const S = { swa: 0.25, firm: 0.5, damp: 0.35, nsub: 6, time: 0, jaw: 0, flare: 0, swish: 0, swishPhase: 0, grab: null, vol: 1, g: 1, drag: 0, swim: 0, swimMix: 0, bend: 0, turn: 0.32, cruise: 0.32, swimH: 0.9, hunt: null };
  const grabs = new Map(); S.grabs = grabs;
  Object.defineProperty(S, 'grab', { get() { return grabs.values().next().value || null; }, set(v) { if (!v) grabs.clear(); } });
  const COLMAX = 160, col = new Float32Array(COLMAX * 8), act = new Int32Array(COLMAX); let ncol = 0, nact = 0; const cstart = new Int32Array(COLMAX + 1); let cpool = null;
  // hand colliders: spheres [x y z r | previous x y z] in sim space
  function setColliders(a, n) { ncol = Math.min(n, COLMAX); col.set(a.subarray(0, ncol * 8)); }
  // landmark vertices
  const nearest = (tx, ty, tz, filter) => { let bi = -1, bd = 1e9; for (let v = 0; v < nv; v++) { if (filter && !filter(v)) continue; const d = Math.hypot(L.rest[3 * v] - tx, L.rest[3 * v + 1] - ty, L.rest[3 * v + 2] - tz); if (d < bd) { bd = d; bi = v; } } return bi; };
  const UF = nearest(0.0, YM + 0.03, 0.02, v => L.cavity.has(v)), LF = nearest(0.0, YM - 0.03, 0.02, v => L.cavity.has(v));
  const UB = nearest(0.24, YM + 0.03, 0.02, v => L.cavity.has(v)), LB_ = nearest(0.24, YM - 0.03, 0.02, v => L.cavity.has(v));
  const projectSurf = (p) => { let [x, y, z] = p; for (let i = 0; i < 6; i++) { const e = 0.003, d = gridSdf(x, y, z); const gx = gridSdf(x + e, y, z) - gridSdf(x - e, y, z), gy = gridSdf(x, y + e, z) - gridSdf(x, y - e, z), gz = gridSdf(x, y, z + e) - gridSdf(x, y, z - e); const gl = (gx * gx + gy * gy + gz * gz) / (4 * e * e); x -= gx / (2 * e) * d / gl; y -= gy / (2 * e) * d / gl; z -= gz / (2 * e) * d / gl; } return [x, y, z]; };
  const eyeP = projectSurf([0.30, YM + 0.06, 0.36]); eyeP[2] -= Math.sign(eyeP[2]) * 0.016;
  const spirP = projectSurf([0.60, YOFF + 0.55, 0.16]);
  const outer = new Uint8Array(nv); for (let i = 0; i < L.tri.length; i++) outer[L.tri[i]] = 1;
  const ev0 = nearest(eyeP[0], eyeP[1], Math.abs(eyeP[2]), v => outer[v] && !L.cavity.has(v)), eyeV = [ev0, nearest(L.rest[3 * ev0], L.rest[3 * ev0 + 1], -L.rest[3 * ev0 + 2], v => outer[v] && !L.cavity.has(v))];
  const surfV = []; for (let v = 0; v < nv; v++) if (outer[v]) surfV.push(v);
  const nrm = new Float32Array(nv * 3), bnrm = new Float32Array(nv * 3);
  const RES = H >= 0.055 ? 0.024 : 0.019;
  const R = buildEmbedded(L, RES, sdfRender, 2, 1), Bm = buildEmbedded(L, 0.034, sdfCore, 1, 1);
  const nearR = (x, y, z) => { let bi = 0, bd = 1e9; for (let v = 0; v < R.nv; v++) { const d = Math.hypot(R.rest[3 * v] - x, R.rest[3 * v + 1] - y, R.rest[3 * v + 2] - z); if (d < bd) { bd = d; bi = v; } } return bi; };
  const er0 = nearR(eyeP[0], eyeP[1], Math.abs(eyeP[2])), eyeR = [er0, nearR(R.rest[3 * er0], R.rest[3 * er0 + 1], -R.rest[3 * er0 + 2])];
  R.pos = new Float32Array(R.nv * 3); R.nrm = new Float32Array(R.nv * 3); Bm.pos = new Float32Array(Bm.nv * 3); Bm.nrm = new Float32Array(Bm.nv * 3);
  R.rest4 = new Float32Array(R.nv * 4); for (let v = 0; v < R.nv; v++) { R.rest4[4 * v] = R.rest[3 * v]; R.rest4[4 * v + 1] = R.rest[3 * v + 1] - YOFF; R.rest4[4 * v + 2] = R.rest[3 * v + 2]; R.rest4[4 * v + 3] = smooth(0.012, 0.045, bodySdf(R.rest[3 * v], R.rest[3 * v + 1] - YOFF, R.rest[3 * v + 2])); }
  const skin = () => { skinMesh(R, pos, R.pos); meshNormals(R.pos, R.tri, R.nrm); skinMesh(Bm, pos, Bm.pos); meshNormals(Bm.pos, Bm.tri, Bm.nrm); };

  function computeNormals(idx, out) {
    out.fill(0);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      out[a] += nx; out[a + 1] += ny; out[a + 2] += nz; out[b] += nx; out[b + 1] += ny; out[b + 2] += nz; out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
    }
    for (let i = 0; i < out.length; i += 3) { const l = Math.hypot(out[i], out[i + 1], out[i + 2]); if (l > 1e-12) { out[i] /= l; out[i + 1] /= l; out[i + 2] /= l; } }
  }

  // whole-body swimming envelope: amplitude grows smoothly from head to tail but is never zero
  const tenvS = new Float32Array(nt); for (let t = 0; t < nt; t++) { const u = Math.max(0, Math.min(1, L.tcen[3 * t] / LB)); tenvS[t] = 0.16 + 0.84 * Math.pow(u, 1.7); }
  const headIdx = [], tailIdx = []; for (let v = 0; v < nv; v++) { const x = L.rest[3 * v]; if (x < 0.4) headIdx.push(v); else if (x > LB - 0.55) tailIdx.push(v); }
  const dorsIdx = [], ventIdx = []; for (let v = 0; v < nv; v++) { const x = L.rest[3 * v], y = L.rest[3 * v + 1]; if (x > 0.4 && x < 1.7) { if (y > YOFF + 0.24) dorsIdx.push(v); else if (y < YOFF + 0.06) ventIdx.push(v); } }
  const cr3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // keep the shark roughly belly-down and level: a gentle rigid righting rotation (strength 0..1)
  function upright(dt, strength, pitchA = 0) {
    if (!dorsIdx.length || !ventIdx.length) return 1;
    const av = (idx) => { let x = 0, y = 0, z = 0; for (const v of idx) { x += pos[3 * v]; y += pos[3 * v + 1]; z += pos[3 * v + 2]; } const n = idx.length; return [x / n, y / n, z / n]; };
    const dd = av(dorsIdx), vv = av(ventIdx), hh = av(headIdx), tt = av(tailIdx);
    let u = [dd[0] - vv[0], dd[1] - vv[1], dd[2] - vv[2]]; const ul = Math.hypot(...u) || 1; u = u.map(c => c / ul);
    let f = [hh[0] - tt[0], hh[1] - tt[1], hh[2] - tt[2]]; const fl = Math.hypot(...f) || 1; f = f.map(c => c / fl);
    let w = cr3(u, [0, 1, 0]); // roll: bring the dorsal axis to vertical
    if (u[1] < -0.2) { const m = Math.hypot(w[0], w[1], w[2]); if (m < 0.35) w = [f[0], f[1], f[2]].map(c => c * 0.9); } // upside down: roll about the body axis
    const fh = Math.hypot(f[0], f[2]) || 1, ca_ = Math.cos(pitchA), sa_ = Math.sin(pitchA), fHor = [f[0] / fh * ca_, sa_, f[2] / fh * ca_], wp = cr3(f, fHor); // pitch: level the body axis (or nose up/down while climbing/diving)
    if (u[1] < 0.5) { const m = Math.hypot(w[0], w[1], w[2]) || 1, need = 1.4 * (0.5 - u[1]); if (m < need) w = w.map(c => c / m * need); } // on its side or belly-up: roll back harder
    const gain = 2.2 * strength * (u[1] < 0.3 ? 1.8 : 1), k = Math.min(1, 3 * dt);
    const wt = [(w[0] + wp[0]) * gain, (w[1] * 0 + wp[1] * 0), (w[2] + wp[2]) * gain];
    // current angular velocity (isotropic estimate), damp the roll/pitch parts toward the target
    let cx = 0, cy = 0, cz = 0, Lx = 0, Ly = 0, Lz = 0, I = 0, mx = 0, my = 0, mz = 0;
    for (let i = 0; i < nv * 3; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; mx += vel[i]; my += vel[i + 1]; mz += vel[i + 2]; } cx /= nv; cy /= nv; cz /= nv; mx /= nv; my /= nv; mz /= nv;
    for (let i = 0; i < nv * 3; i += 3) { const rx = pos[i] - cx, ry = pos[i + 1] - cy, rz = pos[i + 2] - cz, vx = vel[i] - mx, vy = vel[i + 1] - my, vz = vel[i + 2] - mz; Lx += ry * vz - rz * vy; Ly += rz * vx - rx * vz; Lz += rx * vy - ry * vx; I += rx * rx + ry * ry + rz * rz; }
    const wc = [Lx / I * 1.6, Ly / I * 1.6, Lz / I * 1.6], dw = [(wt[0] - wc[0]) * k, 0, (wt[2] - wc[2]) * k];
    for (let i = 0; i < nv * 3; i += 3) { const rx = pos[i] - cx, ry = pos[i + 1] - cy, rz = pos[i + 2] - cz; vel[i] += dw[1] * rz - dw[2] * ry; vel[i + 1] += dw[2] * rx - dw[0] * rz; vel[i + 2] += dw[0] * ry - dw[1] * rx; }
    return u[1];
  }
  let SWA = 0.45;
  function updateActuation() {
    SWA = S.swa || 0.45;
    const jaw = S.jaw, fl = S.flare, sw = S.swish, ph = S.swishPhase, sm_ = S.swimMix, kw = 2 * Math.PI / (1.9 + 1.5 * sm_), amp = 1 + 0.45 * sm_, bend = S.bend;
    for (let t = 0; t < nt; t++) {
      const x = L.tcen[3 * t], y = L.tcen[3 * t + 1], z = L.tcen[3 * t + 2], o = 9 * t;
      let ex = 0;
      if (jaw > 1e-4 && y > YM + 0.015) ex -= jaw * 6.5 * smooth(0.04, 0.09, x) * (1 - smooth(0.24, 0.30, x)) * (y - YM - 0.09);
      if (sw > 1e-4 || bend !== 0) {
        const zn = Math.max(-1, Math.min(1, z / profileAt(x).W)), env = L.tenv[t] + (tenvS[t] - L.tenv[t]) * sm_;
        ex -= sw * SWA * amp * env * Math.cos(kw * x - ph) * zn + bend * tenvS[t] * zn;
      }
      ex = Math.max(-0.45, Math.min(0.45, ex));
      const s = 1 + 0.2 * fl * L.tgm[t];
      if (ex === 0 && s === 1) { for (let q = 0; q < 9; q++) BM[o + q] = Bst[o + q]; V0s[t] = V0[t]; continue; }
      const sx = (1 + ex) * s, sy = s / Math.sqrt(1 + ex), ix = 1 / sx, iy = 1 / sy;
      for (let r = 0; r < 3; r++) { BM[o + r * 3] = Bst[o + r * 3] * ix; BM[o + r * 3 + 1] = Bst[o + r * 3 + 1] * iy; BM[o + r * 3 + 2] = Bst[o + r * 3 + 2] * iy; }
      V0s[t] = V0[t] * sx * sy * sy;
    }
  }

  const RR = new Float64Array(9), RM = new Float64Array(9);
  function extractRot(a00, a01, a02, a10, a11, a12, a20, a21, a22, o, iters) {
    let x = tq[o], y = tq[o + 1], z = tq[o + 2], w = tq[o + 3];
    for (let it = 0; it < iters; it++) {
      const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w);
      const r10 = 2 * (x * y + z * w), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - x * w);
      const r20 = 2 * (x * z - y * w), r21 = 2 * (y * z + x * w), r22 = 1 - 2 * (x * x + y * y);
      // omega = sum_c (Rc x Ac) / |sum_c Rc.Ac|
      const ox = (r10 * a20 - r20 * a10) + (r11 * a21 - r21 * a11) + (r12 * a22 - r22 * a12);
      const oy = (r20 * a00 - r00 * a20) + (r21 * a01 - r01 * a21) + (r22 * a02 - r02 * a22);
      const oz = (r00 * a10 - r10 * a00) + (r01 * a11 - r11 * a01) + (r02 * a12 - r12 * a02);
      const den = Math.abs(r00 * a00 + r10 * a10 + r20 * a20 + r01 * a01 + r11 * a11 + r21 * a21 + r02 * a02 + r12 * a12 + r22 * a22) + 1e-9;
      const wx = ox / den, wy = oy / den, wz = oz / den, wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (wl < 1e-9) break;
      const s = Math.sin(wl * 0.5) / wl, qx = wx * s, qy = wy * s, qz = wz * s, qw = Math.cos(wl * 0.5);
      const nx = qw * x + qx * w + qy * z - qz * y, ny = qw * y - qx * z + qy * w + qz * x, nz = qw * z + qx * y - qy * x + qz * w, nw = qw * w - qx * x - qy * y - qz * z;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
      x = nx * il; y = ny * il; z = nz * il; w = nw * il;
    }
    tq[o] = x; tq[o + 1] = y; tq[o + 2] = z; tq[o + 3] = w;
    RR[0] = 1 - 2 * (y * y + z * z); RR[1] = 2 * (x * y - z * w); RR[2] = 2 * (x * z + y * w); RR[3] = 2 * (x * y + z * w); RR[4] = 1 - 2 * (x * x + z * z); RR[5] = 2 * (y * z - x * w); RR[6] = 2 * (x * z - y * w); RR[7] = 2 * (y * z + x * w); RR[8] = 1 - 2 * (x * x + y * y);
    return RR;
  }

  function solveTets(dt, kS, kV) {
    const idt2 = 1 / (dt * dt), x = pos;
    for (let t = 0; t < nt; t++) {
      const o = 4 * t, v0 = tet[o], v1 = tet[o + 1], v2 = tet[o + 2], v3 = tet[o + 3];
      const i0 = v0 * 3, i1 = v1 * 3, i2 = v2 * 3, i3 = v3 * 3, bo = 9 * t;
      const w0 = iw[v0], w1 = iw[v1], w2 = iw[v2], w3 = iw[v3];
      const d00 = x[i1] - x[i0], d10 = x[i1 + 1] - x[i0 + 1], d20 = x[i1 + 2] - x[i0 + 2];
      const d01 = x[i2] - x[i0], d11 = x[i2 + 1] - x[i0 + 1], d21 = x[i2 + 2] - x[i0 + 2];
      const d02 = x[i3] - x[i0], d12 = x[i3 + 1] - x[i0 + 1], d22 = x[i3 + 2] - x[i0 + 2];
      const b00 = BM[bo], b01 = BM[bo + 1], b02 = BM[bo + 2], b10 = BM[bo + 3], b11 = BM[bo + 4], b12 = BM[bo + 5], b20 = BM[bo + 6], b21 = BM[bo + 7], b22 = BM[bo + 8];
      const f00 = d00 * b00 + d01 * b10 + d02 * b20, f01 = d00 * b01 + d01 * b11 + d02 * b21, f02 = d00 * b02 + d01 * b12 + d02 * b22;
      const f10 = d10 * b00 + d11 * b10 + d12 * b20, f11 = d10 * b01 + d11 * b11 + d12 * b21, f12 = d10 * b02 + d11 * b12 + d12 * b22;
      const f20 = d20 * b00 + d21 * b10 + d22 * b20, f21 = d20 * b01 + d21 * b11 + d22 * b21, f22 = d20 * b02 + d21 * b12 + d22 * b22;
      const R = extractRot(f00, f01, f02, f10, f11, f12, f20, f21, f22, 4 * t, 1);
      const e00 = f00 - R[0], e01 = f01 - R[1], e02 = f02 - R[2], e10 = f10 - R[3], e11 = f11 - R[4], e12 = f12 - R[5], e20 = f20 - R[6], e21 = f21 - R[7], e22 = f22 - R[8];
      const C = Math.sqrt(e00 * e00 + e01 * e01 + e02 * e02 + e10 * e10 + e11 * e11 + e12 * e12 + e20 * e20 + e21 * e21 + e22 * e22);
      if (C > 1e-7) {
        const ic = 1 / C;
        const g1x = (e00 * b00 + e01 * b01 + e02 * b02) * ic, g1y = (e10 * b00 + e11 * b01 + e12 * b02) * ic, g1z = (e20 * b00 + e21 * b01 + e22 * b02) * ic;
        const g2x = (e00 * b10 + e01 * b11 + e02 * b12) * ic, g2y = (e10 * b10 + e11 * b11 + e12 * b12) * ic, g2z = (e20 * b10 + e21 * b11 + e22 * b12) * ic;
        const g3x = (e00 * b20 + e01 * b21 + e02 * b22) * ic, g3y = (e10 * b20 + e11 * b21 + e12 * b22) * ic, g3z = (e20 * b20 + e21 * b21 + e22 * b22) * ic;
        const g0x = -(g1x + g2x + g3x), g0y = -(g1y + g2y + g3y), g0z = -(g1z + g2z + g3z);
        const den = w0 * (g0x * g0x + g0y * g0y + g0z * g0z) + w1 * (g1x * g1x + g1y * g1y + g1z * g1z) + w2 * (g2x * g2x + g2y * g2y + g2z * g2z) + w3 * (g3x * g3x + g3y * g3y + g3z * g3z) + ik[t] / kS * idt2;
        const dl = -C / den;
        x[i0] += w0 * g0x * dl; x[i0 + 1] += w0 * g0y * dl; x[i0 + 2] += w0 * g0z * dl;
        x[i1] += w1 * g1x * dl; x[i1 + 1] += w1 * g1y * dl; x[i1 + 2] += w1 * g1z * dl;
        x[i2] += w2 * g2x * dl; x[i2 + 1] += w2 * g2y * dl; x[i2 + 2] += w2 * g2z * dl;
        x[i3] += w3 * g3x * dl; x[i3 + 1] += w3 * g3y * dl; x[i3 + 2] += w3 * g3z * dl;
      }
      // volume
      const a1x = x[i1] - x[i0], a1y = x[i1 + 1] - x[i0 + 1], a1z = x[i1 + 2] - x[i0 + 2];
      const a2x = x[i2] - x[i0], a2y = x[i2 + 1] - x[i0 + 1], a2z = x[i2 + 2] - x[i0 + 2];
      const a3x = x[i3] - x[i0], a3y = x[i3 + 1] - x[i0 + 1], a3z = x[i3 + 2] - x[i0 + 2];
      const h1x = (a2y * a3z - a2z * a3y) / 6, h1y = (a2z * a3x - a2x * a3z) / 6, h1z = (a2x * a3y - a2y * a3x) / 6;
      const h2x = (a3y * a1z - a3z * a1y) / 6, h2y = (a3z * a1x - a3x * a1z) / 6, h2z = (a3x * a1y - a3y * a1x) / 6;
      const h3x = (a1y * a2z - a1z * a2y) / 6, h3y = (a1z * a2x - a1x * a2z) / 6, h3z = (a1x * a2y - a1y * a2x) / 6;
      const Vc = (a1x * h1x + a1y * h1y + a1z * h1z), Cv = Vc - V0s[t];
      const h0x = -(h1x + h2x + h3x), h0y = -(h1y + h2y + h3y), h0z = -(h1z + h2z + h3z);
      const dv = w0 * (h0x * h0x + h0y * h0y + h0z * h0z) + w1 * (h1x * h1x + h1y * h1y + h1z * h1z) + w2 * (h2x * h2x + h2y * h2y + h2z * h2z) + w3 * (h3x * h3x + h3y * h3y + h3z * h3z) + (V0[t] / kV) * idt2;
      const dlv = -Cv / dv;
      x[i0] += w0 * h0x * dlv; x[i0 + 1] += w0 * h0y * dlv; x[i0 + 2] += w0 * h0z * dlv;
      x[i1] += w1 * h1x * dlv; x[i1 + 1] += w1 * h1y * dlv; x[i1 + 2] += w1 * h1z * dlv;
      x[i2] += w2 * h2x * dlv; x[i2 + 1] += w2 * h2y * dlv; x[i2 + 2] += w2 * h2z * dlv;
      x[i3] += w3 * h3x * dlv; x[i3 + 1] += w3 * h3y * dlv; x[i3 + 2] += w3 * h3z * dlv;
    }
  }

  function collideHands(si, nsub) {
    const f1 = (si + 1) / nsub, inv = 1 / nsub;
    for (let a = 0; a < nact; a++) {
      const o = act[a] * 8, r = col[o + 3], r2 = r * r, px = col[o + 4], py = col[o + 5], pz = col[o + 6];
      const mx = (col[o] - px) * inv, my = (col[o + 1] - py) * inv, mz = (col[o + 2] - pz) * inv;
      const cx = px + (col[o] - px) * f1, cy = py + (col[o + 1] - py) * f1, cz = pz + (col[o + 2] - pz) * f1;
      for (let q = cstart[a]; q < cstart[a + 1]; q++) {
        const i = cpool[q] * 3;
        const dx = pos[i] - cx; if (dx > r || dx < -r) continue;
        const dy = pos[i + 1] - cy; if (dy > r || dy < -r) continue;
        const dz = pos[i + 2] - cz; if (dz > r || dz < -r) continue;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r2) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, nz = dz / d, push = r - d;
        pos[i] += nx * push; pos[i + 1] += ny * push; pos[i + 2] += nz * push;
        const vn = mx * nx + my * ny + mz * nz; // carry along with the hand's tangential motion (grip)
        pos[i] += (mx - vn * nx) * 0.5; pos[i + 1] += (my - vn * ny) * 0.5; pos[i + 2] += (mz - vn * nz) * 0.5;
      }
    }
  }
  function substep(dt, kS, kV, si, nsub) {
    for (let i = 0; i < nv * 3; i += 3) {
      prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2];
      vel[i + 1] -= G_ACC * S.g * dt;
      pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt;
    }
    if (grabs.size) {
      const at = 0.06 / (dt * dt);
      for (const g of grabs.values()) for (let n = 0; n < g.idx.length; n++) {
        const v = g.idx[n], i = v * 3, wgt = g.wt[n];
        const f = iw[v] / (iw[v] + at / wgt);
        pos[i] += (g.tx[n] - pos[i]) * f; pos[i + 1] += (g.ty[n] - pos[i + 1]) * f; pos[i + 2] += (g.tz[n] - pos[i + 2]) * f;
      }
    }
    solveTets(dt, kS, kV);
    if (nact) collideHands(si, nsub);
    const id = 1 / dt;
    for (let i = 0; i < nv * 3; i += 3) {
      if (pos[i + 1] < 0) {
        const dy = -pos[i + 1]; pos[i + 1] = 0;
        const dx = pos[i] - prev[i], dz = pos[i + 2] - prev[i + 2], d = Math.hypot(dx, dz), mf = FLOOR_MU * dy;
        if (d < mf) { pos[i] = prev[i]; pos[i + 2] = prev[i + 2]; } else { const s = (d - mf) / d; pos[i] = prev[i] + dx * s; pos[i + 2] = prev[i + 2] + dz * s; }
      }
      vel[i] = (pos[i] - prev[i]) * id; vel[i + 1] = (pos[i + 1] - prev[i + 1]) * id; vel[i + 2] = (pos[i + 2] - prev[i + 2]) * id;
    }
  }

  function edgeDamp(k) {
    const e = L.edges;
    for (let n = 0; n < e.length; n += 2) {
      const a = e[n], b = e[n + 1], ia = a * 3, ib = b * 3;
      const dx = pos[ib] - pos[ia], dy = pos[ib + 1] - pos[ia + 1], dz = pos[ib + 2] - pos[ia + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9;
      const rv = ((vel[ib] - vel[ia]) * dx + (vel[ib + 1] - vel[ia + 1]) * dy + (vel[ib + 2] - vel[ia + 2]) * dz) / l;
      const s = iw[a] + iw[b], ja = rv * k * iw[a] / s / l, jb = rv * k * iw[b] / s / l;
      vel[ia] += dx * ja; vel[ia + 1] += dy * ja; vel[ia + 2] += dz * ja;
      vel[ib] -= dx * jb; vel[ib + 1] -= dy * jb; vel[ib + 2] -= dz * jb;
    }
  }

  // pseudo-fluid propulsion: no water in the sim, so a gentle controller supplies forward thrust, a turn rate and depth hold
  const SW = { home: null, wasGrab: false, om: 0, inv: 0, flip: 0, pa: 0 };
  const upDot = () => { let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0; for (const v of dorsIdx) { a += pos[3 * v]; b += pos[3 * v + 1]; c += pos[3 * v + 2]; } for (const v of ventIdx) { d += pos[3 * v]; e += pos[3 * v + 1]; f += pos[3 * v + 2]; } const n1 = dorsIdx.length, n2 = ventIdx.length, x = a / n1 - d / n2, y = b / n1 - e / n2, z = c / n1 - f / n2; return y / (Math.hypot(x, y, z) || 1); };
  function swimDrive(dt) {
    if (grabs.size) { SW.wasGrab = true; SW.fh = null; return; }
    const oc = Math.max(0, Math.min(1, (S.drag - 0.05) / 0.85));
    if (S.swim < 0.02) { // ocean gravity alone: lift off the floor to a gentle float, stay level
      SW.home = null; S.bend = 0; if (SW.fh === undefined) SW.fh = null;
      if (oc <= 0.05) { // resting on the floor: if it ends up on its side or belly-up, after a moment it flips itself back
        const uy = upDot(); SW.inv = uy < 0.45 ? (SW.inv || 0) + dt : 0;
        if (SW.inv > 2.2 || SW.flip > 0) {
          if (!(SW.flip > 0)) { SW.flip = 1.6; for (let i = 1; i < nv * 3; i += 3) vel[i] += 1.1; } // small hop
          SW.flip -= dt; if (SW.flip <= 0) SW.inv = 0; upright(dt, 2.6); if (uy > 0.85) { SW.flip = 0; SW.inv = 0; }
        }
      } else SW.inv = SW.flip = 0;
      if (oc > 0.05) {
        upright(dt, 0.45 * oc);
        let cy = 0, my = 0; for (let i = 0; i < nv * 3; i += 3) { cy += pos[i + 1]; my += vel[i + 1]; } cy /= nv; my /= nv;
        if (SW.fh == null || SW.wasGrab) { SW.fh = Math.max(0.6, cy); SW.wasGrab = false; SW.ei = 0; } // float where you let it go
        SW.ei = Math.max(-0.5, Math.min(0.5, SW.ei + (SW.fh - cy) * dt * 0.8));
        const vt = Math.max(-0.35, Math.min(0.35, (SW.fh - cy) * 2.0 + SW.ei)), k = Math.min(1, 2.5 * dt) * oc; for (let i = 1; i < nv * 3; i += 3) vel[i] += (vt - my) * k;
      }
      return;
    }
    upright(dt, 1, SW.pa || 0);
    let cx = 0, cy = 0, cz = 0, mx = 0, my = 0, mz = 0;
    for (let i = 0; i < nv * 3; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; mx += vel[i]; my += vel[i + 1]; mz += vel[i + 2]; }
    cx /= nv; cy /= nv; cz /= nv; mx /= nv; my /= nv; mz /= nv;
    if (!SW.home || SW.wasGrab) { SW.home = [cx, cz]; S.swimH = Math.max(0.75, cy); SW.wasGrab = false; SW.ei = 0; } // where you let go is where it swims
    let hx = 0, hz = 0, tx = 0, tz = 0;
    for (const v of headIdx) { hx += pos[3 * v]; hz += pos[3 * v + 2]; } for (const v of tailIdx) { tx += pos[3 * v]; tz += pos[3 * v + 2]; }
    hx /= headIdx.length || 1; hz /= headIdx.length || 1; tx /= tailIdx.length || 1; tz /= tailIdx.length || 1;
    let fx = hx - tx, fz = hz - tz; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const sw = S.swim, k = Math.min(1, 2.2 * dt);
    // keep the loop near where it started: steer back when it strays
    const dx = SW.home[0] - cx, dz = SW.home[1] - cz, dh = Math.hypot(dx, dz);
    let wT = S.turn, cr_ = S.cruise, vyH = null;
    if (S.hunt && (dh < 3.0 || S.huntFree)) { if (S.huntFree) SW.home = [cx, cz]; // slowly turn toward the nearest krill and creep after it
      const mf = mouthFrame(), ex = S.hunt[0] - mf.f[0], ez = S.hunt[2] - mf.f[2], el = Math.hypot(ex, ez) + 1e-6;
      wT = Math.max(-0.8, Math.min(0.8, 1.5 * Math.atan2(fz * ex - fx * ez, fx * ex + fz * ez)));
      cr_ = S.cruise * (el < 0.9 ? 0.55 : (S.huntFree && el > 1.4 ? 1.25 : 0.8)); vyH = Math.max(-0.35, Math.min(0.35, (S.hunt[1] - mf.f[1]) * 0.9));
    } else if (dh > 1.3) { const cr = fx * dz - fz * dx; wT += Math.max(-1, Math.min(1, -cr / dh)) * Math.min(1.2, (dh - 1.3)); }
    SW.om += (wT - SW.om) * Math.min(1, 1.5 * dt);
    SW.ei = Math.max(-0.5, Math.min(0.5, (SW.ei || 0) + (S.swimH - cy) * dt * 0.8));
    const vyT = vyH !== null ? vyH : Math.max(-0.5, Math.min(0.5, (S.swimH - cy) * 2.0 + SW.ei));
    SW.pa = (SW.pa || 0) + (Math.max(-0.45, Math.min(0.45, Math.atan2(my, Math.max(0.15, cr_)) * 1.1)) * sw - (SW.pa || 0)) * Math.min(1, dt * 1.5); // nose follows the climb/dive
    const ax = (fx * cr_ * sw - mx) * k, ay = (vyT * sw - my) * k, az = (fz * cr_ * sw - mz) * k;
    let num = 0, den = 0;
    for (let i = 0; i < nv * 3; i += 3) { const rx = pos[i] - cx, rz = pos[i + 2] - cz; num += rz * (vel[i] - mx) - rx * (vel[i + 2] - mz); den += rx * rx + rz * rz; }
    const wc = num / (den || 1), dw = (SW.om * sw - wc) * k;
    for (let i = 0; i < nv * 3; i += 3) { const rx = pos[i] - cx, rz = pos[i + 2] - cz; vel[i] += ax + dw * rz; vel[i + 1] += ay; vel[i + 2] += az - dw * rx; }
    S.bend = Math.max(-0.14, Math.min(0.14, SW.om * 0.55)) * sw; // lean the body into the turn
  }
  function step(dtFrame) {
    S.time += dtFrame;
    updateActuation();
    const kS = 8 * Math.pow(100, S.firm) * (1 + 5 * Math.pow(S.firm, 4)), kV = kS * 14 + 60;
    const n = S.nsub, dt = dtFrame / n;
    // keep only colliders that can touch the jelly this frame
    nact = 0;
    if (ncol) {
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let i = 0; i < nv * 3; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      for (let c = 0; c < ncol; c++) { const o = c * 8, r = col[o + 3] + 0.05; if (col[o] > x0 - r && col[o] < x1 + r && col[o + 1] > y0 - r && col[o + 1] < y1 + r && col[o + 2] > z0 - r && col[o + 2] < z1 + r) act[nact++] = c; }
    }
    if (nact) { // per-collider candidate vertices (those that can reach it this frame), so the substeps only scan a few
      if (!cpool) cpool = new Int32Array(Math.min(nv * 24, 400000));
      let w = 0;
      for (let a = 0; a < nact; a++) {
        cstart[a] = w; const o = act[a] * 8, reach = col[o + 3] + 0.12 + Math.hypot(col[o] - col[o + 4], col[o + 1] - col[o + 5], col[o + 2] - col[o + 6]);
        for (let v = 0; v < nv && w < cpool.length; v++) { const i = v * 3; if (Math.abs(pos[i] - col[o]) < reach && Math.abs(pos[i + 1] - col[o + 1]) < reach && Math.abs(pos[i + 2] - col[o + 2]) < reach) cpool[w++] = v; }
      }
      cstart[nact] = w;
    }
    for (let s = 0; s < n; s++) substep(dt, kS, kV, s, n);
    edgeDamp(S.damp * 0.45);
    swimDrive(dtFrame);
    const dec = Math.exp(-(0.25 + S.drag) * dtFrame);
    for (let i = 0; i < vel.length; i++) vel[i] *= dec;
  }
  function volumeRatio() {
    let v = 0, v0 = 0;
    for (let t = 0; t < nt; t++) {
      const i0 = tet[4 * t] * 3, i1 = tet[4 * t + 1] * 3, i2 = tet[4 * t + 2] * 3, i3 = tet[4 * t + 3] * 3;
      const a1x = pos[i1] - pos[i0], a1y = pos[i1 + 1] - pos[i0 + 1], a1z = pos[i1 + 2] - pos[i0 + 2], a2x = pos[i2] - pos[i0], a2y = pos[i2 + 1] - pos[i0 + 1], a2z = pos[i2 + 2] - pos[i0 + 2], a3x = pos[i3] - pos[i0], a3y = pos[i3 + 1] - pos[i0 + 1], a3z = pos[i3 + 2] - pos[i0 + 2];
      v += (a1x * (a2y * a3z - a2z * a3y) + a1y * (a2z * a3x - a2x * a3z) + a1z * (a2x * a3y - a2y * a3x)) / 6; v0 += V0[t];
    }
    return v / v0;
  }
  function reset() { pos.set(L.rest); vel.fill(0); for (let t = 0; t < nt; t++) { tq[4 * t] = tq[4 * t + 1] = tq[4 * t + 2] = 0; tq[4 * t + 3] = 1; } S.jaw = 0; S.flare = 0; S.swish = 0; S.grab = null; S.swim = 0; S.swimMix = 0; S.bend = 0; S.g = 1; S.drag = 0; SW.home = null; SW.om = 0; }
  const P = (v) => [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
  function mouthFrame() {
    const uf = P(UF), lf = P(LF), ub = P(UB), lb = P(LB_);
    const f = [(uf[0] + lf[0]) / 2, (uf[1] + lf[1]) / 2, (uf[2] + lf[2]) / 2], b = [(ub[0] + lb[0]) / 2, (ub[1] + lb[1]) / 2, (ub[2] + lb[2]) / 2];
    const len = Math.hypot(b[0] - f[0], b[1] - f[1], b[2] - f[2]);
    return { f, e: [(b[0] - f[0]) / len, (b[1] - f[1]) / len, (b[2] - f[2]) / len], len };
  }
  const gapeMM = () => Math.hypot(...P(UF).map((c, i) => c - P(LF)[i])) * 100;
  function pickVertex(ro, rd) {
    let best = -1, bt = 1e9;
    for (const v of surfV) {
      const px = pos[3 * v] - ro[0], py = pos[3 * v + 1] - ro[1], pz = pos[3 * v + 2] - ro[2];
      const t = px * rd[0] + py * rd[1] + pz * rd[2]; if (t < 0) continue;
      const d = Math.hypot(px - rd[0] * t, py - rd[1] * t, pz - rd[2] * t);
      if (d < 0.05 && t < bt) { bt = t; best = v; }
    }
    return best;
  }
  function beginGrab(v, fwd, id = 0) {
    const c = P(v), idx = [], off = [];
    for (let u = 0; u < nv; u++) { const d = Math.hypot(pos[3 * u] - c[0], pos[3 * u + 1] - c[1], pos[3 * u + 2] - c[2]); if (d < 0.1) { idx.push(u); off.push([pos[3 * u] - c[0], pos[3 * u + 1] - c[1], pos[3 * u + 2] - c[2], 1 - d / 0.1]); } }
    const gr = { id, idx: Int32Array.from(idx), off, wt: Float32Array.from(off.map(o => 0.25 + 0.75 * o[3])), tx: new Float32Array(idx.length), ty: new Float32Array(idx.length), tz: new Float32Array(idx.length), c0: c, fwd, twist: 0, vtx: v };
    grabs.set(id, gr); moveGrab(c, 0, id); return gr;
  }
  function moveGrab(target, twist, id = 0) {
    const g = grabs.get(id); if (!g) return;
    const ax = g.fwd, c = Math.cos(twist), s = Math.sin(twist);
    for (let n = 0; n < g.idx.length; n++) {
      const o = g.off[n], d = o[0] * ax[0] + o[1] * ax[1] + o[2] * ax[2];
      const cx = ax[1] * o[2] - ax[2] * o[1], cy = ax[2] * o[0] - ax[0] * o[2], cz = ax[0] * o[1] - ax[1] * o[0];
      g.tx[n] = target[0] + o[0] * c + cx * s + ax[0] * d * (1 - c); g.ty[n] = target[1] + o[1] * c + cy * s + ax[1] * d * (1 - c); g.tz[n] = target[2] + o[2] * c + cz * s + ax[2] * d * (1 - c);
    }
  }
  const endGrab = (id = 0) => { if (id < 0) grabs.clear(); else grabs.delete(id); };
  const totalMassG = 1.05 * totalV * 1000;
  return { L, S, YM, MOUTH, H, nv, nt, pos, vel, nrm, bnrm, computeNormals, R, B: Bm, skin, step, reset, volumeRatio, gapeMM, mouthFrame, pickVertex, beginGrab, moveGrab, endGrab, setColliders, cols: () => ({ a: col, n: ncol }), eyeP, spirP, eyeV, eyeR, totalMassG, totalV, P, surfV };
}

// ---------------------------------------------------------------- krill (rigid elongated beads)
const KPI = 11, KMAX = 260, K_HALF = 0.018, K_R = 0.0125;
function createKrill(world) {
  const K = { n: 0, p: new Float32Array(KMAX * 3), q: new Float32Array(KMAX * 4), v: new Float32Array(KMAX * 3), w: new Float32Array(KMAX * 3), shade: new Float32Array(KMAX), eaten: 0, gs: 1, dr: 0, level: 0.5, inst: new Float32Array((KMAX * KPI + 2) * 12), grid: null };
  const rnd = Math.random;
  K.spawn = (cnt, around) => {
    for (let i = 0; i < cnt; i++) {
      let k; if (K.n < KMAX) k = K.n++; else k = (rnd() * KMAX) | 0;
      const front = rnd() < 0.8;
      if (around) { // ocean mode: a cloud floating around the shark at its own depth
        const th = rnd() * 6.2832, rr = 0.7 + rnd() * 1.5;
        K.p[3 * k] = around[0] + Math.cos(th) * rr; K.p[3 * k + 1] = Math.max(0.15, around[1] + (rnd() - 0.5) * 0.5); K.p[3 * k + 2] = around[2] + Math.sin(th) * rr;
      } else { K.p[3 * k] = front ? -0.15 - rnd() * 0.95 : 0.6 + rnd() * 1.8; K.p[3 * k + 1] = 0.25 + rnd() * 0.9; K.p[3 * k + 2] = (rnd() - 0.5) * (front ? 1.1 : 2.0); }
      const q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], l = Math.hypot(...q);
      for (let c = 0; c < 4; c++) K.q[4 * k + c] = q[c] / l;
      K.v[3 * k] = (rnd() - 0.5) * 0.3; K.v[3 * k + 1] = 0; K.v[3 * k + 2] = (rnd() - 0.5) * 0.3;
      K.w[3 * k] = K.w[3 * k + 1] = K.w[3 * k + 2] = 0; K.shade[k] = rnd();
    }
  };
  K.nearest = (fx, fy, fz, maxd) => { let b = -1, bd = maxd * maxd; for (let k = 0; k < K.n; k++) { const dx = K.p[3 * k] - fx, dy = K.p[3 * k + 1] - fy, dz = K.p[3 * k + 2] - fz, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; b = k; } } return b < 0 ? null : { k: b, d: Math.sqrt(bd) }; };
  K.clear = () => { K.n = 0; K.eaten = 0; };
  const rm = (k) => { const l = --K.n; if (k === l) return; for (let c = 0; c < 3; c++) { K.p[3 * k + c] = K.p[3 * l + c]; K.v[3 * k + c] = K.v[3 * l + c]; K.w[3 * k + c] = K.w[3 * l + c]; } for (let c = 0; c < 4; c++) K.q[4 * k + c] = K.q[4 * l + c]; K.shade[k] = K.shade[l]; };
  // triangle grid
  const CS = 0.12; let gMin = [0, 0, 0], gDim = [1, 1, 1], cellStart = new Int32Array(2), cellItems = new Int32Array(1);
  function buildGrid() {
    const pos = world.pos, tri = world.L.tri, nT = tri.length / 3;
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const v of world.surfV) for (let c = 0; c < 3; c++) { const x = pos[3 * v + c]; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; }
    gMin = mn.map(x => x - 0.1); gDim = mx.map((x, c) => Math.min(70, Math.ceil((x + 0.1 - gMin[c]) / CS) + 1));
    const nC = gDim[0] * gDim[1] * gDim[2]; const cnt = new Int32Array(nC + 1);
    const rng = (t) => {
      const a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3, r = [];
      for (let k = 0; k < 3; k++) { const lo = Math.min(pos[a + k], pos[b + k], pos[c + k]), hi = Math.max(pos[a + k], pos[b + k], pos[c + k]); r.push(Math.max(0, Math.floor((lo - gMin[k]) / CS)), Math.min(gDim[k] - 1, Math.floor((hi - gMin[k]) / CS))); }
      return r;
    };
    for (let t = 0; t < nT; t++) { const r = rng(t); for (let z = r[4]; z <= r[5]; z++) for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) cnt[(z * gDim[1] + y) * gDim[0] + x + 1]++; }
    for (let i = 0; i < nC; i++) cnt[i + 1] += cnt[i];
    cellStart = cnt; const fill = new Int32Array(nC); cellItems = new Int32Array(cnt[nC]);
    for (let t = 0; t < nT; t++) { const r = rng(t); for (let z = r[4]; z <= r[5]; z++) for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) { const c = (z * gDim[1] + y) * gDim[0] + x; cellItems[cellStart[c] + fill[c]++] = t; } }
  }
  function closestTri(px, py, pz, t, out) { // Ericson
    const pos = world.pos, tri = world.L.tri, a = tri[3 * t] * 3, b = tri[3 * t + 1] * 3, c = tri[3 * t + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const abx = pos[b] - ax, aby = pos[b + 1] - ay, abz = pos[b + 2] - az, acx = pos[c] - ax, acy = pos[c + 1] - ay, acz = pos[c + 2] - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    let u, v, w;
    if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
      const bpx = px - pos[b], bpy = py - pos[b + 1], bpz = pz - pos[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; } else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const s = d1 / (d1 - d3); u = 1 - s; v = s; w = 0; } else {
          const cpx = px - pos[c], cpy = py - pos[c + 1], cpz = pz - pos[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; } else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const s = d2 / (d2 - d6); u = 1 - s; v = 0; w = s; } else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const s = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - s; w = s; } else { const dn = 1 / (va + vb + vc); v = vb * dn; w = vc * dn; u = 1 - v - w; }
            }
          }
        }
      }
    }
    out[0] = u * ax + v * pos[b] + w * pos[c]; out[1] = u * ay + v * pos[b + 1] + w * pos[c + 1]; out[2] = u * az + v * pos[b + 2] + w * pos[c + 2];
    out[3] = abx * acy - aby * acx; // placeholder
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx, nl = Math.hypot(nx, ny, nz) + 1e-12;
    out[3] = nx / nl; out[4] = ny / nl; out[5] = nz / nl;
    const vel = world.vel; out[6] = u * vel[a] + v * vel[tri[3 * t + 1] * 3] + w * vel[c]; out[7] = u * vel[a + 1] + v * vel[tri[3 * t + 1] * 3 + 1] + w * vel[c + 1]; out[8] = u * vel[a + 2] + v * vel[tri[3 * t + 1] * 3 + 2] + w * vel[c + 2];
  }
  const cp = new Float32Array(9), IP = 3.4e-4, IA = 7.2e-5;
  const Iinv = (v, a) => { const d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2]; return [(v[0] - a[0] * d) / IP + a[0] * d / IA, (v[1] - a[1] * d) / IP + a[1] * d / IA, (v[2] - a[2] * d) / IP + a[2] * d / IA]; };
  function contact(k, ax, cxp, cyp, czp, nx, ny, nz, depth, vsx, vsy, vsz) {
    const bx = K.p[3 * k], by = K.p[3 * k + 1], bz = K.p[3 * k + 2];
    K.p[3 * k] += nx * depth; K.p[3 * k + 1] += ny * depth; K.p[3 * k + 2] += nz * depth;
    const rx = cxp - bx, ry = cyp - by, rz = czp - bz;
    const vx = K.v[3 * k], vy = K.v[3 * k + 1], vz = K.v[3 * k + 2], wx = K.w[3 * k], wy = K.w[3 * k + 1], wz = K.w[3 * k + 2];
    const ux = vx + wy * rz - wz * ry - vsx, uy = vy + wz * rx - wx * rz - vsy, uz = vz + wx * ry - wy * rx - vsz;
    const vn = ux * nx + uy * ny + uz * nz; if (vn >= 0) return;
    const rn = [ry * nz - rz * ny, rz * nx - rx * nz, rx * ny - ry * nx], ir = Iinv(rn, ax);
    const den = 1 + rn[0] * ir[0] + rn[1] * ir[1] + rn[2] * ir[2];
    const e = vn < -0.5 ? 0.35 : 0.05, j = -(1 + e) * vn / den;
    K.v[3 * k] += j * nx; K.v[3 * k + 1] += j * ny; K.v[3 * k + 2] += j * nz;
    let dw = Iinv(rn, ax); K.w[3 * k] += dw[0] * j; K.w[3 * k + 1] += dw[1] * j; K.w[3 * k + 2] += dw[2] * j;
    // friction
    const tx = ux - vn * nx, ty = uy - vn * ny, tz = uz - vn * nz, tl = Math.hypot(tx, ty, tz); if (tl < 1e-6) return;
    const tdx = tx / tl, tdy = ty / tl, tdz = tz / tl, rt = [ry * tdz - rz * tdy, rz * tdx - rx * tdz, rx * tdy - ry * tdx], it = Iinv(rt, ax);
    const dt_ = 1 + rt[0] * it[0] + rt[1] * it[1] + rt[2] * it[2];
    const jt = Math.min(0.55 * j, tl / dt_);
    K.v[3 * k] -= jt * tdx; K.v[3 * k + 1] -= jt * tdy; K.v[3 * k + 2] -= jt * tdz;
    K.w[3 * k] -= it[0] * jt; K.w[3 * k + 1] -= it[1] * jt; K.w[3 * k + 2] -= it[2] * jt;
  }
  K.step = (dt, gulp) => {
    if (!K.n) return;
    buildGrid();
    const mf = world.mouthFrame(), subs = 2, h = dt / subs, hc_ = world.cols(), hca = hc_.a, hcn = hc_.n, ihd = 1 / Math.max(dt, 1e-3);
    for (let s = 0; s < subs; s++) {
      for (let k = 0; k < K.n; k++) {
        const q = K.q, o = 4 * k;
        K.v[3 * k + 1] -= 9.5 * h * K.gs;
        if (K.gs < 0.5) { // floating: hover near the shark's depth and drift a little
          K.v[3 * k + 1] += (K.level - K.p[3 * k + 1]) * 1.1 * h; K.v[3 * k] += (rnd() - 0.5) * 0.9 * h; K.v[3 * k + 1] += (rnd() - 0.5) * 0.5 * h; K.v[3 * k + 2] += (rnd() - 0.5) * 0.9 * h;
        }
        // gulp: steer krill in front of the mouth toward it
        if (gulp > 0.01) {
          const dx = mf.f[0] - K.p[3 * k], dy = mf.f[1] - K.p[3 * k + 1], dz = mf.f[2] - K.p[3 * k + 2], dd = Math.hypot(dx, dy, dz);
          const front = -(dx * mf.e[0] + dy * mf.e[1] + dz * mf.e[2]); // >0 if krill is outside the mouth plane
          if (dd < 1.8 && front > -0.12) {
            const fall = Math.pow(1 - dd / 1.8, 1.4);
            let tx = dx, ty = dy, tz = dz;
            if (dd < 0.22) { tx += mf.e[0] * 0.12; ty += mf.e[1] * 0.12; tz += mf.e[2] * 0.12; }
            const tl = Math.hypot(tx, ty, tz) + 1e-6, gain = (70 * fall + 14) * gulp * h;
            K.v[3 * k] += tx / tl * gain; K.v[3 * k + 1] += ty / tl * gain + 9.5 * h * 0.8 * gulp * K.gs; K.v[3 * k + 2] += tz / tl * gain;
            K.v[3 * k] *= 1 - 0.8 * h * gulp; K.v[3 * k + 2] *= 1 - 0.8 * h * gulp;
          }
        }
        const kd = 1 - (0.3 + K.dr) * h; K.v[3 * k] *= kd; K.v[3 * k + 1] *= kd; K.v[3 * k + 2] *= kd; K.w[3 * k] *= 1 - 0.8 * h; K.w[3 * k + 1] *= 1 - 0.8 * h; K.w[3 * k + 2] *= 1 - 0.8 * h;
        K.p[3 * k] += K.v[3 * k] * h; K.p[3 * k + 1] += K.v[3 * k + 1] * h; K.p[3 * k + 2] += K.v[3 * k + 2] * h;
        const wx = K.w[3 * k], wy = K.w[3 * k + 1], wz = K.w[3 * k + 2], qx = q[o], qy = q[o + 1], qz = q[o + 2], qw = q[o + 3];
        q[o] += 0.5 * h * (wx * qw + wy * qz - wz * qy); q[o + 1] += 0.5 * h * (wy * qw + wz * qx - wx * qz); q[o + 2] += 0.5 * h * (wz * qw + wx * qy - wy * qx); q[o + 3] += 0.5 * h * (-wx * qx - wy * qy - wz * qz);
        const il = 1 / Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]); q[o] *= il; q[o + 1] *= il; q[o + 2] *= il; q[o + 3] *= il;
        const ax = [1 - 2 * (q[o + 1] * q[o + 1] + q[o + 2] * q[o + 2]), 2 * (q[o] * q[o + 1] + q[o + 2] * q[o + 3]), 2 * (q[o] * q[o + 2] - q[o + 1] * q[o + 3])];
        // dish wall
        const rx = K.p[3 * k] - 1.5, rz = K.p[3 * k + 2], rr = Math.hypot(rx, rz);
        if (rr > 2.4) { const nx = -rx / rr, nz = -rz / rr, vn = K.v[3 * k] * nx + K.v[3 * k + 2] * nz; K.p[3 * k] += nx * (rr - 2.4); K.p[3 * k + 2] += nz * (rr - 2.4); if (vn < 0) { K.v[3 * k] -= 1.6 * vn * nx; K.v[3 * k + 2] -= 1.6 * vn * nz; } }
        for (let e = -1; e <= 1; e += 2) {
          const cx = K.p[3 * k] + ax[0] * K_HALF * e, cy = K.p[3 * k + 1] + ax[1] * K_HALF * e, cz = K.p[3 * k + 2] + ax[2] * K_HALF * e;
          if (cy < K_R) contact(k, ax, cx, cy, cz, 0, 1, 0, K_R - cy, 0, 0, 0);
          for (let c = 0; c < hcn; c++) { // hands push krill too
            const q8 = c * 8, R = hca[q8 + 3] + K_R, dx = cx - hca[q8], dy = cy - hca[q8 + 1], dz = cz - hca[q8 + 2], d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-6; contact(k, ax, cx, cy, cz, dx / d, dy / d, dz / d, R - d, (hca[q8] - hca[q8 + 4]) * ihd, (hca[q8 + 1] - hca[q8 + 5]) * ihd, (hca[q8 + 2] - hca[q8 + 6]) * ihd); }
          }
          // jelly
          const pos = world.pos;
          const gx = Math.floor((cx - gMin[0]) / CS), gy = Math.floor((cy - gMin[1]) / CS), gz = Math.floor((cz - gMin[2]) / CS);
          if (gx < 0 || gy < 0 || gz < 0 || gx >= gDim[0] || gy >= gDim[1] || gz >= gDim[2]) continue;
          for (let zz = Math.max(0, gz - 1); zz <= Math.min(gDim[2] - 1, gz + 1); zz++) for (let yy = Math.max(0, gy - 1); yy <= Math.min(gDim[1] - 1, gy + 1); yy++) for (let xx = Math.max(0, gx - 1); xx <= Math.min(gDim[0] - 1, gx + 1); xx++) {
            const c = (zz * gDim[1] + yy) * gDim[0] + xx;
            for (let it = cellStart[c]; it < cellStart[c + 1]; it++) {
              const px = K.p[3 * k] + ax[0] * K_HALF * e, py = K.p[3 * k + 1] + ax[1] * K_HALF * e, pz = K.p[3 * k + 2] + ax[2] * K_HALF * e;
              closestTri(px, py, pz, cellItems[it], cp);
              const dx = px - cp[0], dy = py - cp[1], dz = pz - cp[2], dd = Math.hypot(dx, dy, dz), inside = dx * cp[3] + dy * cp[4] + dz * cp[5] < 0;
              if (dd < K_R || (inside && dd < 0.05)) {
                let nx = cp[3], ny = cp[4], nz = cp[5], depth;
                if (inside) depth = K_R + dd; else { nx = dx / (dd + 1e-9); ny = dy / (dd + 1e-9); nz = dz / (dd + 1e-9); depth = K_R - dd; }
                contact(k, ax, px, py, pz, nx, ny, nz, depth, cp[6], cp[7], cp[8]);
              }
            }
          }
        }
      }
      // krill-krill (centres only, light)
      for (let a = 0; a < K.n; a++) for (let b = a + 1; b < K.n; b++) {
        const dx = K.p[3 * b] - K.p[3 * a], dy = K.p[3 * b + 1] - K.p[3 * a + 1], dz = K.p[3 * b + 2] - K.p[3 * a + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.0009 && d2 > 1e-10) { const d = Math.sqrt(d2), push = (0.03 - d) * 0.5, nx = dx / d, ny = dy / d, nz = dz / d; K.p[3 * a] -= nx * push; K.p[3 * a + 1] -= ny * push; K.p[3 * a + 2] -= nz * push; K.p[3 * b] += nx * push; K.p[3 * b + 1] += ny * push; K.p[3 * b + 2] += nz * push; const rv = (K.v[3 * b] - K.v[3 * a]) * nx + (K.v[3 * b + 1] - K.v[3 * a + 1]) * ny + (K.v[3 * b + 2] - K.v[3 * a + 2]) * nz; if (rv < 0) { K.v[3 * a] += nx * rv * 0.5; K.v[3 * a + 1] += ny * rv * 0.5; K.v[3 * a + 2] += nz * rv * 0.5; K.v[3 * b] -= nx * rv * 0.5; K.v[3 * b + 1] -= ny * rv * 0.5; K.v[3 * b + 2] -= nz * rv * 0.5; } }
      }
    }
    // swallow
    for (let k = K.n - 1; k >= 0; k--) {
      const dx = K.p[3 * k] - mf.f[0], dy = K.p[3 * k + 1] - mf.f[1], dz = K.p[3 * k + 2] - mf.f[2];
      const s = dx * mf.e[0] + dy * mf.e[1] + dz * mf.e[2];
      const lat = Math.hypot(dx - mf.e[0] * s, dy - mf.e[1] * s, dz - mf.e[2] * s);
      if ((s > 0.05 && s < mf.len + 0.08 && lat < 0.2) || (gulp > 0.3 && Math.hypot(dx, dy, dz) < 0.1 && s < 0.05)) { rm(k); K.eaten++; }
      else if (K.p[3 * k + 1] < -0.5 || !isFinite(K.p[3 * k])) rm(k);
    }
  };
  // each krill is drawn as a small translucent shrimp: carapace, orange organ, black eyes, curved tail, fan, antenna, legs
  const KPARTS = [
    [0.012, 0.001, 0, 0.0145, 0.0105, 0.0095, 4, 0], [0.011, -0.0035, 0, 0.0085, 0.0062, 0.0103, 5, 0],
    [0.0215, 0.0045, 0.0058, 0.0034, 0.0034, 0.0034, 1, 0], [0.0215, 0.0045, -0.0058, 0.0034, 0.0034, 0.0034, 1, 0],
    [-0.003, 0.0025, 0, 0.0088, 0.0086, 0.0076, 4, 0], [-0.0115, 0.0045, 0, 0.0078, 0.0068, 0.0060, 4, 0], [-0.0195, 0.0058, 0, 0.0066, 0.0052, 0.0045, 4, 0],
    [-0.0290, 0.0062, 0, 0.0050, 0.0016, 0.0078, 4, 0],
    [0.034, 0.002, 0.002, 0.0125, 0.0007, 0.0007, 6, 0], [0.009, -0.0125, 0, 0.0012, 0.0085, 0.0017, 6, 0], [0.0, -0.0115, 0, 0.0012, 0.0078, 0.0017, 6, 0]];
  K.parts = KPARTS;
  K.fillInstances = (eyeExt) => {
    const I = K.inst, q = K.q; let n = 0;
    for (let k = 0; k < K.n; k++) {
      const qx = q[4 * k], qy = q[4 * k + 1], qz = q[4 * k + 2], qw = q[4 * k + 3], px = K.p[3 * k], py = K.p[3 * k + 1], pz = K.p[3 * k + 2];
      for (let m = 0; m < KPI; m++, n++) {
        const P_ = KPARTS[m], o = n * 12, vx = P_[0], vy = P_[1], vz = P_[2];
        const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
        I[o] = px + vx + qw * tx + (qy * tz - qz * ty); I[o + 1] = py + vy + qw * ty + (qz * tx - qx * tz); I[o + 2] = pz + vz + qw * tz + (qx * ty - qy * tx); I[o + 3] = P_[6];
        I[o + 4] = qx; I[o + 5] = qy; I[o + 6] = qz; I[o + 7] = qw; I[o + 8] = P_[3]; I[o + 9] = P_[4]; I[o + 10] = P_[5]; I[o + 11] = K.shade[k];
      }
    }
    return n;
  };
  return K;
}
//#endregion


// ---------------------------------------------------------------- seaweed (soft gel strands rooted on the floor)
const KELP_CLUMPS = 7, KELP_PER = 5, KELP_SEG = 9, KELP_N = KELP_CLUMPS * KELP_PER, KELP_SUB = 6, KELP_INST = KELP_N * (KELP_SEG - 1) * KELP_SUB * 2;
function createKelp(world) {
  const Kp = { n: KELP_N, inst: new Float32Array(KELP_INST * 12), count: 0 };
  const P = new Float32Array(KELP_N * KELP_SEG * 3), Pv = new Float32Array(KELP_N * KELP_SEG * 3), Pp = new Float32Array(KELP_N * KELP_SEG * 3);
  const st = [];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let c = 0; c < KELP_CLUMPS; c++) {
    const th = (c + 0.2 + rnd() * 0.6) / KELP_CLUMPS * 2 * Math.PI, rr = 1.95 + rnd() * 0.4, cx = 1.5 + Math.cos(th) * rr, cz = Math.sin(th) * rr;
    for (let m = 0; m < KELP_PER; m++) {
      const i = c * KELP_PER + m, bx = cx + (rnd() - 0.5) * 0.22, bz = cz + (rnd() - 0.5) * 0.22, sp = 0.11 + rnd() * 0.11, la = rnd() * 6.283, ls = 0.25 + rnd() * 0.55;
      st.push({ cl: c, bx, bz, sp, w: 0.042 + rnd() * 0.022, lean: [Math.cos(la) * ls, Math.sin(la) * ls], tw: rnd() * 6.28, ph: rnd() * 6.28, side: [rnd() - 0.5, 0.2, rnd() - 0.5], hue: rnd() });
      for (let j = 0; j < KELP_SEG; j++) { const o = (i * KELP_SEG + j) * 3; P[o] = bx; P[o + 1] = j * sp; P[o + 2] = bz; Pp[o] = bx; Pp[o + 1] = j * sp; Pp[o + 2] = bz; }
    }
  }
  const bins = 7, bsum = new Float64Array(bins * 3), bcnt = new Int32Array(bins), brad = new Float32Array(bins);
  const binOf = new Int8Array(world.nv); for (let v = 0; v < world.nv; v++) binOf[v] = Math.max(0, Math.min(bins - 1, Math.floor(world.L.rest[3 * v] / LB * bins)));
  for (let b = 0; b < bins; b++) brad[b] = Math.max(0.1, profileAt((b + 0.5) / bins * LB).Ht * 0.8);
  let tm = 0;
  Kp.step = (dt) => {
    tm += dt; const n = 3, h = dt / n, pos = world.pos;
    bsum.fill(0); bcnt.fill(0);
    for (let v = 0; v < world.nv; v++) { const b = binOf[v]; bsum[3 * b] += pos[3 * v]; bsum[3 * b + 1] += pos[3 * v + 1]; bsum[3 * b + 2] += pos[3 * v + 2]; bcnt[b]++; }
    const hc = world.cols();
    for (let s_ = 0; s_ < n; s_++) {
      for (let i = 0; i < KELP_N; i++) {
        const S = st[i], base = i * KELP_SEG * 3;
        for (let j = 1; j < KELP_SEG; j++) {
          const o = base + j * 3, y = P[o + 1];
          Pv[o] = (P[o] - Pp[o]) / h; Pv[o + 1] = (P[o + 1] - Pp[o + 1]) / h; Pv[o + 2] = (P[o + 2] - Pp[o + 2]) / h;
          // buoyancy + a slow current that swirls with height; stronger toward the tip
          const k = j / (KELP_SEG - 1), sw = 0.55 * k;
          Pv[o] += (1.1 * Math.sin(tm * 0.8 + y * 2.1 + S.ph) + 0.5 * Math.sin(tm * 1.9 + S.ph * 2 + y * 3)) * sw * h;
          Pv[o + 2] += (1.1 * Math.cos(tm * 0.65 + y * 1.8 + S.ph) + 0.5 * Math.sin(tm * 1.7 + S.ph + y * 2.4)) * sw * h;
          Pv[o] += S.lean[0] * k * 1.6 * h; Pv[o + 2] += S.lean[1] * k * 1.6 * h; Pv[o + 1] += 4.0 * h; const dm = Math.exp(-1.9 * h); Pv[o] *= dm; Pv[o + 1] *= dm; Pv[o + 2] *= dm;
          Pp[o] = P[o]; Pp[o + 1] = P[o + 1]; Pp[o + 2] = P[o + 2];
          P[o] += Pv[o] * h; P[o + 1] += Pv[o + 1] * h; P[o + 2] += Pv[o + 2] * h;
        }
        // distance + bending constraints (soft, so the strand wobbles like gel)
        for (let it = 0; it < 4; it++) {
          for (let j = 1; j < KELP_SEG; j++) {
            const a = base + (j - 1) * 3, b = base + j * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], l = Math.hypot(dx, dy, dz) || 1e-6, d = (l - S.sp) / l;
            const wa = j === 1 ? 0 : 0.5, wb = j === 1 ? 1 : 0.5;
            P[a] += dx * d * wa; P[a + 1] += dy * d * wa; P[a + 2] += dz * d * wa; P[b] -= dx * d * wb; P[b + 1] -= dy * d * wb; P[b + 2] -= dz * d * wb;
          }
          for (let j = 2; j < KELP_SEG; j++) {
            const a = base + (j - 2) * 3, b = base + j * 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], l = Math.hypot(dx, dy, dz) || 1e-6, d = (l - 1.9 * S.sp) / l * 0.22;
            const wa = j === 2 ? 0 : 0.5, wb = j === 2 ? 1 : 0.5;
            P[a] += dx * d * wa; P[a + 1] += dy * d * wa; P[a + 2] += dz * d * wa; P[b] -= dx * d * wb; P[b + 1] -= dy * d * wb; P[b + 2] -= dz * d * wb;
          }
          // keep the root segment standing up
          { const a = base + 3, dx = P[a] - S.bx, dy = P[a + 1] + S.sp, dz = P[a + 2] - S.bz, l = Math.hypot(dx, dy, dz) || 1e-6, d = (l - 2 * S.sp) / l * 0.5; P[a] -= dx * d; P[a + 1] -= dy * d; P[a + 2] -= dz * d; }
          for (let j = 1; j < KELP_SEG; j++) {
            const o = base + j * 3; if (P[o + 1] < 0.01) P[o + 1] = 0.01;
            const rj = 0.03 + (1 - j / KELP_SEG) * 0.012;
            for (let b = 0; b < bins; b++) { // shark body
              if (!bcnt[b]) continue; const cx = bsum[3 * b] / bcnt[b], cy = bsum[3 * b + 1] / bcnt[b], cz = bsum[3 * b + 2] / bcnt[b], R = brad[b] + rj;
              const dx = P[o] - cx, dy = P[o + 1] - cy, dz = P[o + 2] - cz, d2 = dx * dx + dy * dy + dz * dz; if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-6, f = (R - d) / d; P[o] += dx * f; P[o + 1] += dy * f; P[o + 2] += dz * f; }
            }
            for (let c = 0; c < hc.n; c++) { // hands
              const q = c * 8, R = hc.a[q + 3] + rj, dx = P[o] - hc.a[q], dy = P[o + 1] - hc.a[q + 1], dz = P[o + 2] - hc.a[q + 2], d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-6, f = (R - d) / d; P[o] += dx * f; P[o + 1] += dy * f; P[o + 2] += dz * f; }
            }
          }
        }
      }
    }
  };
  // relocate a clump along the floor with a pinch
  Kp.pick = (ro, rd, maxd, pt) => { // ray (or point) -> clump index, or -1
    let best = -1, bd = maxd;
    for (let i = 0; i < KELP_N; i++) for (let j = 1; j < KELP_SEG; j++) {
      const o = (i * KELP_SEG + j) * 3; let d;
      if (pt) d = Math.hypot(P[o] - pt[0], P[o + 1] - pt[1], P[o + 2] - pt[2]);
      else { const vx = P[o] - ro[0], vy = P[o + 1] - ro[1], vz = P[o + 2] - ro[2], t = vx * rd[0] + vy * rd[1] + vz * rd[2]; if (t < 0) continue; d = Math.hypot(vx - rd[0] * t, vy - rd[1] * t, vz - rd[2] * t); }
      if (d < bd) { bd = d; best = st[i].cl; }
    }
    return best;
  };
  Kp.root = (c) => { let x = 0, z = 0, n = 0; for (let i = 0; i < KELP_N; i++) if (st[i].cl === c) { x += st[i].bx; z += st[i].bz; n++; } return [x / n, z / n]; };
  Kp.move = (c, x, z) => {
    const r0 = Kp.root(c); let rx = x - 1.5, rz = z, rr = Math.hypot(rx, rz); if (rr > 2.25) { x = 1.5 + rx / rr * 2.25; z = rz / rr * 2.25; }
    const dx = x - r0[0], dz = z - r0[1];
    for (let i = 0; i < KELP_N; i++) if (st[i].cl === c) { st[i].bx += dx; st[i].bz += dz; for (let j = 0; j < KELP_SEG; j++) { const o = (i * KELP_SEG + j) * 3; P[o] += dx; P[o + 2] += dz; Pp[o] += dx; Pp[o + 2] += dz; } }
  };
  // one flattened ellipsoid per segment, oriented along the strand
  Kp.fill = () => {
    let n = 0; const I = Kp.inst;
    for (let i = 0; i < KELP_N; i++) {
      const S = st[i], base = i * KELP_SEG * 3;
      for (let j = 0; j < KELP_SEG - 1; j++) {
        const a = base + j * 3, b = a + 3; let dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2]; const l = Math.hypot(dx, dy, dz) || 1e-6; dx /= l; dy /= l; dz /= l;
        let sx = S.side[0], sy = S.side[1], sz = S.side[2]; const dd = sx * dx + sy * dy + sz * dz; sx -= dx * dd; sy -= dy * dd; sz -= dz * dd; const sl = Math.hypot(sx, sy, sz) || 1e-6; sx /= sl; sy /= sl; sz /= sl;
        const zx = dy * sz - dz * sy, zy = dz * sx - dx * sz, zz = dx * sy - dy * sx; // columns: x=dir, y=side, z=cross
        const m00 = dx, m10 = dy, m20 = dz, m01 = sx, m11 = sy, m21 = sz, m02 = zx, m12 = zy, m22 = zz, tr = m00 + m11 + m22; let qx, qy, qz, qw;
        if (tr > 0) { const t = Math.sqrt(tr + 1) * 2; qw = t / 4; qx = (m21 - m12) / t; qy = (m02 - m20) / t; qz = (m10 - m01) / t; }
        else if (m00 > m11 && m00 > m22) { const t = Math.sqrt(1 + m00 - m11 - m22) * 2; qw = (m21 - m12) / t; qx = t / 4; qy = (m01 + m10) / t; qz = (m02 + m20) / t; }
        else if (m11 > m22) { const t = Math.sqrt(1 + m11 - m00 - m22) * 2; qw = (m02 - m20) / t; qx = (m01 + m10) / t; qy = t / 4; qz = (m12 + m21) / t; }
        else { const t = Math.sqrt(1 + m22 - m00 - m11) * 2; qw = (m10 - m01) / t; qx = (m02 + m20) / t; qy = (m12 + m21) / t; qz = t / 4; }
        for (let m = 0; m < KELP_SUB; m++) { // overlapping slices -> one smooth tapered blade with a darker midrib
          const f = (m + 0.5) / KELP_SUB, t = (j + f) / (KELP_SEG - 1);
          const wprof = t < 0.28 ? 0.45 + 0.55 * Math.sin(t / 0.28 * 1.5708) : Math.pow(Math.max(0, (1 - t) / 0.72), 0.75), w = S.w * 1.35 * Math.max(wprof, 0.04);
          const tw = S.tw + t * 2.2 + Math.sin(tm * 0.7 + S.ph + t * 3) * 0.35, ct = Math.cos(tw), st_ = Math.sin(tw);
          const bx_ = sx * ct + zx * st_, by_ = sy * ct + zy * st_, bz_ = sz * ct + zz * st_, cx_ = zx * ct - sx * st_, cy_ = zy * ct - sy * st_, cz_ = zz * ct - sz * st_;
          let q0, q1, q2, q3; { const m00 = dx, m10 = dy, m20 = dz, m01 = bx_, m11 = by_, m21 = bz_, m02 = cx_, m12 = cy_, m22 = cz_, tr = m00 + m11 + m22;
            if (tr > 0) { const tt = Math.sqrt(tr + 1) * 2; q3 = tt / 4; q0 = (m21 - m12) / tt; q1 = (m02 - m20) / tt; q2 = (m10 - m01) / tt; }
            else if (m00 > m11 && m00 > m22) { const tt = Math.sqrt(1 + m00 - m11 - m22) * 2; q3 = (m21 - m12) / tt; q0 = tt / 4; q1 = (m01 + m10) / tt; q2 = (m02 + m20) / tt; }
            else if (m11 > m22) { const tt = Math.sqrt(1 + m11 - m00 - m22) * 2; q3 = (m02 - m20) / tt; q0 = (m01 + m10) / tt; q1 = tt / 4; q2 = (m12 + m21) / tt; }
            else { const tt = Math.sqrt(1 + m22 - m00 - m11) * 2; q3 = (m10 - m01) / tt; q0 = (m02 + m20) / tt; q1 = (m12 + m21) / tt; q2 = tt / 4; } }
          const wv = 0.045 * t * Math.sin(t * 6 + S.ph + tm * 0.9); // gentle S-curve across the blade width
          const px = P[a] + (P[b] - P[a]) * f + bx_ * wv, py = P[a + 1] + (P[b + 1] - P[a + 1]) * f + by_ * wv, pz = P[a + 2] + (P[b + 2] - P[a + 2]) * f + bz_ * wv;
          const sh = Math.pow(t, 1.1);
          let o = n * 12; I[o] = px; I[o + 1] = py; I[o + 2] = pz; I[o + 3] = 3; I[o + 4] = q0; I[o + 5] = q1; I[o + 6] = q2; I[o + 7] = q3; I[o + 8] = l / KELP_SUB * 1.35; I[o + 9] = w; I[o + 10] = 0.0075; I[o + 11] = sh; n++;
          o = n * 12; I[o] = px; I[o + 1] = py; I[o + 2] = pz; I[o + 3] = 3; I[o + 4] = q0; I[o + 5] = q1; I[o + 6] = q2; I[o + 7] = q3; I[o + 8] = l / KELP_SUB * 1.35; I[o + 9] = w * 0.07; I[o + 10] = 0.0095; I[o + 11] = sh * 0.45; n++;
        }
      }
    }
    Kp.count = n; return n;
  };
  return Kp;
}
