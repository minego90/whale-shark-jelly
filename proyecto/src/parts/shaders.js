//#region SHADERS
const WGSL = /* wgsl */`
struct G {
  viewProj: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  lightVP: mat4x4<f32>,
  cam: vec4<f32>,
  camFwd: vec4<f32>,
  lightDir: vec4<f32>,
  res: vec4<f32>,
  absorb: vec4<f32>,
  tint: vec4<f32>,
  pig: vec4<f32>,
  pale: vec4<f32>,
  milk: vec4<f32>,
  bgLow: vec4<f32>,
  bgTop: vec4<f32>,
  glow: vec4<f32>,
  misc: vec4<f32>,
  eyeP: vec4<f32>,
  spirP: vec4<f32>,
  prof: array<vec4<f32>, 128>,
};
@group(0) @binding(0) var<uniform> g: G;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var backTex: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var shF: texture_depth_2d;
@group(0) @binding(5) var shB: texture_depth_2d;
@group(0) @binding(6) var cauTex: texture_2d<f32>;
@group(0) @binding(7) var cauSamp: sampler;

const LB: f32 = 3.0;
const PI: f32 = 3.14159265;

fn lu() -> f32 { return g.camFwd.w; }
fn keyK() -> f32 { return mix(1.0, 0.14, g.camFwd.w); }
// underwater caustics: sunlight focused by a moving wavy surface, projected along the light onto everything
fn caus(P: vec3<f32>) -> f32 {
  let K = g.pale.w;
  if (K < 0.001) { return 0.0; }
  let L = normalize(g.lightDir.xyz);
  let q = P.xz - L.xz * (P.y / max(L.y, 0.3));
  let a = textureSampleLevel(cauTex, cauSamp, q * (2.6 / 6.2831853), 0.0).r;
  let b = textureSampleLevel(cauTex, cauSamp, q * (1.7 / 6.2831853) + vec2<f32>(0.49, 0.27), 0.0).g;
  return clamp(a * 0.65 + b * 0.5, 0.0, 1.6) * K;
}

fn env(d: vec3<f32>) -> vec3<f32> {
  let k = keyK();
  let up = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  var c = mix(g.bgLow.rgb * 0.85, g.bgTop.rgb, smoothstep(0.5, 0.95, up));
  c = mix(g.bgLow.rgb * 0.5, c, smoothstep(0.2, 0.5, up));
  let Ld = normalize(g.lightDir.xyz);
  let box = smoothstep(0.80, 0.90, dot(d, Ld)) * 3.0 * k;
  let strip = smoothstep(0.92, 0.97, dot(d, normalize(vec3<f32>(0.75, 0.3, -0.55)))) * 1.6 * k;
  let fill = smoothstep(0.7, 0.95, dot(d, normalize(vec3<f32>(-0.7, 0.35, 0.6)))) * 0.7 * k;
  return c + vec3<f32>(box + strip + fill);
}

fn tonemap(c: vec3<f32>) -> vec3<f32> {
  let x = max(c, vec3<f32>(0.0));
  let t = 0.8;
  let over = max(x - vec3<f32>(t), vec3<f32>(0.0));
  let y = min(x, vec3<f32>(t)) + (1.0 - t) * (vec3<f32>(1.0) - exp(-over / (1.0 - t)));
  return pow(y, vec3<f32>(1.0 / 2.2));
}

fn project(p: vec3<f32>) -> vec2<f32> {
  let c = g.viewProj * vec4<f32>(p, 1.0);
  let n = c.xy / c.w;
  return vec2<f32>(n.x * 0.5 + 0.5, 0.5 - n.y * 0.5);
}

fn hsh(p: vec2<f32>) -> f32 { return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453); }
fn aa(d: f32, r: f32, pf: f32) -> f32 { return 1.0 - smoothstep(r - pf, r + pf, d); }

fn profAt(a: f32) -> vec4<f32> {
  let t = clamp(a / LB, 0.0, 1.0) * 127.0;
  let i0 = u32(floor(t));
  let i1 = min(i0 + 1u, 127u);
  return mix(g.prof[i0], g.prof[i1], t - floor(t));
}

// ------------------------------------------------------------- shadow maps
fn shadowAt(P: vec3<f32>) -> vec3<f32> {
  // returns (coverage, mean thickness, wide coverage)
  let lp = g.lightVP * vec4<f32>(P, 1.0);
  let uv = vec2<f32>(lp.x * 0.5 + 0.5, 0.5 - lp.y * 0.5);
  let dims = vec2<i32>(textureDimensions(shF));
  let base = vec2<i32>(uv * vec2<f32>(dims));
  var cov = 0.0; var th = 0.0; var wide = 0.0;
  for (var j = -1; j <= 1; j = j + 1) {
    for (var i = -1; i <= 1; i = i + 1) {
      let c = base + vec2<i32>(i, j) * 2;
      let w = base + vec2<i32>(i, j) * 9;
      if (c.x >= 0 && c.y >= 0 && c.x < dims.x && c.y < dims.y) {
        let f = textureLoad(shF, c, 0);
        let b = textureLoad(shB, c, 0);
        if (f < 0.9999 && lp.z > f + 0.002) { cov = cov + 1.0; th = th + max(b - f, 0.0); }
      }
      if (w.x >= 0 && w.y >= 0 && w.x < dims.x && w.y < dims.y) {
        let f2 = textureLoad(shF, w, 0);
        if (f2 < 0.9999 && lp.z > f2 + 0.002) { wide = wide + 1.0; }
      }
    }
  }
  return vec3<f32>(cov / 9.0, th / max(cov, 1.0) * g.misc.w, wide / 9.0);
}

// ------------------------------------------------------------- fullscreen
struct FOut { @builtin(position) clip: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vsFull(@builtin(vertex_index) vi: u32) -> FOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o: FOut;
  o.clip = vec4<f32>(p[vi], 0.0, 1.0);
  o.uv = p[vi];
  return o;
}

struct FloorOut { @location(0) col: vec4<f32>, @builtin(frag_depth) depth: f32 };
@fragment fn fsFloor(in: FOut) -> FloorOut {
  var o: FloorOut;
  let far = g.invViewProj * vec4<f32>(in.uv, 1.0, 1.0);
  let fp = far.xyz / far.w;
  let rd = normalize(fp - g.cam.xyz);
  var col = g.bgLow.rgb;
  var alpha = 1.0;
  let AR = g.milk.w > 0.5;
  o.depth = 1.0;
  if (rd.y < -0.0005) {
    let t = -g.cam.y / rd.y;
    let P = g.cam.xyz + rd * t;
    let clip = g.viewProj * vec4<f32>(P, 1.0);
    o.depth = clamp(clip.z / clip.w, 0.0, 1.0);
    let r = length(P.xz - vec2<f32>(1.5, 0.0));
    let near = 1.0 - smoothstep(2.3, 4.6, r);
    let sh = shadowAt(P);
    let T = exp(-g.absorb.rgb * sh.y * 0.9) * 0.55;
    let lit = mix(vec3<f32>(1.0), T, sh.x);
    let ao = 1.0 - 0.38 * sh.z * (1.0 - sh.x * 0.6);
    let keyd = keyK();
    var shade = mix(vec3<f32>(1.0), lit * ao, keyd * 0.9 + 0.1);
    // dish: faint rim and a slightly lifted centre
    let ring = 1.0 - smoothstep(0.0, 0.02, abs(r - 2.5));
    shade = shade * (1.0 - 0.07 * ring) * (1.0 + 0.03 * (1.0 - smoothstep(0.0, 2.5, r)));
    col = g.bgLow.rgb * mix(vec3<f32>(1.0), shade, near);
    let cf = caus(P) * (1.0 - smoothstep(3.0, 6.0, r)) * mix(1.0, 0.35, sh.x) * keyd;
    let cK = g.pale.w * (1.0 - smoothstep(3.0, 6.0, r));
    col = col * (1.0 - 0.16 * cK) + vec3<f32>(0.85, 0.95, 1.0) * cf * 0.55; // dim the floor a touch so the bright lines read
    if (AR) {
      // passthrough: the floor is invisible, only the (tinted) shadow is drawn over the real surface
      let sd = mix(vec3<f32>(1.0), shade, near);
      let dark = clamp((1.0 - dot(sd, vec3<f32>(0.3333)) - 0.075) * 1.25, 0.0, 1.0) * 0.9;
      col = g.tint.rgb * 0.10;
      alpha = dark;
      let ca = clamp(cf * 0.55, 0.0, 0.6) * (1.0 - dark);
      col = mix(col, vec3<f32>(0.80, 0.94, 1.0), ca / max(ca + alpha, 1e-4));
      alpha = max(alpha, ca);
    }
  } else {
    col = mix(g.bgLow.rgb, g.bgTop.rgb, smoothstep(0.0, 0.5, rd.y));
    if (AR) { alpha = 0.0; }
  }
  if (!AR && g.tint.w > 0.001) { // optional underwater backdrop: a faint blue that deepens upward and with distance
    let dist = select(1.0, clamp(length((g.cam.xyz + rd * (-g.cam.y / min(rd.y, -0.0005))).xz - vec2<f32>(1.5, 0.0)) / 6.0, 0.0, 1.0), rd.y < -0.0005);
    let up = clamp(rd.y * 1.6 + 0.35, 0.0, 1.0);
    let deep = mix(vec3<f32>(0.70, 0.85, 1.0), vec3<f32>(0.46, 0.68, 0.92), max(up, dist));
    col = mix(col, col * deep, g.tint.w);
  }
  o.col = vec4<f32>(col, alpha);
  return o;
}

@fragment fn fsBlit(in: FOut) -> @location(0) vec4<f32> {
  let sc = textureLoad(sceneTex, vec2<i32>(in.clip.xy - vec2<f32>(g.eyeP.w, g.spirP.w)), 0);
  let t = tonemap(sc.rgb * g.bgLow.w);
  if (g.milk.w > 0.5) { return vec4<f32>(t * sc.a, sc.a); }
  return vec4<f32>(t, 1.0);
}

// ------------------------------------------------------------- shadow / back passes
@vertex fn vsShadow(@location(0) p: vec3<f32>) -> @builtin(position) vec4<f32> {
  return g.lightVP * vec4<f32>(p, 1.0);
}

struct BackOut { @builtin(position) clip: vec4<f32>, @location(0) vz: f32 };
@vertex fn vsBack(@location(0) p: vec3<f32>) -> BackOut {
  var o: BackOut;
  o.clip = g.viewProj * vec4<f32>(p, 1.0);
  o.vz = o.clip.w;
  return o;
}
@fragment fn fsBack(in: BackOut) -> @location(0) vec4<f32> { return vec4<f32>(in.vz, 0.0, 0.0, 1.0); }

// ------------------------------------------------------------- milk layer
struct BlobOut { @builtin(position) clip: vec4<f32>, @location(0) wp: vec3<f32>, @location(1) n: vec3<f32> };
@vertex fn vsBlob(@location(0) p: vec3<f32>, @location(1) n: vec3<f32>) -> BlobOut {
  var o: BlobOut;
  let q = p - n * 0.006;
  o.wp = q; o.n = n;
  o.clip = g.viewProj * vec4<f32>(q, 1.0);
  return o;
}
@fragment fn fsBlob(in: BlobOut) -> @location(0) vec4<f32> {
  let N = normalize(in.n);
  let V = normalize(g.cam.xyz - in.wp);
  let L = normalize(g.lightDir.xyz);
  let k = keyK();
  let wrap = clamp((dot(N, L) + 0.6) / 1.6, 0.0, 1.0);
  let rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  var col = g.milk.rgb * (0.30 + 0.95 * wrap * k + 0.15 * (1.0 - k));
  col = col + g.tint.rgb * rim * 0.25 * k + g.glow.rgb * lu() * 0.10;
  return vec4<f32>(col, 1.0);
}

// ------------------------------------------------------------- beads (krill + eyes)
struct BIn { @location(0) lp: vec3<f32>, @location(1) i0: vec4<f32>, @location(2) q: vec4<f32>, @location(3) s: vec4<f32> };
struct BOut { @builtin(position) clip: vec4<f32>, @location(0) wp: vec3<f32>, @location(1) n: vec3<f32>, @location(2) kind: f32, @location(3) shade: f32 };
fn qrot(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let u = q.xyz;
  let t = 2.0 * cross(u, v);
  return v + q.w * t + cross(u, t);
}
@vertex fn vsBead(i: BIn) -> BOut {
  var o: BOut;
  let wp = i.i0.xyz + qrot(i.q, i.lp * i.s.xyz);
  o.wp = wp;
  o.n = qrot(i.q, normalize(i.lp / i.s.xyz));
  o.clip = g.viewProj * vec4<f32>(wp, 1.0);
  o.kind = i.i0.w;
  o.shade = i.s.w;
  return o;
}
@fragment fn fsBead(i: BOut) -> @location(0) vec4<f32> {
  let N = normalize(i.n);
  let V = normalize(g.cam.xyz - i.wp);
  let L = normalize(g.lightDir.xyz);
  let k = keyK();
  let ndl = max(dot(N, L), 0.0);
  let h = normalize(L + V);
  var base = mix(vec3<f32>(0.96, 0.36, 0.30), vec3<f32>(1.0, 0.66, 0.46), i.shade);
  var pw = 50.0;
  if (i.kind > 0.5) { base = vec3<f32>(0.015, 0.016, 0.02); pw = 220.0; }
  if (i.kind > 1.5) { base = vec3<f32>(0.92, 0.97, 1.0); pw = 60.0; }
  if (i.kind > 2.5 && i.kind < 3.5) { base = mix(vec3<f32>(0.015, 0.075, 0.03), vec3<f32>(0.50, 0.80, 0.16), pow(i.shade, 1.15)); pw = 90.0; }
  if (i.kind > 3.5) { base = mix(vec3<f32>(0.50, 0.68, 0.78), vec3<f32>(0.86, 0.66, 0.56), i.shade); pw = 90.0; }
  if (i.kind > 4.5) { base = vec3<f32>(0.98, 0.40, 0.12); pw = 70.0; }
  if (i.kind > 5.5) { base = vec3<f32>(0.62, 0.74, 0.80); pw = 40.0; }
  let sp = pow(max(dot(N, h), 0.0), pw);
  let fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  let ao = mix(0.65, 1.0, smoothstep(0.0, 0.05, i.wp.y));
  var col = base * (0.30 + 0.9 * ndl * k) * ao + vec3<f32>(sp * 0.7 * k) + env(reflect(-V, N)) * fres * 0.25;
  if (i.kind < 0.5) { col = col + g.glow.rgb * lu() * 0.25 * i.shade; }
  if (i.kind > 1.5 && i.kind < 2.5) { col = base * (0.55 + 0.45 * ndl) + vec3<f32>(sp * 0.4); }
  if (i.kind > 3.5) { let rim = pow(1.0 - max(dot(N, V), 0.0), 2.2); col = base * (0.42 + 0.45 * ndl * k) * ao + vec3<f32>(sp * 0.8 * k) + vec3<f32>(0.45, 0.68, 0.85) * rim * 0.45 + env(reflect(-V, N)) * fres * 0.35; if (i.kind > 4.5 && i.kind < 5.5) { col = base * (0.55 + 0.6 * ndl) + vec3<f32>(sp * 0.5) + vec3<f32>(0.25, 0.05, 0.0) * rim; } if (i.kind > 5.5) { col = mix(col, vec3<f32>(0.9, 0.95, 1.0), 0.25); } }
  if (i.kind > 2.5 && i.kind < 3.5) { let tr = pow(1.0 - max(dot(N, V), 0.0), 2.0); col = base * (0.30 + 0.75 * ndl * k) * ao + vec3<f32>(sp * 0.55 * k) + base * tr * 0.55 + g.glow.rgb * lu() * 0.45 * i.shade; }
  if (i.kind > 6.5) { // jellyfish tentacles (shade < 0.5) and frilly oral arms (shade >= 0.5): blue-violet translucent gel
    let rim7 = pow(1.0 - abs(dot(N, V)), 1.5);
    let fr = step(0.5, i.shade);
    let tt = select(i.shade * 2.0, (i.shade - 0.5) * 2.0, fr > 0.5);
    let pinkA = vec3<f32>(0.62, 0.45, 1.0);
    let peach = vec3<f32>(0.62, 0.78, 1.0);
    let orng = vec3<f32>(0.75, 0.35, 1.0);
    var b7 = mix(vec3<f32>(0.80, 0.86, 1.0), pinkA, tt * 0.8);
    if (fr > 0.5) { b7 = mix(peach, mix(pinkA, vec3<f32>(0.55, 0.28, 0.95), tt), 0.4 + 0.6 * rim7); }
    let ndl2 = abs(dot(N, L));
    col = b7 * (0.55 + 0.45 * ndl2 * k) + vec3<f32>(sp * 0.45 * k) + orng * rim7 * fr * 0.35 + pinkA * rim7 * 0.25 + g.glow.rgb * lu() * 0.35 * (0.3 + rim7);
    if (i.shade > 0.515 && i.shade < 0.525) { col = vec3<f32>(0.68, 0.35, 1.0) * (0.75 + 0.35 * ndl2) + vec3<f32>(0.75, 0.70, 1.0) * rim7 * 0.4; }
  }
  if (i.kind > 1.5) { col = col + vec3<f32>(0.80, 0.93, 1.0) * caus(i.wp) * clamp(N.y * 0.7 + 0.45, 0.0, 1.0) * k * 0.45; }
  return vec4<f32>(col, 1.0);
}

// ------------------------------------------------------------- the jelly
struct JIn { @location(0) p: vec3<f32>, @location(1) n: vec3<f32>, @location(2) rest: vec4<f32> };
struct JOut { @builtin(position) clip: vec4<f32>, @location(0) wp: vec3<f32>, @location(1) n: vec3<f32>, @location(2) rest: vec4<f32> };
@vertex fn vsJelly(i: JIn) -> JOut {
  var o: JOut;
  o.wp = i.p; o.n = i.n; o.rest = i.rest;
  o.clip = g.viewProj * vec4<f32>(i.p, 1.0);
  return o;
}

struct Mk {
  pigOp: f32, pale: f32, halo: f32, slit: f32, mouth: f32, teeth: f32, spir: f32, h: f32,
};

fn ridgeTerm(ath: f32, thr: f32, R: f32, seed: f32, a: f32, pf: f32) -> vec2<f32> {
  let d = abs(ath - thr) * R;
  let bump = exp(-0.5 * (d / 0.016) * (d / 0.016));
  let line = aa(d, 0.0035, pf);
  let brk = step(0.16, hsh(vec2<f32>(floor(a / 0.05), seed)));
  return vec2<f32>(bump, line * brk);
}
fn slitTerm(a: f32, ath: f32, ak: f32, w: f32, pf: f32) -> f32 {
  let ac = ak - 0.02 * cos(ath * 1.5);
  let d = abs(a - ac);
  let ends = smoothstep(0.55, 0.72, ath) * (1.0 - smoothstep(1.95, 2.12, ath));
  return aa(d, w, pf) * ends;
}

fn markings(p0: vec3<f32>, finw: f32, nrm: vec3<f32>, pf: f32) -> Mk {
  var m: Mk;
  let pr = profAt(p0.x);
  let ez = p0.z / pr.x;
  let ey = (p0.y - pr.z) / pr.w;
  let th = atan2(ez, ey);
  let ath = abs(th);
  let R = sqrt(pr.x * pr.w);
  let a = p0.x;
  let bodyW = 1.0 - finw;

  // pigment: dark back, pale belly; fins pigmented on top
  let backP = 1.0 - smoothstep(1.5, 2.1, ath);
  let finP = mix(0.12, 0.9, smoothstep(-0.35, 0.1, nrm.y));
  m.pigOp = mix(backP * 0.96, finP, finw);

  // ridges
  let r1 = ridgeTerm(ath, 0.30, R, 1.0, a, pf);
  let r2 = ridgeTerm(ath, 0.64, R, 2.0, a, pf);
  let r3 = ridgeTerm(ath, 1.00, R, 3.0, a, pf);
  let ridgeAtt = smoothstep(0.05, 0.15, pr.x) * smoothstep(0.0, 0.12, a) * bodyW;
  var hgt = (r1.x + r2.x + r3.x) * 0.0045 * ridgeAtt;
  let ridgeLine = (r1.y + r2.y + r3.y) * smoothstep(0.30, 0.50, a) * bodyW * (1.0 - smoothstep(2.62, 2.78, a));

  // checkerboard: broken hoops + columns of round spots
  let D = 0.115;
  let j = floor(a / D);
  let da = a - j * D;
  let dh = min(da, D - da);
  let seg = floor(th * R / 0.065);
  let hbrk = step(0.2, hsh(vec2<f32>(j * 3.7 + 11.0, seg)));
  let inBand = smoothstep(0.62, 0.78, a) * (1.0 - smoothstep(2.62, 2.78, a)) * (1.0 - smoothstep(2.0, 2.35, ath)) * bodyW;
  let hoops = aa(dh, 0.0026, pf) * hbrk * inBand * 0.0;
  let aC = (j + 0.5) * D;
  let jx = (hsh(vec2<f32>(j*1.3+4.0, floor(ath*7.0))) - 0.5) * 0.07;
  let dA = a - aC - jx;
  let athj = ath + (hsh(vec2<f32>(j * 2.1 + 5.0, 9.0)) - 0.5) * 0.10 + (hsh(vec2<f32>(j * 0.7 + 1.0, 3.0)) - 0.5) * 0.06 * sin(ath * 9.0);
  let dv0 = abs(athj - 0.0) * R;
  let dv1 = abs(athj - 0.47) * R;
  let dv2 = abs(athj - 0.82) * R;
  let dv3 = abs(athj - 1.30) * R;
  let dv4 = abs(athj - 1.90) * R;
  let dv = min(min(dv0, dv1), min(min(dv2, dv3), dv4));
  let rs = 0.0165 * clamp(R / 0.16, 0.5, 1.2) * (0.65 + 0.8 * hsh(vec2<f32>(j, floor(ath * 5.0))));
  let cs = 0.078;
  let cuv = vec2<f32>(a, th * R) / cs;
  let cid = floor(cuv);
  var spotD = 10.0; var rs2 = rs;
  for (var oy = -1; oy <= 1; oy = oy + 1) { for (var ox = -1; ox <= 1; ox = ox + 1) {
    let c2 = cid + vec2<f32>(f32(ox), f32(oy));
    let hj = vec2<f32>(hsh(c2 * 1.37 + 3.1), hsh(c2 * 2.11 + 7.7));
    let rr2 = (0.008 + 0.012 * hsh(c2 + 17.0)) * clamp(R / 0.16, 0.6, 1.2);
    let present = step(0.12, hsh(c2 * 0.77 + 5.0));
    let dd2 = length((c2 + 0.15 + 0.7 * hj) * cs - vec2<f32>(a, th * R)) / rr2;
    if (present > 0.5 && dd2 < spotD) { spotD = dd2; }
  } }
  rs2 = 1.0;
  let spots = (1.0 - smoothstep(0.82, 1.0, spotD)) * inBand * (1.0 - smoothstep(1.7, 2.1, ath));
  let spotHalo = exp(-(spotD / 2.4) * (spotD / 2.4)) * inBand;

  // small dense spots on head and fins
  let uvb = vec2<f32>(a, th * R);
  let uvf = select(vec2<f32>(a, p0.y), vec2<f32>(a, p0.z), abs(nrm.y) > 0.5);
  let uv = mix(uvb, uvf, finw);
  let s = 0.040;
  let row = floor(uv.y / s);
  let st = select(0.0, 0.5, (i32(row) % 2) != 0);
  let col = floor(uv.x / s + st);
  let ctr = vec2<f32>((col + 0.5 - st) * s, (row + 0.5) * s);
  let dd = length(uv - ctr);
  let rr = 0.0052 * (0.7 + 0.6 * hsh(vec2<f32>(col, row)));
  let small = aa(dd, rr, pf);
  let denseMask = max((1.0 - smoothstep(0.50, 0.72, a)) * bodyW, finw * 0.95) * (1.0 - smoothstep(1.9, 2.3, ath) * (1.0 - finw));
  let dense = small * denseMask * mix(smoothstep(0.03, 0.09, a), 1.0, finw);
  let denseHalo = exp(-(dd / (rr * 2.6)) * (dd / (rr * 2.6))) * denseMask;

  m.pale = max(max(spots, hoops), max(ridgeLine, dense * 0.92));
  m.halo = max(spotHalo * 0.7, max(denseHalo * 0.5, m.pale));

  // gill slits
  let flare = g.lightDir.w;
  let sw = 0.0055 + 0.0085 * flare;
  var sl = slitTerm(a, ath, 0.46, sw, pf);
  sl = max(sl, slitTerm(a, ath, 0.525, sw, pf));
  sl = max(sl, slitTerm(a, ath, 0.59, sw, pf));
  sl = max(sl, slitTerm(a, ath, 0.655, sw, pf));
  sl = max(sl, slitTerm(a, ath, 0.72, sw, pf));
  m.slit = sl * bodyW;
  hgt = hgt - m.slit * 0.004;

  // mouth lining + teeth
  let my = g.misc.y;
  let mry = g.misc.z;
  let qm = vec3<f32>((p0.x - 0.02) / 0.24, (p0.y - my) / mry, p0.z / 0.205);
  let rm = length(qm);
  m.mouth = (1.0 - smoothstep(1.12, 1.55, rm)) * bodyW * (1.0 - smoothstep(0.30, 0.34, a));
  let tp = vec2<f32>(p0.z, p0.x) / 0.0075;
  let tc = floor(tp) + vec2<f32>(0.5);
  let td = length((tp - tc) * 0.0075);
  m.teeth = 0.0 * aa(td, 0.0016, pf) * (1.0 - smoothstep(0.04, 0.06, a)) * smoothstep(0.7, 1.1, m.mouth + 0.35) * (1.0 - smoothstep(0.17, 0.2, abs(p0.z))) * step(0.5, m.mouth);

  // eyes (rim + dark patch) and spiracles
  let eA = g.eyeP.xyz;
  let eB = vec3<f32>(eA.x, eA.y, -eA.z);
  let de = min(length(p0 - eA), length(p0 - eB));
  let eyeDark = aa(de, 0.046, pf);
  let eyeRing = aa(de, 0.060, pf) - aa(de, 0.052, pf);
  m.pigOp = max(m.pigOp, eyeDark * 0.97);
  m.pale = max(m.pale, eyeRing * 0.0);
  let sA = g.spirP.xyz;
  let sB = vec3<f32>(sA.x, sA.y, -sA.z);
  let ds = min(length(p0 - sA), length(p0 - sB));
  m.spir = aa(ds, 0.011, pf);
  m.pale = max(m.pale, (aa(ds, 0.019, pf) - aa(ds, 0.014, pf)) * 0.7);
  m.h = hgt;
  return m;
}

@fragment fn fsJelly(in: JOut) -> @location(0) vec4<f32> {
  let frag = in.clip;
  let wp = in.wp;
  let dpx = dpdx(wp);
  let dpy = dpdy(wp);
  let pf = max(length(dpx), length(dpy)) * 0.8;
  let N0 = normalize(in.n);
  let mk = markings(in.rest.xyz, in.rest.w, N0, pf);
  let dhx = dpdx(mk.h);
  let dhy = dpdy(mk.h);
  let r1 = cross(dpy, N0);
  let r2 = cross(N0, dpx);
  let det = dot(dpx, r1);
  let grad = sign(det) * (dhx * r1 + dhy * r2);
  let N = normalize(abs(det) * N0 - grad);

  let V = normalize(g.cam.xyz - wp);
  let L = normalize(g.lightDir.xyz);
  let k = keyK();
  let ndv = clamp(dot(N, V), 0.0, 1.0);
  let rayD = -V;

  // thickness from back faces
  let backZ = textureLoad(backTex, vec2<i32>(frag.xy - vec2<f32>(g.eyeP.w, g.spirP.w)), 0).r;
  let frontZ = 1.0 / frag.w;
  let cosf = max(dot(rayD, g.camFwd.xyz), 0.25);
  var thick = select(0.03, max(backZ - frontZ, 0.0) / cosf, backZ > 0.0);
  thick = clamp(thick, 0.0, 1.2);

  // refraction (three wavelengths)
  let sp = thick * 0.85 + 0.02;
  let uR = clamp(project(wp + refract(rayD, N, 1.0 / 1.31) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let uG = clamp(project(wp + refract(rayD, N, 1.0 / 1.34) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let uB = clamp(project(wp + refract(rayD, N, 1.0 / 1.37) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let sc = vec3<f32>(
    textureSampleLevel(sceneTex, samp, uR, 0.0).r,
    textureSampleLevel(sceneTex, samp, uG, 0.0).g,
    textureSampleLevel(sceneTex, samp, uB, 0.0).b);
  let T = exp(-g.absorb.rgb * thick);
  let wrap = clamp((dot(N, L) + 0.5) / 1.5, 0.0, 1.0);
  var trans = sc * T + g.tint.rgb * (1.0 - T) * (0.10 + 0.55 * wrap * k) * g.absorb.w;

  let F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  let refl = env(reflect(rayD, N));
  let Hh = normalize(L + V);
  let nh = max(dot(N, Hh), 0.0);
  let spec = (pow(nh, 260.0) * 4.0 + pow(nh, 36.0) * 0.22) * k;
  var col = trans * (1.0 - F) + refl * F + vec3<f32>(spec);

  // dark pigmented back (painted in rest space)
  let skin = g.pig.rgb * (0.22 + 0.80 * max(dot(N, L), 0.0) * k) + env(N) * 0.05 * g.pig.rgb + refl * (0.012 + 0.28 * F) + vec3<f32>(spec * 0.8);
  col = mix(col, skin, clamp(mk.pigOp * g.pig.w, 0.0, 1.0));

  // pale markings and glow
  let palelit = g.pale.rgb * (0.40 + 0.80 * wrap * k) + refl * 0.15;
  col = mix(col, palelit, clamp(mk.pale * 0.92, 0.0, 1.0));
  col = col + g.glow.rgb * (mk.pale * 1.6 + mk.halo * 0.45) * lu() * 2.0;

  // gill slits
  let slitCol = mix(vec3<f32>(0.012, 0.005, 0.01), vec3<f32>(0.5, 0.08, 0.11), clamp(g.lightDir.w, 0.0, 1.0) * 0.85);
  col = mix(col, slitCol * (0.35 + 0.65 * wrap), mk.slit * 0.92);

  // mouth lining, teeth, spiracles
  let lining = vec3<f32>(0.045, 0.030, 0.032) * (0.5 + 0.5 * wrap) + vec3<f32>(0.075, 0.035, 0.04) * pow(1.0 - ndv, 2.0) + vec3<f32>(spec * 0.4);
  col = mix(col, lining, mk.mouth * 0.95);
  let lipB = smoothstep(0.55, 1.0, mk.mouth) * (1.0 - smoothstep(0.93, 1.0, mk.mouth)); // pale lip rim around the opening
  col = mix(col, vec3<f32>(0.80, 0.77, 0.72) * (0.55 + 0.45 * wrap), lipB * 0.55);
  col = mix(col, vec3<f32>(0.90, 0.88, 0.82) * (0.5 + 0.5 * wrap), mk.teeth * 0.28);
  col = mix(col, vec3<f32>(0.01, 0.01, 0.012), mk.spir * 0.92);

  col = col + vec3<f32>(0.80, 0.93, 1.0) * caus(wp) * clamp(N.y * 0.8 + 0.35, 0.0, 1.0) * keyK() * 0.55;
  return vec4<f32>(tonemap(col * g.bgLow.w), 1.0);
}

@fragment fn fsJfish(in: JOut) -> @location(0) vec4<f32> {
  let frag = in.clip;
  let wp = in.wp;
  let N = normalize(in.n);
  let V = normalize(g.cam.xyz - wp);
  let L = normalize(g.lightDir.xyz);
  let k = keyK();
  let ndv = clamp(dot(N, V), 0.0, 1.0);
  let rayD = -V;
  let t = in.rest.x;
  let ph = in.rest.y;
  let layer = in.rest.z;
  let id = in.rest.w;
  let backZ = textureLoad(backTex, vec2<i32>(frag.xy - vec2<f32>(g.eyeP.w, g.spirP.w)), 0).r;
  let frontZ = 1.0 / frag.w;
  let cosf = max(dot(rayD, g.camFwd.xyz), 0.25);
  var thick = select(0.05, max(backZ - frontZ, 0.0) / cosf, backZ > 0.0);
  thick = clamp(thick, 0.0, 0.8);
  let sp = thick * 0.9 + 0.015;
  let uR = clamp(project(wp + refract(rayD, N, 1.0 / 1.31) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let uG = clamp(project(wp + refract(rayD, N, 1.0 / 1.34) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let uB = clamp(project(wp + refract(rayD, N, 1.0 / 1.37) * sp), vec2<f32>(0.002), vec2<f32>(0.998));
  let sc = vec3<f32>(textureSampleLevel(sceneTex, samp, uR, 0.0).r, textureSampleLevel(sceneTex, samp, uG, 0.0).g, textureSampleLevel(sceneTex, samp, uB, 0.0).b);
  // blue-to-violet bell with a violet glow inside, 8 soft lobes, scalloped orange rim
  let pink = mix(vec3<f32>(0.22, 0.55, 1.0), vec3<f32>(0.62, 0.36, 1.0), smoothstep(0.35, 0.95, t)); // blue crown -> violet rim
  let orng = vec3<f32>(0.72, 0.30, 1.0);
  let absorbJ = mix(vec3<f32>(2.8, 1.0, 0.22), vec3<f32>(1.1, 2.0, 0.35), smoothstep(0.35, 0.95, t));
  let T = exp(-absorbJ * thick * 3.0);
  let wrap = clamp((dot(N, L) + 0.5) / 1.5, 0.0, 1.0);
  let inner = mix(pink, orng, smoothstep(0.35, 0.85, t) * 0.75);
  var trans = sc * T + inner * (1.0 - T) * (0.35 + 0.65 * wrap * k);
  let F = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);
  let refl = env(reflect(rayD, N));
  let Hh = normalize(L + V);
  let nh = max(dot(N, Hh), 0.0);
  let spec = (pow(nh, 260.0) * 1.2 + pow(nh, 30.0) * 0.08) * k;
  var col = trans * (1.0 - F) + refl * F * 0.55 + vec3<f32>(spec);
  // lobe grooves (thin pale seams), warm glow in the lower half, scalloped orange rim
  let gd = abs(fract(ph * 8.0) - 0.5);
  let seam = (1.0 - smoothstep(0.0, 0.06, 0.5 - gd)) * 0.0 + (1.0 - smoothstep(0.0, 0.045, abs(gd - 0.5))) * smoothstep(0.1, 0.25, t) * (1.0 - smoothstep(0.9, 0.98, t));
  let scal = 0.5 + 0.5 * cos(ph * 6.2832 * 32.0);
  let rimB = smoothstep(0.86 + 0.05 * scal, 0.97, t);
  let glowB = exp(-pow((t - 0.82) / 0.14, 2.0));
  col = mix(col, vec3<f32>(0.82, 0.88, 1.0) * (0.55 + 0.5 * wrap), seam * 0.45);
  col = col + orng * glowB * (0.22 + 0.25 * layer) * (0.6 + 0.4 * wrap);
  col = mix(col, orng * (0.75 + 0.35 * wrap) + vec3<f32>(spec), rimB * 0.85);
  col = mix(col, vec3<f32>(0.80, 0.90, 1.0) * (0.55 + 0.5 * wrap), layer * (1.0 - smoothstep(0.55, 0.95, t)) * 0.22); // pale bluish sub-umbrella
  col = col + pink * pow(1.0 - ndv, 2.5) * 0.30 + g.glow.rgb * (rimB * 0.3 + glowB * 0.3) * lu() * 1.4;
  let idv = id;
  col = col + vec3<f32>(0.85, 0.9, 1.0) * caus(wp) * clamp(N.y * 0.8 + 0.35, 0.0, 1.0) * keyK() * 0.22;
  return vec4<f32>(tonemap(col * g.bgLow.w), 1.0);
}

@vertex fn vsLine(@location(0) p: vec3<f32>) -> @builtin(position) vec4<f32> {
  return g.viewProj * vec4<f32>(p, 1.0);
}
@fragment fn fsLine() -> @location(0) vec4<f32> {
  return vec4<f32>(g.pale.rgb * 0.9 + g.glow.rgb * 0.2, select(0.22, 1.0, g.milk.w > 0.5));
}
`;

// panel (VR menu) + laser: separate module with its own bindings
const WGSL_PANEL = /* wgsl */`
struct PU { vp: mat4x4<f32>, c: vec4<f32>, r: vec4<f32>, u: vec4<f32>, laserA: vec4<f32>, laserB: vec4<f32>, ringC: vec4<f32>, ringH: vec4<f32> };
@group(0) @binding(0) var<uniform> pu: PU;
@group(0) @binding(1) var ptex: texture_2d<f32>;
@group(0) @binding(2) var psamp: sampler;
struct PO { @builtin(position) clip: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vsPanel(@builtin(vertex_index) vi: u32) -> PO {
  var q = array<vec2<f32>, 6>(vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0));
  let p = q[vi];
  let w = pu.c.xyz + pu.r.xyz * p.x + pu.u.xyz * p.y;
  var o: PO;
  o.clip = pu.vp * vec4<f32>(w, 1.0);
  o.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return o;
}
@fragment fn fsPanel(in: PO) -> @location(0) vec4<f32> {
  let c = textureSampleLevel(ptex, psamp, in.uv, 0.0);
  return vec4<f32>(c.rgb, c.a);
}
@vertex fn vsLaser(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  var p = pu.laserA.xyz;
  if (vi == 1u) { p = pu.laserB.xyz; }
  return pu.vp * vec4<f32>(p, 1.0);
}
@fragment fn fsLaser() -> @location(0) vec4<f32> { return vec4<f32>(0.5, 0.85, 1.0, 0.9); }
@vertex fn vsRing(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> @builtin(position) vec4<f32> {
  var ca = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  var co = array<f32, 6>(-1.0, 1.0, -1.0, -1.0, 1.0, 1.0);
  let seg = f32(vi / 6u); let k = vi % 6u;
  let ang = (seg + ca[k]) / 64.0 * 6.2831853;
  var R = pu.ringC.w; var hw = 0.005;
  if (ii == 1u) { R = 0.022; hw = 0.0035; }
  let rr = R + co[k] * hw;
  let p = pu.ringC.xyz + vec3<f32>(cos(ang) * rr, 0.0, sin(ang) * rr);
  return pu.vp * vec4<f32>(p, 1.0);
}
@vertex fn vsArrow(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  let h = pu.ringH.xyz; let sd = vec3<f32>(-h.z, 0.0, h.x); let R = pu.ringC.w;
  var p = pu.ringC.xyz + h * (R * 1.28);
  if (vi == 1u) { p = pu.ringC.xyz + h * (R * 1.06) + sd * 0.03; }
  if (vi == 2u) { p = pu.ringC.xyz + h * (R * 1.06) - sd * 0.03; }
  return pu.vp * vec4<f32>(p, 1.0);
}
@fragment fn fsRing() -> @location(0) vec4<f32> { return vec4<f32>(0.62, 0.92, 1.0, 0.92); }
`;
//#endregion
