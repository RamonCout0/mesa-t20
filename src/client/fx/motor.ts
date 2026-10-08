// Motor de efeitos do telao: particulas com brilho aditivo, desenhos com tempo de vida,
// tremor e clarao. Feito em Canvas 2D (funciona offline e em qualquer PC).

export interface Ponto {
  x: number;
  y: number;
}

export type FormaParticula = 'brilho' | 'faisca' | 'fumaca' | 'anel' | 'estilhaco' | 'estrela';

export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  /** Fracao da velocidade perdida por segundo (0 = sem atrito). */
  arrasto: number;
  vida: number;
  max: number;
  tam: number;
  tamFim: number;
  cor: string;
  alfa: number;
  forma: FormaParticula;
  rot: number;
  vrot: number;
  aditivo: boolean;
}

interface Desenho {
  inicio: number;
  dur: number;
  aditivo: boolean;
  fn: (ctx: CanvasRenderingContext2D, t: number, segundos: number) => void;
}

export const sorte = (a: number, b: number) => a + Math.random() * (b - a);
export const ease = {
  saida: (t: number) => 1 - (1 - t) ** 3,
  entrada: (t: number) => t * t * t,
  meio: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  mola: (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const distancia = (a: Ponto, b: Ponto) => Math.hypot(b.x - a.x, b.y - a.y);
export const angulo = (a: Ponto, b: Ponto) => Math.atan2(b.y - a.y, b.x - a.x);

/** Ponto numa curva quadratica de `a` ate `b` com barriga `altura` (para cima). */
export function arco(a: Ponto, b: Ponto, altura: number, t: number): Ponto {
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - altura;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
}

// Sprites de brilho prontos (gradiente radial) por cor: desenhar imagem e muito mais rapido que gradiente.
const SPRITES = new Map<string, HTMLCanvasElement>();
function sprite(cor: string, forma: FormaParticula) {
  const chave = `${forma}|${cor}`;
  let s = SPRITES.get(chave);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = 64;
  s.height = 64;
  const c = s.getContext('2d')!;
  if (forma === 'fumaca') {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, cor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  } else if (forma === 'estrela') {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.15, cor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 ? 6 : 31;
      const a = (i * Math.PI) / 4;
      c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    c.fill();
  } else {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, cor);
    g.addColorStop(0.5, `${cor}55`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  SPRITES.set(chave, s);
  return s;
}

const LIMITE = 3500;

export class MotorFx {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particulas: Particula[] = [];
  private desenhos: Desenho[] = [];
  private quadro = 0;
  private ultimo = 0;
  private dpr = 1;
  largura = 0;
  altura = 0;
  /** Chamado para tremer a tela (o telao aplica no elemento raiz). */
  aoTremer: (intensidade: number, ms: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ajustar();
    addEventListener('resize', () => this.ajustar());
  }

  ajustar() {
    this.dpr = Math.min(devicePixelRatio, 2);
    this.largura = innerWidth;
    this.altura = innerHeight;
    this.canvas.width = Math.round(this.largura * this.dpr);
    this.canvas.height = Math.round(this.altura * this.dpr);
  }

  /** Escala relativa ao telao (1 = 1080p), para os efeitos terem o mesmo tamanho em qualquer tela. */
  get escala() {
    return Math.max(0.5, this.altura / 1080);
  }

  particula(p: Partial<Particula> & { x: number; y: number }) {
    if (this.particulas.length >= LIMITE) this.particulas.shift();
    const max = p.max ?? 0.8;
    this.particulas.push({
      vx: 0, vy: 0, ax: 0, ay: 0, arrasto: 0, vida: max, tam: 10, tamFim: 0, cor: '#ffffff', alfa: 1,
      forma: 'brilho', rot: 0, vrot: 0, aditivo: true, ...p, max,
    } as Particula);
    this.ligar();
  }

  emitir(n: number, fn: (i: number) => Partial<Particula> & { x: number; y: number }) {
    for (let i = 0; i < n; i += 1) this.particula(fn(i));
  }

  /** Desenho livre com duracao: fn recebe t de 0 a 1. */
  desenhar(durMs: number, fn: Desenho['fn'], aditivo = true) {
    this.desenhos.push({ inicio: performance.now(), dur: durMs, fn, aditivo });
    this.ligar();
  }

  esperar(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  tremer(intensidade: number, ms = 450) {
    this.aoTremer(intensidade, ms);
  }

  /** Clarao na tela inteira. */
  clarao(cor: string, ms = 380, forca = 0.75) {
    this.desenhar(ms, (c, t) => {
      c.globalAlpha = forca * (1 - t) ** 2;
      c.fillStyle = cor;
      c.fillRect(0, 0, this.largura, this.altura);
    });
  }

  /** Anel que se expande (onda de choque). */
  anel(p: Ponto, cor: string, raioFinal: number, ms = 500, espessura = 10) {
    this.desenhar(ms, (c, t) => {
      const r = raioFinal * ease.saida(t);
      c.globalAlpha = (1 - t) ** 1.5;
      c.strokeStyle = cor;
      c.lineWidth = Math.max(1, espessura * (1 - t));
      c.shadowColor = cor;
      c.shadowBlur = 24;
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.stroke();
      c.shadowBlur = 0;
    });
  }

  /** Brilho grande e rapido num ponto (o "pop" do impacto). */
  pulso(p: Ponto, cor: string, raio: number, ms = 300) {
    const s = sprite(cor, 'brilho');
    this.desenhar(ms, (c, t) => {
      const r = raio * (0.6 + 0.6 * ease.saida(t));
      c.globalAlpha = 1 - t;
      c.drawImage(s, p.x - r, p.y - r, r * 2, r * 2);
    });
  }

  private ligar() {
    if (this.quadro) return;
    this.ultimo = performance.now();
    this.quadro = requestAnimationFrame((t) => this.passo(t));
  }

  private passo(agora: number) {
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.largura, this.altura);

    // Desenhos (raios, aneis, formas) primeiro; particulas por cima.
    this.desenhos = this.desenhos.filter((d) => {
      const t = (agora - d.inicio) / d.dur;
      if (t >= 1) return false;
      c.save();
      c.globalCompositeOperation = d.aditivo ? 'lighter' : 'source-over';
      d.fn(c, Math.max(0, t), (agora - d.inicio) / 1000);
      c.restore();
      return true;
    });

    const vivas: Particula[] = [];
    for (const p of this.particulas) {
      p.vida -= dt;
      if (p.vida <= 0) continue;
      const atrito = Math.max(0, 1 - p.arrasto * dt);
      p.vx = (p.vx + p.ax * dt) * atrito;
      p.vy = (p.vy + p.ay * dt) * atrito;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      vivas.push(p);
      const k = 1 - p.vida / p.max;
      const tam = lerp(p.tam, p.tamFim, k);
      const alfa = p.alfa * (p.forma === 'fumaca' ? Math.sin(Math.PI * Math.min(1, k * 1.2)) : (1 - k) ** 1.2);
      if (tam <= 0.2 || alfa <= 0.01) continue;
      c.globalCompositeOperation = p.aditivo ? 'lighter' : 'source-over';
      c.globalAlpha = Math.min(1, alfa);
      if (p.forma === 'faisca') {
        // Faisca: risco na direcao do movimento.
        const v = Math.hypot(p.vx, p.vy) || 1;
        const comp = Math.min(tam * 6, v * 0.05 + tam);
        c.strokeStyle = p.cor;
        c.lineWidth = Math.max(1, tam * 0.45);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - (p.vx / v) * comp, p.y - (p.vy / v) * comp);
        c.stroke();
      } else if (p.forma === 'estilhaco') {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.cor;
        c.beginPath();
        c.moveTo(0, -tam);
        c.lineTo(tam * 0.5, tam * 0.6);
        c.lineTo(-tam * 0.6, tam * 0.3);
        c.closePath();
        c.fill();
        c.restore();
      } else if (p.forma === 'anel') {
        c.strokeStyle = p.cor;
        c.lineWidth = Math.max(1, tam * 0.12);
        c.beginPath();
        c.arc(p.x, p.y, tam, 0, Math.PI * 2);
        c.stroke();
      } else {
        const s = sprite(p.cor, p.forma);
        c.save();
        if (p.forma === 'estrela') {
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.drawImage(s, -tam, -tam, tam * 2, tam * 2);
        } else {
          c.drawImage(s, p.x - tam, p.y - tam, tam * 2, tam * 2);
        }
        c.restore();
      }
    }
    this.particulas = vivas;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    if (this.particulas.length || this.desenhos.length) {
      this.quadro = requestAnimationFrame((t) => this.passo(t));
    } else {
      this.quadro = 0;
      c.clearRect(0, 0, this.largura, this.altura);
    }
  }
}
