// Economia de acoes (Tormenta20, p. 233): na sua vez, uma acao padrao e uma de movimento
// (ou uma completa, que gasta as duas). A padrao pode virar uma segunda de movimento.
// Acao livre nao conta. Reacao vale a qualquer momento, inclusive fora da vez.

export type Execucao = 'padrao' | 'movimento' | 'completa' | 'livre' | 'reacao';

export const EXECUCOES: Execucao[] = ['padrao', 'movimento', 'completa', 'livre', 'reacao'];
export const NOME_EXECUCAO: Record<Execucao, string> = {
  padrao: 'Padrão', movimento: 'Movimento', completa: 'Completa', livre: 'Livre', reacao: 'Reação',
};

/** O que ja foi gasto no turno atual. */
export interface Gasto {
  padrao: boolean;
  movimento: boolean;
}
export const gastoNovo = (): Gasto => ({ padrao: false, movimento: false });

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Le a execucao de um texto: "Padrão", "Reação", "ação de movimento", "(ação livre)"...
 * Execucoes longas ("1 hora", "Duas rodadas") contam como completa no combate.
 */
export function lerExecucao(texto: string | undefined, padrao: Execucao = 'padrao'): Execucao {
  const t = sem(texto ?? '').trim();
  if (!t) return padrao;
  if (/^(padrao|movimento|completa|livre|reacao)$/.test(t)) return t as Execucao;
  if (/\breacao\b/.test(t)) return 'reacao';
  if (/acao livre|^livre/.test(t)) return 'livre';
  if (/acao completa|^completa|rodadas?\b|minutos?|hora/.test(t)) return 'completa';
  if (/acao de movimento|^moviment/.test(t)) return 'movimento';
  if (/acao padrao|^padrao/.test(t)) return 'padrao';
  return padrao;
}

/**
 * Execucao citada na descricao de um poder ("Como uma reação, ...", "gaste uma ação de movimento").
 * Vale a primeira que aparece; sem nenhuma citada, fica o padrao.
 */
export function execucaoDoTexto(texto: string | undefined, padrao: Execucao = 'padrao'): Execucao {
  const t = sem(texto ?? '');
  const achados: [number, Execucao][] = ([
    [/\breac(ao|oes)\b/, 'reacao'], [/acao livre/, 'livre'], [/acao completa/, 'completa'],
    [/acao de movimento/, 'movimento'], [/acao padrao/, 'padrao'],
  ] as [RegExp, Execucao][]).map(([rx, e]) => [t.search(rx), e] as [number, Execucao]).filter(([i]) => i >= 0);
  achados.sort((a, b) => a[0] - b[0]);
  return achados[0]?.[1] ?? padrao;
}

/** Explica por que nao da para gastar (null = pode). */
export function faltaAcao(g: Gasto, e: Execucao): string | null {
  if (e === 'livre' || e === 'reacao') return null;
  if (e === 'padrao' && g.padrao) return 'Você já usou sua ação padrão neste turno.';
  if (e === 'movimento' && g.padrao && g.movimento) return 'Você já usou suas ações neste turno.';
  if (e === 'completa' && (g.padrao || g.movimento)) return 'Ação completa precisa do turno inteiro (padrão e movimento livres).';
  return null;
}

/** Marca o gasto. Movimento sem a de movimento livre usa a padrao no lugar. */
export function gastar(g: Gasto, e: Execucao) {
  if (e === 'padrao') g.padrao = true;
  else if (e === 'completa') { g.padrao = true; g.movimento = true; }
  else if (e === 'movimento') { if (!g.movimento) g.movimento = true; else g.padrao = true; }
}

/** Ainda tem alguma acao (padrao ou movimento) para gastar neste turno. */
export const temAcao = (g: Gasto) => !g.padrao || !g.movimento;
