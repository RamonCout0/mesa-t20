// Sons do telao, sintetizados na hora (Web Audio): nada para baixar, nada de direitos autorais.
// O navegador so libera audio depois de um clique/tecla na pagina; ate la fica mudo.

import type { Elemento } from '../../shared/magias-efeitos.ts';

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let mudo = (() => {
  try { return localStorage.getItem('mesa-som') === 'mudo'; } catch { return false; }
})();
const ouvintes = new Set<() => void>();

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    mestre = ctx.createGain();
    mestre.gain.value = 0.55;
    // Compressor: varios sons juntos nao estouram.
    const comp = ctx.createDynamicsCompressor();
    mestre.connect(comp).connect(ctx.destination);
    ctx.onstatechange = () => ouvintes.forEach((f) => f());
  }
  return ctx;
}

/** Primeiro clique/tecla na pagina libera o audio. */
export function liberarAudioNoPrimeiroGesto() {
  const liberar = () => {
    audio().resume().catch(() => {});
  };
  addEventListener('pointerdown', liberar);
  addEventListener('keydown', liberar);
}

export const somBloqueado = () => !mudo && (!ctx || ctx.state === 'suspended');
export const somMudo = () => mudo;
export function alternarMudo() {
  mudo = !mudo;
  try { localStorage.setItem('mesa-som', mudo ? 'mudo' : 'ligado'); } catch { /* sem armazenamento */ }
  ouvintes.forEach((f) => f());
  return mudo;
}
export function aoMudarSom(f: () => void) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

function pronto() {
  if (mudo) return null;
  const c = audio();
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
    ouvintes.forEach((f) => f());
    return null;
  }
  return c;
}

// ---------------- pecas basicas ----------------

let bufferRuido: AudioBuffer | null = null;
function ruido(c: AudioContext) {
  if (!bufferRuido) {
    bufferRuido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = bufferRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = bufferRuido;
  s.loop = true;
  return s;
}

interface Envelope { ataque?: number; dur: number; vol: number; em?: number }

function envelope(c: AudioContext, { ataque = 0.005, dur, vol, em = 0 }: Envelope) {
  const g = c.createGain();
  const t = c.currentTime + em;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(mestre!);
  return { g, t };
}

/** Ruido filtrado (chiado, sopro, estalo). */
function chiado(c: AudioContext, o: Envelope & { tipo?: BiquadFilterType; de: number; ate?: number; q?: number }) {
  const { g, t } = envelope(c, o);
  const f = c.createBiquadFilter();
  f.type = o.tipo ?? 'bandpass';
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.de, t);
  if (o.ate) f.frequency.exponentialRampToValueAtTime(o.ate, t + o.dur);
  const s = ruido(c);
  s.connect(f).connect(g);
  s.start(t, Math.random());
  s.stop(t + o.dur + 0.05);
}

/** Tom com deslize de frequencia. */
function tom(c: AudioContext, o: Envelope & { forma?: OscillatorType; de: number; ate?: number; detune?: number }) {
  const { g, t } = envelope(c, o);
  const osc = c.createOscillator();
  osc.type = o.forma ?? 'sine';
  osc.detune.value = o.detune ?? 0;
  osc.frequency.setValueAtTime(o.de, t);
  if (o.ate) osc.frequency.exponentialRampToValueAtTime(o.ate, t + o.dur);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

const sorte = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------- sons do jogo ----------------

/** Dados quicando na mesa. */
export function somDados(qtd = 1) {
  const c = pronto();
  if (!c) return;
  const batidas = Math.min(14, 4 + qtd * 2);
  for (let i = 0; i < batidas; i++) {
    const em = 0.05 + (i / batidas) ** 1.4 * 1.1 + sorte(0, 0.04);
    chiado(c, { em, dur: 0.05, vol: 0.5 * (1 - i / batidas) + 0.08, de: sorte(1800, 3400), q: 6 });
    tom(c, { em, dur: 0.04, vol: 0.12, de: sorte(500, 900), forma: 'triangle' });
  }
}

export function somAcerto(forte = false) {
  const c = pronto();
  if (!c) return;
  tom(c, { dur: forte ? 0.5 : 0.28, vol: forte ? 0.9 : 0.7, de: forte ? 140 : 160, ate: 45 });
  chiado(c, { dur: 0.18, vol: 0.5, tipo: 'lowpass', de: 1400, ate: 300 });
}

export function somCritico() {
  const c = pronto();
  if (!c) return;
  somAcerto(true);
  for (const [f, em] of [[880, 0.02], [1320, 0.06], [1760, 0.1]] as const) {
    tom(c, { em, dur: 1.2, vol: 0.18, de: f, forma: 'triangle' });
  }
  chiado(c, { em: 0.02, dur: 0.6, vol: 0.25, tipo: 'highpass', de: 4000 });
}

export function somErro() {
  const c = pronto();
  if (!c) return;
  chiado(c, { ataque: 0.06, dur: 0.38, vol: 0.32, de: 500, ate: 2200, q: 2 });
}

export function somCura() {
  const c = pronto();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tom(c, { em: i * 0.08, ataque: 0.02, dur: 0.9, vol: 0.16, de: f }));
}

export function somDissipar() {
  const c = pronto();
  if (!c) return;
  [1568, 1175, 880, 659].forEach((f, i) => tom(c, { em: i * 0.07, ataque: 0.02, dur: 0.5, vol: 0.08, de: f, forma: 'triangle' }));
}

export function somInvocacao() {
  const c = pronto();
  if (!c) return;
  tom(c, { ataque: 0.05, dur: 2.2, vol: 0.9, de: 70, ate: 28 });
  tom(c, { ataque: 0.1, dur: 2, vol: 0.25, de: 110, ate: 55, forma: 'sawtooth' });
  chiado(c, { ataque: 0.2, dur: 2, vol: 0.4, tipo: 'lowpass', de: 300, ate: 80 });
}

/** Som de lancamento de uma magia, pelo elemento. */
export function somMagia(elemento: Elemento) {
  const c = pronto();
  if (!c) return;
  switch (elemento) {
    case 'fogo':
      chiado(c, { ataque: 0.08, dur: 0.9, vol: 0.55, tipo: 'lowpass', de: 400, ate: 2500 });
      for (let i = 0; i < 8; i++) chiado(c, { em: sorte(0.1, 0.8), dur: 0.03, vol: 0.25, de: sorte(2000, 5000), q: 8 });
      break;
    case 'frio':
    case 'agua':
      for (let i = 0; i < 6; i++) tom(c, { em: i * 0.06, dur: 0.6, vol: 0.1, de: sorte(1400, 2600), forma: 'sine' });
      chiado(c, { ataque: 0.05, dur: 0.6, vol: 0.2, tipo: 'highpass', de: 3000 });
      break;
    case 'eletricidade':
    case 'tormenta':
      for (let i = 0; i < 7; i++) tom(c, { em: i * 0.045, dur: 0.06, vol: 0.22, de: sorte(80, 400), forma: 'sawtooth' });
      chiado(c, { dur: 0.45, vol: 0.45, tipo: 'highpass', de: 1500 });
      break;
    case 'luz':
    case 'ouro':
    case 'espirito':
      [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tom(c, { em: i * 0.05, ataque: 0.02, dur: 1, vol: 0.13, de: f, forma: 'triangle' }));
      break;
    case 'trevas':
    case 'sangue':
    case 'veneno':
    case 'acido':
      tom(c, { ataque: 0.1, dur: 1, vol: 0.4, de: 90, ate: 60, forma: 'sawtooth', detune: -12 });
      tom(c, { ataque: 0.1, dur: 1, vol: 0.3, de: 92, ate: 58, forma: 'sawtooth', detune: 14 });
      chiado(c, { ataque: 0.15, dur: 0.9, vol: 0.25, tipo: 'lowpass', de: 600, ate: 150 });
      break;
    case 'psiquico':
    case 'tempo':
    case 'caos':
      tom(c, { ataque: 0.05, dur: 0.9, vol: 0.2, de: 300, ate: 1200, forma: 'sine' });
      tom(c, { ataque: 0.05, dur: 0.9, vol: 0.15, de: 305, ate: 1180, forma: 'sine' });
      break;
    case 'terra':
    case 'metal':
      tom(c, { dur: 0.7, vol: 0.7, de: 90, ate: 35 });
      chiado(c, { dur: 0.6, vol: 0.45, tipo: 'lowpass', de: 700, ate: 120 });
      break;
    case 'natureza':
    case 'ar':
    case 'som':
      chiado(c, { ataque: 0.1, dur: 0.8, vol: 0.35, de: 400, ate: 1800, q: 1.5 });
      break;
    default: // arcano
      [880, 1108.7, 1318.5].forEach((f, i) => tom(c, { em: i * 0.04, ataque: 0.01, dur: 0.8, vol: 0.12, de: f, ate: f * 1.5 }));
      chiado(c, { ataque: 0.05, dur: 0.5, vol: 0.18, tipo: 'highpass', de: 2500 });
  }
}
