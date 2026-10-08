// Cores de cada elemento: nucleo (quase branco), cor principal, brilho e faisca.
import type { Elemento } from '../../shared/magias-efeitos.ts';

export interface Paleta {
  nucleo: string;
  cor: string;
  brilho: string;
  faisca: string;
  /** Fumaca/sombra (desenhada sem brilho aditivo). */
  fumaca?: string;
}

export const PALETAS: Record<Elemento, Paleta> = {
  fogo: { nucleo: '#fff6d8', cor: '#ff7a1a', brilho: '#ff3d00', faisca: '#ffd36b', fumaca: 'rgba(40,20,14,0.55)' },
  frio: { nucleo: '#ffffff', cor: '#8fe6ff', brilho: '#3fb6ff', faisca: '#dff8ff' },
  eletricidade: { nucleo: '#ffffff', cor: '#b9d8ff', brilho: '#5a8cff', faisca: '#fffbd0' },
  acido: { nucleo: '#f6ffd8', cor: '#a8ff3c', brilho: '#4ccf1a', faisca: '#e6ff8a', fumaca: 'rgba(30,50,10,0.45)' },
  luz: { nucleo: '#ffffff', cor: '#fff1a8', brilho: '#ffd23f', faisca: '#ffffff' },
  trevas: { nucleo: '#e6d6ff', cor: '#7b3fd6', brilho: '#3a0d7a', faisca: '#c79bff', fumaca: 'rgba(14,4,24,0.7)' },
  arcano: { nucleo: '#fbeaff', cor: '#d27bff', brilho: '#8a3dff', faisca: '#f3c8ff' },
  psiquico: { nucleo: '#fff0fb', cor: '#ff7ad9', brilho: '#c23ad6', faisca: '#ffd1f2' },
  natureza: { nucleo: '#f2ffe0', cor: '#7ddc5a', brilho: '#2f9e3a', faisca: '#d6ff9a' },
  terra: { nucleo: '#fff1d6', cor: '#d9a35a', brilho: '#8a5a24', faisca: '#ffe0a8', fumaca: 'rgba(60,40,20,0.55)' },
  agua: { nucleo: '#ffffff', cor: '#6fd3ff', brilho: '#1f7fd6', faisca: '#cff3ff' },
  ar: { nucleo: '#ffffff', cor: '#e2f4ff', brilho: '#9ac8e6', faisca: '#ffffff' },
  som: { nucleo: '#ffffff', cor: '#ffe9a8', brilho: '#ffbf3f', faisca: '#fff6d8' },
  veneno: { nucleo: '#f4ffe6', cor: '#8fd63f', brilho: '#4a7a12', faisca: '#d8ff8a', fumaca: 'rgba(40,60,10,0.5)' },
  sangue: { nucleo: '#ffe0e0', cor: '#ff3352', brilho: '#a00020', faisca: '#ff9aa8', fumaca: 'rgba(40,0,6,0.55)' },
  tormenta: { nucleo: '#ffe6ea', cor: '#ff2a4a', brilho: '#8a0018', faisca: '#ff8aa0', fumaca: 'rgba(40,0,10,0.6)' },
  ouro: { nucleo: '#ffffff', cor: '#ffe08a', brilho: '#e8a92a', faisca: '#fff4cc' },
  caos: { nucleo: '#ffffff', cor: '#ff7ad9', brilho: '#5ad8ff', faisca: '#fff27a' },
  metal: { nucleo: '#ffffff', cor: '#e6edf5', brilho: '#9aa8ba', faisca: '#fff6d8' },
  espirito: { nucleo: '#ffffff', cor: '#bff6ff', brilho: '#5ac8d6', faisca: '#eaffff' },
  tempo: { nucleo: '#ffffff', cor: '#ffe7b0', brilho: '#c9a24a', faisca: '#fff3d0' },
};

/** Cores sorteadas do "caos" (Nimb, ilusoes prismaticas). */
export const ARCO_IRIS = ['#ff5b5b', '#ffb84a', '#fff04a', '#5bff8a', '#4ad3ff', '#8a5bff', '#ff5bd8'];

export const ELEMENTO_DO_DANO: Record<string, Elemento> = {
  fogo: 'fogo', frio: 'frio', eletricidade: 'eletricidade', acido: 'acido', luz: 'luz', trevas: 'trevas',
  essencia: 'arcano', psiquico: 'psiquico', impacto: 'terra', corte: 'metal', perfuracao: 'metal',
};

/** Icone do efeito que fica na mesa (selo sobre a carta). */
export const ICONE_ELEMENTO: Record<Elemento, string> = {
  fogo: '🔥', frio: '❄️', eletricidade: '⚡', acido: '🧪', luz: '☀️', trevas: '🌑', arcano: '✨', psiquico: '🌀', natureza: '🌿',
  terra: '🪨', agua: '💧', ar: '🌪️', som: '🎵', veneno: '☠️', sangue: '🩸', tormenta: '🌩️', ouro: '⭐', caos: '🎲', metal: '⚙️',
  espirito: '👻', tempo: '⏳',
};
