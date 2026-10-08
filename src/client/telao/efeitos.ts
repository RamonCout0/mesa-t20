// Efeitos de tela do telao (tremor, clarao, raio, chamas...) e numeros flutuantes.
// Imperativos de proposito: sao passageiros e nao fazem parte do estado.

export const sorte = (min: number, max: number) => min + Math.random() * (max - min);
const SVG = 'http://www.w3.org/2000/svg';

function el(tag: string, classe: string, estilo: Record<string, string> = {}) {
  const e = document.createElement(tag);
  e.className = classe;
  for (const [k, v] of Object.entries(estilo)) e.style.setProperty(k, v);
  return e;
}

/** Reinicia uma animacao CSS de classe (remove, forca reflow, recoloca). */
export function pulsar(alvo: Element | null, classe: string, duracaoMs?: number) {
  if (!alvo) return;
  alvo.classList.remove(classe);
  void (alvo as HTMLElement).offsetWidth;
  alvo.classList.add(classe);
  if (duracaoMs) setTimeout(() => alvo.classList.remove(classe), duracaoMs);
}

// Linha quebrada de (x0,y0) ate (x1,y1), em coordenadas 0..100 da tela.
function trilha(x0: number, y0: number, x1: number, y1: number, passos: number, desvio: number) {
  return Array.from({ length: passos + 1 }, (_, i) => {
    const t = i / passos;
    const solto = i === 0 || i === passos ? 0 : (Math.random() - 0.5) * desvio;
    return [x0 + (x1 - x0) * t + solto, y0 + (y1 - y0) * t];
  });
}

function desenharRaio() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('raio-svg');
  const tronco = trilha(sorte(35, 65), -2, sorte(40, 60), sorte(58, 78), 16, 9);
  const ramos = [tronco];
  for (let r = 0; r < 3; r += 1) {
    const [x, y] = tronco[Math.floor(sorte(3, tronco.length - 4))];
    ramos.push(trilha(x, y, x + sorte(-24, 24), y + sorte(12, 26), 7, 6));
  }
  ramos.forEach((pontos, i) => {
    const d = `M${pontos.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
    for (const camada of ['halo', 'nucleo']) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `${camada}${i ? ' ramo' : ''}`);
      svg.append(path);
    }
  });
  return svg;
}

function particulas(n: number) {
  return Array.from({ length: n }, () => el('i', 'particula', {
    left: `${sorte(0, 100)}%`,
    '--t': `${sorte(3, 8)}px`,
    '--d': `${sorte(1.4, 2.4)}s`,
    '--atraso': `${sorte(0, 0.7)}s`,
    '--x': `${sorte(-6, 6)}vw`,
  }));
}

export function efeitoDeTela(nome: string) {
  const raiz = document.getElementById('raiz');
  const camadaFx = document.getElementById('fx');
  if (!raiz || !camadaFx) return;
  if (nome === 'tremor') {
    pulsar(raiz, 'tremendo');
    return;
  }
  const camada = el('div', `fx-camada fx-${nome}`);
  if (nome === 'raio') camada.append(desenharRaio());
  if (nome === 'cura' || nome === 'fogo') camada.append(...particulas(nome === 'cura' ? 36 : 44));
  camadaFx.append(camada);
  if (nome === 'raio') efeitoDeTela('tremor');
  setTimeout(() => camada.remove(), 3000);
}

/** Numero que sobe e some sobre o alvo. */
export function flutuante(caixa: Element, classe: string, texto: string) {
  const e = el('div', `flutuante ${classe}`);
  e.textContent = texto;
  caixa.append(e);
  setTimeout(() => e.remove(), 1700);
}

/** Elemento do telao que representa um combatente (heroi, capanga ou boss). */
export function elementoDe(id: string): HTMLElement | null {
  const seguro = CSS.escape(id);
  // No modo cena, o personagem no palco (os dados saem dele).
  const noPalco = document.querySelector<HTMLElement>(`.vn-palco.ativo .vn-ator[data-ref="${seguro}"]:not(.saindo)`);
  if (noPalco) return noPalco;
  return document.querySelector(`#grupo > [data-id="${seguro}"], .flanco > [data-id="${seguro}"], #boss[data-id="${seguro}"]`);
}
