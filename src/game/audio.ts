let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let gain: GainNode | null = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
  } catch {
    ctx = null;
  }
}

export function setEngine(speed01: number, boost: boolean) {
  if (!ctx || !osc || !osc2 || !gain) return;
  const t = ctx.currentTime;
  const f = 55 + speed01 * 140 + (boost ? 40 : 0);
  osc.frequency.setTargetAtTime(f, t, 0.05);
  osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  gain.gain.setTargetAtTime(document.hidden ? 0 : 0.03 + speed01 * 0.04, t, 0.1);
}

export function beep(freq: number, dur = 0.15, type: OscillatorType = "square", vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}
