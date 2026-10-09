// Motor de regras: resolve ataques e magias pela regra do livro e aplica o resultado na mesa.
//
//   Ataque ........ d20 + bonus contra a Defesa; critico na margem de ameaca (so se acertar).
//   Magia ......... alvo testa Fort/Ref/Von contra a CD (10 + metade do nivel + atributo-chave).
//   Dano .......... RD por tipo, imunidade e vulnerabilidade; PV temporario absorve primeiro.
//   Morte ......... PV negativo ate -10 ou -metade do PV maximo (Tormenta20, p. 237).

import { randomInt } from 'node:crypto';
import type { Estado, Entidade, Heroi, Inimigo, Lado, Ataque, TipoDano } from '../shared/tipos.ts';
import { NOME_DANO } from '../shared/tipos.ts';
import type { Ficha } from '../shared/ficha.ts';
import { CUSTO_CIRCULO, cdMagia, execucaoDoPoder, limitePm, poderUsavel } from '../shared/ficha.ts';
import type { Magia } from '../shared/magias.ts';
import type { Anim, EfeitoMagia, Resistencia, Uso } from '../shared/magias-efeitos.ts';
import { acharMagia, efeitoNaFicha, fichaConhece } from '../shared/magias-proprias.ts';
import {
  rolar, multiplicarDados, somarExpressao, maisDadosIguais, lerExpressao, type Sorteio, type Rolada,
} from '../shared/rolagem.ts';
import { expandir, limiteDeMorte, modAtaque, modDefesa, modPericia, modResistencia, pvDepoisDoDano } from '../shared/modificadores.ts';
import type {
  AlvoResultado, Autor, EfeitoAtivo, ParteDano, ResultadoAcao, RolagemExibida, Temporizador,
} from '../shared/acoes.ts';
import { CONDICAO_POR_ID } from '../shared/condicoes.ts';
import { faltaAcao, gastar, lerExecucao, NOME_EXECUCAO, type Execucao } from '../shared/execucao.ts';
import { novoId, buscar, tirarEfeitos } from './estado.ts';

export const sorteioSeguro: Sorteio = (faces) => randomInt(1, faces + 1);

export interface Contexto {
  estado: Estado;
  fichaDe: (h: Heroi) => Ficha | undefined;
  sorteio?: Sorteio;
}

type Alvo = { ent: Entidade; lado: Lado };

const NOME_TESTE: Record<Resistencia, string> = { fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' };
const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// ---------------- quem e quem ----------------

function autorDe(alvo: Alvo): Autor {
  return {
    id: alvo.ent.id, nome: alvo.ent.nome, lado: alvo.lado, imagem: alvo.ent.imagem,
    cor: alvo.lado === 'aliados' ? (alvo.ent as Heroi).cor : '#ff6b4a',
  };
}

function exigir(estado: Estado, id: string): Alvo {
  const a = buscar(estado, id);
  if (!a) throw new Error('Esse alvo não está mais na mesa.');
  return a;
}

/** Bonus de resistencia: ficha do heroi (pericias) ou estatistica do inimigo. */
function bonusResistencia(ctx: Contexto, alvo: Alvo, teste: Resistencia) {
  if (alvo.lado === 'inimigos') return (alvo.ent as Inimigo)[teste];
  const f = ctx.fichaDe(alvo.ent as Heroi);
  const nome = NOME_TESTE[teste];
  if (f?.pericias[nome]) return f.pericias[nome].total;
  return Math.floor(((alvo.ent as Heroi).nivel ?? 1) / 2);
}

function rdDe(ctx: Contexto, alvo: Alvo): Partial<Record<TipoDano | 'geral', number>> {
  if (alvo.lado === 'inimigos') return (alvo.ent as Inimigo).rd ?? {};
  return ctx.fichaDe(alvo.ent as Heroi)?.rd ?? {};
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------- dano, cura e condicoes ----------------

interface DanoAplicado {
  dano: number;
  reduzido: number;
  imune: boolean;
  caiu: boolean;
  morreu: boolean;
}

/** Aplica partes de dano (cada uma com seu tipo) respeitando RD, imunidade e vulnerabilidade. */
export function aplicarDano(ctx: Contexto, alvo: Alvo, partes: ParteDano[]): DanoAplicado {
  const ent = alvo.ent;
  const rd = rdDe(ctx, alvo);
  const imunidades = alvo.lado === 'inimigos' ? (ent as Inimigo).imunidades.map(normal) : [];
  const vulneravel = alvo.lado === 'inimigos' ? (ent as Inimigo).vulnerabilidades.map(normal) : [];
  let total = 0;
  let reduzido = 0;
  let imuneTotal = partes.length > 0;
  let rdGeralRestante = rd.geral ?? 0; // RD geral vale uma vez por golpe
  for (const p of partes) {
    let v = Math.max(0, p.valor);
    if (p.tipo && p.tipo !== 'perda') {
      const nome = normal(NOME_DANO[p.tipo]);
      if (imunidades.some((i) => i.includes(nome))) { reduzido += v; continue; }
      if (vulneravel.some((i) => i.includes(nome))) v = Math.floor(v * 1.5);
      const rdTipo = Math.min(v, rd[p.tipo] ?? 0);
      v -= rdTipo;
      reduzido += rdTipo;
      const geral = Math.min(v, rdGeralRestante);
      v -= geral;
      rdGeralRestante -= geral;
      reduzido += geral;
    }
    imuneTotal = false;
    total += v;
  }
  const antes = ent.pv;
  const absorvido = Math.min(ent.pvTemp, total);
  ent.pvTemp -= absorvido;
  const limite = limiteDeMorte(ent.pvMax);
  ent.pv = pvDepoisDoDano(ent.pv, total - absorvido, ent.pvMax, alvo.lado === 'aliados', ctx.estado.opcoes.zerarAntes);
  const caiu = antes > 0 && ent.pv <= 0;
  const morreu = alvo.lado === 'aliados' && ent.pv <= limite && antes > limite;
  if (alvo.lado === 'aliados' && ent.pv <= 0) {
    // Com 0 PV ou menos: inconsciente e sangrando (Tormenta20, p. 237).
    for (const c of morreu ? [] : ['inconsciente', 'sangrando']) if (!ent.condicoes.includes(c)) ent.condicoes.push(c);
  }
  return { dano: total, reduzido, imune: imuneTotal && total === 0 && partes.length > 0, caiu, morreu };
}

/** Cura a partir do PV atual (mesmo negativo). Voltando a 1+ PV, acorda e para de sangrar. */
export function aplicarCura(ent: Entidade, valor: number) {
  const antes = ent.pv;
  ent.pv = Math.min(ent.pvMax, ent.pv + Math.max(0, valor));
  if (valor > 0) ent.condicoes = ent.condicoes.filter((c) => c !== 'sangrando');
  if (ent.pv > 0) ent.condicoes = ent.condicoes.filter((c) => c !== 'inconsciente' && c !== 'morrendo');
  return ent.pv - antes;
}

/** "atordoado:2" -> poe a condicao e um temporizador de 2 rodadas no turno de quem causou. */
function aplicarCondicoes(estado: Estado, alvo: Entidade, lista: string[] | undefined, donoId: string) {
  const postas: string[] = [];
  for (const item of lista ?? []) {
    const [id, rodadas] = item.split(':');
    if (!CONDICAO_POR_ID[id]) continue;
    if (!alvo.condicoes.includes(id)) alvo.condicoes.push(id);
    postas.push(id);
    estado.temporizadores = estado.temporizadores.filter((t) => !(t.alvoId === alvo.id && t.condicao === id));
    if (rodadas) {
      const t: Temporizador = { id: novoId(), alvoId: alvo.id, condicao: id, donoId, restantes: Math.max(1, Number(rodadas)) };
      estado.temporizadores.push(t);
    }
  }
  return postas;
}

/** No inicio do turno de alguem: conta as rodadas das condicoes e efeitos que essa pessoa causou. */
export function iniciarTurno(estado: Estado, entId: string) {
  const fim: string[] = [];
  for (const t of estado.temporizadores) {
    if (t.donoId !== entId) continue;
    t.restantes -= 1;
    if (t.restantes <= 0) {
      const a = buscar(estado, t.alvoId);
      if (a) a.ent.condicoes = a.ent.condicoes.filter((c) => c !== t.condicao);
      fim.push(t.id);
    }
  }
  estado.temporizadores = estado.temporizadores.filter((t) => !fim.includes(t.id));
  for (const e of estado.efeitos) if (e.conjuradorId === entId && e.persistente === 'rodadas' && e.rodadas !== undefined) e.rodadas -= 1;
  tirarEfeitos(estado, (e) => e.persistente === 'rodadas' && e.rodadas !== undefined && e.rodadas <= 0);
}

/** Fim do combate/cena: condicoes com tempo e efeitos de cena acabam. */
export function encerrarCena(estado: Estado) {
  for (const t of estado.temporizadores) {
    const a = buscar(estado, t.alvoId);
    if (a) a.ent.condicoes = a.ent.condicoes.filter((c) => c !== t.condicao);
  }
  estado.temporizadores = [];
  tirarEfeitos(estado, (e) => e.persistente !== 'longa');
}

// ---------------- rolagens exibidas ----------------

const exibir = (rotulo: string, r: Rolada, alvoId?: string): RolagemExibida => ({
  rotulo, expressao: r.expressao, dados: r.dados, bonus: r.bonus, total: r.total, ...(alvoId ? { alvoId } : {}),
});

/**
 * Com combate em andamento e a regra ligada: fora da vez o jogador so usa reacoes; na vez, cada acao
 * gasta padrao/movimento. Devolve a funcao que marca o gasto (chamada so quando a acao deu certo).
 */
function checarVez(estado: Estado, autorId: string, ehJogador: boolean, execucao: Execucao): () => void {
  const nada = () => {};
  if (!ehJogador || !estado.opcoes.acaoSoNaVez || !estado.turnos.ativo || execucao === 'reacao') return nada;
  if (estado.turnos.atual !== autorId) {
    throw new Error(execucao === 'livre'
      ? 'Ação livre só na sua vez. Fora dela, só reações.'
      : `Não é a sua vez. Fora dela só dá para usar reações (isto é ação ${NOME_EXECUCAO[execucao].toLowerCase()}).`);
  }
  const falta = faltaAcao(estado.turnos.gasto, execucao);
  if (falta) throw new Error(falta);
  return () => gastar(estado.turnos.gasto, execucao);
}

/** O jogador gasta uma acao sem rolar nada (mover-se, sacar ou recarregar a arma, levantar...). */
export function gastarAcaoAvulsa(estado: Estado, autorId: string, execucao: Execucao) {
  if (!estado.turnos.ativo) throw new Error('Sem combate em andamento: ande à vontade.');
  if (estado.turnos.atual !== autorId) throw new Error('Não é a sua vez.');
  const falta = faltaAcao(estado.turnos.gasto, execucao);
  if (falta) throw new Error(falta);
  gastar(estado.turnos.gasto, execucao);
}

function exigirAcordado(ent: Entidade) {
  const c = expandir(ent.condicoes);
  if (ent.pv <= 0 || c.has('inconsciente')) throw new Error(`${ent.nome} está inconsciente.`);
  for (const x of ['atordoado', 'pasmo', 'paralisado', 'surpreendido', 'petrificado']) {
    if (c.has(x)) throw new Error(`${ent.nome} está ${CONDICAO_POR_ID[x].nome.toLowerCase()} e não pode agir.`);
  }
}

// ---------------- ataque com arma ----------------

export interface ExtrasAtaque {
  /** Bonus situacional no teste (flanquear +2, etc.). */
  bonus?: number;
  /** Dano extra que nao multiplica no critico (Ataque Furtivo "2d6"). */
  danoExtra?: string;
  /** Arremessar uma arma corpo a corpo (adaga, lanca...). */
  arremessar?: boolean;
}

/** Soma dos bonus dos efeitos ativos sobre alguem (poderes como a Furia, magias de protecao). */
export function bonusAtivos(estado: Estado, entId: string) {
  const b = { ataque: 0, dano: 0, defesa: 0 };
  for (const e of estado.efeitos) {
    if (!e.bonus) continue;
    const sobre = e.alvos.includes(entId) || (e.conjuradorId === entId && !e.alvos.length);
    if (!sobre) continue;
    b.ataque += e.bonus.ataque ?? 0;
    b.dano += e.bonus.dano ?? 0;
    b.defesa += e.bonus.defesa ?? 0;
  }
  return b;
}

export function resolverAtaque(ctx: Contexto, autorId: string, ataque: Ataque, alvoId: string, extras: ExtrasAtaque, ehJogador: boolean): ResultadoAcao {
  const { estado } = ctx;
  const sorteio = ctx.sorteio ?? sorteioSeguro;
  const autor = exigir(estado, autorId);
  // Agredir e acao padrao (Tormenta20, p. 234).
  const gastarVez = checarVez(estado, autorId, ehJogador, 'padrao');
  exigirAcordado(autor.ent);
  const alvo = exigir(estado, alvoId);
  if (alvo.ent.id === autor.ent.id) throw new Error('Escolha outro alvo.');
  // Inimigo escondido do telao nao pode ser atacado pelo celular (nem pelo id).
  if (ehJogador && alvo.lado === 'inimigos' && !(alvo.ent as Inimigo).naTela && estado.cena.bossId !== alvo.ent.id) throw new Error('Alvo inválido.');

  const distancia = ataque.distancia || Boolean(extras.arremessar && ataque.arremessavel);
  const bonusSituacao = Math.max(-20, Math.min(20, Math.trunc(extras.bonus ?? 0)));
  // Condicoes e poderes/magias ativos (Furia, Escudo da Fe...) entram sozinhos.
  const ativoAutor = bonusAtivos(estado, autor.ent.id);
  const modCond = modAtaque(autor.ent.condicoes, distancia) + ativoAutor.ataque;
  const d20 = rolar('1d20', sorteio);
  const total = d20.total + ataque.bonus + bonusSituacao + modCond;
  const defesa = alvo.ent.defesa + modDefesa(alvo.ent.condicoes, distancia) + bonusAtivos(estado, alvo.ent.id).defesa;
  const acertou = total >= defesa;
  const imuneCritico = alvo.lado === 'inimigos' && (alvo.ent as Inimigo).imunidades.some((i) => /cr[ií]tico/i.test(i));
  const critico = acertou && d20.total >= ataque.margem && !imuneCritico;

  const rolagens: RolagemExibida[] = [{ ...exibir('Ataque', d20), bonus: ataque.bonus + bonusSituacao + modCond, total }];
  const alvoRes: AlvoResultado = {
    id: alvo.ent.id, nome: alvo.ent.nome, lado: alvo.lado, desfecho: critico ? 'critico' : acertou ? 'acerto' : 'erro',
    ataque: { dado: d20.total, total, defesa, margem: ataque.margem }, pvAntes: alvo.ent.pv,
  };

  if (acertou) {
    const expr = critico ? multiplicarDados(ataque.dano, ataque.mult) : ataque.dano;
    const dano = rolar(expr, sorteio);
    rolagens.push(exibir(critico ? `Dano crítico (x${ataque.mult})` : 'Dano', dano));
    let valor = Math.max(1, dano.total + ativoAutor.dano);
    if (extras.danoExtra?.trim()) {
      const extra = rolar(extras.danoExtra, sorteio);
      rolagens.push(exibir('Dano extra', extra));
      valor += Math.max(0, extra.total);
    }
    const r = aplicarDano(ctx, alvo, [{ valor, tipo: ataque.tipoDano }]);
    Object.assign(alvoRes, { dano: r.dano, partes: [{ valor, tipo: ataque.tipoDano }], reduzido: r.reduzido, caiu: r.caiu, morreu: r.morreu });
    if (r.imune) alvoRes.desfecho = 'imune';
  }
  alvoRes.pvDepois = alvo.ent.pv;

  const desc = critico ? 'CRÍTICO' : acertou ? 'acerta' : 'erra';
  gastarVez();
  const texto = `${autor.ent.nome} ataca ${alvo.ent.nome} com ${ataque.nome}: ${total} contra Defesa ${defesa}, ${desc}${acertou ? ` (${alvoRes.dano} de dano${alvoRes.reduzido ? `, ${alvoRes.reduzido} reduzidos` : ''})` : ''}.`;
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'ataque', autor: autorDe(autor), titulo: ataque.nome,
    subtitulo: `${sinal(ataque.bonus)} · ${ataque.dano}${ataque.tipoDano ? ` ${NOME_DANO[ataque.tipoDano]}` : ''}`,
    dado: dadoDe(ctx, autor), rolagens, alvos: [alvoRes], anim: { arma: distancia && extras.arremessar ? 'arremesso' : ataque.arquetipo, distancia, tipoDano: ataque.tipoDano }, texto,
  };
}

function dadoDe(ctx: Contexto, autor: Alvo) {
  if (autor.lado === 'inimigos') return 'tormenta';
  return ctx.fichaDe(autor.ent as Heroi)?.dado ?? 'ouro';
}

// ---------------- magias e efeitos com resistencia ----------------

interface EfeitoParaAplicar extends Omit<EfeitoMagia, 'anim' | 'persistente' | 'usos'> {
  anim: EfeitoMagia['anim'];
}

/** Aplica o efeito de uma magia (ou uso, ou habilidade de ameaca) nos alvos. */
const maiorQueAMorte = (alvo: Alvo) => alvo.lado === 'inimigos'
  && (alvo.ent as Inimigo).habilidades.some((h) => /maior que a morte/i.test(h.nome))
  && alvo.ent.pv * 2 >= alvo.ent.pvMax;

function aplicarEfeito(ctx: Contexto, autor: Alvo, e: EfeitoParaAplicar, alvos: Alvo[], cd: number | null, rolagens: RolagemExibida[]): AlvoResultado[] {
  const { estado } = ctx;
  const sorteio = ctx.sorteio ?? sorteioSeguro;
  const extraAtributo = e.somaAtributo && autor.lado === 'aliados' ? (ctx.fichaDe(autor.ent as Heroi)?.atributos[e.somaAtributo] ?? 0) : 0;

  // Uma rolagem de dano para todos os alvos (como na mesa).
  const rolarSe = (rotulo: string, expr?: string) => {
    if (!expr) return null;
    const r = rolar(expr, sorteio);
    rolagens.push(exibir(rotulo, r));
    return r.total;
  };
  const dano1 = rolarSe(e.tipoDano ? `Dano de ${NOME_DANO[e.tipoDano]}` : e.perda ? 'Perda de vida' : 'Dano', e.dano);
  const dano2 = rolarSe(e.tipoDano2 ? `Dano de ${NOME_DANO[e.tipoDano2]}` : 'Dano extra', e.dano2);
  const danoPassou = e.danoPassou ? rolarSe('Dano (se resistir)', e.danoPassou) : null;
  const cura = rolarSe('Cura', e.cura);
  const temp = rolarSe('PV temporários', e.temp);

  const resultados: AlvoResultado[] = [];
  for (const alvo of alvos) {
    const r: AlvoResultado = { id: alvo.ent.id, nome: alvo.ent.nome, lado: alvo.lado, desfecho: 'efeito', pvAntes: alvo.ent.pv };
    // Maior que a Morte (chefe final): com metade dos PV ou mais, ignora morte instantanea.
    if (e.morteInstantanea && maiorQueAMorte(alvo)) {
      resultados.push({ ...r, desfecho: 'imune', carimbo: 'Maior que a Morte' });
      continue;
    }
    let passou = false;
    if (e.res && cd !== null) {
      const mod = modResistencia(alvo.ent.condicoes, e.res);
      const d20 = rolar('1d20', sorteio);
      const bonus = bonusResistencia(ctx, alvo, e.res) + (mod ?? 0);
      const total = mod === null ? -99 : d20.total + bonus;
      passou = mod !== null && total >= cd;
      r.salvamento = { teste: e.res, dado: d20.total, total, cd, passou };
      rolagens.push({ rotulo: `${NOME_TESTE[e.res]} de ${alvo.ent.nome}`, expressao: '1d20', dados: d20.dados, bonus, total, alvoId: alvo.ent.id });
    }
    const anulou = passou && e.sucesso === 'anula';
    const metade = passou && e.sucesso === 'metade';

    // Dano
    const partes: ParteDano[] = [];
    if (dano1 !== null && !anulou) {
      const base = passou && danoPassou !== null ? danoPassou : dano1 + extraAtributo;
      partes.push({ valor: metade ? Math.floor(base / 2) : base, tipo: e.perda ? 'perda' : (e.tipoDano ?? '') });
    }
    if (dano2 !== null && !anulou && !(passou && e.dano2SoFalha)) {
      partes.push({ valor: metade ? Math.floor(dano2 / 2) : dano2, tipo: e.tipoDano2 ?? '' });
    }
    if (partes.length) {
      const ap = aplicarDano(ctx, alvo, partes);
      Object.assign(r, { dano: ap.dano, partes, reduzido: ap.reduzido, caiu: ap.caiu, morreu: ap.morreu });
      if (ap.imune) r.desfecho = 'imune';
    }

    // Cura e PV temporarios
    if (cura !== null && !anulou) {
      r.cura = aplicarCura(alvo.ent, e.cura === '999' ? alvo.ent.pvMax * 2 : cura);
      r.desfecho = 'cura';
    }
    if (temp !== null && !anulou) {
      alvo.ent.pvTemp = Math.max(alvo.ent.pvTemp, temp); // PV temporarios nao acumulam
      r.temp = temp;
      r.desfecho = 'cura';
    }

    // Condicoes
    const conds = anulou ? [] : passou ? e.passou : e.falhou;
    const postas = aplicarCondicoes(estado, alvo.ent, conds, autor.ent.id);
    if (postas.length) r.condicoes = postas;
    if (e.remove?.length && !anulou) {
      const antes = alvo.ent.condicoes;
      alvo.ent.condicoes = antes.filter((c) => !e.remove!.includes(c));
      const tiradas = antes.filter((c) => !alvo.ent.condicoes.includes(c));
      if (tiradas.length) r.removidas = tiradas;
    }

    if (r.desfecho !== 'imune' && r.desfecho !== 'cura') {
      if (e.res && cd !== null) r.desfecho = anulou ? 'anulado' : passou ? 'resistiu' : 'acerto';
      else if (partes.length || postas.length) r.desfecho = 'acerto';
    }
    r.pvDepois = alvo.ent.pv;
    resultados.push(r);
  }
  return resultados;
}

/** Quantas vezes cada aprimoramento foi escolhido (indice -> vezes), validado. */
function lerAprimoramentos(m: Magia, pedidos: Record<string, number>) {
  const escolhidos: { i: number; vezes: number }[] = [];
  for (const [k, v] of Object.entries(pedidos ?? {})) {
    const i = Number(k);
    const vezes = Math.max(0, Math.min(20, Math.trunc(Number(v))));
    if (!vezes || !m.aprimoramentos[i]) continue;
    // So "aumenta..." pode repetir; os outros valem uma vez.
    const repetivel = /^\s*aumenta/i.test(m.aprimoramentos[i].texto);
    escolhidos.push({ i, vezes: repetivel ? vezes : 1 });
  }
  const truque = escolhidos.find(({ i }) => m.aprimoramentos[i].truque);
  if (truque && escolhidos.length > 1) throw new Error('Truque não pode ser usado com outros aprimoramentos.');
  return escolhidos;
}

/** Aplica os aprimoramentos que mexem no dano/cura/alvos (os demais ficam no texto do registro). */
function efeitoComAprimoramentos(m: Magia, base: EfeitoMagia, escolhidos: { i: number; vezes: number }[]) {
  const e: EfeitoMagia = { ...base };
  for (const { i, vezes } of escolhidos) {
    const a = m.aprimoramentos[i];
    const alvos = /aumenta o n[úu]mero de alvos em \+(\d+)/i.exec(a.texto);
    if (alvos && e.maxAlvos) e.maxAlvos += Number(alvos[1]) * vezes;
    for (const d of a.dano ?? []) {
      const rotulo = normal(d.targetRollLabel ?? '');
      const noSegundo = rotulo && e.tipoDano2 && normal(NOME_DANO[e.tipoDano2]).includes(rotulo);
      const chave: 'dano' | 'dano2' | 'cura' | 'temp' = e.cura && !e.dano ? 'cura' : e.temp && !e.dano ? 'temp' : noSegundo ? 'dano2' : 'dano';
      let expr = e[chave];
      if (!expr) continue;
      if (d.replaceWith) expr = d.replaceWith;
      if (d.diceCount) expr = maisDadosIguais(expr, d.diceCount * vezes);
      if (d.dicePerActivation) for (let n = 0; n < vezes; n += 1) expr = somarExpressao(expr, d.dicePerActivation);
      if (d.flatPerActivation) expr = somarExpressao(expr, String(d.flatPerActivation * vezes));
      e[chave] = expr;
    }
  }
  return e;
}

function validarAlvos(estado: Estado, e: { alvo: EfeitoMagia['alvo']; maxAlvos?: number }, autor: Alvo, ids: string[], ehJogador: boolean): Alvo[] {
  if (e.alvo === 'nenhum') return [];
  if (e.alvo === 'si') return [autor];
  const unicos = [...new Set(ids.map(String))];
  if (!unicos.length) throw new Error('Escolha o alvo da magia.');
  const max = e.maxAlvos ?? 0;
  if (max && unicos.length > max) throw new Error(`Esta magia afeta no máximo ${max} alvo${max > 1 ? 's' : ''}.`);
  return unicos.map((id) => {
    const a = exigir(estado, id);
    // Inimigo escondido do telao nao pode ser escolhido pelos jogadores.
    if (ehJogador && a.lado === 'inimigos' && !(a.ent as Inimigo).naTela && estado.cena.bossId !== a.ent.id) throw new Error('Alvo inválido.');
    return a;
  });
}

function textoMagia(autor: Alvo, nome: string, alvos: AlvoResultado[], pm: number | undefined) {
  const partes = alvos.map((a) => {
    const s = a.salvamento ? ` (${NOME_TESTE[a.salvamento.teste]} ${a.salvamento.total ?? a.salvamento.dado}: ${a.salvamento.passou ? 'passou' : 'falhou'})` : '';
    const efeitos = [
      a.dano !== undefined ? `${a.dano} de dano` : '', a.cura ? `cura ${a.cura}` : '', a.temp ? `+${a.temp} PV temp.` : '',
      a.condicoes?.length ? a.condicoes.map((c) => CONDICAO_POR_ID[c]?.nome.toLowerCase()).join(', ') : '',
      a.removidas?.length ? `livre de ${a.removidas.map((c) => CONDICAO_POR_ID[c]?.nome.toLowerCase()).join(', ')}` : '',
    ].filter(Boolean).join(', ');
    return `${a.nome}${s}${efeitos ? `: ${efeitos}` : ''}`;
  });
  return `${autor.ent.nome} lança ${nome}${pm !== undefined ? ` (${pm} PM)` : ''}${partes.length ? ` → ${partes.join('; ')}` : ''}.`;
}

export interface PedidoMagia {
  magiaId: string;
  alvos: string[];
  aprimoramentos?: Record<string, number>;
}

export function resolverMagia(ctx: Contexto, heroiId: string, pedido: PedidoMagia, ehJogador: boolean): ResultadoAcao {
  const { estado } = ctx;
  const autor = exigir(estado, heroiId);
  if (autor.lado !== 'aliados') throw new Error('Só heróis lançam magias do grimório.');
  const heroi = autor.ent as Heroi;
  const ficha = ctx.fichaDe(heroi);
  const m = acharMagia(ficha, pedido.magiaId);
  if (!m) throw new Error('Magia desconhecida.');
  const gastarVez = checarVez(estado, heroiId, ehJogador, lerExecucao(m.execucao));
  exigirAcordado(autor.ent);
  if (ehJogador && ficha && !fichaConhece(ficha, m.id)) throw new Error('Essa magia não está na sua ficha.');

  const escolhidos = lerAprimoramentos(m, pedido.aprimoramentos ?? {});
  const truque = escolhidos.some(({ i }) => m.aprimoramentos[i].truque);
  const alquebrado = heroi.condicoes.includes('alquebrado') ? 1 : 0;
  const custo = truque ? 0 : CUSTO_CIRCULO[m.circulo] + escolhidos.reduce((s, { i, vezes }) => s + m.aprimoramentos[i].pm * vezes, 0) + alquebrado;
  const limite = ficha ? limitePm(ficha) : heroi.nivel;
  if (custo - alquebrado > limite) throw new Error(`Você pode gastar no máximo ${limite} PM numa magia (seu nível).`);
  if (custo > heroi.pm) throw new Error(`PM insuficientes: precisa de ${custo}, tem ${heroi.pm}.`);

  const efeito = efeitoComAprimoramentos(m, efeitoNaFicha(ficha, m), escolhidos);
  const alvos = validarAlvos(estado, efeito, autor, pedido.alvos, ehJogador);
  const cd = ficha ? cdMagia(ficha) : 10 + Math.floor(heroi.nivel / 2);
  heroi.pm -= custo;
  gastarVez();

  const rolagens: RolagemExibida[] = [];
  const resultados = aplicarEfeito(ctx, autor, efeito, alvos, cd, rolagens);
  const autoCura = drenar(efeito, autor, resultados);

  let efeitoId: string | undefined;
  if (efeito.persistente && efeito.persistente !== 'longa') {
    const ativo: EfeitoAtivo = {
      id: novoId(), magiaId: m.id, nome: m.nome, conjuradorId: heroi.id, alvos: alvos.map((a) => a.ent.id),
      persistente: efeito.persistente, criadoEm: Date.now(), elemento: efeito.anim.elemento,
      ...(resultados.some((r) => r.condicoes?.length) ? { impostas: Object.fromEntries(resultados.filter((r) => r.condicoes?.length).map((r) => [r.id, r.condicoes!])) } : {}),
      ...(efeito.persistente === 'rodadas' ? { rodadas: Math.max(1, Number(/(\d+)/.exec(m.duracao)?.[1] ?? 1)) } : {}),
    };
    // Mesma magia do mesmo conjurador nao empilha: a nova substitui.
    tirarEfeitos(estado, (x) => x.magiaId === m.id && x.conjuradorId === heroi.id && x.persistente === 'sustentada');
    estado.efeitos.push(ativo);
    efeitoId = ativo.id;
  }

  const aprimTexto = escolhidos.map(({ i, vezes }) => `${vezes > 1 ? `${vezes}× ` : ''}${m.aprimoramentos[i].texto}`).join(' | ');
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'magia', autor: autorDe(autor), titulo: m.nome,
    subtitulo: [`${m.circulo}º círculo`, efeito.dano ? `${efeito.dano}${efeito.tipoDano ? ` ${NOME_DANO[efeito.tipoDano]}` : ''}` : '', efeito.cura ? `cura ${efeito.cura}` : '', efeito.res ? `${NOME_TESTE[efeito.res]} CD ${cd}` : ''].filter(Boolean).join(' · '),
    dado: ficha?.dado ?? 'ouro', rolagens, alvos: resultados, anim: { magia: efeito.anim }, pmGasto: custo,
    ...(autoCura ? { autoCura } : {}),
    texto: textoMagia(autor, m.nome, resultados, custo),
    nota: [efeito.nota, aprimTexto && `Aprimoramentos: ${aprimTexto}`].filter(Boolean).join(' ') || undefined,
    ...(efeitoId ? { efeitoId } : {}),
  };
}

function drenar(e: { drenar?: boolean }, autor: Alvo, resultados: AlvoResultado[]) {
  if (!e.drenar) return 0;
  const total = resultados.reduce((s, r) => s + (r.dano ?? 0), 0);
  return total > 0 ? aplicarCura(autor.ent, Math.floor(total / 2)) : 0;
}

/** Aciona de novo um efeito de magia que esta ativo (enxame morde, chicote, nuvem solta raios...). */
export function resolverUso(ctx: Contexto, autorId: string, efeitoId: string, indice: number, alvoIds: string[], ehJogador: boolean): ResultadoAcao {
  const { estado } = ctx;
  const ativo = estado.efeitos.find((x) => x.id === efeitoId);
  if (!ativo) throw new Error('Esse efeito já acabou.');
  if (ehJogador && ativo.conjuradorId !== autorId) throw new Error('Esse efeito não é seu.');
  const autor = exigir(estado, ativo.conjuradorId);
  const ficha = autor.lado === 'aliados' ? ctx.fichaDe(autor.ent as Heroi) : undefined;
  const m = acharMagia(ficha, ativo.magiaId);
  const uso: Uso | undefined = m ? efeitoNaFicha(ficha, m).usos?.[indice] : undefined;
  if (!m || !uso) throw new Error('Esse efeito não tem esse uso.');
  const gastarVez = checarVez(estado, autor.ent.id, ehJogador, lerExecucao(uso.nome));
  const cd = ficha ? cdMagia(ficha) : 10 + Math.floor(((autor.ent as Heroi).nivel ?? 1) / 2);
  const alvos = validarAlvos(estado, { alvo: uso.alvo, maxAlvos: uso.maxAlvos ?? 0 }, autor, alvoIds, ehJogador);
  gastarVez();
  const rolagens: RolagemExibida[] = [];
  const resultados = aplicarEfeito(ctx, autor, { ...uso, maxAlvos: uso.maxAlvos ?? 0 }, alvos, cd, rolagens);
  const autoCura = drenar(uso, autor, resultados);
  if (uso.encerra) estado.efeitos = estado.efeitos.filter((x) => x.id !== ativo.id);
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'uso', autor: autorDe(autor), titulo: `${m.nome}: ${uso.nome}`,
    subtitulo: [uso.dano, uso.res ? `${NOME_TESTE[uso.res]} CD ${cd}` : ''].filter(Boolean).join(' · '),
    dado: ficha?.dado ?? 'ouro', rolagens, alvos: resultados, anim: { magia: uso.anim }, ...(autoCura ? { autoCura } : {}),
    texto: textoMagia(autor, `${m.nome} (${uso.nome})`, resultados, undefined), nota: uso.nota,
  };
}

// ---------------- habilidade de ameaca (mestre) ----------------

export interface PedidoHabilidade {
  nome: string;
  dano?: string;
  tipoDano?: TipoDano | '';
  cura?: string;
  res?: Resistencia | '';
  cd?: number;
  sucesso?: 'metade' | 'anula';
  condicoes?: string[];
  /** PM que o inimigo gasta. */
  pm?: number;
  /** 'nenhum' = so anuncia no telao; 'si' = o proprio inimigo (cura, protecao). */
  alvo?: 'inimigos' | 'um' | 'si' | 'aliados' | 'nenhum';
  /** Descricao, vai para a nota do registro (so o mestre ve). */
  texto?: string;
}

// Cor da animacao pelo tipo de dano da habilidade.
const ELEMENTO_DO_DANO: Partial<Record<TipoDano, Anim['elemento']>> = {
  fogo: 'fogo', frio: 'frio', eletricidade: 'eletricidade', acido: 'acido', luz: 'luz', trevas: 'trevas',
  psiquico: 'psiquico', essencia: 'arcano', impacto: 'terra', corte: 'metal', perfuracao: 'metal',
};

/** O mestre usa uma habilidade de inimigo (sopro, grito, veneno, magia do bloco, aura...). */
export function resolverHabilidade(ctx: Contexto, autorId: string, p: PedidoHabilidade, alvoIds: string[]): ResultadoAcao {
  const autor = exigir(ctx.estado, autorId);
  const pm = Math.max(0, Math.trunc(p.pm ?? 0));
  if (pm && autor.ent.pmMax && pm > autor.ent.pm) throw new Error(`${autor.ent.nome} tem só ${autor.ent.pm} PM (precisa de ${pm}).`);
  const alvoTipo = p.alvo ?? 'inimigos';
  const alvos = alvoTipo === 'nenhum' ? []
    : alvoTipo === 'si' ? [autor]
      : validarAlvos(ctx.estado, { alvo: 'inimigos', maxAlvos: alvoTipo === 'um' ? 1 : 0 }, autor, alvoIds, false);
  if (p.dano) lerExpressao(p.dano);
  if (p.cura) lerExpressao(p.cura);
  const elemento = (p.tipoDano && ELEMENTO_DO_DANO[p.tipoDano]) || (p.cura ? 'luz' : 'trevas');
  const efeito: EfeitoParaAplicar = {
    alvo: 'inimigos', maxAlvos: 0, ...(p.dano ? { dano: p.dano } : {}), ...(p.tipoDano ? { tipoDano: p.tipoDano } : {}),
    ...(p.cura ? { cura: p.cura } : {}),
    ...(p.res ? { res: p.res, sucesso: p.sucesso ?? 'metade' } : {}), falhou: p.condicoes ?? [],
    anim: { tipo: p.cura && !p.dano ? 'cura' : alvoTipo === 'nenhum' || alvoTipo === 'si' ? 'aura' : 'onda', elemento },
  };
  if (pm && autor.ent.pmMax) autor.ent.pm -= pm;
  const rolagens: RolagemExibida[] = [];
  const resultados = alvos.length ? aplicarEfeito(ctx, autor, efeito, alvos, p.res ? (p.cd ?? 15) : null, rolagens) : [];
  const nome = p.nome || 'uma habilidade';
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'magia', autor: autorDe(autor), titulo: p.nome || 'Habilidade',
    subtitulo: [pm ? `${pm} PM` : '', p.dano, p.cura ? `cura ${p.cura}` : '', p.res ? `${NOME_TESTE[p.res]} CD ${p.cd ?? 15}` : ''].filter(Boolean).join(' · '),
    dado: dadoDe(ctx, autor), rolagens, alvos: resultados, anim: { magia: efeito.anim }, ...(pm ? { pmGasto: pm } : {}),
    texto: alvos.length ? textoMagia(autor, nome, resultados, pm || undefined) : `${autor.ent.nome} usa ${nome}${pm ? ` (${pm} PM)` : ''}.`,
    ...(p.texto ? { nota: p.texto.slice(0, 600) } : {}),
  };
}

// ---------------- rolagem livre ----------------

export function resolverRolagem(ctx: Contexto, autorId: string, expressao: string, rotulo: string, secreta: boolean): ResultadoAcao {
  const autor = exigir(ctx.estado, autorId);
  const r = rolar(expressao, ctx.sorteio ?? sorteioSeguro);
  const nome = rotulo.trim().slice(0, 40) || expressao;
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'rolagem', autor: autorDe(autor), titulo: nome, subtitulo: expressao,
    dado: dadoDe(ctx, autor), rolagens: [exibir(nome, r)], alvos: [], anim: {}, secreta,
    texto: `${autor.ent.nome} rola ${nome}: ${r.total}${r.dados.length > 1 || r.bonus ? ` (${r.dados.map((d) => d.valor).join(' + ')}${r.bonus ? ` ${sinal(r.bonus)}` : ''})` : ''}.`,
  };
}

// ---------------- poderes da ficha ----------------

/**
 * Usar um poder da ficha pelo celular: gasta PM (com o limite pelo nivel), aplica o efeito que o grupo
 * definiu (dano, cura, condicao) e, se tiver bonus ou durar, fica ativo na mesa ate acabar.
 */
export function resolverPoder(ctx: Contexto, heroiId: string, indice: number, alvoIds: string[], ehJogador: boolean, lista: 'poderes' | 'itens' = 'poderes'): ResultadoAcao {
  const { estado } = ctx;
  const autor = exigir(estado, heroiId);
  if (autor.lado !== 'aliados') throw new Error('Só heróis usam poderes da ficha.');
  const heroi = autor.ent as Heroi;
  const ficha = ctx.fichaDe(heroi);
  const p = ficha?.[lista]?.[indice];
  if (!ficha || !p || !poderUsavel(p)) throw new Error(lista === 'itens' ? 'Item não encontrado na ficha.' : 'Poder não encontrado na ficha.');
  const gastarVez = checarVez(estado, heroiId, ehJogador, execucaoDoPoder(p));
  exigirAcordado(autor.ent);
  const alquebrado = p.pm && heroi.condicoes.includes('alquebrado') ? 1 : 0;
  const custo = (p.pm ?? 0) + alquebrado;
  if ((p.pm ?? 0) > limitePm(ficha)) throw new Error(`Você pode gastar no máximo ${limitePm(ficha)} PM numa habilidade (seu nível).`);
  if (custo > heroi.pm) throw new Error(`PM insuficientes: precisa de ${custo}, tem ${heroi.pm}.`);

  const efeito = p.efeito ?? { alvo: 'si' as const, maxAlvos: 1, anim: { tipo: 'aura' as const, elemento: 'ouro' as const } };
  const alvos = validarAlvos(estado, efeito, autor, alvoIds, ehJogador);
  const cd = cdMagia(ficha) ?? 10 + Math.floor(ficha.nivel / 2) + Math.max(...Object.values(ficha.atributos));
  heroi.pm -= custo;
  gastarVez();
  const rolagens: RolagemExibida[] = [];
  const resultados = aplicarEfeito(ctx, autor, { ...efeito, sucesso: efeito.res ? efeito.sucesso ?? 'metade' : undefined }, alvos, cd, rolagens);

  // Bonus ou duracao: fica ativo (o mesmo poder do mesmo heroi nao acumula).
  const temBonus = Boolean(p.bonus && (p.bonus.ataque || p.bonus.dano || p.bonus.defesa));
  let efeitoId: string | undefined;
  if (temBonus || efeito.persistente) {
    const chave = `poder:${p.nome}`;
    tirarEfeitos(estado, (x) => x.magiaId === chave && x.conjuradorId === heroi.id);
    const ativo: EfeitoAtivo = {
      id: novoId(), magiaId: chave, nome: p.nome, conjuradorId: heroi.id, alvos: alvos.map((a) => a.ent.id),
      persistente: efeito.persistente ?? 'cena', criadoEm: Date.now(), elemento: efeito.anim.elemento,
      ...(temBonus ? { bonus: p.bonus } : {}),
      ...(efeito.persistente === 'rodadas' ? { rodadas: 1 } : {}),
    };
    estado.efeitos.push(ativo);
    efeitoId = ativo.id;
  }
  const bonusTexto = temBonus ? [p.bonus!.ataque && `${sinal(p.bonus!.ataque)} ataque`, p.bonus!.dano && `${sinal(p.bonus!.dano)} dano`, p.bonus!.defesa && `${sinal(p.bonus!.defesa)} Defesa`].filter(Boolean).join(', ') : '';
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'uso', autor: autorDe(autor), titulo: p.nome,
    subtitulo: [custo ? `${custo} PM` : lista === 'itens' ? 'Item' : 'Poder', bonusTexto].filter(Boolean).join(' · '),
    dado: dadoDe(ctx, autor), rolagens, alvos: resultados, anim: { magia: efeito.anim }, pmGasto: custo,
    texto: `${heroi.nome} usa ${p.nome}${custo ? ` (${custo} PM)` : ''}${bonusTexto ? `: ${bonusTexto} enquanto durar` : ''}${resultados.length && resultados[0].id !== heroi.id ? ` → ${resultados.map((r) => r.nome).join(', ')}` : ''}.`,
    ...(efeitoId ? { efeitoId } : {}),
  };
}

// ---------------- testes pedidos pelo mestre ----------------

/** Resposta a um teste pedido pelo mestre: d20 + pericia da ficha (com as condicoes). */
export function resolverTeste(ctx: Contexto, heroiId: string, pedidoId: string): ResultadoAcao {
  const p = ctx.estado.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error('Esse teste já foi encerrado.');
  if (!p.alvos.includes(heroiId)) throw new Error('Esse teste não é para você.');
  if (p.respostas[heroiId]) throw new Error('Esse teste já foi rolado.');
  const alvo = exigir(ctx.estado, heroiId);
  const heroi = alvo.ent as Heroi;
  // Desacordado nao faz teste de pericia; resistencia (Fortitude contra veneno etc.) continua valendo.
  if (expandir(heroi.condicoes).has('inconsciente') && !['Fortitude', 'Reflexos', 'Vontade'].includes(p.pericia)) {
    throw new Error(`${heroi.nome} está inconsciente e não pode fazer esse teste.`);
  }
  const per = ctx.fichaDe(heroi)?.pericias[p.pericia];
  const base = per?.total ?? (p.pericia === 'Iniciativa' ? heroi.bonusIni : 0);
  const bonus = base + (per ? modPericia(heroi.condicoes, per.atributo) : 0);
  const r = rolar(`1d20${bonus ? sinal(bonus) : ''}`, ctx.sorteio ?? sorteioSeguro);
  const passou = p.cd === null ? null : r.total >= p.cd;
  p.respostas[heroiId] = { total: r.total, passou };
  if (p.pericia === 'Iniciativa') heroi.iniciativa = r.total;
  const alvos: AlvoResultado[] = passou === null ? [] : [{
    id: heroi.id, nome: heroi.nome, lado: 'aliados', desfecho: passou ? 'efeito' : 'erro', carimbo: passou ? 'Passou' : 'Falhou',
  }];
  return {
    id: novoId(), criadoEm: Date.now(), tipo: passou === null ? 'rolagem' : 'uso', autor: autorDe(alvo), titulo: p.pericia,
    subtitulo: p.cd !== null ? `CD ${p.cd}` : 'Teste pedido pelo mestre', dado: dadoDe(ctx, alvo), rolagens: [exibir(p.pericia, r)],
    alvos, anim: {}, ...(p.secreto ? { secreta: true } : {}),
    texto: `${heroi.nome} rola ${p.pericia}: ${r.total}${p.cd !== null ? ` contra CD ${p.cd} — ${passou ? 'passou' : 'falhou'}` : ''}.`,
  };
}

// ---------------- sangramento ----------------

/**
 * Inicio do turno de um heroi sangrando: teste de Constituicao CD 15.
 * Passou: estabiliza (para de sangrar). Falhou: perde 1d6 PV.
 */
export function resolverSangramento(ctx: Contexto, heroiId: string): ResultadoAcao | null {
  const alvo = buscar(ctx.estado, heroiId);
  if (!alvo || alvo.lado !== 'aliados' || !alvo.ent.condicoes.includes('sangrando')) return null;
  const ficha = ctx.fichaDe(alvo.ent as Heroi);
  const con = ficha?.atributos.con ?? 0;
  const sorteio = ctx.sorteio ?? sorteioSeguro;
  const teste = rolar(`1d20${con ? sinal(con) : ''}`, sorteio);
  const passou = teste.total >= 15;
  const rolagens = [exibir('Constituição', teste)];
  const pvAntes = alvo.ent.pv;
  let r: AlvoResultado;
  if (passou) {
    alvo.ent.condicoes = alvo.ent.condicoes.filter((c) => c !== 'sangrando');
    r = { id: alvo.ent.id, nome: alvo.ent.nome, lado: alvo.lado, desfecho: 'efeito', carimbo: 'Estabilizou', removidas: ['sangrando'] };
  } else {
    const perda = rolar('1d6', sorteio);
    rolagens.push(exibir('Perda de PV', perda));
    const d = aplicarDano(ctx, alvo, [{ valor: perda.total, tipo: 'perda' }]);
    r = {
      id: alvo.ent.id, nome: alvo.ent.nome, lado: alvo.lado, desfecho: 'acerto', carimbo: 'Sangrando', dano: d.dano,
      partes: [{ valor: d.dano, tipo: 'perda' }], caiu: d.caiu, morreu: d.morreu, pvAntes, pvDepois: alvo.ent.pv,
    };
  }
  return {
    id: novoId(), criadoEm: Date.now(), tipo: 'uso', autor: autorDe(alvo), titulo: 'Sangrando', subtitulo: 'Constituição CD 15',
    dado: dadoDe(ctx, alvo), rolagens, alvos: [r], anim: {},
    texto: passou
      ? `${alvo.ent.nome} passa no teste de Constituição (${teste.total}) e estabiliza.`
      : `${alvo.ent.nome} falha no teste de Constituição (${teste.total}) e perde ${r.dano} PV sangrando${r.morreu ? ' — morreu' : ''}.`,
  };
}

// ---------------- visao publica do resultado ----------------

/** O que telao e jogadores veem: sem Defesa, bonus de resistencia nem PV de inimigo escondido. */
export function resultadoPublico(estado: Estado, r: ResultadoAcao): ResultadoAcao | null {
  if (r.secreta) return null;
  const alvos = r.alvos.flatMap((a) => {
    if (a.lado !== 'inimigos') return [a];
    const ini = estado.inimigos.find((i) => i.id === a.id);
    const visivel = ini && (ini.naTela || estado.cena.bossId === ini.id);
    if (!visivel) return [];
    const numero = ini.revelar === 'numero';
    return [{
      ...a,
      ...(a.ataque ? { ataque: { ...a.ataque, defesa: null } } : {}),
      ...(a.salvamento ? { salvamento: { ...a.salvamento, total: null } } : {}),
      ...(numero ? {} : { pvAntes: undefined, pvDepois: undefined }),
    }];
  });
  const ocultos = new Set(r.alvos.filter((a) => !alvos.some((b) => b.id === a.id)).map((a) => a.id));
  const rolagens = r.rolagens
    .filter((x) => !x.alvoId || !ocultos.has(x.alvoId))
    .map((x) => (x.alvoId && estado.inimigos.some((i) => i.id === x.alvoId) ? { ...x, total: x.dados[0]?.valor ?? x.total, bonus: 0 } : x));
  // Descricao e PM gasto de habilidade de inimigo ficam so com o mestre.
  const doInimigo = r.autor.lado === 'inimigos' ? { nota: undefined, pmGasto: undefined } : {};
  return { ...r, alvos, rolagens, ...doInimigo };
}
