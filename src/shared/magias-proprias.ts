// Magias que uma ficha conhece: as do grimorio (pelo id) e as criadas pelo grupo (homebrew).
// O motor de regras, o celular e o painel do mestre buscam magia e efeito por aqui.
import type { Ficha, MagiaPropria } from './ficha.ts';
import { buscarMagia, type Magia } from './magias.ts';
import { efeitoDaMagia, type EfeitoMagia, type Uso } from './magias-efeitos.ts';

export const FONTE_PROPRIA = 'Homebrew';
const NOME_TESTE: Record<string, string> = { fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' };
const SUCESSO: Record<string, string> = { metade: 'reduz à metade', anula: 'anula', parcial: 'parcial' };

/** A magia propria no mesmo formato das do livro (para listar, mostrar e lancar). */
export function comoMagia(p: MagiaPropria): Magia {
  const e = p.efeito;
  return {
    id: p.id, nome: p.nome, tipo: 'universal', circulo: p.circulo, escola: 'Evoc', execucao: p.execucao, alcance: p.alcance,
    alvo: { inimigo: '1 criatura', inimigos: 'criaturas escolhidas', aliado: '1 criatura', aliados: 'criaturas escolhidas', si: 'você', qualquer: '1 criatura', nenhum: '' }[e.alvo] ?? '',
    area: '', duracao: p.duracao, resistencia: e.res ? `${NOME_TESTE[e.res]} ${SUCESSO[e.sucesso ?? 'metade']}` : '',
    descricao: p.descricao,
    // O motor le "aumenta o numero de alvos em +N" e soma os dados por ativacao, como nas do livro.
    aprimoramentos: (p.aprimoramentos ?? []).map((a) => ({
      pm: a.pm,
      texto: [a.texto, a.dano ? `+${a.dano} de dano` : '', a.alvos ? `aumenta o número de alvos em +${a.alvos}` : ''].filter(Boolean).join('; '),
      ...(a.dano ? { dano: [{ dicePerActivation: a.dano }] } : {}),
    })),
    rolagens: [], fonte: FONTE_PROPRIA,
  };
}

function usoDe(u: NonNullable<MagiaPropria['uso']>): Uso {
  const { persistente: _p, ...resto } = u;
  return resto;
}

export function efeitoPropria(p: MagiaPropria): EfeitoMagia {
  const e = p.efeito;
  return {
    ...e,
    maxAlvos: e.maxAlvos,
    ...(e.res && !e.sucesso ? { sucesso: 'metade' as const } : {}),
    ...(p.uso ? { usos: [usoDe(p.uso)] } : {}),
  };
}

/** Todas as magias da ficha: do grimorio e proprias. */
export function magiasDaFicha(f: Pick<Ficha, 'magias' | 'magiasProprias'>): Magia[] {
  const doLivro = f.magias.map((id) => buscarMagia(id)).filter((m): m is Magia => Boolean(m));
  return [...doLivro, ...(f.magiasProprias ?? []).map(comoMagia)];
}

/** Acha uma magia que a ficha conhece (ou, sem ficha, so no grimorio). */
export function acharMagia(f: Pick<Ficha, 'magias' | 'magiasProprias'> | undefined, id: string): Magia | undefined {
  const propria = f?.magiasProprias?.find((p) => p.id === id);
  return propria ? comoMagia(propria) : buscarMagia(id);
}

/** Efeito de uma magia (propria ou do livro) para o motor de regras e as telas. */
export function efeitoNaFicha(f: Pick<Ficha, 'magiasProprias'> | undefined, m: Magia): EfeitoMagia {
  const propria = m.fonte === FONTE_PROPRIA ? f?.magiasProprias?.find((p) => p.id === m.id) : undefined;
  return propria ? efeitoPropria(propria) : efeitoDaMagia(m);
}

/** A ficha conhece esta magia? */
export const fichaConhece = (f: Pick<Ficha, 'magias' | 'magiasProprias'>, id: string) =>
  f.magias.includes(id) || (f.magiasProprias ?? []).some((p) => p.id === id);
