// Grimorio: as magias extraidas do Fichas de Nimb (ferramentas/extrair-magias.ts).
import dados from './dados/magias.json' with { type: 'json' };

export type TipoMagia = 'arcana' | 'divina' | 'universal';
export type Escola = 'Abjur' | 'Adiv' | 'Conv' | 'Encan' | 'Evoc' | 'Ilusão' | 'Necro' | 'Trans';

export interface Aprimoramento {
  pm: number;
  texto: string;
  truque?: boolean;
  dano?: { diceCount?: number; dicePerActivation?: string; flatPerActivation?: number; replaceWith?: string; targetRollLabel?: string }[];
}

export interface RolagemMagia {
  rotulo: string;
  dados: string;
  tipoDano?: string;
}

export interface Magia {
  id: string;
  nome: string;
  tipo: TipoMagia;
  circulo: number;
  escola: Escola;
  execucao: string;
  alcance: string;
  alvo: string;
  area: string;
  duracao: string;
  resistencia: string;
  descricao: string;
  aprimoramentos: Aprimoramento[];
  rolagens: RolagemMagia[];
  fonte: string;
}

export const MAGIAS = dados as Magia[];

export const NOME_ESCOLA: Record<Escola, string> = {
  Abjur: 'Abjuração', Adiv: 'Adivinhação', Conv: 'Convocação', Encan: 'Encantamento',
  Evoc: 'Evocação', Ilusão: 'Ilusão', Necro: 'Necromancia', Trans: 'Transmutação',
};

/** "Bola de Fogo" -> "bola-de-fogo", igual ao id gravado no grimorio. */
export const chaveMagia = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const POR_ID = new Map(MAGIAS.map((m) => [m.id, m]));
// Alguns nomes aparecem com grafia diferente entre livros e fichas.
const APELIDOS: Record<string, string> = {
  'lendas-historias': 'lendas-e-historias',
  'armamento-de-allihanna': 'arsenal-de-allihanna',
};

export function buscarMagia(idOuNome: string): Magia | undefined {
  const k = chaveMagia(idOuNome);
  return POR_ID.get(k) ?? POR_ID.get(APELIDOS[k] ?? '');
}
