//#region APP
const $ = id => document.getElementById(id);
const canvas = $('c'), stage = $('stage');
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const PHN = { on: false }; // phone camera mode (parts/phone.js)

// ---------------------------------------------------------------- math (column-major)
const M4 = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = f / (n - f); o[11] = -1; o[14] = f * n / (n - f); return o; },
  ortho(l, r, b, t, n, f) { const o = new Float32Array(16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -1 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -n / (f - n); o[15] = 1; return o; },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  inv(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return o; d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  },
  trs(tx, ty, tz, s) { return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, tx, ty, tz, 1]); },
  pt(m, p) { const x = p[0], y = p[1], z = p[2], w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; },
  dir(m, d) { return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]]; },
};
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------------------------------------------------------- colourways
const lin = c => c.map(x => Math.pow(x / 255, 2.2));
const WAYS = [
  { name: 'Ocean', sw: '#3d8fd1', absorb: [3.4, 1.15, 0.38], tint: [0.12, 0.50, 0.95], pig: [0.035, 0.085, 0.17], pale: [0.82, 0.94, 1.0], milk: [0.80, 0.93, 1.0], glow: [0.50, 0.85, 1.0], bg: [222, 230, 233], bgD: [7, 13, 20], accent: '#2a7fbf' },
  { name: 'Lagoon', sw: '#2fb596', absorb: [3.8, 0.55, 1.5], tint: [0.12, 0.85, 0.62], pig: [0.02, 0.10, 0.085], pale: [0.86, 1.0, 0.92], milk: [0.86, 1.0, 0.93], glow: [0.50, 1.0, 0.78], bg: [221, 232, 226], bgD: [6, 16, 14], accent: '#1f9a7e' },
  { name: 'Dusk', sw: '#9161d6', absorb: [1.3, 3.5, 0.75], tint: [0.65, 0.30, 0.98], pig: [0.075, 0.04, 0.16], pale: [1.0, 0.88, 0.96], milk: [0.98, 0.91, 1.0], glow: [1.0, 0.58, 0.95], bg: [232, 226, 235], bgD: [13, 8, 21], accent: '#7a4cc4' },
  { name: 'Coral', sw: '#f07a4e', absorb: [0.45, 2.4, 3.6], tint: [1.0, 0.45, 0.28], pig: [0.17, 0.04, 0.045], pale: [1.0, 0.95, 0.86], milk: [1.0, 0.93, 0.86], glow: [1.0, 0.70, 0.40], bg: [236, 228, 220], bgD: [20, 10, 8], accent: '#d65a2e' },
];

// ---------------------------------------------------------------- state
let huntCool = 0, jfGid = 0;
const CAU_N = 256, cau = { last: -1 };
const CAU_WGSL = `
@group(0) @binding(0) var<uniform> cu: vec4<f32>;
struct O { @builtin(position) p: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i: u32) -> O { var o: O; let x = f32((i << 1u) & 2u); let y = f32(i & 2u); o.p = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0); o.uv = vec2<f32>(x, y); return o; }
fn ca(q: vec2<f32>, t: f32) -> f32 {
  let p = q - vec2<f32>(250.0);
  var i = p; var c = 1.0; let inten = 0.005;
  for (var n = 0; n < 4; n = n + 1) {
    let tt = t * (1.0 - 3.5 / f32(n + 1));
    i = p + vec2<f32>(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c = c + 1.0 / length(vec2<f32>(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c = c / 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
@fragment fn fs(o: O) -> @location(0) vec4<f32> {
  let q = o.uv * 6.2831853;   // the pattern repeats every 2*pi, so the texture tiles seamlessly
  return vec4<f32>(clamp(ca(q, cu.x), 0.0, 1.0), clamp(ca(q, cu.x * 0.8 + 11.0), 0.0, 1.0), 0.0, 1.0);
}`;
// "follow my food": one big krill the shark chases; grab it and lead the shark around, it respawns when eaten
const LURE_K = 7, lure = { p: [2, 0.8, 0.5], v: [0, 0, 0], grab: false, t: 0, s: 0, id: 0, act: false, wait: 1.2 }, LI = new Float32Array(12);
function lureSpawn() {
  const c = bodyCentre(); let x = 1.5, z = 1.5;
  for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283, r = 0.7 + Math.random() * 1.4; x = 1.5 + Math.cos(a) * r; z = Math.sin(a) * r; if (Math.hypot(x - c[0], z - c[2]) > 1.5) break; }
  lure.p = [x, Math.max(0.55, ST.swim ? world.S.swimH : c[1]) + (Math.random() - 0.5) * 0.3, z]; lure.v = [0, 0, 0]; lure.s = 0; lure.grab = false; lure.id++; lure.act = true;
}
function lureSet(x, y, z) { // user drag target, kept inside the dish
  const rx = x - 1.5, rr = Math.hypot(rx, z); if (rr > 2.2) { x = 1.5 + rx / rr * 2.2; z = z / rr * 2.2; }
  lure.p = [x, Math.max(0.15, Math.min(2.2, y)), z]; lure.v = [0, 0, 0];
}
function lureStep(dt) {
  const S = world.S;
  if (!ST.lure) { S.huntFree = false; return; }
  if (!lure.act) { lure.s = 0; lure.grab = false; S.huntFree = false; lure.wait -= dt; if (lure.wait <= 0) lureSpawn(); return; }
  lure.s += (1 - lure.s) * Math.min(1, dt * 2); lure.t += dt;
  if (!lure.grab) { // floats on its own: slow bob and drift, settles to the shark's depth
    const lv = Math.max(0.5, S.swimH), v = lure.v;
    v[0] += Math.sin(lure.t * 0.7) * 0.12 * dt; v[2] += Math.cos(lure.t * 0.6) * 0.12 * dt; v[1] += ((lv - lure.p[1]) * 0.6 + Math.sin(lure.t * 1.1) * 0.1) * dt;
    const dm = Math.exp(-1.6 * dt); v[0] *= dm; v[1] *= dm; v[2] *= dm;
    lureSet(lure.p[0] + v[0] * dt, lure.p[1] + v[1] * dt, lure.p[2] + v[2] * dt); lure.v = v;
  }
  const mf = world.mouthFrame(), dx = lure.p[0] - mf.f[0], dy = lure.p[1] - mf.f[1], dz = lure.p[2] - mf.f[2], d = Math.hypot(dx, dy, dz);
  S.hunt = [lure.p[0], lure.p[1], lure.p[2]]; S.huntFree = true;
  huntCool -= dt; if (ST.gulpT < 0 && d < 0.8 && huntCool <= 0) { ST.gulpT = 0; huntCool = 1.1; }
  if (d < 0.22 && lure.s > 0.8) { lure.act = false; lure.s = 0; lure.grab = false; lure.wait = 7 + Math.random() * 9; S.huntFree = false; }
}
function krillDrop(n) { if (ST.ocean) krill.spawn(n, bodyCentre()); else krill.spawn(n); }
function bodyCentre() { const p = world.pos, n = world.nv; let x = 0, y = 0, z = 0; for (let i = 0; i < n; i++) { x += p[3 * i]; y += p[3 * i + 1]; z += p[3 * i + 2]; } return [x / n, y / n, z / n]; }
const ST = { krillOn: false, kWait: 0, cau: true, cauK: 1, uw: false, uwK: 0, jf: true, way: 0, lu: 0, luT: 0, eyeExt: 1, eyeT: 1, swishT: 0, ocean: false, swim: false, kelp: true, gulpT: -1, mesh: false, slow: false, pause: false, twist: false, firm: 0.55, damp: 0.35, nsub: 4, cell: 0.05 };
const cam = { yaw: -0.95, pitch: 0.62, dist: 4.7, tx: 1.35, ty: 0.12, tz: 0 };
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- gpu
let device, ctx, fmt, world, krill, kelp, jf, gpuOK = false;
let bgl, sampler, dummy = {}, shF, shB, shFv, shBv;
let pipes = {}, buf = {}, vrs = [];
const U_FLOATS = 620, U_BYTES = U_FLOATS * 4, SH = 1024;
const prof = new Float32Array(128 * 4);
for (let i = 0; i < 128; i++) { const p = profileAt(i / 127 * LB); prof.set([p.W, p.Ht, p.cy, p.b], i * 4); }

function initPipelines() {
  const V = GPUShaderStage.VERTEX, F = GPUShaderStage.FRAGMENT;
  bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: V | F, buffer: { type: 'uniform' } },
    { binding: 1, visibility: F, texture: { sampleType: 'float' } },
    { binding: 2, visibility: F, texture: { sampleType: 'unfilterable-float' } },
    { binding: 3, visibility: F, sampler: { type: 'filtering' } },
    { binding: 4, visibility: F, texture: { sampleType: 'depth' } },
    { binding: 5, visibility: F, texture: { sampleType: 'depth' } },
    { binding: 6, visibility: V | F, texture: { sampleType: 'float' } },
    { binding: 7, visibility: V | F, sampler: { type: 'filtering' } }] });
  // caustics are computed once per frame into a small tileable texture, then just sampled everywhere
  cau.tex = device.createTexture({ size: [CAU_N, CAU_N], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  cau.view = cau.tex.createView();
  cau.samp = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat' });
  cau.ub = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  { const cm = device.createShaderModule({ code: CAU_WGSL }), cl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: F, buffer: { type: 'uniform' } }] });
    cau.pipe = device.createRenderPipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [cl] }), vertex: { module: cm, entryPoint: 'vs' }, fragment: { module: cm, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] }, primitive: { topology: 'triangle-list' } });
    cau.bg = device.createBindGroup({ layout: cl, entries: [{ binding: 0, resource: { buffer: cau.ub } }] }); }
  sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const T = (w, h, format, usage) => device.createTexture({ size: [w, h], format, usage });
  const RB = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  dummy.scene = T(1, 1, 'rgba16float', RB); dummy.back = T(1, 1, 'r32float', RB); dummy.depth = T(1, 1, 'depth32float', RB);
  dummy.sceneV = dummy.scene.createView(); dummy.backV = dummy.back.createView(); dummy.depthV = dummy.depth.createView();
  shF = T(SH, SH, 'depth32float', RB); shB = T(SH, SH, 'depth32float', RB); shFv = shF.createView(); shBv = shB.createView();
  const mod = device.createShaderModule({ code: WGSL });
  mod.getCompilationInfo().then(i => { for (const m of i.messages) console[m.type === 'error' ? 'error' : 'warn']('WGSL ' + m.type + ' ' + m.lineNum + ':' + m.linePos + ' ' + m.message); });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const VB_POS = { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] };
  const VB_NRM = { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] };
  const VB_REST = { arrayStride: 16, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }] };
  const VB_SPH = { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] };
  const VB_INST = { arrayStride: 48, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }, { shaderLocation: 2, offset: 16, format: 'float32x4' }, { shaderLocation: 3, offset: 32, format: 'float32x4' }] };
  const DS = (cmp, write = true) => ({ format: 'depth32float', depthWriteEnabled: write, depthCompare: cmp });
  const mk = (o) => device.createRenderPipeline(Object.assign({ layout }, o));
  const tri = (cull) => ({ topology: 'triangle-list', cullMode: cull });
  pipes.shF = mk({ vertex: { module: mod, entryPoint: 'vsShadow', buffers: [VB_POS] }, primitive: tri('none'), depthStencil: DS('less') });
  pipes.shB = mk({ vertex: { module: mod, entryPoint: 'vsShadow', buffers: [VB_POS] }, primitive: tri('none'), depthStencil: DS('greater') });
  pipes.floor = mk({ vertex: { module: mod, entryPoint: 'vsFull' }, fragment: { module: mod, entryPoint: 'fsFloor', targets: [{ format: 'rgba16float' }] }, primitive: tri('none'), depthStencil: DS('always') });
  pipes.blob = mk({ vertex: { module: mod, entryPoint: 'vsBlob', buffers: [VB_POS, VB_NRM] }, fragment: { module: mod, entryPoint: 'fsBlob', targets: [{ format: 'rgba16float' }] }, primitive: tri('back'), depthStencil: DS('less') });
  pipes.bead = mk({ vertex: { module: mod, entryPoint: 'vsBead', buffers: [VB_SPH, VB_INST] }, fragment: { module: mod, entryPoint: 'fsBead', targets: [{ format: 'rgba16float' }] }, primitive: tri('back'), depthStencil: DS('less') });
  pipes.back = mk({ vertex: { module: mod, entryPoint: 'vsBack', buffers: [VB_POS] }, fragment: { module: mod, entryPoint: 'fsBack', targets: [{ format: 'r32float' }] }, primitive: tri('front'), depthStencil: DS('greater') });
  pipes.blit = mk({ vertex: { module: mod, entryPoint: 'vsFull' }, fragment: { module: mod, entryPoint: 'fsBlit', targets: [{ format: fmt }] }, primitive: tri('none'), depthStencil: DS('always', false) });
  pipes.jelly = mk({ vertex: { module: mod, entryPoint: 'vsJelly', buffers: [VB_POS, VB_NRM, VB_REST] }, fragment: { module: mod, entryPoint: 'fsJelly', targets: [{ format: fmt }] }, primitive: tri('back'), depthStencil: DS('less') });
  pipes.jfish = mk({ vertex: { module: mod, entryPoint: 'vsJelly', buffers: [VB_POS, VB_NRM, VB_REST] }, fragment: { module: mod, entryPoint: 'fsJfish', targets: [{ format: fmt }] }, primitive: tri('back'), depthStencil: DS('less') });
  pipes.line = mk({ vertex: { module: mod, entryPoint: 'vsLine', buffers: [VB_POS] }, fragment: { module: mod, entryPoint: 'fsLine', targets: [{ format: fmt, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] }, primitive: { topology: 'line-list' }, depthStencil: DS('always', false) });
  // sphere mesh
  const nu = 14, nv = 9, sp = [], si = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const th = j / nv * Math.PI, ph = i / nu * 2 * Math.PI; sp.push(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; si.push(a, c, b, b, c, d); }
  for (let t = 0; t < si.length; t += 3) { // orient outward
    const P = k => [sp[si[t + k] * 3], sp[si[t + k] * 3 + 1], sp[si[t + k] * 3 + 2]];
    const a = P(0), b = P(1), c = P(2), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * (a[0] + b[0] + c[0]) + n[1] * (a[1] + b[1] + c[1]) + n[2] * (a[2] + b[2] + c[2]) < 0) { const x = si[t + 1]; si[t + 1] = si[t + 2]; si[t + 2] = x; }
  }
  buf.sphV = device.createBuffer({ size: sp.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(buf.sphV, 0, new Float32Array(sp));
  buf.sphI = device.createBuffer({ size: si.length * 4, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(buf.sphI, 0, new Uint32Array(si));
  buf.sphN = si.length;
  buf.inst = device.createBuffer({ size: (KMAX * KPI + 3 + 16 + 64 + KELP_INST + JF_INST) * 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
}

function makeVR(w, h) {
  const RB = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING, RA = GPUTextureUsage.RENDER_ATTACHMENT;
  const vr = { w, h };
  vr.gBuf = device.createBuffer({ size: U_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  vr.scene = device.createTexture({ size: [w, h], format: 'rgba16float', usage: RB });
  vr.back = device.createTexture({ size: [w, h], format: 'r32float', usage: RB });
  vr.sceneD = device.createTexture({ size: [w, h], format: 'depth32float', usage: RA });
  vr.backD = device.createTexture({ size: [w, h], format: 'depth32float', usage: RA });
  vr.sceneV = vr.scene.createView(); vr.backV = vr.back.createView(); vr.sceneDV = vr.sceneD.createView(); vr.backDV = vr.backD.createView();
  const bg = (s, b, f, k) => device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: vr.gBuf } }, { binding: 1, resource: s }, { binding: 2, resource: b }, { binding: 3, resource: sampler }, { binding: 4, resource: f }, { binding: 5, resource: k }, { binding: 6, resource: cau.view }, { binding: 7, resource: cau.samp }] });
  vr.bgShadow = bg(dummy.sceneV, dummy.backV, dummy.depthV, dummy.depthV);
  vr.bgScene = bg(dummy.sceneV, dummy.backV, shFv, shBv);
  vr.bgBack = bg(dummy.sceneV, dummy.backV, shFv, shBv);
  vr.bgMain = bg(vr.sceneV, vr.backV, shFv, shBv);
  vr.data = new Float32Array(U_FLOATS);
  return vr;
}
function destroyVR(vr) { for (const k of ['scene', 'back', 'sceneD', 'backD']) vr[k].destroy(); vr.gBuf.destroy(); if (vr.eye) vr.eye.destroy(); }

const VBU = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, IBU = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
function loadWorld(cell) {
  if (buf.pos) for (const k of ['pos', 'nrm', 'bnrm', 'rest', 'tri', 'blob', 'edge', 'rpos', 'rnrm', 'rrest', 'rtri', 'bpos2', 'bnrm2', 'btri', 'jpos', 'jnrm', 'jrest', 'jtri']) if (buf[k]) buf[k].destroy();
  world = createWorld(cell); krill = createKrill(world); kelp = createKelp(world); jf = createJellies(world);
  const nv = world.nv, L = world.L;
  buf.pos = device.createBuffer({ size: nv * 12, usage: VBU }); buf.nrm = device.createBuffer({ size: nv * 12, usage: VBU }); buf.bnrm = device.createBuffer({ size: nv * 12, usage: VBU });
  buf.rest = device.createBuffer({ size: nv * 16, usage: VBU });
  const r4 = new Float32Array(nv * 4); for (let v = 0; v < nv; v++) { r4[4 * v] = L.rest[3 * v]; r4[4 * v + 1] = L.rest[3 * v + 1]; r4[4 * v + 2] = L.rest[3 * v + 2]; r4[4 * v + 3] = L.finw[v]; }
  device.queue.writeBuffer(buf.rest, 0, r4);
  const mkI = (a) => { const b = device.createBuffer({ size: Math.max(16, (a.byteLength + 3) & ~3), usage: IBU }); device.queue.writeBuffer(b, 0, a); return b; };
  buf.tri = mkI(L.tri); buf.blob = mkI(L.blob); buf.edge = mkI(L.edges);
  buf.nTri = L.tri.length; buf.nBlob = L.blob.length; buf.nEdge = L.edges.length;
  const Rm = world.R, Bm = world.B;
  buf.rpos = device.createBuffer({ size: Rm.nv * 12, usage: VBU }); buf.rnrm = device.createBuffer({ size: Rm.nv * 12, usage: VBU }); buf.rrest = device.createBuffer({ size: Rm.nv * 16, usage: VBU });
  device.queue.writeBuffer(buf.rrest, 0, Rm.rest4); buf.rtri = mkI(Rm.tri); buf.nRTri = Rm.tri.length;
  buf.bpos2 = device.createBuffer({ size: Bm.nv * 12, usage: VBU }); buf.bnrm2 = device.createBuffer({ size: Bm.nv * 12, usage: VBU }); buf.btri = mkI(Bm.tri); buf.nBTri = Bm.tri.length;
  buf.jpos = device.createBuffer({ size: jf.pos.byteLength, usage: VBU }); buf.jnrm = device.createBuffer({ size: jf.nrm.byteLength, usage: VBU }); buf.jrest = device.createBuffer({ size: jf.rest4.byteLength, usage: VBU });
  device.queue.writeBuffer(buf.jrest, 0, jf.rest4); buf.jtri = mkI(jf.tri); buf.nJTri = jf.tri.length;
  world.S.nsub = ST.nsub;
  uploadDynamic();
}
function uploadDynamic() {
  world.skin();
  device.queue.writeBuffer(buf.rpos, 0, world.R.pos); device.queue.writeBuffer(buf.rnrm, 0, world.R.nrm);
  device.queue.writeBuffer(buf.bpos2, 0, world.B.pos); device.queue.writeBuffer(buf.bnrm2, 0, world.B.nrm);
  if (ST.mesh) device.queue.writeBuffer(buf.pos, 0, world.pos);
}

// ---------------------------------------------------------------- timeline + sim
let simAcc = 0, adaptT = 0, simMs = 0;
function advance(dtReal) {
  const scale = ST.slow ? 0.25 : 1;
  const S = world.S;
  // smooth toggles (real time)
  ST.lu += (ST.luT - ST.lu) * Math.min(1, dtReal * 2.2);
  ST.eyeExt += clamp(ST.eyeT - ST.eyeExt, -dtReal * 2.6, dtReal * 2.6);
  if (ST.pause) return;
  const dt = Math.min(dtReal, 1 / 30) * scale;
  let jaw = 0, flare = 0, steer = 0;
  if (ST.gulpT >= 0) {
    const t = ST.gulpT;
    jaw = sm(0, 0.55, t) * (1 - sm(1.05, 1.5, t));
    flare = sm(0.1, 0.8, t) * (1 - sm(1.2, 2.3, t));
    steer = sm(0.1, 0.5, t) * (1 - sm(1.4, 1.9, t));
    ST.gulpT += dt; if (ST.gulpT > 2.5) ST.gulpT = -1;
  }
  S.jaw = jaw; S.flare = flare;
  S.swim += ((ST.swim ? 1 : 0) - S.swim) * Math.min(1, dt * 1.2); S.swimMix = S.swim;
  S.g += ((ST.ocean ? 0.03 : 1) - S.g) * Math.min(1, dt * 2.5); S.drag += ((ST.ocean ? 0.9 : 0) - S.drag) * Math.min(1, dt * 2.5);
  S.swish += (((ST.swishT || ST.swim) ? 1 : 0) - S.swish) * Math.min(1, dt * 3);
  if (S.swish > 0.001) S.swishPhase += dt * 2 * Math.PI * (1.3 - 0.4 * S.swimMix);
  S.firm = ST.firm; S.damp = ST.damp; S.nsub = ST.nsub;
  const t0 = performance.now();
  // ocean / swim: krill float at the shark's depth; a swimming shark hunts the nearest one and gulps when it is at the mouth
  krill.gs += ((ST.ocean ? 0.02 : 1) - krill.gs) * Math.min(1, dt * 3); krill.dr = ST.ocean ? 1.1 : 0;
  if (ST.ocean) { const lv = ST.swim ? S.swimH : bodyCentre()[1]; krill.level += (lv - krill.level) * Math.min(1, dt * 0.8); }
  S.hunt = null; S.huntFree = false;
  if (ST.swim && krill.n) {
    const mf = world.mouthFrame(), nr = krill.nearest(mf.f[0], mf.f[1], mf.f[2], 3.2);
    if (nr) {
      const k = nr.k; S.hunt = [krill.p[3 * k], krill.p[3 * k + 1], krill.p[3 * k + 2]];
      const out = -((krill.p[3 * k] - mf.f[0]) * mf.e[0] + (krill.p[3 * k + 1] - mf.f[1]) * mf.e[1] + (krill.p[3 * k + 2] - mf.f[2]) * mf.e[2]);
      huntCool -= dt; if (ST.gulpT < 0 && nr.d < 0.95 && out > 0.02 && huntCool <= 0) { ST.gulpT = 0; huntCool = 1.0; }
    }
  }
  lureStep(dt);
  world.step(dt);
  krill.step(dt, steer);
  if (ST.kelp) kelp.step(dt);
  ST.uwK += ((ST.uw ? 1 : 0) - ST.uwK) * Math.min(1, dtReal * 1.5);
  ST.cauK += ((ST.cau ? 1 : 0) - ST.cauK) * Math.min(1, dtReal * 1.5);
  if (ST.krillOn && !ST.pause) { ST.kWait -= dtReal; if (ST.kWait <= 0) { krillDrop(28 + (Math.random() * 26 | 0)); ST.kWait = 14 + Math.random() * 18; } } // keeps feeding: a new handful now and then
  if (ST.jf) { jf.setSwim(ST.swim, !!ST.swishT); jf.setParams(ST.firm, ST.damp); jf.step(dt); }
  simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;
  adaptT += dtReal;
  if (adaptT > 0.6) { adaptT = 0; if (simMs > 17 && ST.nsub > 2) ST.nsub--; else if (simMs < 7 && ST.nsub < 5) ST.nsub++; }
}

// ---------------------------------------------------------------- uniforms
const LIGHT = nrm([-0.35, 0.85, 0.30]);
const lightVP = M4.mul(M4.ortho(-3.4, 3.4, -3.4, 3.4, 1.5, 11.5), M4.lookAt([1.5 + LIGHT[0] * 6.5, 0.1 + LIGHT[1] * 6.5, LIGHT[2] * 6.5], [1.5, 0.1, 0], [0, 1, 0]));
function bgNow() { const w = WAYS[ST.way], u = ST.lu; return w.bg.map((c, i) => c + (w.bgD[i] - c) * u); }
function writeG(vr, viewProj, camPos, camFwd, off) {
  const d = vr.data, w = WAYS[ST.way], u = ST.lu, bg = lin(bgNow());
  d.set(viewProj, 0); d.set(M4.inv(viewProj), 16); d.set(lightVP, 32);
  const V = (i, a, b = 0) => { d[48 + i * 4] = a[0]; d[49 + i * 4] = a[1]; d[50 + i * 4] = a[2]; d[51 + i * 4] = b; };
  V(0, camPos, performance.now() / 1000); V(1, camFwd, u); V(2, LIGHT, world.S.flare); V(3, [vr.w, vr.h, 1 / vr.w, 1 / vr.h]);
  V(4, w.absorb.map(x => x * 1.35), 1.0); V(5, w.tint, ST.uwK); V(6, w.pig, 0.97); V(7, w.pale, ST.cauK * (xrS && xrS.ar ? 1.3 : 1)); V(8, w.milk, (xrS && xrS.ar) || PHN.on ? 1 : 0);
  V(9, bg, 1.0);
  V(10, bg.map(x => Math.min(1, u > 0.5 ? x * 1.8 + 0.01 : x * 0.5 + 0.5)), 10);
  V(11, w.glow, 0); V(12, [ST.mesh ? 1 : 0, world.YM - YOFF, world.MOUTH.r[1]], 10);
  V(13, [world.eyeP[0], world.eyeP[1] - YOFF, world.eyeP[2]], off ? off[0] : 0); V(14, [world.spirP[0], world.spirP[1] - YOFF, world.spirP[2]], off ? off[1] : 0);
  d.set(prof, 108);
  device.queue.writeBuffer(vr.gBuf, 0, d);
}

const XI = new Float32Array(64 * 12); let xiN = 0;
function updateInstances() {
  const n = krill.fillInstances(), I = krill.inst;
  for (let e = 0; e < 2; e++) {
    const v = world.eyeR[e], o = (n + e) * 12, k = -0.026 + 0.020 * ST.eyeExt;
    I[o] = world.R.pos[3 * v] + world.R.nrm[3 * v] * k; I[o + 1] = world.R.pos[3 * v + 1] + world.R.nrm[3 * v + 1] * k; I[o + 2] = world.R.pos[3 * v + 2] + world.R.nrm[3 * v + 2] * k; I[o + 3] = 1;
    I[o + 4] = 0; I[o + 5] = 0; I[o + 6] = 0; I[o + 7] = 1; I[o + 8] = I[o + 9] = I[o + 10] = 0.019; I[o + 11] = 0;
  }
  device.queue.writeBuffer(buf.inst, 0, I, 0, (n + 2) * 12);
  let tot = n + 2;
  if (ST.lure && lure.s > 0.01) {
    const a = lure.t * 0.5, sc = lure.s * LURE_K, ca = Math.cos(a), sa = Math.sin(a), ly = lure.p[1] + Math.sin(lure.t * 1.1) * 0.01, PT_ = krill.parts, LB_ = new Float32Array(PT_.length * 12);
    PT_.forEach((p, m) => { const o = m * 12, x = p[0] * sc, y = p[1] * sc, z = p[2] * sc;
      LB_[o] = lure.p[0] + x * ca + z * sa; LB_[o + 1] = ly + y; LB_[o + 2] = lure.p[2] - x * sa + z * ca; LB_[o + 3] = p[6];
      LB_[o + 4] = 0; LB_[o + 5] = Math.sin(a / 2); LB_[o + 6] = 0; LB_[o + 7] = Math.cos(a / 2); LB_[o + 8] = p[3] * sc; LB_[o + 9] = p[4] * sc; LB_[o + 10] = p[5] * sc; LB_[o + 11] = 0.35; });
    device.queue.writeBuffer(buf.inst, tot * 48, LB_, 0, PT_.length * 12); tot += PT_.length;
  }
  if ((xrS || PHN.on) && xiN) { device.queue.writeBuffer(buf.inst, tot * 48, XI, 0, xiN * 12); tot += xiN; }
  if (ST.jf) {
    device.queue.writeBuffer(buf.jpos, 0, jf.pos); device.queue.writeBuffer(buf.jnrm, 0, jf.nrm); device.queue.writeBuffer(buf.jrest, 0, jf.rest4);
    const jn = jf.fill(); device.queue.writeBuffer(buf.inst, tot * 48, jf.inst, 0, jn * 12); tot += jn;
  }
  if (ST.kelp) { const kn = kelp.fill(); device.queue.writeBuffer(buf.inst, tot * 48, kelp.inst, 0, kn * 12); tot += kn; }
  return tot;
}

// ---------------------------------------------------------------- encode
const DBG = new Set((location.hash || '').slice(1).split(',').filter(Boolean));
function drawJelly(p) { p.setVertexBuffer(0, buf.rpos); p.setVertexBuffer(1, buf.rnrm); p.setVertexBuffer(2, buf.rrest); p.setIndexBuffer(buf.rtri, 'uint32'); p.drawIndexed(buf.nRTri); }
function encodeShadows(enc, vr) {
  if (DBG.has('noshadow')) return;
  for (const [tex, pipe, clear] of [[shFv, pipes.shF, 1], [shBv, pipes.shB, 0]]) {
    const p = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: tex, depthClearValue: clear, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    p.setPipeline(pipe); p.setBindGroup(0, vr.bgShadow); p.setVertexBuffer(0, buf.rpos); p.setIndexBuffer(buf.rtri, 'uint32'); p.drawIndexed(buf.nRTri); p.end();
  }
}
function encodeView(enc, vr, colorView, nInst, viewport) {
  const bg = lin(bgNow());
  { const tn = performance.now(); if (ST.cauK > 0.001 && tn - cau.last > 8) { cau.last = tn; device.queue.writeBuffer(cau.ub, 0, new Float32Array([tn / 1000 * 0.45, 0, 0, 0]));
    const cp = enc.beginRenderPass({ colorAttachments: [{ view: cau.view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] }); cp.setPipeline(cau.pipe); cp.setBindGroup(0, cau.bg); cp.draw(3); cp.end(); } }
  let p = enc.beginRenderPass({ colorAttachments: [{ view: vr.sceneV, clearValue: { r: bg[0], g: bg[1], b: bg[2], a: ((xrS && xrS.ar) || PHN.on) ? 0 : 1 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: vr.sceneDV, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
  p.setBindGroup(0, vr.bgScene);
  if (!DBG.has('nofloor')) { p.setPipeline(pipes.floor); p.draw(3); }
  if (!DBG.has('noblob')) { p.setPipeline(pipes.blob); p.setVertexBuffer(0, buf.bpos2); p.setVertexBuffer(1, buf.bnrm2); p.setIndexBuffer(buf.btri, 'uint32'); p.drawIndexed(buf.nBTri); }
  if (!DBG.has('nobead')) { p.setPipeline(pipes.bead); p.setVertexBuffer(0, buf.sphV); p.setVertexBuffer(1, buf.inst); p.setIndexBuffer(buf.sphI, 'uint32'); p.drawIndexed(buf.sphN, nInst); }
  p.end();
  p = enc.beginRenderPass({ colorAttachments: [{ view: vr.backV, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: vr.backDV, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } });
  if (!DBG.has('noback')) { p.setBindGroup(0, vr.bgBack); p.setPipeline(pipes.back); p.setVertexBuffer(0, buf.rpos); p.setIndexBuffer(buf.rtri, 'uint32'); p.drawIndexed(buf.nRTri); }
  if (ST.jf && !DBG.has('nojf')) { p.setBindGroup(0, vr.bgBack); p.setPipeline(pipes.back); p.setVertexBuffer(0, buf.jpos); p.setIndexBuffer(buf.jtri, 'uint32'); p.drawIndexed(buf.nJTri); }
  p.end();
  p = enc.beginRenderPass({ colorAttachments: [{ view: colorView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: viewport ? 'load' : 'clear', storeOp: 'store' }], depthStencilAttachment: { view: vr.sceneDV, depthLoadOp: 'load', depthStoreOp: 'store' } });
  if (viewport) { p.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, 0, 1); p.setScissorRect(viewport.x, viewport.y, viewport.width, viewport.height); }
  p.setBindGroup(0, vr.bgMain);
  p.setPipeline(pipes.blit); p.draw(3);
  if (!DBG.has('nojelly')) { p.setPipeline(pipes.jelly); drawJelly(p); }
  if (ST.jf && !DBG.has('nojf')) { p.setPipeline(pipes.jfish); p.setVertexBuffer(0, buf.jpos); p.setVertexBuffer(1, buf.jnrm); p.setVertexBuffer(2, buf.jrest); p.setIndexBuffer(buf.jtri, 'uint32'); p.drawIndexed(buf.nJTri); }
  if (ST.mesh) { p.setPipeline(pipes.line); p.setVertexBuffer(0, buf.pos); p.setIndexBuffer(buf.edge, 'uint32'); p.drawIndexed(buf.nEdge); }
  return p; // caller ends
}

// ---------------------------------------------------------------- desktop camera
function camBasis() {
  const asp = canvas.width / canvas.height, fit = clamp(1.25 / asp, 1, 2.4), d = cam.dist * fit, cp = Math.cos(cam.pitch);
  const eye = [cam.tx + d * cp * Math.sin(cam.yaw), cam.ty + d * Math.sin(cam.pitch), cam.tz + d * cp * Math.cos(cam.yaw)];
  const tgt = [cam.tx, cam.ty, cam.tz];
  const view = M4.lookAt(eye, tgt, [0, 1, 0]), proj = M4.persp(0.62, asp, 0.1, 40);
  return { eye, fwd: nrm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), vp: M4.mul(proj, view) };
}
function pickRay(clientX, clientY) {
  const r = canvas.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
  const b = camBasis(), iv = M4.inv(b.vp), p = M4.pt(iv, [nx, ny, 1]);
  return { ro: b.eye, rd: nrm([p[0] - b.eye[0], p[1] - b.eye[1], p[2] - b.eye[2]]), fwd: b.fwd };
}

// ---------------------------------------------------------------- frame
let lastT = 0, roT = 0, frameN = 0, volCache = 1;
function updateReadouts(now) {
  if (now - roT < 160) return; roT = now;
  if (frameN % 3 === 0) volCache = world.volumeRatio();
  $('roMass').textContent = (world.totalMassG + krill.eaten * 0.05).toFixed(1);
  $('roVol').textContent = (volCache * 100).toFixed(1);
  $('roGape').textContent = world.gapeMM().toFixed(1);
  $('roKrill').textContent = krill.eaten;
}
function applyTheme() {
  const w = WAYS[ST.way], c = bgNow();
  document.documentElement.style.setProperty('--bg', `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
  document.documentElement.style.setProperty('--accent', w.accent);
  document.body.classList.toggle('dark', ST.lu > 0.5);
}
function frame(now) {
  if (xrS) return;
  requestAnimationFrame(frame);
  if (document.hidden) { lastT = now; return; }
  const dtReal = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now; frameN++;
  if (PHN.on) phoneUpdate(now);
  advance(dtReal); applyTheme();
  if (!ST.pause || frameN < 3) uploadDynamic();
  if (DBG.has('norender')) return;
  if (DBG.has('clearonly')) { const e = device.createCommandEncoder(), q = e.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0.2, g: 0.5, b: 0.3, a: 1 }, loadOp: 'clear', storeOp: 'store' }] }); q.end(); device.queue.submit([e.finish()]); return; }
  const nInst = updateInstances(), b = PHN.on ? phoneBasis() : camBasis();
  const vr = vrs[0];
  writeG(vr, b.vp, b.eye, b.fwd);
  const enc = device.createCommandEncoder();
  encodeShadows(enc, vr);
  const p = encodeView(enc, vr, ctx.getCurrentTexture().createView(), nInst, null); p.end();
  device.queue.submit([enc.finish()]);
  if (frameN < 4) device.queue.onSubmittedWorkDone().then(() => console.log('frame done', frameN, Math.round(performance.now())));
  updateReadouts(now);
}
function resize() {
  if (!gpuOK) return;
  const dpr = Math.min(window.devicePixelRatio || 1, PHN.on ? 1.5 : stage.clientWidth < 700 ? 1.75 : 2);
  const w = Math.max(2, Math.floor(stage.clientWidth * dpr)), h = Math.max(2, Math.floor(stage.clientHeight * dpr));
  if (canvas.width === w && canvas.height === h && vrs[0]) return;
  canvas.width = w; canvas.height = h;
  if (vrs[0]) destroyVR(vrs[0]);
  vrs[0] = makeVR(w, h);
}

// ---------------------------------------------------------------- actions
const A = {
  gulp() { if (ST.gulpT < 0 || ST.gulpT > 1.5) ST.gulpT = 0; if (ST.pause) { ST.pause = false; $('cPause').checked = false; } },
  swish() { ST.swishT = ST.swishT ? 0 : 1; sync(); },
  ocean() { ST.ocean = !ST.ocean; if (ST.ocean) for (let i = 0; i < world.nv; i++) world.vel[3 * i + 1] += 0.45; else ST.swim = false; sync(); },
  swim() { ST.swim = !ST.swim; if (ST.swim && !ST.ocean) { ST.ocean = true; for (let i = 0; i < world.nv; i++) world.vel[3 * i + 1] += 0.45; } sync(); },
  lure() { ST.lure = !ST.lure; if (ST.lure) { if (!ST.ocean) { ST.ocean = true; for (let i = 0; i < world.nv; i++) world.vel[3 * i + 1] += 0.45; } ST.swim = true; lure.act = false; lure.s = 0; lure.wait = 1.2; } else lure.grab = false; sync(); },
  eyes() { ST.eyeT = ST.eyeT ? 0 : 1; sync(); },
  light() { ST.luT = ST.luT ? 0 : 1; sync(); },
  krill() { ST.krillOn = !ST.krillOn; if (ST.krillOn) { krillDrop(110); ST.kWait = 14 + Math.random() * 14; } sync(); },
  reset() { world.reset(); krill.clear(); ST.gulpT = -1; ST.swishT = 0; ST.ocean = false; ST.swim = false; ST.lure = false; lure.grab = false; ST.eyeT = 1; ST.luT = 0; ST.krillOn = false; jf.reset(); uploadDynamic(); sync(); },
  jf() { ST.jf = !ST.jf; sync(); },
  uw() { ST.uw = !ST.uw; sync(); },
  cau() { ST.cau = !ST.cau; sync(); },
  way(i) { ST.way = i; sync(); },
};
function sync() {
  $('bSwish').setAttribute('aria-pressed', !!ST.swishT); $('bEyes').setAttribute('aria-pressed', !ST.eyeT); $('bEyes').textContent = ST.eyeT ? 'Tuck the eyes' : 'Release the eyes';
  $('bLight').setAttribute('aria-pressed', !!ST.luT); $('bOcean').setAttribute('aria-pressed', !!ST.ocean); $('bSwim').setAttribute('aria-pressed', !!ST.swim); $('bLure').setAttribute('aria-pressed', !!ST.lure); $('bJf').setAttribute('aria-pressed', !!ST.jf); $('bUw').setAttribute('aria-pressed', !!ST.uw); $('bCau').setAttribute('aria-pressed', !!ST.cau); $('bKrill').setAttribute('aria-pressed', !!ST.krillOn);
  document.querySelectorAll('.way').forEach((b, i) => b.setAttribute('aria-pressed', i === ST.way));
  if (xrS) xrS.dirty = true;
  if (PHN.on) phoneSync();
}
function initUI() {
  const ways = $('ways');
  WAYS.forEach((w, i) => { const b = document.createElement('button'); b.className = 'way'; b.innerHTML = `<i style="background:${w.sw}"></i>${w.name}`; b.onclick = () => A.way(i); ways.appendChild(b); });
  $('bGulp').onclick = A.gulp; $('bSwish').onclick = A.swish; $('bOcean').onclick = A.ocean; $('bSwim').onclick = A.swim; $('bLure').onclick = A.lure; $('bJf').onclick = A.jf; $('bUw').onclick = A.uw; $('bCau').onclick = A.cau; $('bEyes').onclick = A.eyes; $('bLight').onclick = A.light; $('bKrill').onclick = A.krill; $('bReset').onclick = A.reset;
  $('sFirm').oninput = e => { ST.firm = e.target.value / 100; $('oFirm').textContent = e.target.value; if (xrS) xrS.dirty = true; };
  $('sDamp').oninput = e => { ST.damp = e.target.value / 100; $('oDamp').textContent = e.target.value; if (xrS) xrS.dirty = true; };
  $('sSnd').oninput = e => { sndSet(e.target.value / 100); $('oSnd').textContent = e.target.value; sndStart(); if (xrS) xrS.dirty = true; };
  $('cSlow').onchange = e => { ST.slow = e.target.checked; if (xrS) xrS.dirty = true; };
  $('cMesh').onchange = e => { ST.mesh = e.target.checked; if (xrS) xrS.dirty = true; };
  $('cPause').onchange = e => { ST.pause = e.target.checked; if (xrS) xrS.dirty = true; };
  $('cTwist').onchange = e => { ST.twist = e.target.checked; };
  $('cKelp').onchange = e => { ST.kelp = e.target.checked; if (xrS) xrS.dirty = true; };
  $('sDetail').onchange = e => { ST.cell = +e.target.value; loadWorld(ST.cell); sync(); };
  sync();
}

// ---------------------------------------------------------------- pointer
const ptrs = new Map(); let drag = null, pinch0 = 0;
function bindPointer() {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (PHN.on) return;
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { drag = null; world.endGrab(); canvas.classList.remove('grabbing'); const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); return; }
    if (ptrs.size > 2) return;
    const r = pickRay(e.clientX, e.clientY), v = world.pickVertex(r.ro, r.rd);
    if (ST.lure && lure.s > 0.3) {
      const vx = lure.p[0] - r.ro[0], vy = lure.p[1] - r.ro[1], vz = lure.p[2] - r.ro[2], tt = vx * r.rd[0] + vy * r.rd[1] + vz * r.rd[2];
      if (tt > 0 && Math.hypot(vx - r.rd[0] * tt, vy - r.rd[1] * tt, vz - r.rd[2] * tt) < 0.2) { lure.grab = true; drag = { mode: 'lure', t: vx * r.fwd[0] + vy * r.fwd[1] + vz * r.fwd[2] }; canvas.classList.add('grabbing'); return; }
    }
    if (ST.jf) { const jh = jf.pick(r.ro, r.rd); if (jh) { let st = 1e9; if (v >= 0) { const P_ = world.pos; st = (P_[3 * v] - r.ro[0]) * r.rd[0] + (P_[3 * v + 1] - r.ro[1]) * r.rd[1] + (P_[3 * v + 2] - r.ro[2]) * r.rd[2]; }
      if (jh.t < st + 0.05) { const c = jf.grab('d', jh); drag = { mode: 'jf', c, t: (c[0] - r.ro[0]) * r.fwd[0] + (c[1] - r.ro[1]) * r.fwd[1] + (c[2] - r.ro[2]) * r.fwd[2] }; canvas.classList.add('grabbing'); if (ST.pause) { ST.pause = false; $('cPause').checked = false; } return; } } }
    const kc = (v < 0 && ST.kelp) ? kelp.pick(r.ro, r.rd, 0.14) : -1;
    if (kc >= 0) { drag = { mode: 'kelp', c: kc, x: e.clientX, y: e.clientY }; canvas.classList.add('grabbing'); return; }
    if (v >= 0) {
      world.beginGrab(v, r.fwd); const c = world.S.grab.c0;
      const t = ((c[0] - r.ro[0]) * r.fwd[0] + (c[1] - r.ro[1]) * r.fwd[1] + (c[2] - r.ro[2]) * r.fwd[2]);
      drag = { mode: 'grab', c, t, fwd: r.fwd, twist: 0, x: e.clientX, y: e.clientY }; canvas.classList.add('grabbing');
      if (ST.pause) { ST.pause = false; $('cPause').checked = false; }
    } else drag = { mode: 'orbit', x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) cam.dist = clamp(cam.dist * pinch0 / d, 1.6, 9); pinch0 = d; return; }
    if (!drag) return;
    if (drag.mode === 'lure') { const r = pickRay(e.clientX, e.clientY), den = Math.max(0.2, r.rd[0] * r.fwd[0] + r.rd[1] * r.fwd[1] + r.rd[2] * r.fwd[2]), tt = drag.t / den; lureSet(r.ro[0] + r.rd[0] * tt, r.ro[1] + r.rd[1] * tt, r.ro[2] + r.rd[2] * tt); return; }
    if (drag.mode === 'jf') { const r = pickRay(e.clientX, e.clientY), den = Math.max(0.2, r.rd[0] * r.fwd[0] + r.rd[1] * r.fwd[1] + r.rd[2] * r.fwd[2]), tt = drag.t / den; jf.move('d', [r.ro[0] + r.rd[0] * tt, r.ro[1] + r.rd[1] * tt, r.ro[2] + r.rd[2] * tt]); return; }
    if (drag.mode === 'kelp') { const r = pickRay(e.clientX, e.clientY); if (r.rd[1] < -0.02) { const t = -r.ro[1] / r.rd[1]; kelp.move(drag.c, r.ro[0] + r.rd[0] * t, r.ro[2] + r.rd[2] * t); } return; }
    if (drag.mode === 'orbit') { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.006, 0.06, 1.45); return; }
    const r = pickRay(e.clientX, e.clientY);
    if (ST.twist || e.shiftKey || (e.buttons & 2)) { drag.twist += dx * 0.018; world.moveGrab(drag.c, drag.twist); return; }
    const den = r.rd[0] * r.fwd[0] + r.rd[1] * r.fwd[1] + r.rd[2] * r.fwd[2], tt = drag.t / Math.max(den, 0.2);
    let tg = [r.ro[0] + r.rd[0] * tt, r.ro[1] + r.rd[1] * tt, r.ro[2] + r.rd[2] * tt];
    const o = [tg[0] - drag.c[0], tg[1] - drag.c[1], tg[2] - drag.c[2]], l = Math.hypot(...o);
    if (l > 1.2) tg = [drag.c[0] + o[0] / l * 1.2, drag.c[1] + o[1] / l * 1.2, drag.c[2] + o[2] / l * 1.2];
    tg[1] = Math.max(0.02, tg[1]);
    world.moveGrab(tg, drag.twist);
  });
  const up = e => { if (drag && drag.mode === 'lure') lure.grab = false; if (drag && drag.mode === 'jf') jf.release('d'); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (drag && drag.mode === 'grab') world.endGrab(); drag = null; canvas.classList.remove('grabbing'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 1.6, 9); }, { passive: false });
}

// ---------------------------------------------------------------- WebXR (WebGPU binding): VR + AR placement + floating menu + hand pinch
let xrS = null, panelRes = null; const xrErrs = []; let fmt0 = null;
function setFmt(f) { for (const v of vrs) if (v) destroyVR(v); vrs = []; fmt = f; initPipelines(); panelRes = null; resize(); }
const PNW = 640, PNH = 1296, PIW = 720, PIH = 380;
const stepItem = (label, y, get, set, extra = {}) => Object.assign({ kind: 'stepper', label, x: 28, y, w: 584, h: 70, get, set }, extra);
const sizeItem = y => stepItem('Size', y, () => (xrS.pl.scale - 0.06) / 0.24, v => { xrS.pl.scale = 0.06 + v * 0.24; applyPlace(xrS.pl); });
const turnItem = y => stepItem('Turn', y, () => (((xrS.pl.yaw / (2 * Math.PI)) % 1) + 1) % 1, v => { xrS.pl.yaw = v * 2 * Math.PI; applyPlace(xrS.pl); }, { step: 1 / 12, wrap: true });
const exitBtn = (label, x, w, y, only) => ({ kind: 'btn', label, x, y, w, h: 74, only, fn: () => xrS && xrS.session.end() });
const VR_ITEMS = (() => {
  const it = [];
  const add = (kind, label, x, w, h, extra = {}) => it.push(Object.assign({ kind, label, x, y: 0, w, h }, extra));
  WAYS.forEach((w, i) => add('way', w.name, 28 + i * 150, 140, 64, { i, y: 82 }));
  const rows = [['Gulp', A.gulp, null], ['Swish tail', A.swish, () => ST.swishT], ['Light up', A.light, () => ST.luT], ['Ocean gravity', A.ocean, () => ST.ocean], ['Swim', A.swim, () => ST.swim], ['Scatter krill', A.krill, () => ST.krillOn], ['Reset', A.reset, null]];
  rows.forEach((r, i) => { const col = i % 2, row = (i / 2) | 0; add('btn', r[0], 28 + col * 300, 284, 74, { y: 170 + row * 86, fn: r[1], on: r[2] }); });
  add('stepper', 'Firmness', 28, 584, 70, { y: 526, get: () => ST.firm, set: v => { ST.firm = v; $('sFirm').value = v * 100; $('oFirm').textContent = Math.round(v * 100); } });
  add('btn', 'Underwater blue', 28, 284, 66, { y: 1216, on: () => ST.uw, fn: A.uw });
  add('btn', 'Light rays', 328, 284, 66, { y: 1216, on: () => ST.cau, fn: A.cau });
  add('stepper', 'Ocean sound', 28, 584, 70, { y: 1136, get: () => SND.vol, set: v => { sndSet(v); sndStart(); $('sSnd').value = Math.round(v * 100); $('oSnd').textContent = Math.round(v * 100); } });
  add('stepper', 'Damping', 28, 584, 70, { y: 606, get: () => ST.damp, set: v => { ST.damp = v; $('sDamp').value = v * 100; $('oDamp').textContent = Math.round(v * 100); } });
  [['¼ speed', 'slow', 'cSlow'], ['Show mesh', 'mesh', 'cMesh'], ['Pause', 'pause', 'cPause']].forEach((t, i) => add('btn', t[0], 28 + i * 200, 190, 66, { y: 696, on: () => ST[t[1]], fn: () => { ST[t[1]] = !ST[t[1]]; $(t[2]).checked = ST[t[1]]; } }));
  add('btn', 'Follow food', 228, 190, 66, { y: 772, on: () => ST.lure, fn: A.lure });
  add('btn', 'Jellyfish', 428, 190, 66, { y: 772, on: () => ST.jf, fn: A.jf });
  add('btn', 'Seaweed', 28, 190, 66, { y: 772, on: () => ST.kelp, fn: () => { ST.kelp = !ST.kelp; $('cKelp').checked = ST.kelp; } });
  it.push(sizeItem(872), turnItem(952));
  add('btn', 'Move shark', 28, 284, 74, { y: 1052, only: 'ar', fn: () => setMode('place') });
  it.push(exitBtn('Exit AR', 328, 284, 1052, 'ar'), exitBtn('Exit VR', 28, 584, 1052, 'vr'));
  return it;
})();
const PLACE_ITEMS = [sizeItem(330), turnItem(410), exitBtn('Exit AR', 28, 584, 500, null)];
function setMode(m) {
  const s = xrS; s.mode = m; s.items = m === 'place' ? PLACE_ITEMS : VR_ITEMS.filter(it => !it.only || it.only === (s.ar ? 'ar' : 'vr'));
  s.hover = -1; s.dirty = true;
}
function drawPanel(hover) {
  const s = xrS, c = panelRes.cv, g2 = c.getContext('2d'), w = WAYS[ST.way], dk = true, place = s.mode === 'place', Hc = place ? 600 : PNH;
  g2.clearRect(0, 0, PNW, PNH);
  { const gr = g2.createLinearGradient(0, 0, PNW * 0.6, Hc); gr.addColorStop(0, 'rgba(34,44,56,0.72)'); gr.addColorStop(1, 'rgba(10,15,22,0.62)'); g2.fillStyle = gr; g2.beginPath(); g2.roundRect(0, 0, PNW, Hc, 34); g2.fill(); g2.strokeStyle = 'rgba(255,255,255,0.22)'; g2.lineWidth = 2; g2.stroke(); }
  const ink = dk ? '#e9eef0' : '#14212b', mute = dk ? '#8fa1ab' : '#5b6b75';
  g2.fillStyle = ink; g2.font = 'italic 46px Georgia, serif'; g2.fillText('Whale Shark Jelly.', 28, 54);
  g2.font = '600 17px system-ui, sans-serif'; g2.fillStyle = mute;
  g2.fillText('drag this title to move the board', 28, 76);
  if (place) {
    g2.fillStyle = ink; g2.font = '600 30px system-ui'; g2.fillText(s.ret.ok ? 'Surface found' : 'Looking for a surface…', 28, 150);
    g2.fillStyle = s.ret.ok ? w.accent : mute; g2.beginPath(); g2.arc(600, 138, 12, 0, 7); g2.fill();
    g2.fillStyle = mute; g2.font = '500 24px system-ui';
    ['Point at a table or the floor.', s.noHT ? 'No hit-test here: it lands on the floor in front of you.' : 'The shark follows your pointer.', 'Pinch (or squeeze the trigger) to place it.', 'Then the board stays at its side.'].forEach((t, i) => g2.fillText(t, 28, 200 + i * 34));
  }
  g2.font = '500 15px system-ui'; g2.fillStyle = xrErrs.length ? '#c0392b' : mute;
  g2.fillText((place ? s.diag : s.diag + ' · ' + s.frames + 'f · walls ' + (s.nPlanes || 0)) + (xrErrs.length ? ' · ' + xrErrs[xrErrs.length - 1] : ''), 28, place ? 584 : PNH - 16, 584);
  s.items.forEach((it, idx) => {
    const hov = hover === idx; g2.lineWidth = 3;
    if (it.kind === 'way') { g2.fillStyle = WAYS[it.i].sw; g2.strokeStyle = ST.way === it.i ? ink : 'rgba(0,0,0,0)'; g2.beginPath(); g2.roundRect(it.x, it.y, it.w, it.h, 18); g2.fill(); g2.stroke(); g2.fillStyle = '#fff'; g2.font = '700 22px system-ui'; g2.textAlign = 'center'; g2.fillText(it.label, it.x + it.w / 2, it.y + 40); g2.textAlign = 'left'; if (hov) { g2.strokeStyle = '#fff'; g2.strokeRect(it.x, it.y, it.w, it.h); } return; }
    if (it.kind === 'btn') {
      const on = it.on && it.on(); g2.fillStyle = on ? w.accent : (hov ? (dk ? '#2b3540' : '#dfe3e3') : (dk ? '#1d242c' : '#e8e8e2')); g2.strokeStyle = on ? w.accent : mute; g2.beginPath(); g2.roundRect(it.x, it.y, it.w, it.h, it.h / 2); g2.fill(); g2.stroke();
      g2.fillStyle = on ? '#fff' : ink; g2.font = '600 26px system-ui'; g2.textAlign = 'center'; g2.fillText(it.label === 'Tuck the eyes' && on ? 'Release eyes' : it.label, it.x + it.w / 2, it.y + it.h / 2 + 9); g2.textAlign = 'left'; return;
    }
    if (it.kind === 'stepper') {
      g2.fillStyle = ink; g2.font = '600 24px system-ui'; g2.fillText(it.label, it.x, it.y + 42);
      const v = it.get(); g2.fillStyle = dk ? '#2b3540' : '#d9dcd8'; g2.beginPath(); g2.roundRect(it.x + 190, it.y + 24, 250, 22, 11); g2.fill(); g2.fillStyle = w.accent; g2.beginPath(); g2.roundRect(it.x + 190, it.y + 24, Math.max(22, 250 * v), 22, 11); g2.fill();
      [[0, '–'], [1, '+']].forEach(([k, sg]) => { const bx = it.x + (k ? 500 : 140); g2.fillStyle = hov && ptrHoverSide === k ? w.accent : (dk ? '#1d242c' : '#e8e8e2'); g2.beginPath(); g2.roundRect(bx, it.y + 8, 84, 54, 27); g2.fill(); g2.fillStyle = ink; g2.font = '700 34px system-ui'; g2.textAlign = 'center'; g2.fillText(sg, bx + 42, it.y + 46); g2.textAlign = 'left'; });
    }
  });
  device.queue.copyExternalImageToTexture({ source: c }, { texture: panelRes.tex }, [PNW, PNH]);
}
function wrapText(g2, text, x, y, maxW, lh) { let line = ''; for (const wd of text.split(' ')) { const t = line ? line + ' ' + wd : wd; if (g2.measureText(t).width > maxW && line) { g2.fillText(line, x, y); y += lh; line = wd; } else line = t; } g2.fillText(line, x, y); return y; }
function drawInfo() { // second floating board: the readouts and notes from the page's top and bottom bars
  const s = xrS, g2 = panelRes.cvI.getContext('2d'), w = WAYS[ST.way], dk = true;
  g2.clearRect(0, 0, PIW, PIH);
  { const gr = g2.createLinearGradient(0, 0, PIW * 0.6, PIH); gr.addColorStop(0, 'rgba(34,44,56,0.72)'); gr.addColorStop(1, 'rgba(10,15,22,0.62)'); g2.fillStyle = gr; g2.beginPath(); g2.roundRect(0, 0, PIW, PIH, 34); g2.fill(); g2.strokeStyle = 'rgba(255,255,255,0.22)'; g2.lineWidth = 2; g2.stroke(); }
  const ink = dk ? '#e9eef0' : '#14212b', mute = dk ? '#8fa1ab' : '#5b6b75';
  g2.fillStyle = ink; g2.font = 'italic 46px Georgia, serif'; g2.fillText('Whale Shark Jelly.', 30, 58);
  g2.font = '600 17px system-ui, sans-serif'; g2.fillStyle = mute; g2.fillText('MATERIAL STUDIES  ·  SOFT-BODY STUDY', 32, 86);
  const stats = [[(world.totalMassG + krill.eaten * 0.05).toFixed(0), 'MASS  g'], [(volCache * 100).toFixed(0), 'VOLUME  %'], [world.gapeMM().toFixed(1), 'GAPE  mm'], [String(krill.eaten), 'KRILL']];
  stats.forEach((st, i) => { const x = 30 + i * 172; g2.fillStyle = w.accent; g2.font = '600 50px system-ui'; g2.fillText(st[0], x, 168); g2.fillStyle = mute; g2.font = '600 16px system-ui'; g2.fillText(st[1], x, 194); });
  g2.fillStyle = dk ? '#2b3540' : '#d9dcd8'; g2.fillRect(30, 214, PIW - 60, 2);
  g2.fillStyle = ink; g2.font = '500 22px system-ui';
  wrapText(g2, s.mode === 'place' ? 'Point at a table or the floor, then pinch to place the shark.' : 'Pinch the jelly to pull it. Use both hands at once, or touch it with a finger, the palm or your whole hand. Ocean gravity floats it; Swim makes it circle where you let go.', 30, 250, PIW - 60, 30);
  g2.font = '500 15px system-ui'; g2.fillStyle = xrErrs.length ? '#c0392b' : mute; g2.fillText($('verTag').textContent + (xrErrs.length ? '  ·  ' + xrErrs[xrErrs.length - 1] : ''), 30, PIH - 20, PIW - 60);
  device.queue.copyExternalImageToTexture({ source: panelRes.cvI }, { texture: panelRes.texI }, [PIW, PIH]);
}
function infoPose(s, eye) { // opposite side of the shark from the menu board, a bit higher, always facing the viewer
  const pos = s.pl.pos, hw = 0.17, hh = hw * PIH / PIW; let dx = pos[0] - eye[0], dz = pos[2] - eye[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const off = 0.2 + 1.9 * s.pl.scale, c = [pos[0] + dz * off - dx * 0.08, pos[1] + hh + 0.1, pos[2] - dx * off - dz * 0.08];
  const n = nrm([eye[0] - c[0], 0, eye[2] - c[2]]); s.infoP = { c, r: [n[2], 0, -n[0]], hw, hh };
}
let ptrHoverSide = 0;
async function setupXR() {
  const note = $('vrNote'), bVR = $('bVR'), bAR = $('bAR');
  if (!navigator.xr) { note.textContent = 'WebXR isn’t available in this browser (it needs HTTPS and a headset browser such as Quest Browser).'; return; }
  let vr = false, ar = false;
  try { vr = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { }
  try { ar = await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { }
  if (!vr && !ar) { note.textContent = 'No immersive headset found.'; return; }
  if (ar) { bAR.disabled = false; bAR.onclick = () => enterXR(true); }
  if (vr) { bVR.disabled = false; bVR.onclick = () => enterXR(false); }
  note.textContent = (ar ? 'AR: point at a table or the floor and pinch to place the shark; the board floats at its side. ' : '') + 'Pinch on the jelly to pull it; pinch the board to press. Controllers work too (trigger).';
}
function makeBridge(session) {
  const glc = document.createElement('canvas'), gl = glc.getContext('webgl2', { xrCompatible: true, alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL2 not available for the XR layer');
  const layer = new XRWebGLLayer(session, gl, { alpha: true, antialias: false, depth: false, stencil: false, framebufferScaleFactor: 0.8 });
  session.updateRenderState({ baseLayer: layer });
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('glsl ' + gl.getShaderInfoLog(o)); return o; };
  const pg = gl.createProgram();
  gl.attachShader(pg, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'));
  gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;uniform sampler2D T;uniform vec2 S;out vec4 o;void main(){o=texture(T,vec2(gl_FragCoord.x/S.x,1.0-gl_FragCoord.y/S.y));}'));
  gl.linkProgram(pg); if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw new Error('glsl link ' + gl.getProgramInfoLog(pg));
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const cv = document.createElement('canvas'), gctx = cv.getContext('webgpu');
  const b = { gl, layer, pg, tex, cv, gctx, fw: 0, fh: 0, cur: null, vao: gl.createVertexArray() };
  window.__br = b;
  return b;
}
function bridgeBegin(br) { // acquire the offscreen WebGPU target for this frame
  const fw = br.layer.framebufferWidth, fh = br.layer.framebufferHeight;
  if (fw !== br.fw || fh !== br.fh) { br.fw = fw; br.fh = fh; br.cv.width = fw; br.cv.height = fh; br.gctx.configure({ device, format: fmt, alphaMode: 'premultiplied', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST }); }
  br.curTex = br.gctx.getCurrentTexture();
}
function bridgeEnd(br) { // copy the WebGPU result into the XR framebuffer
  const gl = br.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, br.layer.framebuffer);
  gl.viewport(0, 0, br.fw, br.fh); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.colorMask(true, true, true, true);
  const glE = (tag) => { const e = gl.getError(); if (e) { xrErrs.push('GL ' + e + ' @' + tag); if (xrErrs.length > 3) xrErrs.shift(); if (xrS) xrS.errAt = frameN; } };
  glE('pre');
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, br.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  glE('state'); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, br.cv); glE('tex');
  gl.useProgram(br.pg); gl.uniform1i(gl.getUniformLocation(br.pg, 'T'), 0); gl.uniform2f(gl.getUniformLocation(br.pg, 'S'), br.fw, br.fh);
  gl.bindVertexArray(br.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  glE('draw');
}
// per-view target: viewport (WebGPU, top-left origin) + colour view
function xrSub(s, view) {
  if (s.xm === 'gpu') { const sub = s.binding.getViewSubImage(s.layer, view); return { vp: sub.viewport, cv: sub.colorTexture.createView(sub.getViewDescriptor ? sub.getViewDescriptor() : undefined) }; }
  const g = s.layer.getViewport(view), br = s.br;
  return { vp: { x: g.x, y: br.fh - g.y - g.height, width: g.width, height: g.height }, cv: null };
}
async function enterXR(ar) {
  try {
    if (ST.cell < 0.06) { ST.cell = 0.06; $('sDetail').value = '0.06'; loadWorld(0.06); }
    const session = await navigator.xr.requestSession(ar ? 'immersive-ar' : 'immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ar ? ['hit-test', 'hand-tracking', 'plane-detection'] : ['hand-tracking'] });
    // Default path: render with WebGPU into an offscreen canvas and copy it into a normal WebGL XR layer
    // (Quest Browser has no XRGPUBinding unless flags are set). Add #gpu to the URL to try the native binding.
    xrErrs.length = 0;
    let binding = null, layer = null, gl = null, br = null, pref = null, mode = 'bridge';
    if (DBG.has('gpu') && typeof XRGPUBinding !== 'undefined') {
      try {
        binding = new XRGPUBinding(session, device);
        pref = binding.getPreferredColorFormat ? binding.getPreferredColorFormat() : fmt;
        if (pref && pref !== fmt) { fmt0 = fmt; setFmt(pref); }
        layer = binding.createProjectionLayer({ colorFormat: fmt, alphaMode: 'premultiplied' });
        session.updateRenderState({ layers: [layer] }); mode = 'gpu';
      } catch (e) { binding = null; layer = null; xrErrs.push('gpu binding: ' + String(e.message).slice(0, 80)); }
    }
    if (mode === 'bridge') { br = makeBridge(session); gl = br.gl; layer = br.layer; }
    const ref = await session.requestReferenceSpace('local-floor');
    if (!panelRes) {
      const cv = document.createElement('canvas'); cv.width = PNW; cv.height = PNH;
      const tex = device.createTexture({ size: [PNW, PNH], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      const mod = device.createShaderModule({ code: WGSL_PANEL });
      const bl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }] });
      const pl = device.createPipelineLayout({ bindGroupLayouts: [bl] });
      const bl2 = { blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } };
      const ds = { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' };
      const mk = (vs, fs, topo, blend) => device.createRenderPipeline({ layout: pl, vertex: { module: mod, entryPoint: vs }, fragment: { module: mod, entryPoint: fs, targets: [blend ? Object.assign({ format: fmt }, bl2) : { format: fmt }] }, primitive: { topology: topo }, depthStencil: ds });
      const pPanel = mk('vsPanel', 'fsPanel', 'triangle-list', true), pLaser = mk('vsLaser', 'fsLaser', 'line-list', false);
      const pRing = mk('vsRing', 'fsRing', 'triangle-list', true), pArrow = mk('vsArrow', 'fsRing', 'triangle-list', true);
      const ubs = [0, 1].map(() => device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })); // one per eye: queue.writeBuffer lands before the submit, so a shared buffer would give both eyes the last matrix
      const bgs = ubs.map(ub => device.createBindGroup({ layout: bl, entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: sampler }] }));
      const cvI = document.createElement('canvas'); cvI.width = PIW; cvI.height = PIH;
      const texI = device.createTexture({ size: [PIW, PIH], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      const ubsI = [0, 1].map(() => device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
      const bgsI = ubsI.map(ub => device.createBindGroup({ layout: bl, entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: texI.createView() }, { binding: 2, resource: sampler }] }));
      panelRes = { cv, tex, pPanel, pLaser, pRing, pArrow, ubs, bgs, data: new Float32Array(48), cvI, texI, ubsI, bgsI, dataI: new Float32Array(48) };
    }
    xrS = { session, binding, layer, br, xm: mode, ref, ar, dirty: true, hover: -1, grabs: new Map(), pgrab: null, hprev: new Map(), panelPose: null, last: 0, mode: 'play', items: [], hts: new Map(), viewerHT: null, noHT: false, ret: { ok: false, t: 0, pos: [0, 0, -0.7] }, pl: { pos: [0, ar ? 0 : 0.82, -0.7], yaw: 0, scale: ar ? 0.16 : 0.14 }, yawSet: !ar, pinch: new Set(), frames: 0, diag: `${document.getElementById('verTag').textContent.replace('Build ','')} ${ar ? 'AR' : 'VR'} ${mode} blend:${session.environmentBlendMode || '?'} fmt:${fmt}${br ? ' fbL:' + br.layer.framebufferWidth + 'x' + br.layer.framebufferHeight : ''}` };
    setMode(ar ? 'place' : 'play'); applyPlace(xrS.pl);
    ['selectstart', 'selectend'].forEach(n => session.addEventListener(n, ev => xrSelect(ev, n === 'selectstart')));
    if (ar) {
      xrS.noHT = typeof session.requestHitTestSource !== 'function';
      if (!xrS.noHT) {
        const s = xrS;
        session.requestReferenceSpace('viewer').then(vs => session.requestHitTestSource({ space: vs })).then(h => { s.viewerHT = h; }).catch(() => { });
        const addSrc = src => { if (!src.targetRaySpace || s.hts.has(src)) return; s.hts.set(src, null); session.requestHitTestSource({ space: src.targetRaySpace }).then(h => s.hts.set(src, h)).catch(() => { }); };
        session.addEventListener('inputsourceschange', ev => { ev.added.forEach(addSrc); ev.removed.forEach(r => { const h = s.hts.get(r); if (h && h.cancel) h.cancel(); s.hts.delete(r); }); });
        Array.from(session.inputSources).forEach(addSrc);
      }
    }
    session.addEventListener('end', () => { world.endGrab(-1); jf.release(); ROOM.planes = []; ROOM.virt = true; ROOM.R = 7.5; ROOM.H = 5.5; world.setColliders(CB, 0); const dg = xrS ? `${xrS.diag} frames:${xrS.frames}${xrErrs.length ? ' ERR: ' + xrErrs.join(' | ') : ''}` : ''; xrS = null; XI.fill(0); xiN = 0; if (fmt0) { setFmt(fmt0); fmt0 = null; } canvas.width = 0; resize(); $('vrNote').textContent = 'Last XR session → ' + dg; lastT = performance.now(); requestAnimationFrame(frame); });
    session.requestAnimationFrame(xrFrame);
  } catch (e) { console.error(e); $('vrNote').textContent = 'Could not start ' + (ar ? 'AR' : 'VR') + ': ' + e.message; }
}
const XR_M = M4.trs(0, 0.82, -0.7, 0.14);
let XR_MI = null;
// sim → XR: sim point (1.5,0,0) (centre of the dish, belly on the table) lands on p.pos; yaw about the vertical; uniform scale
// walls / ceiling for the physics: real planes (AR plane detection) in scene units, else a virtual room sized in metres
function roomFromXR(frame, s, pose) {
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  const k = Math.hypot(XR_M[0], XR_M[1], XR_M[2]) || 1, h = pose.transform.position, ps = [];
  const planes = s.ar && frame.detectedPlanes;
  if (planes) for (const pl of planes) {
    let pp; try { pp = frame.getPose(pl.planeSpace, s.ref); } catch (e) { pp = null; } if (!pp || !pl.polygon || pl.polygon.length < 3) continue;
    const m = pp.transform.matrix, o = [m[12], m[13], m[14]]; let n = [m[4], m[5], m[6]];
    if ((h.x - o[0]) * n[0] + (h.y - o[1]) * n[1] + (h.z - o[2]) * n[2] < 0) n = n.map(c => -c); // face into the room
    if (n[1] > 0.7 && o[1] < XR_M[13] + 0.05) continue; // floor / surface the dish stands on: the sim floor already handles it
    let e = [1e9, -1e9, 1e9, -1e9]; for (const q of pl.polygon) { e[0] = Math.min(e[0], q.x); e[1] = Math.max(e[1], q.x); e[2] = Math.min(e[2], q.z); e[3] = Math.max(e[3], q.z); }
    const M = 0.05; e = [(e[0] - M) / k, (e[1] + M) / k, (e[2] - M) / k, (e[3] + M) / k];
    ps.push({ o: M4.pt(XR_MI, o), n: nrm(M4.dir(XR_MI, n)), u: nrm(M4.dir(XR_MI, [m[0], m[1], m[2]])), v: nrm(M4.dir(XR_MI, [m[8], m[9], m[10]])), e, th: 0.35 / k, label: pl.semanticLabel || '' });
  }
  ROOM.planes = ps; ROOM.virt = ps.length < 2;
  if (ROOM.virt) { ROOM.R = 2.2 / k; ROOM.H = Math.max(0.6, 2.5 - XR_M[13]) / k; }
  s.nPlanes = ps.length;
}
function applyPlace(p) {
  const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), k = p.scale;
  XR_M.set([k * c, 0, -k * sn, 0, 0, k, 0, 0, k * sn, 0, k * c, 0, p.pos[0] - 1.5 * k * c, p.pos[1], p.pos[2] + 1.5 * k * sn, 1]); XR_MI = null;
}
const faceYaw = (eye, pos) => { // shark head toward the viewer's left, a bit toward the viewer
  let dx = pos[0] - eye[0], dz = pos[2] - eye[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const fx = dz * 0.9 - dx * 0.45, fz = -dx * 0.9 - dz * 0.45; return Math.atan2(fz, -fx);
};
function dockPanel(s, eye) { // board floats at the viewer's right of the shark, facing the viewer
  const pos = s.pl.pos, hw = 0.15, hh = hw * PNH / PNW; let dx = pos[0] - eye[0], dz = pos[2] - eye[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const off = 0.14 + 1.9 * s.pl.scale, c = [pos[0] - dz * off - dx * 0.08, pos[1] + hh + 0.03, pos[2] + dx * off - dz * 0.08];
  faceEye(s, c, eye, hw, hh);
}
function faceEye(s, c, eye, hw = s.panelPose.hw, hh = s.panelPose.hh) {
  const n = nrm([eye[0] - c[0], 0, eye[2] - c[2]]); s.panelPose = { c, n, r: [n[2], 0, -n[0]], u: [0, 1, 0], hw, hh };
}
function rayFromSource(frame, src) {
  const pose = frame.getPose(src.targetRaySpace, xrS.ref); if (!pose) return null;
  const m = pose.transform.matrix; return { ro: [m[12], m[13], m[14]], rd: nrm([-m[8], -m[9], -m[10]]) };
}
function pinchPoint(frame, src) {
  const h = src.hand; if (!h) return null;
  const a = h.get('index-finger-tip'), b = h.get('thumb-tip'); if (!a || !b) return null;
  const pa = frame.getJointPose(a, xrS.ref), pb = frame.getJointPose(b, xrS.ref); if (!pa || !pb) return null;
  const A = pa.transform.position, B = pb.transform.position; return [(A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2];
}
function panelHit(ray) {
  const P = xrS.panelPose; if (!P) return null;
  const den = ray.rd[0] * P.n[0] + ray.rd[1] * P.n[1] + ray.rd[2] * P.n[2]; if (Math.abs(den) < 1e-4) return null;
  const t = ((P.c[0] - ray.ro[0]) * P.n[0] + (P.c[1] - ray.ro[1]) * P.n[1] + (P.c[2] - ray.ro[2]) * P.n[2]) / den; if (t < 0) return null;
  const h = [ray.ro[0] + ray.rd[0] * t - P.c[0], ray.ro[1] + ray.rd[1] * t - P.c[1], ray.ro[2] + ray.rd[2] * t - P.c[2]];
  const x = (h[0] * P.r[0] + h[1] * P.r[1] + h[2] * P.r[2]) / P.hw, y = (h[0] * P.u[0] + h[1] * P.u[1] + h[2] * P.u[2]) / P.hh;
  if (Math.abs(x) > 1 || Math.abs(y) > 1) return null;
  const px = (x * 0.5 + 0.5) * PNW, py = (0.5 - y * 0.5) * PNH;
  if (py > (xrS.mode === 'place' ? 600 : PNH)) return null; // the empty part of the texture isn't the board
  return { t, px, py };
}
function itemAt(px, py) { const L = xrS.items; for (let i = 0; i < L.length; i++) { const it = L[i]; if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) return i; } return -1; }
function freeGrabId(s) { const used = new Set([...s.grabs.values()].map(g => g.id)); let i = 1; while (used.has(i)) i++; return i; }
function xrSelect(ev, down) {
  const s = xrS; if (!s) return;
  const frame = ev.frame, src = ev.inputSource, ray = rayFromSource(frame, src); if (!ray) return;
  if (!down) {
    s.pinch.delete(src);
    { const g = s.grabs.get(src); if (g) { world.endGrab(g.id); s.grabs.delete(src); } }
    if (s.kgrabs) { const kg = s.kgrabs.get(src); if (kg && kg.lure) lure.grab = false; if (kg && kg.jf) jf.release(kg.jf); s.kgrabs.delete(src); }
    if (s.pgrab && s.pgrab.src === src) s.pgrab = null;
    return;
  }
  s.pinch.add(src);
  const ph = panelHit(ray);
  if (ph) { // click on the board (title bar drags it)
    if (ph.py < 90) { s.pgrab = { src, dist: ph.t }; return; }
    const i = itemAt(ph.px, ph.py);
    if (i >= 0) { const it = s.items[i]; if (it.kind === 'way') A.way(it.i); else if (it.kind === 'btn') { it.fn(); sync(); } else if (it.kind === 'stepper') { const dir = ph.px < it.x + 300 ? -1 : 1, st = it.step || 0.1; let v = it.get() + dir * st; v = it.wrap ? ((v % 1) + 1) % 1 : clamp(v, 0, 1); it.set(v); } s.dirty = true; }
    return;
  }
  if (s.mode === 'place') { // pinch/trigger anywhere else drops the shark here
    if (s.ret.ok) { setMode('play'); const e = frame.getViewerPose(s.ref); if (e) { const p = e.transform.position; dockPanel(s, [p.x, p.y, p.z]); } }
    return;
  }
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  const ro = M4.pt(XR_MI, ray.ro), rd = nrm(M4.dir(XR_MI, ray.rd));
  if (!s.kgrabs) s.kgrabs = new Map();
  if (ST.lure && lure.s > 0.3) { // grab the big krill: pinch close to it, or point the ray at it
    const pk = pinchPoint(frame, src);
    if (pk) { const ps = M4.pt(XR_MI, pk); if (Math.hypot(ps[0] - lure.p[0], ps[1] - lure.p[1], ps[2] - lure.p[2]) < 0.3) { lure.grab = true; s.kgrabs.set(src, { lure: true, direct: true, off: [lure.p[0] - ps[0], lure.p[1] - ps[1], lure.p[2] - ps[2]], id: lure.id }); return; } }
    else { const vx = lure.p[0] - ro[0], vy = lure.p[1] - ro[1], vz = lure.p[2] - ro[2], tt = vx * rd[0] + vy * rd[1] + vz * rd[2]; if (tt > 0 && Math.hypot(vx - rd[0] * tt, vy - rd[1] * tt, vz - rd[2] * tt) < 0.18) { lure.grab = true; s.kgrabs.set(src, { lure: true, dist: tt, id: lure.id }); return; } }
  }
  if (ST.jf) { // jellyfish: pinch close to one, or point the ray at it
    const pk = pinchPoint(frame, src), gid = 'x' + (++jfGid);
    if (pk) { const ps = M4.pt(XR_MI, pk), jh = jf.near(ps, 0.12); if (jh) { const c = jf.grab(gid, jh); s.kgrabs.set(src, { jf: gid, direct: true, off: [c[0] - ps[0], c[1] - ps[1], c[2] - ps[2]] }); return; } }
    else { const jh = jf.pick(ro, rd, 0.06), sv = world.pickVertex(ro, rd); let st = 1e9; if (sv >= 0) st = (world.pos[3 * sv] - ro[0]) * rd[0] + (world.pos[3 * sv + 1] - ro[1]) * rd[1] + (world.pos[3 * sv + 2] - ro[2]) * rd[2];
      if (jh && jh.t < st + 0.05) { jf.grab(gid, jh); s.kgrabs.set(src, { jf: gid, dist: jh.t }); return; } }
  }
  if (ST.kelp) { // pinch a seaweed clump and slide it over the floor
    const pk = pinchPoint(frame, src);
    if (pk) { const ps = M4.pt(XR_MI, pk), kc = kelp.pick(null, null, 0.2, ps); if (kc >= 0) { const r0 = kelp.root(kc); s.kgrabs.set(src, { c: kc, direct: true, off: [r0[0] - ps[0], r0[1] - ps[2]] }); return; } }
    else { const kc = world.pickVertex(ro, rd) < 0 ? kelp.pick(ro, rd, 0.12) : -1; if (kc >= 0) { s.kgrabs.set(src, { c: kc, direct: false }); return; } }
  }
  const pp = pinchPoint(frame, src); // hand pinch close to the jelly = grab it directly, like clicking the character
  if (pp) {
    const ps = M4.pt(XR_MI, pp); let best = -1, bd = 0.45;
    for (const v of world.surfV) { const d = Math.hypot(world.pos[3 * v] - ps[0], world.pos[3 * v + 1] - ps[1], world.pos[3 * v + 2] - ps[2]); if (d < bd) { bd = d; best = v; } }
    if (best >= 0) { const id = freeGrabId(s), c = world.beginGrab(best, rd, id).c0; s.grabs.set(src, { id, direct: true, off: [c[0] - ps[0], c[1] - ps[1], c[2] - ps[2]] }); return; }
  }
  const v = world.pickVertex(ro, rd);
  if (v >= 0) { const id = freeGrabId(s), c = world.beginGrab(v, rd, id).c0; s.grabs.set(src, { id, dist: Math.hypot(c[0] - ro[0], c[1] - ro[1], c[2] - ro[2]) }); }
}
// ---- hand colliders: every joint, bone midpoint and palm point becomes a small sphere the jelly can't enter
const CB = new Float32Array(160 * 8);
const HJ = { thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'], index: ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'], middle: ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'], ring: ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'], pinky: ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'] };
function buildHandColliders(frame, s) {
  let n = 0; const sc = s.pl.scale;
  if (s.mode === 'play') for (const src of s.session.inputSources) {
    if (!src.hand || s.grabs.has(src)) continue; // a pinching hand holds the jelly instead of bumping it
    const P = {}, R = {}; let ok = true;
    for (const [name, js] of src.hand) { const jp = frame.getJointPose(js, s.ref); if (!jp) { ok = false; break; } const q = jp.transform.position; P[name] = [q.x, q.y, q.z]; R[name] = Math.max(0.007, jp.radius || 0.008); }
    if (!ok || !P.wrist) { s.hprev.delete(src); continue; }
    const pv = s.hprev.get(src) || new Map(), nx = new Map();
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
        if (i > 0 && P[ch[i - 1]]) add(f + 'm' + i, mid(P[ch[i - 1]], a), (R[ch[i]] + R[ch[i - 1]]) / 2);
        add(f + i, a, i === 0 ? Math.max(R[ch[i]], 0.014) : R[ch[i]]);
      }
    }
    // palm: fill between the wrist and the finger bases, plus the knuckle row
    const base = ['index', 'middle', 'ring', 'pinky'].map(f => P[HJ[f][0]]).filter(Boolean);
    if (base.length === 4) {
      const c = [0, 1, 2].map(k => (P.wrist[k] + base[0][k] + base[1][k] + base[2][k] + base[3][k]) / 5);
      add('palm', c, 0.035);
      for (let i = 0; i < 4; i++) add('pw' + i, mid(P.wrist, base[i]), 0.026);
      const k1 = ['index', 'middle', 'ring', 'pinky'].map(f => P[HJ[f][1]]);
      for (let i = 0; i < 3; i++) { if (k1[i] && k1[i + 1]) add('kn' + i, mid(k1[i], k1[i + 1]), 0.014); add('bb' + i, mid(base[i], base[i + 1]), 0.02); }
      for (let i = 0; i < 4; i++) if (k1[i]) add('pm' + i, mid(base[i], k1[i]), 0.016);
    }
    s.hprev.set(src, nx);
  }
  if (s.mode === 'play') { // your head is a collider too: a face sphere and a skull sphere that follow the headset
    const vp = frame.getViewerPose(s.ref);
    if (vp) {
      const o = vp.transform.orientation || { x: 0, y: 0, z: 0, w: 1 }, p = vp.transform.position || { x: 0, y: 1.6, z: 0 }, qx = o.x, qy = o.y, qz = o.z, qw = o.w;
      const f = [-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy))], u = [2 * (qx * qy - qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qw * qx)];
      const pv = s.headPrev || new Map(), nx = new Map();
      [['h0', 0.07, 0.0, 0.082], ['h1', -0.05, 0.03, 0.105], ['h2', -0.02, 0.10, 0.07]].forEach(([key, fz, uz, r]) => {
        if (n >= 160) return; const w = [p.x + f[0] * fz + u[0] * uz, p.y + f[1] * fz + u[1] * uz, p.z + f[2] * fz + u[2] * uz], q = M4.pt(XR_MI, w), oo = n * 8, old = pv.get(key) || q;
        CB[oo] = q[0]; CB[oo + 1] = q[1]; CB[oo + 2] = q[2]; CB[oo + 3] = r * 1.1 / sc; CB[oo + 4] = old[0]; CB[oo + 5] = old[1]; CB[oo + 6] = old[2]; n++; nx.set(key, q);
      });
      s.headPrev = nx;
    }
  }
  world.setColliders(CB, n);
}
function updateReticle(frame, s, skip, eye, fwd) {
  if (s.noHT) { s.ret.ok = true; s.ret.t = performance.now(); s.ret.pos = [eye[0] + fwd[0] * 0.9, 0, eye[2] + fwd[2] * 0.9]; return; }
  const test = h => { if (!h) return null; let r; try { r = frame.getHitTestResults(h); } catch (e) { return null; } for (const res of r) { const p = res.getPose(s.ref); if (p && p.transform.matrix[5] > 0.75) return p.transform.matrix; } return null; };
  let m = null;
  for (const [src, h] of s.hts) { if (skip.has(src)) continue; m = test(h); if (m) break; }
  if (!m) m = test(s.viewerHT);
  if (m) { s.ret.ok = true; s.ret.t = performance.now(); s.ret.pos = [m[12], m[13], m[14]]; } else if (performance.now() - s.ret.t > 450) s.ret.ok = false;
}
function xrFrame(t, frame) {
  if (!xrS) return;
  const s = xrS; s.session.requestAnimationFrame(xrFrame);
  try { xrFrameInner(t, frame, s); s.frames++; }
  catch (e) {
    console.error('xrFrame', e); xrErrs.push(String(e && e.message || e).slice(0, 110)); if (xrErrs.length > 3) xrErrs.shift(); s.dirty = true;
    try { // keep the room visible: clear the layer to transparent
      if (s.xm === 'bridge') { const gl = s.br.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, s.layer.framebuffer); gl.clearColor(0.35, 0, 0.35, 0.35); gl.clear(gl.COLOR_BUFFER_BIT); return; }
      const pose = frame.getViewerPose(s.ref); if (!pose) return; const enc = device.createCommandEncoder();
      for (const view of pose.views) { const sub = xrSub(s, view); enc.beginRenderPass({ colorAttachments: [{ view: sub.cv, clearValue: { r: 0, g: 0, b: 0, a: s.ar ? 0 : 1 }, loadOp: 'clear', storeOp: 'store' }] }).end(); }
      device.queue.submit([enc.finish()]);
    } catch (e2) { }
  }
}
function xrFrameInner(t, frame, s) {
  const dtReal = Math.min(0.05, (t - s.last) / 1000 || 0.016); s.last = t; frameN++;
  const pose = frame.getViewerPose(s.ref); if (!pose) return;
  if (s.frames % 20 === 0) roomFromXR(frame, s, pose);
  advance(dtReal); uploadDynamic();
  const vm = pose.transform.matrix, eye = [vm[12], vm[13], vm[14]], fwd = nrm([-vm[8], 0, -vm[10]]);
  if (!s.panelPose) { // first board: in front of the viewer, a little to the right
    const r = [-fwd[2], 0, fwd[0]], hw = 0.15; faceEye(s, [eye[0] + fwd[0] * 0.65 + r[0] * 0.3, Math.max(0.3, eye[1] - 0.1), eye[2] + fwd[2] * 0.65 + r[2] * 0.3], eye, hw, hw * PNH / PNW);
  }
  // controllers / hands: rays, board hover, drag
  let hover = -1, laser = null; const onPanel = new Set();
  for (const src of s.session.inputSources) {
    const ray = rayFromSource(frame, src); if (!ray) continue;
    const hit = panelHit(ray); let len = 1.2;
    if (hit) { len = hit.t; onPanel.add(src); const i = itemAt(hit.px, hit.py); if (i >= 0) { hover = i; ptrHoverSide = hit.px < s.items[i].x + 300 ? 0 : 1; } }
    if (s.pgrab && s.pgrab.src === src) { const d = s.pgrab.dist; faceEye(s, [ray.ro[0] + ray.rd[0] * d, ray.ro[1] + ray.rd[1] * d, ray.ro[2] + ray.rd[2] * d], eye); }
    const kg = s.kgrabs && s.kgrabs.get(src);
    if (kg && kg.lure) {
      if (!XR_MI) XR_MI = M4.inv(XR_M);
      if (kg.id !== lure.id) s.kgrabs.delete(src); // it was eaten
      else if (kg.direct) { const pk = pinchPoint(frame, src); if (pk) { const ps = M4.pt(XR_MI, pk); lureSet(ps[0] + kg.off[0], ps[1] + kg.off[1], ps[2] + kg.off[2]); } }
      else { const ro = M4.pt(XR_MI, ray.ro), rd = nrm(M4.dir(XR_MI, ray.rd)); lureSet(ro[0] + rd[0] * kg.dist, ro[1] + rd[1] * kg.dist, ro[2] + rd[2] * kg.dist); }
    } else if (kg && kg.jf) {
      if (!XR_MI) XR_MI = M4.inv(XR_M);
      if (kg.direct) { const pk = pinchPoint(frame, src); if (pk) { const ps = M4.pt(XR_MI, pk); jf.move(kg.jf, [ps[0] + kg.off[0], ps[1] + kg.off[1], ps[2] + kg.off[2]]); } }
      else { const ro = M4.pt(XR_MI, ray.ro), rd = nrm(M4.dir(XR_MI, ray.rd)); jf.move(kg.jf, [ro[0] + rd[0] * kg.dist, ro[1] + rd[1] * kg.dist, ro[2] + rd[2] * kg.dist]); }
    } else if (kg) {
      if (!XR_MI) XR_MI = M4.inv(XR_M);
      if (kg.direct) { const pk = pinchPoint(frame, src); if (pk) { const ps = M4.pt(XR_MI, pk); kelp.move(kg.c, ps[0] + kg.off[0], ps[2] + kg.off[1]); } }
      else { const ro = M4.pt(XR_MI, ray.ro), rd = nrm(M4.dir(XR_MI, ray.rd)); if (rd[1] < -0.02) { const t = -ro[1] / rd[1]; kelp.move(kg.c, ro[0] + rd[0] * t, ro[2] + rd[2] * t); } }
    }
    const gb = s.grabs.get(src);
    if (gb) {
      if (!XR_MI) XR_MI = M4.inv(XR_M);
      let tg;
      const pp = gb.direct ? pinchPoint(frame, src) : null;
      if (pp) { const ps = M4.pt(XR_MI, pp); tg = [ps[0] + gb.off[0], Math.max(0.03, ps[1] + gb.off[1]), ps[2] + gb.off[2]]; }
      else { const ro = M4.pt(XR_MI, ray.ro), rd = nrm(M4.dir(XR_MI, ray.rd)), d = gb.dist || 1; tg = [ro[0] + rd[0] * d, Math.max(0.03, ro[1] + rd[1] * d), ro[2] + rd[2] * d]; }
      const c0 = world.S.grabs.get(gb.id).c0, o = [tg[0] - c0[0], tg[1] - c0[1], tg[2] - c0[2]], l = Math.hypot(...o), k = l > 1.4 ? 1.4 / l : 1;
      world.moveGrab([c0[0] + o[0] * k, c0[1] + o[1] * k, c0[2] + o[2] * k], 0, gb.id);
    }
    if ((!src.hand || hit) && (!laser || hit)) laser = [ray.ro, [ray.ro[0] + ray.rd[0] * len, ray.ro[1] + ray.rd[1] * len, ray.ro[2] + ray.rd[2] * len]];
  }
  // surface detection + placement preview
  if (s.ar && s.mode === 'place') {
    updateReticle(frame, s, onPanel, eye, fwd);
    if (s.ret.ok) {
      const P = s.pl, first = !s.yawSet, k = first ? 1 : 0.35;
      for (let i = 0; i < 3; i++) P.pos[i] += (s.ret.pos[i] - P.pos[i]) * k;
      if (first) { P.yaw = faceYaw(eye, P.pos); s.yawSet = true; dockPanel(s, eye); }
      applyPlace(P);
    }
    if (frameN % 20 === 0) s.dirty = true;
  }
  if (!XR_MI) XR_MI = M4.inv(XR_M);
  if (hover !== s.hover || s.dirty || frameN % 12 === 0) { s.hover = hover; s.dirty = false; drawPanel(hover); }
  buildHandColliders(frame, s); infoPose(s, eye); if (frameN % 12 === 0) drawInfo();
  // hand markers: pinch dots in AR (real hands are visible), full joints in VR
  xiN = 0;
  for (const src of s.session.inputSources) {
    if (!src.hand) continue;
    const rr = (r) => r / s.pl.scale, pushDot = (p, r, shade) => { if (xiN >= 64) return; const q = M4.pt(XR_MI, p), o = xiN * 12; XI[o] = q[0]; XI[o + 1] = q[1]; XI[o + 2] = q[2]; XI[o + 3] = 2; XI[o + 4] = 0; XI[o + 5] = 0; XI[o + 6] = 0; XI[o + 7] = 1; XI[o + 8] = XI[o + 9] = XI[o + 10] = rr(r); XI[o + 11] = shade; xiN++; };
    if (s.ar) { const pp = pinchPoint(frame, src); if (pp) pushDot(pp, s.pinch.has(src) ? 0.011 : 0.006, 0); }
    else for (const js of src.hand.values()) { const jp = frame.getJointPose(js, s.ref); if (jp) pushDot([jp.transform.position.x, jp.transform.position.y, jp.transform.position.z], Math.max(0.004, jp.radius || 0.006), 0); }
  }
  applyTheme();
  const nInst = updateInstances();
  const enc = device.createCommandEncoder();
  let first = true; if (s.xm === 'bridge') bridgeBegin(s.br);
  const ringOn = s.ar && s.mode === 'place' && s.ret.ok, R = 1.6 * s.pl.scale, hc = Math.cos(s.pl.yaw), hs = Math.sin(s.pl.yaw);
  for (let vi = 0; vi < pose.views.length; vi++) {
    const view = pose.views[vi], sub = xrSub(s, view), vp = sub.vp;
    if (!vrs[vi + 1] || vrs[vi + 1].w !== vp.width || vrs[vi + 1].h !== vp.height) { if (vrs[vi + 1]) destroyVR(vrs[vi + 1]); vrs[vi + 1] = makeVR(vp.width, vp.height); }
    const vr = vrs[vi + 1];
    let P = view.projectionMatrix; // normalise depth to WebGPU 0..1 if the UA gives GL-style clip space
    const nearGL = P[14] / (P[10] - 1), nearGPU = P[14] / P[10], dn = s.session.renderState.depthNear || 0.1;
    if (Math.abs(nearGL - dn) < Math.abs(nearGPU - dn)) { const Z = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]); P = M4.mul(Z, P); }
    const V = view.transform.inverse.matrix, vpXR = M4.mul(P, V), vpSim = M4.mul(vpXR, XR_M);
    const e = view.transform.position, camSim = M4.pt(XR_MI, [e.x, e.y, e.z]), f = nrm(M4.dir(XR_MI, [-V[2], -V[6], -V[10]]));
    writeG(vr, vpSim, camSim, f, s.xm === 'bridge' ? [0, 0] : [vp.x, vp.y]);
    if (first) { encodeShadows(enc, vr); first = false; }
    const bridge = s.xm === 'bridge';
    if (bridge && !vr.eye) { vr.eye = device.createTexture({ size: [vp.width, vp.height], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }); vr.eyeV = vr.eye.createView(); }
    const p = encodeView(enc, vr, bridge ? vr.eyeV : sub.cv, nInst, bridge ? { x: 0, y: 0, width: vp.width, height: vp.height } : { x: vp.x, y: vp.y, width: vp.width, height: vp.height });
    // board + laser + placement ring (XR space)
    const d = panelRes.data, P0 = s.panelPose;
    d.set(vpXR, 0); d.set([P0.c[0], P0.c[1], P0.c[2], 0], 16); d.set([P0.r[0] * P0.hw, P0.r[1] * P0.hw, P0.r[2] * P0.hw, 0], 20); d.set([0, P0.hh, 0, 0], 24);
    if (laser) { d.set([...laser[0], 0], 28); d.set([...laser[1], 0], 32); }
    d.set([s.pl.pos[0], s.pl.pos[1] + 0.003, s.pl.pos[2], R], 36); d.set([-hc, 0, hs, 1], 40);
    device.queue.writeBuffer(panelRes.ubs[vi & 1], 0, d);
    p.setBindGroup(0, panelRes.bgs[vi & 1]);
    if (ringOn) { p.setPipeline(panelRes.pRing); p.draw(384, 2); p.setPipeline(panelRes.pArrow); p.draw(3); }
    p.setPipeline(panelRes.pPanel); p.draw(6);
    if (laser) { p.setPipeline(panelRes.pLaser); p.draw(2); }
    { const I = s.infoP, dI = panelRes.dataI; dI.set(d); dI.set([I.c[0], I.c[1], I.c[2], 0], 16); dI.set([I.r[0] * I.hw, I.r[1] * I.hw, I.r[2] * I.hw, 0], 20); dI.set([0, I.hh, 0, 0], 24);
      device.queue.writeBuffer(panelRes.ubsI[vi & 1], 0, dI); p.setBindGroup(0, panelRes.bgsI[vi & 1]); p.setPipeline(panelRes.pPanel); p.draw(6); }
    p.end();
    if (bridge) enc.copyTextureToTexture({ texture: vr.eye }, { texture: s.br.curTex, origin: [vp.x, vp.y] }, [vp.width, vp.height]);
  }
  device.queue.submit([enc.finish()]);
  if (s.xm === 'bridge') bridgeEnd(s.br);
}

// debug / export: render one frame into a texture and return RGBA bytes
async function snapshot() {
  const w = canvas.width, h = canvas.height, vr = vrs[0];
  const tex = device.createTexture({ size: [w, h], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const bpr = Math.ceil(w * 4 / 256) * 256, rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const b = PHN.on ? phoneBasis() : camBasis(); writeG(vr, b.vp, b.eye, b.fwd);
  const enc = device.createCommandEncoder(); encodeShadows(enc, vr);
  const p = encodeView(enc, vr, tex.createView(), updateInstances(), null); p.end();
  enc.copyTextureToBuffer({ texture: tex }, { buffer: rb, bytesPerRow: bpr }, [w, h]);
  device.queue.submit([enc.finish()]); await rb.mapAsync(GPUMapMode.READ);
  const src = new Uint8Array(rb.getMappedRange()), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
  if (fmt.startsWith('bgra')) for (let i = 0; i < out.length; i += 4) { const t = out[i]; out[i] = out[i + 2]; out[i + 2] = t; }
  rb.unmap(); tex.destroy(); rb.destroy();
  return { w, h, data: btoa(String.fromCharCode(...out.subarray(0, 0))) , bytes: Array.from(out) };
}

// ---------------------------------------------------------------- boot
async function boot() {
  if (!navigator.gpu) { $('nogpu').style.display = 'flex'; initUI(); return; }
  try {
    let adapter = null;
    try { adapter = await navigator.gpu.requestAdapter({ xrCompatible: true, powerPreference: 'high-performance' }); } catch (e) { }
    if (!adapter) adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    device = await adapter.requestDevice();
    device.lost.then(i => console.warn('GPU device lost', i.reason, i.message, Math.round(performance.now())));
    device.addEventListener && device.addEventListener('uncapturederror', e => { console.error('WebGPU:', e.error.message); xrErrs.push(String(e.error.message).split('\n')[0].slice(0, 110)); if (xrErrs.length > 3) xrErrs.shift(); if (xrS) { xrS.dirty = true; xrS.errAt = frameN; } });
    ctx = canvas.getContext('webgpu'); fmt = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format: fmt, alphaMode: 'premultiplied' });
    ST.cell = (window.matchMedia('(max-width:820px)').matches || /Quest|Mobile/i.test(navigator.userAgent)) ? 0.06 : 0.05;
    $('sDetail').value = String(ST.cell);
    initPipelines(); gpuOK = true;
    await gridLoad();
    loadWorld(ST.cell);
    initUI(); bindPointer(); resize();
    new ResizeObserver(resize).observe(stage);
    setupXR(); console.log('boot ok', Math.round(performance.now()), fmt);
    lastT = performance.now(); requestAnimationFrame(frame);
    window.__jelly = { lure, jf: () => jf, world: () => world, krill: () => krill, ST, A, cam, snapshot, setAR: v => { xrS = v ? { ar: true } : null; }, panelCompile: async () => { const m = device.createShaderModule({ code: WGSL_PANEL }); const i = await m.getCompilationInfo(); return i.messages.map(x => x.type + ':' + x.message + '@' + x.lineNum); } };
  } catch (e) { console.error(e); $('nogpu').style.display = 'flex'; $('nogpu').firstElementChild.textContent = 'Could not start WebGPU: ' + e.message; initUI(); }
}
boot();
//#endregion
