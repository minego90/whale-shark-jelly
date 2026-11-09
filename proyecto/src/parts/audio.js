
// ---------------------------------------------------------------- ocean ambience (synthesised with WebAudio, volume slider)
const SND = { ctx: null, master: null, vol: 0.5, started: false };
function sndStart() {
  if (SND.started) { if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  SND.started = true;
  const c = SND.ctx = new AC(), sr = c.sampleRate, len = sr * 8;
  const mk = (type) => { const b = c.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } } const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; };
  const m = SND.master = c.createGain(); m.gain.value = SND.vol * SND.vol; m.connect(c.destination);
  const lfo = (f, depth, target) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); };
  // deep water rumble
  { const s = mk('brown'), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.55; s.connect(f); f.connect(g); g.connect(m); lfo(0.05, 0.18, g.gain); }
  // rolling surf: noise swells with two slow waves
  { const s = mk('white'), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.4; g.gain.value = 0.16; s.connect(f); f.connect(g); g.connect(m); lfo(0.11, 0.12, g.gain); lfo(0.067, 0.08, g.gain); lfo(0.09, 380, f.frequency); }
  // foam hiss on the crest of each wave
  { const s = mk('white'), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5; g.gain.value = 0.035; s.connect(f); f.connect(g); g.connect(m); lfo(0.11, 0.03, g.gain); lfo(0.067, 0.02, g.gain); }
  // small bubbles now and then
  const bub = () => {
    if (c.state === 'running') { const t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f0 = 380 + Math.random() * 700; o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.09); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12); o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.15); }
    setTimeout(bub, 600 + Math.random() * 3200);
  };
  bub();
}
function sndSet(v) { SND.vol = Math.max(0, Math.min(1, v)); if (SND.master) SND.master.gain.value = SND.vol * SND.vol; }
['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, sndStart, { passive: true }));
window.__snd = SND;
