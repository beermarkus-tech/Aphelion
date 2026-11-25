/**
 * Procedural audio: generative ambient music and synthesized sound effects (Web Audio, no files).
 * Browsers only allow audio after a user gesture, so call unlock() from a tap.
 */

type SeasonId = 'thaw' | 'bloom' | 'dust' | 'winter' | string;

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, reverb: ConvolverNode, reverbIn: GainNode;
let wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
let musicVol = 0.5;
let sfxVol = 0.7;
let season: SeasonId = 'thaw';
let schedTimer: ReturnType<typeof setInterval> | null = null;
let nextChordAt = 0;
let nextBellAt = 0;
let chordIndex = 0;
let hidden = false;

// D dorian-ish, slow and open. Each chord: MIDI notes.
const CHORDS = [
  [50, 57, 62, 65, 69], // Dm9-ish
  [46, 53, 58, 62, 65], // Bb
  [48, 55, 60, 64, 67], // C
  [45, 52, 57, 60, 64], // Am
];
const BELL_SCALE = [74, 76, 77, 79, 81, 84, 86, 88]; // D E F G A C D E
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function noiseBuffer(c: AudioContext, seconds = 2): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 4.5, 2.6);
  reverbIn = ctx.createGain();
  reverbIn.gain.value = 0.55;
  reverbIn.connect(reverb).connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicVol * 0.5;
  musicBus.connect(master);
  musicBus.connect(reverbIn);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVol;
  sfxBus.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.25;
  sfxBus.connect(send).connect(reverbIn);
  return ctx;
}

/** Call from a user gesture (tap/click). Safe to call repeatedly. */
export function unlock(): void {
  const c = init();
  if (!c) return;
  if (c.state === 'suspended' && !hidden) c.resume();
  startMusic();
}

export function setVolumes(music: number, sfx: number): void {
  musicVol = music;
  sfxVol = sfx;
  if (!ctx) return;
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(music * 0.5, t, 0.3);
  sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
  if (wind) wind.gain.gain.setTargetAtTime(windLevel() * music, t, 1);
}

export function setSeason(id: SeasonId): void {
  if (id === season) return;
  season = id;
  if (ctx && wind) {
    const t = ctx.currentTime;
    wind.gain.gain.setTargetAtTime(windLevel() * musicVol, t, 4);
    wind.filter.frequency.setTargetAtTime(id === 'winter' ? 900 : id === 'dust' ? 600 : 400, t, 4);
  }
}

/** Pause everything while the page is hidden (saves battery on phones). */
export function setHidden(h: boolean): void {
  hidden = h;
  if (!ctx) return;
  if (h) ctx.suspend();
  else if (ctx.state === 'suspended') ctx.resume();
}

function windLevel(): number {
  return season === 'winter' ? 0.22 : season === 'dust' ? 0.14 : 0.05;
}

// ---------------------------------------------------------------- music

function startMusic(): void {
  if (!ctx || schedTimer) return;
  const c = ctx;
  // wind bed
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(filter).connect(g).connect(master);
  src.start();
  wind = { gain: g, filter };
  g.gain.setTargetAtTime(windLevel() * musicVol, c.currentTime, 3);
  // slow wind gusts
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  nextChordAt = c.currentTime + 0.3;
  nextBellAt = c.currentTime + 4;
  schedTimer = setInterval(schedule, 250);
}

function schedule(): void {
  if (!ctx || hidden || musicVol <= 0.001) return;
  const now = ctx.currentTime;
  const len = season === 'winter' ? 14 : 11;
  while (nextChordAt < now + 1) {
    pad(CHORDS[chordIndex % CHORDS.length], nextChordAt, len);
    chordIndex++;
    nextChordAt += len - 2; // overlap for smooth crossfades
  }
  while (nextBellAt < now + 1) {
    const sparse = season === 'winter' ? 1.6 : season === 'bloom' ? 0.7 : 1;
    if (Math.random() < 0.7) {
      const note = BELL_SCALE[Math.floor(Math.random() * BELL_SCALE.length)];
      bell(midi(note), nextBellAt, 0.06 + Math.random() * 0.04);
      if (Math.random() < 0.3) bell(midi(note + (Math.random() < 0.5 ? 7 : 12)), nextBellAt + 0.35, 0.035);
    }
    nextBellAt += (2.5 + Math.random() * 5) * sparse;
  }
}

function pad(notes: number[], t: number, dur: number): void {
  const c = ctx!;
  const out = c.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.11, t + dur * 0.35);
  out.gain.linearRampToValueAtTime(0.0001, t + dur);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = season === 'bloom' ? 1500 : season === 'winter' ? 700 : 1000;
  filter.frequency.setValueAtTime(bright * 0.5, t);
  filter.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(bright * 0.6, t + dur);
  filter.Q.value = 0.5;
  out.connect(filter).connect(musicBus);
  notes.forEach((n, i) => {
    for (const det of [-6, 5]) {
      const o = c.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = (i === 0 ? 0.5 : 0.16) / notes.length;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  });
}

function bell(freq: number, t: number, vol: number, bus?: GainNode): void {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  g.connect(bus ?? musicBus);
  for (const [mul, amp] of [[1, 1], [2.76, 0.25], [5.4, 0.08]] as const) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    const og = c.createGain();
    og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 3.6);
  }
}

// ---------------------------------------------------------------- sound effects

export type Sfx = 'tap' | 'scavenge' | 'build' | 'research' | 'craft' | 'event' | 'story' | 'rebuild' | 'ascend' | 'deny' | 'toggle';

let lastPlayed: Record<string, number> = {};

export function sfx(name: Sfx): void {
  if (!ctx || ctx.state !== 'running' || sfxVol <= 0.001) return;
  const t = ctx.currentTime;
  // rate-limit repeats (hold-to-repeat buttons)
  const gap = name === 'scavenge' || name === 'tap' ? 0.04 : 0.07;
  if (t - (lastPlayed[name] ?? -1) < gap) return;
  lastPlayed[name] = t;
  switch (name) {
    case 'tap': blip(880, 0.03, 'sine', 0.08); break;
    case 'toggle': blip(660, 0.04, 'triangle', 0.1); break;
    case 'scavenge': {
      noiseHit(t, 2200 + Math.random() * 1800, 0.06, 0.25);
      blip(300 + Math.random() * 120, 0.05, 'square', 0.04);
      break;
    }
    case 'build': {
      thump(t, 90, 0.35);
      noiseHit(t + 0.02, 1400, 0.12, 0.18);
      blip(523, 0.12, 'triangle', 0.12, t + 0.06);
      blip(784, 0.16, 'triangle', 0.1, t + 0.12);
      break;
    }
    case 'craft': {
      noiseHit(t, 5000, 0.04, 0.15);
      blip(1047, 0.08, 'sine', 0.1, t + 0.03);
      break;
    }
    case 'research': {
      [72, 76, 79, 84].forEach((n, i) => bell(midi(n), t + i * 0.09, 0.14, sfxBus));
      break;
    }
    case 'event': {
      bell(midi(81), t, 0.18, sfxBus);
      bell(midi(76), t + 0.28, 0.16, sfxBus);
      break;
    }
    case 'story': bell(midi(69), t, 0.12, sfxBus); break;
    case 'deny': blip(140, 0.12, 'sawtooth', 0.08); break;
    case 'rebuild':
    case 'ascend': {
      sweep(t, name === 'ascend' ? 2.5 : 1.6);
      const notes = name === 'ascend' ? [62, 69, 74, 78, 81, 86] : [62, 65, 69, 74];
      notes.forEach((n, i) => bell(midi(n), t + 0.3 + i * 0.16, 0.16, sfxBus));
      break;
    }
  }
}

function blip(freq: number, dur: number, type: OscillatorType, vol: number, t = ctx!.currentTime): void {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noiseHit(t: number, freq: number, dur: number, vol: number): void {
  const c = ctx!;
  noiseBuf ??= noiseBuffer(c, 1);
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function thump(t: number, freq: number, vol: number): void {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 2, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + 0.3);
}

function sweep(t: number, dur: number): void {
  const c = ctx!;
  noiseBuf ??= noiseBuffer(c, 1);
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(200, t);
  f.frequency.exponentialRampToValueAtTime(4000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t);
  s.stop(t + dur + 0.05);
}
