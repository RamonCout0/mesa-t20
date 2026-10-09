// Assinatura de cada elemento no impacto e no rastro: e o que faz um raio de gelo nao parecer uma
// bola de fogo de outra cor. Fogo sobe em linguas, gelo estilhaca em cristais, eletricidade
// ramifica, acido respinga e borbulha, trevas implodem, luz desce em coluna, terra racha o chao...
import type { Elemento } from '../../shared/magias-efeitos.ts';
import { MotorFx, ease, lerp, sorte, type Ponto } from './motor.ts';
import { ARCO_IRIS, PALETAS } from './paletas.ts';

const TAU = Math.PI * 2;

/** Relampago ramificado que tremeluz (refaz o caminho a cada poucos quadros). */
export function relampago(m: MotorFx, de: Ponto, para: Ponto, cor: string, ms = 420, largura = 4, ramos = 2) {
  const gerar = () => {
    const d = Math.hypot(para.x - de.x, para.y - de.y);
    const n = Math.max(6, Math.round(d / 22));
    const ang = Math.atan2(para.y - de.y, para.x - de.x) + Math.PI / 2;
    const linha = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      const solto = i === 0 || i === n ? 0 : sorte(-1, 1) * d * 0.09;
      return { x: lerp(de.x, para.x, t) + Math.cos(ang) * solto, y: lerp(de.y, para.y, t) + Math.sin(ang) * solto };
    });
    const galhos = Array.from({ length: ramos }, () => {
      const i = Math.floor(sorte(2, n - 1));
      const o = linha[i];
      const dir = Math.atan2(para.y - de.y, para.x - de.x) + sorte(-1.1, 1.1);
      const comp = d * sorte(0.15, 0.35);
      return Array.from({ length: 5 }, (_, k) => ({
        x: o.x + Math.cos(dir) * comp * (k / 4) + sorte(-10, 10), y: o.y + Math.sin(dir) * comp * (k / 4) + sorte(-10, 10),
      }));
    });
    return [linha, ...galhos];
  };
  let caminhos = gerar();
  let quadro = 0;
  m.desenhar(ms, (c, t) => {
    if (++quadro % 3 === 0) caminhos = gerar();
    const forca = (t < 0.1 ? t / 0.1 : (1 - t) ** 1.2) * (Math.random() < 0.25 ? 0.45 : 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    caminhos.forEach((cam, k) => {
      for (const [cr, w, blur] of [[cor, largura * 3, 26], ['#ffffff', largura, 6]] as const) {
        c.globalAlpha = forca * (k ? 0.6 : 1);
        c.strokeStyle = cr;
        c.lineWidth = w * m.escala * (k ? 0.55 : 1);
        c.shadowColor = cr;
        c.shadowBlur = blur;
        c.beginPath();
        cam.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.stroke();
      }
    });
    c.shadowBlur = 0;
  });
}

/** Linhas de velocidade saindo do ponto (crítico): o golpe "congela" por um instante. */
export function linhasDeImpacto(m: MotorFx, p: Ponto, cor: string, raio: number) {
  const linhas = Array.from({ length: 22 }, () => ({ ang: sorte(0, TAU), ini: sorte(0.9, 1.3), comp: sorte(0.8, 1.8), larg: sorte(2, 6) }));
  m.desenhar(420, (c, t) => {
    const e = ease.saida(t);
    c.globalAlpha = (1 - t) ** 1.4;
    c.strokeStyle = cor;
    c.lineCap = 'round';
    for (const l of linhas) {
      const r0 = raio * (l.ini + e * 0.9);
      const r1 = r0 + raio * l.comp * (1 - t * 0.6);
      c.lineWidth = l.larg * m.escala;
      c.beginPath();
      c.moveTo(p.x + Math.cos(l.ang) * r0, p.y + Math.sin(l.ang) * r0);
      c.lineTo(p.x + Math.cos(l.ang) * r1, p.y + Math.sin(l.ang) * r1);
      c.stroke();
    }
  });
}

/** Rachaduras no chao a partir do ponto (terra, impacto forte). */
function rachaduras(m: MotorFx, p: Ponto, raio: number, cor: string) {
  const fendas = Array.from({ length: 6 }, () => {
    let a = sorte(0, TAU);
    let q = { ...p };
    return Array.from({ length: 6 }, () => {
      a += sorte(-0.5, 0.5);
      q = { x: q.x + Math.cos(a) * raio * 0.22, y: q.y + Math.sin(a) * raio * 0.11 };
      return q;
    });
  });
  m.desenhar(1100, (c, t) => {
    const cresce = Math.min(1, t * 4);
    c.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    c.strokeStyle = cor;
    c.lineWidth = 3 * m.escala;
    c.shadowColor = cor;
    c.shadowBlur = 12;
    for (const f of fendas) {
      const n = Math.max(1, Math.round(f.length * cresce));
      c.beginPath();
      c.moveTo(p.x, p.y);
      for (let i = 0; i < n; i += 1) c.lineTo(f[i].x, f[i].y);
      c.stroke();
    }
    c.shadowBlur = 0;
  });
}

/** Ondas achatadas (agua, som, psiquico): aneis em perspectiva. */
function ondulacao(m: MotorFx, p: Ponto, cor: string, raio: number, vezes = 3, achatar = 0.4, intervalo = 140) {
  for (let i = 0; i < vezes; i += 1) {
    setTimeout(() => m.desenhar(700, (c, t) => {
      c.globalAlpha = (1 - t) ** 1.5;
      c.strokeStyle = cor;
      c.lineWidth = Math.max(1, 6 * (1 - t)) * m.escala;
      c.shadowColor = cor;
      c.shadowBlur = 16;
      c.beginPath();
      c.ellipse(p.x, p.y, raio * ease.saida(t), raio * achatar * ease.saida(t), 0, 0, TAU);
      c.stroke();
      c.shadowBlur = 0;
    }), i * intervalo);
  }
}

/** Circulo runico girando no chao do alvo (arcano). */
function runas(m: MotorFx, p: Ponto, raio: number, cor: string, ms = 900) {
  m.desenhar(ms, (c, t, s) => {
    c.globalAlpha = Math.sin(Math.PI * t);
    c.strokeStyle = cor;
    c.shadowColor = cor;
    c.shadowBlur = 18;
    c.lineWidth = 2.5 * m.escala;
    c.save();
    c.translate(p.x, p.y);
    c.scale(1, 0.42);
    c.rotate(s * 2.4);
    const r = raio * (0.7 + 0.3 * ease.mola(Math.min(1, t * 2)));
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.arc(0, 0, r * 0.78, 0, TAU);
    c.stroke();
    // Estrela de 5 pontas por dentro
    c.beginPath();
    for (let i = 0; i <= 5; i += 1) {
      const a = (i * 2 * TAU) / 5 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    }
    c.stroke();
    for (let i = 0; i < 10; i += 1) {
      const a = (i * TAU) / 10;
      c.fillStyle = cor;
      c.fillRect(Math.cos(a) * r * 0.89 - 3, Math.sin(a) * r * 0.89 - 3, 6, 6);
    }
    c.restore();
    c.shadowBlur = 0;
  });
}

/** Coluna de luz descendo sobre o ponto, com brilho em cruz. */
function colunaDeLuz(m: MotorFx, p: Ponto, raio: number, cor: string) {
  m.desenhar(700, (c, t) => {
    const forca = t < 0.15 ? t / 0.15 : (1 - t) ** 1.5;
    const w = raio * 0.9 * (1 - t * 0.5);
    const g = c.createLinearGradient(p.x - w, 0, p.x + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, cor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = forca * 0.85;
    c.fillStyle = g;
    c.fillRect(p.x - w, 0, w * 2, p.y + raio * 0.3);
    // Brilho em cruz (lente)
    c.globalAlpha = forca;
    c.strokeStyle = '#ffffff';
    c.shadowColor = cor;
    c.shadowBlur = 30;
    c.lineWidth = 3 * m.escala;
    const h = raio * 2.4 * (0.6 + 0.4 * forca);
    c.beginPath();
    c.moveTo(p.x - h, p.y);
    c.lineTo(p.x + h, p.y);
    c.moveTo(p.x, p.y - h * 0.6);
    c.lineTo(p.x, p.y + h * 0.6);
    c.stroke();
    c.shadowBlur = 0;
  });
}

/** Particulas que nascem em volta e correm para o centro (trevas, dreno): implosao. */
function implosao(m: MotorFx, p: Ponto, raio: number, cor: string, nucleo: string, n = 36) {
  m.emitir(n, () => {
    const a = sorte(0, TAU);
    const r = raio * sorte(1.4, 2.2);
    const vida = sorte(0.35, 0.55);
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: (-Math.cos(a) * r) / vida, vy: (-Math.sin(a) * r) / vida, max: vida, tam: sorte(4, 9) * m.escala, cor: Math.random() < 0.3 ? nucleo : cor, forma: 'faisca' };
  });
}

/** Vento em espiral em volta do ponto (ar). */
function redemoinho(m: MotorFx, p: Ponto, raio: number, cor: string) {
  const fitas = Array.from({ length: 5 }, (_, i) => ({ fase: (i * TAU) / 5, alt: sorte(-0.4, 0.4), r: raio * sorte(0.8, 1.3) }));
  m.desenhar(800, (c, t, s) => {
    c.globalAlpha = Math.sin(Math.PI * t) * 0.9;
    c.strokeStyle = cor;
    c.lineCap = 'round';
    c.lineWidth = 3 * m.escala;
    c.shadowColor = cor;
    c.shadowBlur = 12;
    for (const f of fitas) {
      const a0 = f.fase + s * 9;
      c.beginPath();
      c.ellipse(p.x, p.y + f.alt * raio, f.r * (1 - t * 0.4), f.r * 0.35, 0, a0, a0 + 1.6);
      c.stroke();
    }
    c.shadowBlur = 0;
  });
}

/**
 * Detalhe proprio do elemento no impacto. `k` e a escala do impacto (critico maior, resistiu menor).
 * Chamado pelo impacto geral; os elementos com assinatura forte pedem menos faiscas genericas.
 */
export function assinatura(m: MotorFx, p: Ponto, elemento: Elemento, k: number, raio = 90) {
  const pl = PALETAS[elemento] ?? PALETAS.arcano;
  const r = raio * k * m.escala;
  switch (elemento) {
    case 'fogo':
      // Linguas de fogo subindo e brasas que flutuam.
      m.emitir(Math.round(30 * k), () => ({
        x: p.x + sorte(-r * 0.5, r * 0.5), y: p.y + sorte(-10, r * 0.3), vx: sorte(-30, 30), vy: sorte(-320, -140), ay: -80, arrasto: 1.2,
        max: sorte(0.45, 0.9), tam: sorte(16, 30) * k * m.escala, tamFim: 2, cor: Math.random() < 0.4 ? '#ffd36b' : Math.random() < 0.5 ? pl.cor : pl.brilho,
      }));
      m.emitir(Math.round(16 * k), () => ({
        x: p.x + sorte(-r, r), y: p.y + sorte(-r * 0.3, r * 0.3), vx: sorte(-60, 60), vy: sorte(-120, -40), ay: -30, max: sorte(1, 1.8),
        tam: sorte(2, 4) * m.escala, cor: '#ffb347', forma: 'faisca',
      }));
      break;
    case 'frio':
      // Cristais de gelo que estilhacam e uma geada branca.
      m.emitir(Math.round(16 * k), () => {
        const a = sorte(0, TAU);
        const v = sorte(160, 420) * k;
        return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrasto: 3.2, ay: 160, max: sorte(0.8, 1.3), tam: sorte(10, 20) * k * m.escala, tamFim: 3, cor: pl.cor, forma: 'cristal', rot: a + Math.PI / 2, vrot: sorte(-2, 2), aditivo: false };
      });
      m.pulso(p, '#e8fbff', r * 1.3, 600);
      m.emitir(Math.round(20 * k), () => ({ x: p.x + sorte(-r, r), y: p.y - r * sorte(0.2, 1), vx: sorte(-20, 20), vy: sorte(20, 60), max: sorte(1, 1.8), tam: sorte(2, 4) * m.escala, cor: '#ffffff', forma: 'estrela', vrot: 1 }));
      break;
    case 'eletricidade':
    case 'tormenta': {
      const cor = elemento === 'tormenta' ? '#ff3a5a' : '#9fc4ff';
      for (let i = 0; i < 4 + Math.round(2 * k); i += 1) {
        const a = sorte(0, TAU);
        relampago(m, p, { x: p.x + Math.cos(a) * r * sorte(1.2, 2), y: p.y + Math.sin(a) * r * sorte(1.2, 2) }, cor, sorte(250, 450), 2.5, 1);
      }
      m.clarao(elemento === 'tormenta' ? '#ff1f3f' : '#dfe9ff', 160, 0.25);
      break;
    }
    case 'acido':
    case 'veneno':
    case 'sangue':
    case 'agua': {
      // Respingo de gotas com gravidade; acido e veneno borbulham, agua ondula.
      const cor = elemento === 'sangue' ? '#c4102a' : pl.cor;
      m.emitir(Math.round(26 * k), () => {
        const a = sorte(-Math.PI * 0.95, -Math.PI * 0.05);
        const v = sorte(220, 560) * k;
        return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 1400, max: sorte(0.6, 1), tam: sorte(5, 10) * k * m.escala, tamFim: 3, cor, forma: 'gota', aditivo: elemento !== 'sangue' };
      });
      if (elemento === 'acido' || elemento === 'veneno') {
        m.emitir(Math.round(14 * k), () => ({ x: p.x + sorte(-r * 0.6, r * 0.6), y: p.y + sorte(-10, r * 0.4), vx: sorte(-15, 15), vy: sorte(-90, -40), max: sorte(0.8, 1.4), tam: sorte(4, 10) * m.escala, cor: pl.faisca, forma: 'bolha' }));
      }
      if (elemento === 'agua') ondulacao(m, { x: p.x, y: p.y + r * 0.4 }, pl.cor, r * 1.6, 3, 0.3);
      break;
    }
    case 'trevas':
      implosao(m, p, r, pl.cor, pl.faisca, Math.round(40 * k));
      setTimeout(() => {
        m.emitir(Math.round(12 * k), () => ({ x: p.x + sorte(-20, 20), y: p.y + sorte(-20, 20), vx: sorte(-90, 90), vy: sorte(-90, 90), arrasto: 1.5, max: sorte(0.9, 1.5), tam: sorte(30, 50) * k * m.escala, tamFim: sorte(80, 120) * k * m.escala, cor: pl.fumaca ?? 'rgba(14,4,24,0.7)', forma: 'fumaca', aditivo: false }));
        m.pulso(p, pl.brilho, r * 1.4, 400);
      }, 380);
      break;
    case 'luz':
    case 'ouro':
      colunaDeLuz(m, p, r * 0.8, pl.brilho);
      m.emitir(Math.round(18 * k), () => ({ x: p.x + sorte(-r, r), y: p.y + sorte(-r, r * 0.4), vy: sorte(-80, -20), max: sorte(0.7, 1.3), tam: sorte(6, 12) * m.escala, cor: '#ffffff', forma: 'estrela', vrot: 3 }));
      break;
    case 'psiquico':
      ondulacao(m, p, pl.cor, r * 1.5, 4, 0.55, 110);
      m.emitir(Math.round(10 * k), (i) => {
        const a = (i / 10) * TAU;
        return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.5, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 80, max: 0.9, tam: 9 * m.escala, cor: pl.faisca, forma: 'estrela', vrot: 5 };
      });
      break;
    case 'natureza':
      m.emitir(Math.round(22 * k), () => {
        const a = sorte(0, TAU);
        const v = sorte(120, 320) * k;
        return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, arrasto: 2, ay: 120, max: sorte(0.9, 1.5), tam: sorte(7, 12) * m.escala, cor: Math.random() < 0.3 ? '#c9f27a' : pl.brilho, forma: 'folha', rot: a, vrot: sorte(-7, 7), aditivo: false };
      });
      break;
    case 'terra':
      rachaduras(m, { x: p.x, y: p.y + r * 0.35 }, r * 1.6, pl.cor);
      m.emitir(Math.round(18 * k), () => ({ x: p.x, y: p.y, vx: sorte(-380, 380) * k, vy: sorte(-520, -160) * k, ay: 1300, max: sorte(0.6, 1), tam: sorte(6, 13) * k * m.escala, cor: Math.random() < 0.5 ? '#8a6a44' : '#b8915c', forma: 'estilhaco', vrot: sorte(-10, 10), aditivo: false }));
      m.emitir(Math.round(8 * k), () => ({ x: p.x + sorte(-r, r), y: p.y + r * 0.3, vx: sorte(-60, 60), vy: sorte(-40, -10), max: sorte(0.9, 1.5), tam: sorte(30, 50) * m.escala, tamFim: sorte(80, 120) * m.escala, cor: 'rgba(90,70,45,0.45)', forma: 'fumaca', aditivo: false }));
      break;
    case 'ar':
      redemoinho(m, p, r * 1.2, pl.cor);
      break;
    case 'som':
      ondulacao(m, p, pl.brilho, r * 2, 4, 1, 90);
      break;
    case 'arcano':
      runas(m, { x: p.x, y: p.y + r * 0.5 }, r * 1.3, pl.cor);
      m.emitir(Math.round(16 * k), () => ({ x: p.x + sorte(-r, r), y: p.y + sorte(-r, r), vy: sorte(-60, -10), max: sorte(0.6, 1.2), tam: sorte(5, 10) * m.escala, cor: pl.faisca, forma: 'estrela', vrot: 4 }));
      break;
    case 'espirito':
      m.emitir(Math.round(14 * k), (i) => ({ x: p.x + Math.cos(i) * r * 0.6, y: p.y + r * 0.4, vx: Math.cos(i * 2) * 50, vy: sorte(-200, -110), arrasto: 0.5, max: sorte(1, 1.6), tam: sorte(14, 24) * m.escala, tamFim: 40 * m.escala, cor: pl.cor, alfa: 0.6 }));
      break;
    case 'tempo':
      ondulacao(m, p, pl.brilho, r * 1.4, 3, 1, 200);
      break;
    case 'metal':
      // Faiscas de metal que caem.
      m.emitir(Math.round(22 * k), () => {
        const a = sorte(-Math.PI, 0);
        const v = sorte(260, 640);
        return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 1500, arrasto: 0.8, max: sorte(0.35, 0.7), tam: sorte(2, 4) * m.escala, cor: Math.random() < 0.5 ? '#fff3c4' : '#ffb347', forma: 'faisca' };
      });
      break;
    case 'caos':
      m.emitir(Math.round(30 * k), () => {
        const a = sorte(0, TAU);
        const v = sorte(150, 500);
        return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrasto: 2.5, max: sorte(0.6, 1.1), tam: sorte(6, 12) * m.escala, cor: ARCO_IRIS[Math.floor(Math.random() * ARCO_IRIS.length)], forma: 'estrela', vrot: 6 };
      });
      break;
  }
}

/** Elementos cuja assinatura ja e forte: o impacto geral solta menos faiscas para nao embolar. */
export const ASSINATURA_FORTE = new Set<Elemento>(['metal', 'frio', 'eletricidade', 'tormenta', 'acido', 'veneno', 'sangue', 'agua', 'trevas', 'natureza', 'terra', 'luz']);

/** Algo a mais no rastro do projetil (cristais de gelo, chispas, gotas, folhas). */
export function rastro(m: MotorFx, p: Ponto, elemento: Elemento, tam: number) {
  const pl = PALETAS[elemento] ?? PALETAS.arcano;
  if (Math.random() > 0.35) return;
  switch (elemento) {
    case 'frio':
      m.particula({ x: p.x + sorte(-6, 6), y: p.y + sorte(-6, 6), vx: sorte(-20, 20), vy: sorte(10, 50), max: sorte(0.5, 0.9), tam: tam * 0.25, cor: pl.cor, forma: 'cristal', rot: sorte(0, TAU), vrot: sorte(-3, 3), aditivo: false });
      break;
    case 'eletricidade':
    case 'tormenta':
      if (Math.random() < 0.4) relampago(m, p, { x: p.x + sorte(-60, 60), y: p.y + sorte(-60, 60) }, elemento === 'tormenta' ? '#ff3a5a' : '#9fc4ff', 120, 1.5, 0);
      break;
    case 'acido':
    case 'veneno':
    case 'sangue':
    case 'agua':
      m.particula({ x: p.x, y: p.y, vx: sorte(-40, 40), vy: sorte(0, 60), ay: 1200, max: 0.6, tam: tam * 0.2, cor: elemento === 'sangue' ? '#c4102a' : pl.cor, forma: 'gota' });
      break;
    case 'natureza':
      m.particula({ x: p.x, y: p.y, vx: sorte(-50, 50), vy: sorte(-30, 40), ay: 80, max: 0.9, tam: tam * 0.3, cor: pl.brilho, forma: 'folha', rot: sorte(0, TAU), vrot: sorte(-6, 6), aditivo: false });
      break;
    case 'trevas':
      m.particula({ x: p.x, y: p.y, vx: sorte(-20, 20), vy: sorte(-20, 20), max: 0.9, tam: tam * 0.6, tamFim: tam * 1.6, cor: pl.fumaca ?? 'rgba(14,4,24,0.6)', forma: 'fumaca', aditivo: false, alfa: 0.7 });
      break;
    case 'luz':
    case 'arcano':
      m.particula({ x: p.x + sorte(-8, 8), y: p.y + sorte(-8, 8), max: 0.6, tam: tam * 0.35, cor: pl.faisca, forma: 'estrela', vrot: 5 });
      break;
  }
}
