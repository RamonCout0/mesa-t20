// Numeros da ficha pela regra do livro (Tormenta20, Jogo do Ano): PV e PM por classe e nivel,
// Defesa e pericias. Usado no editor para montar uma ficha do zero (ou conferir a do Nimb).
import type { Atributo } from './tipos.ts';
import type { Pericia } from './ficha.ts';
import { PERICIAS } from './ficha.ts';

export interface DadosClasse {
  nome: string;
  /** PV no 1º nivel (soma a Constituicao). */
  pvInicial: number;
  /** PV por nivel depois do 1º (soma a Constituicao). */
  pvNivel: number;
  /** PM por nivel. */
  pmNivel: number;
  /** Atributo-chave das magias (so para quem conjura). */
  chave?: Atributo;
}

export const CLASSES: DadosClasse[] = [
  { nome: 'Arcanista', pvInicial: 8, pvNivel: 2, pmNivel: 6, chave: 'int' },
  { nome: 'Bárbaro', pvInicial: 24, pvNivel: 6, pmNivel: 3 },
  { nome: 'Bardo', pvInicial: 12, pvNivel: 3, pmNivel: 4, chave: 'car' },
  { nome: 'Bucaneiro', pvInicial: 16, pvNivel: 4, pmNivel: 3 },
  { nome: 'Caçador', pvInicial: 16, pvNivel: 4, pmNivel: 4 },
  { nome: 'Cavaleiro', pvInicial: 20, pvNivel: 5, pmNivel: 3 },
  { nome: 'Clérigo', pvInicial: 16, pvNivel: 4, pmNivel: 5, chave: 'sab' },
  { nome: 'Druida', pvInicial: 16, pvNivel: 4, pmNivel: 4, chave: 'sab' },
  { nome: 'Guerreiro', pvInicial: 20, pvNivel: 5, pmNivel: 3 },
  { nome: 'Inventor', pvInicial: 12, pvNivel: 3, pmNivel: 4, chave: 'int' },
  { nome: 'Ladino', pvInicial: 12, pvNivel: 3, pmNivel: 4 },
  { nome: 'Lutador', pvInicial: 20, pvNivel: 5, pmNivel: 3 },
  { nome: 'Nobre', pvInicial: 16, pvNivel: 4, pmNivel: 4 },
  { nome: 'Paladino', pvInicial: 20, pvNivel: 5, pmNivel: 3, chave: 'car' },
];

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Clériga", "Vassalo (Cavaleiro)", "duelista (bucaneiro)" -> a classe base. */
export function acharClasse(texto: string): DadosClasse | undefined {
  const t = sem(texto);
  return CLASSES.find((c) => t.includes(sem(c.nome))) ?? CLASSES.find((c) => t.startsWith(sem(c.nome).slice(0, 5)));
}

/** Atributo padrao de cada pericia. */
export const ATRIBUTO_PERICIA: Record<string, Atributo> = {
  Acrobacia: 'des', Adestramento: 'car', Atletismo: 'for', Atuação: 'car', Cavalgar: 'des', Conhecimento: 'int', Cura: 'sab',
  Diplomacia: 'car', Enganação: 'car', Fortitude: 'con', Furtividade: 'des', Guerra: 'int', Iniciativa: 'des', Intimidação: 'car',
  Intuição: 'sab', Investigação: 'int', Jogatina: 'car', Ladinagem: 'des', Luta: 'for', Misticismo: 'int', Nobreza: 'int',
  'Ofício 1': 'int', 'Ofício 2': 'int', Percepção: 'sab', Pilotagem: 'des', Pontaria: 'des', Reflexos: 'des', Religião: 'sab',
  Sobrevivência: 'sab', Vontade: 'sab',
};

/** Bonus de treinamento: +2 (niveis 1 a 6), +4 (7 a 14), +6 (15 em diante). */
export const bonusTreino = (nivel: number) => (nivel >= 15 ? 6 : nivel >= 7 ? 4 : 2);

export interface Equipamento {
  /** Bonus de Defesa da armadura. */
  armadura: number;
  /** Armadura pesada nao soma a Destreza na Defesa. */
  pesada: boolean;
  escudo: number;
  /** Outros bonus (poderes, itens, raca). */
  outros: number;
  /** PV e PM a mais (raca, poderes como Vitalidade). */
  pvExtra: number;
  pmExtra: number;
}

export const equipamentoVazio = (): Equipamento => ({ armadura: 0, pesada: false, escudo: 0, outros: 0, pvExtra: 0, pmExtra: 0 });

export interface Calculo {
  pvMax: number;
  pmMax: number;
  defesa: number;
  pericias: Record<string, Pericia>;
  chave: Atributo | null;
}

/** PV, PM, Defesa e pericias pela regra. Pericias mantem treino, atributo e rotulo de cada uma. */
export function calcular(classe: DadosClasse, nivel: number, atrib: Record<Atributo, number>, pericias: Record<string, Pericia>, eq: Equipamento): Calculo {
  const n = Math.max(1, Math.min(20, Math.trunc(nivel)));
  const con = atrib.con;
  // Cada nivel da pelo menos 1 PV, mesmo com Constituicao negativa.
  const pvMax = Math.max(1, classe.pvInicial + con) + (n - 1) * Math.max(1, classe.pvNivel + con) + eq.pvExtra;
  const pmMax = classe.pmNivel * n + eq.pmExtra;
  const defesa = 10 + (eq.pesada ? 0 : atrib.des) + eq.armadura + eq.escudo + eq.outros;
  const metade = Math.floor(n / 2);
  const novas: Record<string, Pericia> = {};
  for (const nome of PERICIAS) {
    const atual = pericias[nome];
    const atributo = atual?.atributo ?? ATRIBUTO_PERICIA[nome] ?? 'des';
    const treinada = atual?.treinada ?? false;
    // Oficio sem nome e sem treino nao aparece na ficha.
    if ((nome === 'Ofício 1' || nome === 'Ofício 2') && !treinada && !atual?.rotulo) continue;
    novas[nome] = { ...(atual ?? {}), atributo, treinada, total: metade + atrib[atributo] + (treinada ? bonusTreino(n) : 0) };
  }
  return { pvMax, pmMax, defesa, pericias: novas, chave: classe.chave ?? null };
}
