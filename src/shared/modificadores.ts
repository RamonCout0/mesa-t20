// Penalidades das condicoes (Tormenta20, p. 394-395) aplicadas pelo motor de regras.
// Efeitos iguais nao se acumulam: vale o mais severo de cada grupo.
import type { Atributo } from './tipos.ts';

/** Condicoes que trazem outras junto (cego -> desprevenido e lento...). */
const IMPLICA: Record<string, string[]> = {
  agarrado: ['desprevenido', 'imovel'],
  atordoado: ['desprevenido'],
  cego: ['desprevenido', 'lento'],
  enredado: ['lento', 'vulneravel'],
  exausto: ['debilitado', 'lento', 'vulneravel'],
  fatigado: ['fraco', 'vulneravel'],
  inconsciente: ['indefeso'],
  indefeso: ['desprevenido'],
  paralisado: ['imovel', 'indefeso'],
  petrificado: ['inconsciente'],
  surpreendido: ['desprevenido'],
};

export function expandir(condicoes: string[]): Set<string> {
  const todas = new Set<string>();
  const fila = [...condicoes];
  while (fila.length) {
    const c = fila.pop()!;
    if (todas.has(c)) continue;
    todas.add(c);
    fila.push(...(IMPLICA[c] ?? []));
  }
  return todas;
}

const pior = (...valores: number[]) => Math.min(0, ...valores);

/** Penalidade em testes de pericia (inclui ataque, que e teste de Luta/Pontaria). */
export function modPericia(condicoes: string[], atributo: Atributo) {
  const c = expandir(condicoes);
  const medo = pior(c.has('abalado') ? -2 : 0, c.has('apavorado') ? -5 : 0);
  const fisico = ['for', 'des', 'con'].includes(atributo) ? pior(c.has('fraco') ? -2 : 0, c.has('debilitado') ? -5 : 0) : 0;
  const mental = ['int', 'sab', 'car'].includes(atributo) ? pior(c.has('frustrado') ? -2 : 0, c.has('esmorecido') ? -5 : 0) : 0;
  return medo + fisico + mental;
}

/** Modificador no teste de ataque de quem ataca. */
export function modAtaque(condicoes: string[], distancia: boolean) {
  const c = expandir(condicoes);
  const atributo: Atributo = distancia ? 'des' : 'for';
  // ofuscado, enredado e agarrado sao o mesmo efeito (-2 em ataques): nao somam.
  const ataque = c.has('ofuscado') || c.has('enredado') || c.has('agarrado') ? -2 : 0;
  const caido = c.has('caido') && !distancia ? -5 : 0;
  return modPericia(condicoes, atributo) + ataque + caido;
}

/** Modificador na Defesa de quem e atacado. */
export function modDefesa(condicoes: string[], distancia: boolean) {
  const c = expandir(condicoes);
  const geral = pior(c.has('vulneravel') ? -2 : 0, c.has('desprevenido') ? -5 : 0, c.has('indefeso') ? -10 : 0);
  const caido = c.has('caido') ? (distancia ? 5 : -5) : 0;
  return geral + caido;
}

/** Modificador em Fortitude/Reflexos/Vontade. `null` = falha automatica (indefeso em Reflexos). */
export function modResistencia(condicoes: string[], teste: 'fort' | 'ref' | 'von'): number | null {
  const c = expandir(condicoes);
  if (teste === 'ref' && c.has('indefeso')) return null;
  const atributo: Atributo = teste === 'fort' ? 'con' : teste === 'ref' ? 'des' : 'sab';
  const desprevenido = teste === 'ref' && c.has('desprevenido') ? -5 : 0;
  return modPericia(condicoes, atributo) + desprevenido;
}

/** PV em que o personagem morre: -10 ou metade dos PV totais, o que for mais baixo (Tormenta20, p. 237). */
export const limiteDeMorte = (pvMax: number) => -Math.max(10, Math.floor(pvMax / 2));
