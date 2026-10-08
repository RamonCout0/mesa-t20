// Animacoes de magias e ataques no telao. Cada magia do grimorio tem tipo + elemento (+ forma),
// e cada alvo tem um desfecho: acerto, critico, resistiu, anulado, imune, erro, cura, efeito.
import type { Anim, TipoAnim } from '../../shared/magias-efeitos.ts';
import type { Desfecho } from '../../shared/acoes.ts';
import type { ArquetipoArma } from '../../shared/tipos.ts';
import { MotorFx, arco, angulo, distancia, ease, lerp, sorte, type Ponto } from './motor.ts';
import { ARCO_IRIS, PALETAS, type Paleta } from './paletas.ts';

export interface AlvoFx {
  p: Ponto;
  raio: number;
  desfecho: Desfecho;
}

export interface CenaFx {
  motor: MotorFx;
  de: Ponto;
  /** Tamanho da carta de quem age (para auras e convocacoes perto dele). */
  raioAutor: number;
  alvos: AlvoFx[];
  aoImpacto: (indice: number) => void;
}

// Desenhos com emoji para formas que pedem uma figura (cranio, punho, mao...).
const GLIFOS: Record<string, string> = {
  cranio: '💀', punho: '👊', mao: '✋', adaga: '🗡️', coracao: '💗', coracoes: '💗', caveira: '💀', espiral: '🌀', olho: '👁️',
  sono: '💤', notas: '🎵', pena: '🪶', sorte: '🍀', moedas: '🪙', livro: '📖', relogio: '⏳', coroa: '👑', balanca: '⚖️',
  marca: '✴️', ordem: '❗', mascara: '🎭', touro: '🐂', dragao: '🐉', vampiro: '🦇', fenix: '🔥', animal: '🐺', cavalo: '🐎',
  esqueletos: '💀', zumbi: '🧟', anjo: '👼', monstro: '👹', enxame: '🪲', espirito: '👻', espectro: '👻', alimento: '🍞',
  mensagem: '✉️', bussola: '🧭', mapa: '🗺️', globo: '🔮', ancestral: '👤', serpente: '🐍', sussurros: '💬', calma: '🕊️',
  lagrimas: '💧', primordial: '✴️', banir: '✴️', pocao: '⚗️', engrenagens: '⚙️', arvore: '🌳', asas: '🪽', musculos: '💪',
};

const LIMITE_GLIFO = 64;

function glifo(m: MotorFx, txt: string, p: Ponto, tam: number, ms: number, sobe = 0) {
  m.desenhar(ms, (c, t) => {
    c.globalAlpha = t < 0.15 ? t / 0.15 : (1 - t) ** 0.8;
    c.font = `${Math.min(LIMITE_GLIFO * 3, tam)}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, p.x, p.y - sobe * ease.saida(t));
  }, false);
}

const pal = (a: Anim): Paleta => PALETAS[a.elemento] ?? PALETAS.arcano;
const corDe = (a: Anim, p: Paleta) => (a.elemento === 'caos' ? ARCO_IRIS[Math.floor(Math.random() * ARCO_IRIS.length)] : p.cor);

/** Ponto onde um golpe que erra passa: ao lado do alvo e um pouco alem. */
function pontoDeErro(de: Ponto, alvo: AlvoFx): Ponto {
  const a = angulo(de, alvo.p) + (Math.random() < 0.5 ? -1 : 1) * 0.35;
  const d = distancia(de, alvo.p) + alvo.raio * 2.2;
  return { x: de.x + Math.cos(a) * d, y: de.y + Math.sin(a) * d };
}

const acertou = (d: Desfecho) => d === 'acerto' || d === 'critico' || d === 'resistiu' || d === 'cura' || d === 'efeito';

// ---------------- blocos ----------------

/** Explosao de particulas no impacto (tamanho conforme o desfecho). */
function impacto(m: MotorFx, p: Ponto, a: Anim, desfecho: Desfecho, escala = 1) {
  const pl = pal(a);
  const k = m.escala * escala * (desfecho === 'critico' ? 1.7 : desfecho === 'resistiu' ? 0.6 : 1);
  if (desfecho === 'imune' || desfecho === 'anulado') {
    // Bate e se desfaz: faiscas que ricocheteiam e um escudo rapido.
    m.anel(p, '#cfd8ff', 90 * k, 380, 6);
    m.emitir(16, () => {
      const ang = sorte(0, Math.PI * 2);
      return { x: p.x, y: p.y, vx: Math.cos(ang) * sorte(150, 420), vy: Math.sin(ang) * sorte(150, 420), arrasto: 2.5, max: sorte(0.25, 0.5), tam: 4, cor: '#dfe6ff', forma: 'faisca' };
    });
    return;
  }
  m.pulso(p, pl.cor, 130 * k, 320);
  m.anel(p, pl.faisca, 150 * k, 520, 9 * k);
  const n = Math.round(46 * k);
  m.emitir(n, () => {
    const ang = sorte(0, Math.PI * 2);
    const v = sorte(180, 640) * k;
    return {
      x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, arrasto: 3, ay: a.elemento === 'fogo' ? -120 : 60,
      max: sorte(0.35, 0.9), tam: sorte(4, 12) * k, tamFim: 0, cor: Math.random() < 0.3 ? pl.nucleo : corDe(a, pl), forma: Math.random() < 0.5 ? 'faisca' : 'brilho',
    };
  });
  if (pl.fumaca) {
    m.emitir(Math.round(10 * k), () => ({
      x: p.x + sorte(-20, 20), y: p.y + sorte(-20, 20), vx: sorte(-40, 40), vy: sorte(-80, -20), max: sorte(0.8, 1.4),
      tam: sorte(30, 60) * k, tamFim: sorte(70, 110) * k, cor: pl.fumaca!, forma: 'fumaca', aditivo: false, alfa: 0.8,
    }));
  }
  if (desfecho === 'critico') {
    m.clarao(pl.nucleo, 260, 0.55);
    m.tremer(16, 520);
    m.emitir(10, (i) => ({ x: p.x, y: p.y, vx: Math.cos(i * 0.628) * 520, vy: Math.sin(i * 0.628) * 520, arrasto: 4, max: 0.5, tam: 22 * k, cor: pl.faisca, forma: 'estrela', vrot: 6 }));
  } else if (desfecho !== 'resistiu') {
    m.tremer(7, 380);
  }
}

/** Projetil em arco ate o ponto, com rastro. Resolve na chegada. */
async function projetil(m: MotorFx, de: Ponto, para: Ponto, a: Anim, opcoes: { ms?: number; altura?: number; tam?: number; reto?: boolean } = {}) {
  const pl = pal(a);
  const d = distancia(de, para);
  const ms = opcoes.ms ?? Math.max(380, Math.min(900, d * 0.75));
  const altura = opcoes.reto ? 0 : (opcoes.altura ?? Math.min(260, d * 0.28));
  const tam = (opcoes.tam ?? 26) * m.escala;
  const forma = a.forma ?? '';
  const emoji = GLIFOS[forma];
  let anterior = de;
  m.desenhar(ms, (c, t) => {
    const e = ease.meio(t);
    const p = arco(de, para, altura, e);
    // Rastro de particulas entre a posicao anterior e a atual.
    const passos = Math.max(1, Math.round(distancia(anterior, p) / 8));
    for (let i = 0; i < passos; i += 1) {
      const q = { x: lerp(anterior.x, p.x, i / passos), y: lerp(anterior.y, p.y, i / passos) };
      m.particula({ x: q.x + sorte(-4, 4), y: q.y + sorte(-4, 4), vx: sorte(-30, 30), vy: sorte(-30, 30), max: sorte(0.25, 0.55), tam: tam * sorte(0.35, 0.7), cor: corDe(a, pl) });
    }
    if (pl.fumaca && Math.random() < 0.4) m.particula({ x: p.x, y: p.y, vy: -30, max: 0.8, tam: tam * 0.8, tamFim: tam * 2, cor: pl.fumaca, forma: 'fumaca', aditivo: false, alfa: 0.6 });
    anterior = p;
    // Cabeca do projetil
    const ang = angulo(arco(de, para, altura, Math.max(0, e - 0.02)), p);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    if (emoji) {
      c.restore();
      c.globalCompositeOperation = 'source-over';
      c.font = `${tam * 2.2}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = pl.cor;
      c.shadowBlur = 30;
      c.fillText(emoji, p.x, p.y);
      return;
    }
    const alongado = ['seta', 'flecha', 'dardo', 'lanca', 'adaga', 'espinho', 'raio-purpura'].includes(forma) ? 2.6 : 1;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, tam * alongado);
    g.addColorStop(0, pl.nucleo);
    g.addColorStop(0.35, pl.cor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.scale(alongado, 1 / Math.sqrt(alongado));
    c.beginPath();
    c.arc(0, 0, tam, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });
  await m.esperar(ms);
}

/** Raio/feixe instantaneo do autor ao alvo. `quebrado` = relampago em zigue-zague. */
function feixe(m: MotorFx, de: Ponto, para: Ponto, a: Anim, ms = 520, quebrado = false, largura = 18) {
  const pl = pal(a);
  const pontos = (() => {
    if (!quebrado) return [de, para];
    const n = 12;
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      const solto = i === 0 || i === n ? 0 : sorte(-1, 1) * distancia(de, para) * 0.06;
      const ang = angulo(de, para) + Math.PI / 2;
      return { x: lerp(de.x, para.x, t) + Math.cos(ang) * solto, y: lerp(de.y, para.y, t) + Math.sin(ang) * solto };
    });
  })();
  const w = largura * m.escala;
  m.desenhar(ms, (c, t) => {
    const forca = t < 0.12 ? t / 0.12 : (1 - t) ** 1.3;
    const tremido = quebrado && Math.random() < 0.3 ? 0.4 : 1;
    for (const [cor, larg, blur] of [[pl.brilho, w * 2.2, 40], [pl.cor, w, 24], [pl.nucleo, w * 0.35, 8]] as const) {
      c.globalAlpha = forca * tremido;
      c.strokeStyle = cor;
      c.lineWidth = larg * (0.6 + 0.4 * forca);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.shadowColor = cor;
      c.shadowBlur = blur;
      c.beginPath();
      pontos.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    }
    c.shadowBlur = 0;
  });
  // Faiscas ao longo do feixe
  m.emitir(30, () => {
    const t = Math.random();
    return { x: lerp(de.x, para.x, t), y: lerp(de.y, para.y, t), vx: sorte(-120, 120), vy: sorte(-160, 60), arrasto: 3, max: sorte(0.2, 0.6), tam: sorte(3, 8) * m.escala, cor: pl.faisca, forma: 'faisca' };
  });
}

/** Cone/sopro do autor na direcao dos alvos. */
async function cone(m: MotorFx, de: Ponto, alvos: AlvoFx[], a: Anim, ms = 750, denso = false) {
  const pl = pal(a);
  const centro = alvos.length ? { x: alvos.reduce((s, x) => s + x.p.x, 0) / alvos.length, y: alvos.reduce((s, x) => s + x.p.y, 0) / alvos.length } : { x: de.x, y: de.y - 300 };
  const dir = angulo(de, centro);
  const alcance = distancia(de, centro) * 1.15;
  const abertura = denso ? 0.32 : 0.45;
  const fim = performance.now() + ms;
  const jorrar = () => {
    if (performance.now() > fim) return;
    m.emitir(denso ? 16 : 11, () => {
      const ang = dir + sorte(-abertura, abertura);
      const v = alcance * sorte(1.1, 1.6);
      return {
        x: de.x, y: de.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, arrasto: 1.6, max: sorte(0.5, 0.85),
        tam: sorte(8, 22) * m.escala, tamFim: sorte(26, 46) * m.escala, cor: Math.random() < 0.2 ? pl.nucleo : corDe(a, pl), forma: 'brilho',
      };
    });
    if (pl.fumaca) m.particula({ x: de.x, y: de.y, vx: Math.cos(dir) * alcance, vy: Math.sin(dir) * alcance, arrasto: 2, max: 1, tam: 30, tamFim: 90, cor: pl.fumaca, forma: 'fumaca', aditivo: false, alfa: 0.6 });
    requestAnimationFrame(jorrar);
  };
  jorrar();
  await m.esperar(ms * 0.55);
}

/** Algo cai do ceu sobre o ponto (meteoro, pilar, raio celeste). */
async function queda(m: MotorFx, p: Ponto, a: Anim, ms = 520) {
  const de = { x: p.x + sorte(-120, 120) * m.escala, y: -80 };
  if (a.forma === 'pilar' || a.forma === 'raios' || a.forma === 'raio-celeste') {
    feixe(m, { x: p.x, y: -40 }, p, a, 600, a.forma !== 'pilar', a.forma === 'pilar' ? 70 : 20);
    await m.esperar(140);
    return;
  }
  await projetil(m, de, p, { ...a, forma: a.forma === 'meteoros' ? 'bola' : a.forma }, { ms, reto: true, tam: a.forma === 'meteoros' ? 46 : 30 });
}

/** Algo irrompe do chao sob o alvo (estacas, vinhas, tentaculos, ossos, correntes). */
async function doChao(m: MotorFx, p: Ponto, raio: number, a: Anim, ms = 650) {
  const pl = pal(a);
  const n = 7;
  const base = p.y + raio * 0.9;
  const pontas = Array.from({ length: n }, (_, i) => ({ x: p.x + (i - (n - 1) / 2) * raio * 0.32 + sorte(-8, 8), h: raio * sorte(0.9, 1.7), inclina: sorte(-0.35, 0.35) }));
  const organico = ['vinhas', 'tentaculos', 'raizes', 'ossos', 'correntes', 'ancora'].includes(a.forma ?? '');
  m.desenhar(ms + 500, (c, t) => {
    const sobe = ease.mola(Math.min(1, t * 2.2));
    const some = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    c.globalAlpha = some;
    for (const pt of pontas) {
      const topo = { x: pt.x + Math.sin(pt.inclina) * pt.h * sobe, y: base - pt.h * sobe };
      const g = c.createLinearGradient(pt.x, base, topo.x, topo.y);
      g.addColorStop(0, pl.brilho);
      g.addColorStop(1, pl.nucleo);
      c.strokeStyle = g;
      c.fillStyle = g;
      c.shadowColor = pl.cor;
      c.shadowBlur = 18;
      if (organico) {
        c.lineWidth = raio * 0.07;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(pt.x, base);
        c.quadraticCurveTo(pt.x + Math.sin(t * 8 + pt.x) * raio * 0.3, (base + topo.y) / 2, topo.x, topo.y);
        c.stroke();
      } else {
        const lg = raio * 0.07;
        c.beginPath();
        c.moveTo(pt.x - lg, base);
        c.lineTo(topo.x, topo.y);
        c.lineTo(pt.x + lg, base);
        c.closePath();
        c.fill();
      }
    }
    c.shadowBlur = 0;
  });
  m.emitir(24, () => ({ x: p.x + sorte(-raio, raio), y: base, vx: sorte(-60, 60), vy: sorte(-260, -80), ay: 300, max: sorte(0.4, 0.8), tam: sorte(4, 9) * m.escala, cor: pl.faisca, forma: 'estilhaco', vrot: sorte(-8, 8), aditivo: false }));
  await m.esperar(ms * 0.45);
}

/** Brilho que sobe em volta de alguem (auras, bencaos, cura). */
function aura(m: MotorFx, p: Ponto, raio: number, a: Anim, ms = 1100, motes = 34) {
  const pl = pal(a);
  m.anel({ x: p.x, y: p.y + raio * 0.5 }, pl.cor, raio * 1.4, ms * 0.7, 6);
  m.emitir(motes, () => ({
    x: p.x + sorte(-raio, raio), y: p.y + raio * sorte(0.2, 0.9), vx: sorte(-15, 15), vy: sorte(-160, -60), arrasto: 0.4,
    max: sorte(0.7, 1.3), tam: sorte(5, 12) * m.escala, cor: Math.random() < 0.3 ? pl.nucleo : corDe(a, pl), forma: Math.random() < 0.25 ? 'estrela' : 'brilho', vrot: 2,
  }));
  m.pulso(p, pl.cor, raio * 1.3, ms * 0.5);
  if (GLIFOS[a.forma ?? '']) glifo(m, GLIFOS[a.forma!], { x: p.x, y: p.y - raio * 0.9 }, raio * 0.7, ms, raio * 0.6);
}

/** Simbolo girando sobre a cabeca (encantamento, adivinhacao). */
function sigilo(m: MotorFx, p: Ponto, raio: number, a: Anim, ms = 1200) {
  const pl = pal(a);
  const centro = { x: p.x, y: p.y - raio * 1.05 };
  m.desenhar(ms, (c, t, s) => {
    c.globalAlpha = Math.sin(Math.PI * t);
    c.strokeStyle = pl.cor;
    c.shadowColor = pl.brilho;
    c.shadowBlur = 20;
    c.lineWidth = 3 * m.escala;
    c.save();
    c.translate(centro.x, centro.y);
    c.scale(1, 0.38);
    c.rotate(s * 3);
    c.beginPath();
    c.arc(0, 0, raio * 0.6, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 6; i += 1) {
      const ang = (i * Math.PI) / 3;
      c.beginPath();
      c.arc(Math.cos(ang) * raio * 0.6, Math.sin(ang) * raio * 0.6, raio * 0.07, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    c.shadowBlur = 0;
  });
  const g = GLIFOS[a.forma ?? ''] ?? (a.tipo === 'adivinhacao' ? '👁️' : a.tipo === 'mental' ? '🌀' : '');
  if (g) glifo(m, g, { x: centro.x, y: centro.y - raio * 0.15 }, raio * 0.75, ms, raio * 0.25);
}

/** Tremeluzir prismatico (ilusoes). */
function prisma(m: MotorFx, p: Ponto, raio: number, ms = 1000) {
  m.desenhar(ms, (c, t, s) => {
    for (let i = 0; i < 4; i += 1) {
      c.globalAlpha = 0.18 * Math.sin(Math.PI * t);
      c.fillStyle = ARCO_IRIS[(i + Math.floor(s * 12)) % ARCO_IRIS.length];
      const dx = Math.sin(s * 10 + i * 2) * raio * 0.25;
      c.beginPath();
      c.ellipse(p.x + dx, p.y, raio * 0.75, raio * 1.05, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  m.emitir(26, () => ({ x: p.x + sorte(-raio, raio), y: p.y + sorte(-raio, raio), vx: sorte(-40, 40), vy: sorte(-40, 40), max: sorte(0.5, 1), tam: sorte(4, 10) * m.escala, cor: ARCO_IRIS[Math.floor(Math.random() * 7)], forma: 'estrela', vrot: 3 }));
}

/** Filetes que saem do alvo e voltam para o autor (dreno de vida). */
async function dreno(m: MotorFx, de: Ponto, alvo: Ponto, a: Anim, ms = 900) {
  const pl = pal(a);
  const fios = Array.from({ length: 5 }, () => ({ altura: sorte(-140, 140) * m.escala, atraso: sorte(0, 0.25) }));
  m.desenhar(ms, (c, t) => {
    for (const f of fios) {
      const tt = Math.min(1, Math.max(0, (t - f.atraso) / 0.75));
      if (tt <= 0) continue;
      c.globalAlpha = Math.sin(Math.PI * tt) * 0.9;
      c.strokeStyle = pl.cor;
      c.shadowColor = pl.brilho;
      c.shadowBlur = 20;
      c.lineWidth = 4 * m.escala;
      c.beginPath();
      const meio = { x: (de.x + alvo.x) / 2, y: (de.y + alvo.y) / 2 + f.altura };
      c.moveTo(alvo.x, alvo.y);
      c.quadraticCurveTo(meio.x, meio.y, lerp(alvo.x, de.x, tt), lerp(alvo.y, de.y, tt));
      c.stroke();
    }
    c.shadowBlur = 0;
  });
  m.emitir(30, () => ({ x: alvo.x + sorte(-30, 30), y: alvo.y + sorte(-30, 30), vx: (de.x - alvo.x) * sorte(0.6, 1.1), vy: (de.y - alvo.y) * sorte(0.6, 1.1), arrasto: 0.8, max: sorte(0.6, 1), tam: sorte(5, 10) * m.escala, cor: pl.faisca }));
  await m.esperar(ms * 0.35);
}

/** Circulo magico no chao e algo surgindo (convocacao). */
function circulo(m: MotorFx, p: Ponto, raio: number, a: Anim, ms = 1400) {
  const pl = pal(a);
  m.desenhar(ms, (c, t, s) => {
    c.globalAlpha = Math.sin(Math.PI * t);
    c.strokeStyle = pl.cor;
    c.shadowColor = pl.brilho;
    c.shadowBlur = 24;
    c.lineWidth = 3 * m.escala;
    c.save();
    c.translate(p.x, p.y + raio * 0.8);
    c.scale(1, 0.32);
    c.rotate(s * 1.5);
    for (const r of [raio, raio * 0.78]) {
      c.beginPath();
      c.arc(0, 0, r * ease.saida(Math.min(1, t * 3)), 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    for (let i = 0; i <= 5; i += 1) {
      const ang = (i * 4 * Math.PI) / 5;
      c.lineTo(Math.cos(ang) * raio * 0.78, Math.sin(ang) * raio * 0.78);
    }
    c.stroke();
    c.restore();
    c.shadowBlur = 0;
  });
  m.emitir(40, () => ({ x: p.x + sorte(-raio, raio) * 0.8, y: p.y + raio * 0.8, vy: sorte(-280, -90), vx: sorte(-20, 20), max: sorte(0.6, 1.2), tam: sorte(4, 10) * m.escala, cor: corDe(a, pl) }));
  const g = GLIFOS[a.forma ?? ''];
  if (g) glifo(m, g, { x: p.x, y: p.y - raio * 0.1 }, raio * 1.1, ms, raio * 0.4);
}

/** Campo que cobre a tela (nevoa, escuridao, teia, silencio, tempestade...). */
function campo(m: MotorFx, a: Anim, ms = 1800) {
  const pl = pal(a);
  const forma = a.forma ?? '';
  if (forma === 'teia') {
    const fios = Array.from({ length: 14 }, () => ({ x1: sorte(0, m.largura), y1: sorte(0, m.altura * 0.7), x2: sorte(0, m.largura), y2: sorte(0, m.altura * 0.7) }));
    m.desenhar(ms, (c, t) => {
      c.globalAlpha = 0.55 * Math.sin(Math.PI * t);
      c.strokeStyle = '#f2f0ea';
      c.lineWidth = 1.5;
      for (const f of fios) {
        c.beginPath();
        c.moveTo(f.x1, f.y1);
        c.quadraticCurveTo((f.x1 + f.x2) / 2, (f.y1 + f.y2) / 2 + 40, f.x2, f.y2);
        c.stroke();
      }
    }, false);
    return;
  }
  const escuro = ['trevas', 'escuridao', 'vultos', 'buraco-negro', 'profanar', 'poeira'].includes(forma) || a.elemento === 'trevas';
  m.emitir(60, () => ({
    x: sorte(0, m.largura), y: sorte(m.altura * 0.15, m.altura * 0.85), vx: sorte(-30, 30), vy: sorte(-15, 15), max: sorte(1.2, 2),
    tam: sorte(80, 160) * m.escala, tamFim: sorte(160, 260) * m.escala, cor: escuro ? 'rgba(10,4,18,0.55)' : pl.fumaca ?? `${pl.cor}`,
    forma: 'fumaca', aditivo: !escuro && !pl.fumaca, alfa: escuro ? 0.9 : 0.35,
  }));
}

/** Onda de choque saindo do autor (aura de morte, despedacar, trovoes). */
async function onda(m: MotorFx, de: Ponto, alvos: AlvoFx[], a: Anim) {
  const pl = pal(a);
  const longe = Math.max(300, ...alvos.map((x) => distancia(de, x.p))) * 1.1;
  for (let i = 0; i < 3; i += 1) setTimeout(() => m.anel(de, i ? pl.cor : pl.nucleo, longe, 700, 14 * m.escala), i * 120);
  await m.esperar(420);
}

// ---------------- magia ----------------

const POR_TIPO: Record<TipoAnim, (cena: CenaFx, a: Anim) => Promise<void>> = {
  async projetil(cena, a) {
    const qtd = Math.max(1, a.qtd ?? 1);
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      const fim = acertou(alvo.desfecho) ? alvo.p : pontoDeErro(cena.de, alvo);
      const vezes = cena.alvos.length === 1 ? qtd : 1;
      await Promise.all(Array.from({ length: vezes }, async (_, k) => {
        await cena.motor.esperar(i * 90 + k * 110);
        await projetil(cena.motor, cena.de, fim, a, { altura: sorte(80, 240) });
      }));
      cena.aoImpacto(i);
      if (alvo.desfecho !== 'erro') impacto(cena.motor, alvo.p, a, alvo.desfecho);
    }));
  },
  async raio(cena, a) {
    const quebrado = a.elemento === 'eletricidade' || a.forma === 'relampago';
    cena.alvos.forEach((alvo, i) => feixe(cena.motor, cena.de, acertou(alvo.desfecho) ? alvo.p : pontoDeErro(cena.de, alvo), a, 560, quebrado, a.forma === 'katana' ? 36 : 18));
    await cena.motor.esperar(120);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.8); });
  },
  async explosao(cena, a) {
    const centro = { x: cena.alvos.reduce((s, x) => s + x.p.x, 0) / Math.max(1, cena.alvos.length), y: cena.alvos.reduce((s, x) => s + x.p.y, 0) / Math.max(1, cena.alvos.length) };
    const qtd = a.qtd ?? 1;
    await Promise.all(Array.from({ length: qtd }, (_, k) => cena.motor.esperar(k * 140).then(() => projetil(cena.motor, cena.de, centro, a, { tam: 34 }))));
    const pl = pal(a);
    cena.motor.pulso(centro, pl.nucleo, 340 * cena.motor.escala, 420);
    cena.motor.anel(centro, pl.cor, 420 * cena.motor.escala, 700, 22 * cena.motor.escala);
    cena.motor.clarao(pl.cor, 300, 0.35);
    cena.motor.tremer(14, 600);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.9); });
  },
  async cone(cena, a) {
    await cone(cena.motor, cena.de, cena.alvos, a);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.7); });
  },
  async sopro(cena, a) {
    await cone(cena.motor, cena.de, cena.alvos, a, 950, true);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.7); });
  },
  async toque(cena, a) {
    // O golpe "salta" do autor para o alvo: rajada curta e reta.
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      await projetil(cena.motor, cena.de, acertou(alvo.desfecho) ? alvo.p : pontoDeErro(cena.de, alvo), a, { reto: true, ms: 280, tam: 30 });
      cena.aoImpacto(i);
      impacto(cena.motor, alvo.p, a, alvo.desfecho, 1.1);
      if (GLIFOS[a.forma ?? '']) glifo(cena.motor, GLIFOS[a.forma!], alvo.p, alvo.raio * 0.9, 700);
    }));
  },
  async queda(cena, a) {
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      await cena.motor.esperar(i * 110);
      await queda(cena.motor, alvo.p, a);
      cena.aoImpacto(i);
      impacto(cena.motor, alvo.p, a, alvo.desfecho, 1.1);
    }));
    if (!cena.alvos.length) await queda(cena.motor, { x: cena.motor.largura / 2, y: cena.motor.altura * 0.45 }, a);
  },
  async chao(cena, a) {
    if (!cena.alvos.length) {
      await doChao(cena.motor, { x: cena.motor.largura / 2, y: cena.motor.altura * 0.45 }, 160 * cena.motor.escala, a);
      return;
    }
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      await doChao(cena.motor, alvo.p, alvo.raio, a);
      cena.aoImpacto(i);
      if (alvo.desfecho !== 'anulado') impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.6);
    }));
  },
  async aura(cena, a) {
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'efeito' as Desfecho }];
    quem.forEach((alvo) => aura(cena.motor, alvo.p, alvo.raio, a));
    await cena.motor.esperar(450);
    cena.alvos.forEach((_, i) => cena.aoImpacto(i));
  },
  async cura(cena, a) {
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'cura' as Desfecho }];
    await Promise.all(quem.map(async (alvo, i) => {
      if (distancia(cena.de, alvo.p) > 40) await projetil(cena.motor, cena.de, alvo.p, a, { tam: 18, altura: 160 });
      aura(cena.motor, alvo.p, alvo.raio, a, 1300, 46);
      cena.aoImpacto(i);
    }));
  },
  async mental(cena, a) {
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      await projetil(cena.motor, cena.de, acertou(alvo.desfecho) ? alvo.p : pontoDeErro(cena.de, alvo), { ...a, forma: undefined }, { tam: 14, altura: 120 });
      if (acertou(alvo.desfecho)) sigilo(cena.motor, alvo.p, alvo.raio, a);
      else impacto(cena.motor, alvo.p, a, 'anulado');
      cena.aoImpacto(i);
    }));
  },
  async ilusao(cena, a) {
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'efeito' as Desfecho }];
    quem.forEach((alvo) => prisma(cena.motor, alvo.p, alvo.raio));
    await cena.motor.esperar(500);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); if (alvo.desfecho === 'acerto') impacto(cena.motor, alvo.p, a, 'resistiu', 0.6); });
  },
  async dreno(cena, a) {
    await Promise.all(cena.alvos.map(async (alvo, i) => {
      cena.aoImpacto(i);
      impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.7);
      if (acertou(alvo.desfecho)) await dreno(cena.motor, cena.de, alvo.p, a);
    }));
  },
  async convocacao(cena, a) {
    const ponto = cena.alvos[0]?.p ?? { x: cena.motor.largura / 2, y: cena.motor.altura * 0.45 };
    circulo(cena.motor, ponto, 170 * cena.motor.escala, a);
    await cena.motor.esperar(600);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.8); });
  },
  async adivinhacao(cena, a) {
    sigilo(cena.motor, cena.de, cena.raioAutor, a);
    cena.alvos.forEach((alvo) => sigilo(cena.motor, alvo.p, alvo.raio, a, 900));
    await cena.motor.esperar(500);
    cena.alvos.forEach((_, i) => cena.aoImpacto(i));
  },
  async campo(cena, a) {
    campo(cena.motor, a);
    await cena.motor.esperar(500);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); if (alvo.desfecho === 'acerto') impacto(cena.motor, alvo.p, a, 'resistiu', 0.6); });
  },
  async teleporte(cena, a) {
    const pl = pal(a);
    cena.motor.pulso(cena.de, pl.cor, cena.raioAutor * 2, 500);
    cena.motor.emitir(40, () => ({ x: cena.de.x + sorte(-40, 40), y: cena.de.y + sorte(-60, 60), vx: sorte(-30, 30), vy: sorte(-200, -40), max: sorte(0.5, 1), tam: sorte(4, 9) * cena.motor.escala, cor: pl.faisca, forma: 'estrela', vrot: 4 }));
    for (const alvo of cena.alvos) cena.motor.pulso(alvo.p, pl.cor, alvo.raio * 1.6, 600);
    await cena.motor.esperar(400);
    cena.alvos.forEach((_, i) => cena.aoImpacto(i));
  },
  async escudo(cena, a) {
    const pl = pal(a);
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'efeito' as Desfecho }];
    for (const alvo of quem) {
      cena.motor.desenhar(1200, (c, t) => {
        const r = alvo.raio * 1.25 * ease.mola(Math.min(1, t * 2.5));
        c.globalAlpha = 0.85 * Math.sin(Math.PI * t);
        const g = c.createRadialGradient(alvo.p.x, alvo.p.y, r * 0.7, alvo.p.x, alvo.p.y, r);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, pl.cor);
        c.fillStyle = g;
        c.strokeStyle = pl.nucleo;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(alvo.p.x, alvo.p.y, r, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      });
      if (GLIFOS[a.forma ?? '']) glifo(cena.motor, GLIFOS[a.forma!], { x: alvo.p.x, y: alvo.p.y - alvo.raio }, alvo.raio * 0.6, 1100, alvo.raio * 0.3);
    }
    await cena.motor.esperar(420);
    cena.alvos.forEach((_, i) => cena.aoImpacto(i));
  },
  async transmutacao(cena, a) {
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'efeito' as Desfecho }];
    quem.forEach((alvo) => { sigilo(cena.motor, { x: alvo.p.x, y: alvo.p.y + alvo.raio * 1.6 }, alvo.raio, a, 1000); aura(cena.motor, alvo.p, alvo.raio, a, 1000, 20); });
    await cena.motor.esperar(450);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); if (alvo.desfecho === 'acerto') impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.6); });
  },
  async tempo(cena, a) {
    const quem = cena.alvos.length ? cena.alvos : [{ p: cena.de, raio: cena.raioAutor, desfecho: 'efeito' as Desfecho }];
    for (const alvo of quem) for (let i = 0; i < 3; i += 1) setTimeout(() => cena.motor.anel(alvo.p, pal(a).cor, alvo.raio * 1.8, 700, 5), i * 160);
    quem.forEach((alvo) => glifo(cena.motor, '⏳', { x: alvo.p.x, y: alvo.p.y - alvo.raio }, alvo.raio * 0.7, 1000, alvo.raio * 0.4));
    await cena.motor.esperar(450);
    cena.alvos.forEach((_, i) => cena.aoImpacto(i));
  },
  async arma(cena, a) {
    // Arma conjurada: brilha no autor e, se houver alvo, corta o alvo.
    aura(cena.motor, cena.de, cena.raioAutor * 0.8, a, 800, 18);
    if (!cena.alvos.length) return;
    await cena.motor.esperar(250);
    for (const [i, alvo] of cena.alvos.entries()) {
      if (a.forma === 'chicote') feixe(cena.motor, cena.de, acertou(alvo.desfecho) ? alvo.p : pontoDeErro(cena.de, alvo), a, 320, true, 10);
      else corte(cena.motor, alvo.p, alvo.raio, pal(a), alvo.desfecho === 'critico');
      cena.aoImpacto(i);
      if (alvo.desfecho !== 'erro') impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.8);
    }
  },
  async onda(cena, a) {
    await onda(cena.motor, cena.de, cena.alvos, a);
    cena.alvos.forEach((alvo, i) => { cena.aoImpacto(i); impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.7); });
  },
  async palavra(cena, a) {
    const pl = pal(a);
    cena.motor.pulso(cena.de, pl.nucleo, cena.raioAutor * 1.6, 400);
    await onda(cena.motor, cena.de, cena.alvos, a);
    cena.alvos.forEach((alvo, i) => {
      cena.aoImpacto(i);
      if (acertou(alvo.desfecho)) sigilo(cena.motor, alvo.p, alvo.raio, a, 900);
      impacto(cena.motor, alvo.p, a, alvo.desfecho, 0.6);
    });
  },
};

export async function tocarMagia(cena: CenaFx, anim: Anim) {
  const f = POR_TIPO[anim.tipo] ?? POR_TIPO.projetil;
  await f(cena, anim);
}

// ---------------- armas ----------------

/** Arco de corte (golpe de espada/machado) sobre o alvo. */
function corte(m: MotorFx, p: Ponto, raio: number, pl: Paleta, critico: boolean, errou = false) {
  const inicio = sorte(-2.6, -1.9);
  const giro = critico ? 3.4 : 2.3;
  const r = raio * (critico ? 1.35 : 1.05);
  const centro = errou ? { x: p.x + raio * 1.3, y: p.y - raio * 0.3 } : p;
  for (let k = 0; k < (critico ? 2 : 1); k += 1) {
    const deslocado = k ? 0.9 : 0;
    m.desenhar(380, (c, t) => {
      const a0 = inicio + deslocado;
      const a1 = a0 + giro * ease.saida(t);
      const caudaInicio = Math.max(a0, a1 - 1.3);
      c.globalAlpha = (1 - t) ** 0.6;
      c.lineCap = 'round';
      for (const [cor, larg, blur] of [[pl.brilho, 22, 30], [pl.cor, 11, 16], [pl.nucleo, 4, 6]] as const) {
        c.strokeStyle = cor;
        c.lineWidth = larg * m.escala * (critico ? 1.4 : 1);
        c.shadowColor = cor;
        c.shadowBlur = blur;
        c.beginPath();
        c.arc(centro.x, centro.y, r, caudaInicio, a1);
        c.stroke();
      }
      c.shadowBlur = 0;
    });
  }
}

/** Estocada (perfuracao): risco reto rapido atravessando o alvo. */
function estocada(m: MotorFx, de: Ponto, p: Ponto, pl: Paleta, critico: boolean) {
  const ang = angulo(de, p);
  const comp = 220 * m.escala * (critico ? 1.5 : 1);
  const ini = { x: p.x - Math.cos(ang) * comp, y: p.y - Math.sin(ang) * comp };
  const fim = { x: p.x + Math.cos(ang) * comp * 0.35, y: p.y + Math.sin(ang) * comp * 0.35 };
  feixe(m, ini, fim, { tipo: 'raio', elemento: 'metal' }, 260, false, critico ? 14 : 9);
  m.pulso(p, pl.nucleo, 60 * m.escala, 240);
}

/** Pancada (impacto): onda curta e destrocos. */
function pancada(m: MotorFx, p: Ponto, pl: Paleta, critico: boolean) {
  m.anel(p, pl.nucleo, 120 * m.escala * (critico ? 1.6 : 1), 360, 16);
  m.emitir(critico ? 30 : 16, () => ({ x: p.x, y: p.y, vx: sorte(-420, 420), vy: sorte(-480, -60), ay: 900, max: sorte(0.5, 0.9), tam: sorte(5, 11) * m.escala, cor: '#cdb79a', forma: 'estilhaco', vrot: sorte(-10, 10), aditivo: false }));
}

/** Marcas de garra (armas naturais, desarmado). */
function garras(m: MotorFx, p: Ponto, raio: number, pl: Paleta, critico: boolean) {
  for (let i = 0; i < 3; i += 1) {
    const dx = (i - 1) * raio * 0.28;
    m.desenhar(420, (c, t) => {
      const e = ease.saida(Math.min(1, t * 2));
      c.globalAlpha = 1 - t;
      c.strokeStyle = pl.cor;
      c.shadowColor = pl.brilho;
      c.shadowBlur = 18;
      c.lineWidth = (critico ? 9 : 6) * m.escala;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(p.x + dx - raio * 0.3, p.y - raio * 0.6);
      c.lineTo(p.x + dx - raio * 0.3 + raio * 0.6 * e, p.y - raio * 0.6 + raio * 1.1 * e);
      c.stroke();
      c.shadowBlur = 0;
    });
  }
}

/** Projetil de arma a distancia (flecha, virote, bala, arma arremessada). */
async function disparo(m: MotorFx, de: Ponto, para: Ponto, tipo: ArquetipoArma, critico: boolean) {
  const ms = tipo === 'tiro' ? 160 : tipo === 'virote' ? 320 : 420;
  const altura = tipo === 'flecha' ? Math.min(140, distancia(de, para) * 0.15) : tipo === 'arremesso' ? 120 : 0;
  if (tipo === 'tiro') {
    m.pulso(de, '#ffd36b', 70 * m.escala, 180);
    m.emitir(10, () => ({ x: de.x, y: de.y, vx: sorte(-120, 120), vy: sorte(-160, -20), max: 0.6, tam: 20, tamFim: 50, cor: 'rgba(80,80,80,0.5)', forma: 'fumaca', aditivo: false }));
  }
  m.desenhar(ms, (c, t) => {
    const p = arco(de, para, altura, t);
    const q = arco(de, para, altura, Math.max(0, t - 0.06));
    const ang = angulo(q, p);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(tipo === 'arremesso' ? t * 26 : ang);
    if (tipo === 'arremesso') {
      c.fillStyle = '#e6edf5';
      c.shadowColor = '#ffffff';
      c.shadowBlur = 14;
      c.fillRect(-16 * m.escala, -3 * m.escala, 32 * m.escala, 6 * m.escala);
    } else {
      // Haste com brilho (rastro de luz atras)
      const comp = (tipo === 'tiro' ? 70 : 54) * m.escala;
      const g = c.createLinearGradient(-comp, 0, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, critico ? '#ffe08a' : '#ffffff');
      c.strokeStyle = g;
      c.lineWidth = (tipo === 'tiro' ? 4 : 3) * m.escala;
      c.shadowColor = critico ? '#ffcf4a' : '#ffffff';
      c.shadowBlur = 16;
      c.beginPath();
      c.moveTo(-comp, 0);
      c.lineTo(0, 0);
      c.stroke();
      if (tipo !== 'tiro') {
        c.fillStyle = '#e6edf5';
        c.beginPath();
        c.moveTo(4 * m.escala, 0);
        c.lineTo(-6 * m.escala, -4 * m.escala);
        c.lineTo(-6 * m.escala, 4 * m.escala);
        c.fill();
      }
    }
    c.restore();
  }, false);
  await m.esperar(ms);
}

export interface CenaArma extends Omit<CenaFx, 'alvos'> {
  alvo: AlvoFx;
  tipo: ArquetipoArma;
  elemento?: string;
}

export async function tocarArma(cena: CenaArma) {
  const { motor: m, alvo, tipo } = cena;
  const critico = alvo.desfecho === 'critico';
  const errou = alvo.desfecho === 'erro';
  const pl = cena.elemento ? (PALETAS as Record<string, Paleta>)[cena.elemento] ?? PALETAS.metal : PALETAS.metal;
  if (['flecha', 'virote', 'tiro', 'arremesso'].includes(tipo)) {
    await disparo(m, cena.de, errou ? pontoDeErro(cena.de, alvo) : alvo.p, tipo, critico);
  } else {
    // Corpo a corpo: rapido avanco de luz ate o alvo, depois o golpe.
    await projetil(m, cena.de, alvo.p, { tipo: 'toque', elemento: 'metal' }, { reto: true, ms: 220, tam: 12 });
    if (tipo === 'corte') corte(m, alvo.p, alvo.raio, pl, critico, errou);
    else if (tipo === 'perfuracao') estocada(m, cena.de, errou ? pontoDeErro(cena.de, alvo) : alvo.p, pl, critico);
    else if (tipo === 'impacto') { if (!errou) pancada(m, alvo.p, pl, critico); }
    else garras(m, errou ? { x: alvo.p.x + alvo.raio, y: alvo.p.y } : alvo.p, alvo.raio, pl, critico);
    await m.esperar(140);
  }
  cena.aoImpacto(0);
  if (errou) {
    m.emitir(8, () => ({ x: alvo.p.x + alvo.raio, y: alvo.p.y, vx: sorte(60, 200), vy: sorte(-80, 80), arrasto: 3, max: 0.4, tam: 4, cor: '#ffffff', forma: 'faisca' }));
    return;
  }
  impacto(m, alvo.p, { tipo: 'toque', elemento: (cena.elemento as Anim['elemento']) ?? 'metal' }, alvo.desfecho, tipo === 'impacto' ? 1.1 : 0.85);
  if (critico) glifo(m, '💥', alvo.p, alvo.raio * 1.2, 650);
}
