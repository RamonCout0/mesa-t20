// O que cada magia faz na mesa automatica: quem pode ser alvo, dano/cura, resistencia,
// condicoes e a animacao do telao. A maior parte sai dos dados do grimorio; o que as
// regras gerais erram (ou merece um efeito especial) fica em AJUSTES, revisado magia a magia.

import { MAGIAS, buscarMagia, type Magia } from './magias.ts';
import type { Atributo, TipoDano } from './tipos.ts';
import { AJUSTES } from './dados/magias-ajustes.ts';

export type AlvoMagia =
  | 'inimigo' // 1 criatura, normalmente inimiga
  | 'inimigos' // varias criaturas (area ou "criaturas escolhidas")
  | 'aliado' // 1 criatura aliada (ou voce)
  | 'aliados' // varios aliados
  | 'si' // so voce
  | 'qualquer' // 1 criatura de qualquer lado
  | 'nenhum'; // efeito no ambiente, convocacao, utilidade

export type Resistencia = 'fort' | 'ref' | 'von';
export type Sucesso = 'metade' | 'anula' | 'parcial';

/** Como a animacao e desenhada no telao (Fase 3: src/client/fx). */
export type TipoAnim =
  | 'projetil' | 'raio' | 'explosao' | 'cone' | 'toque' | 'queda' | 'chao' | 'aura' | 'cura' | 'mental'
  | 'ilusao' | 'dreno' | 'convocacao' | 'adivinhacao' | 'campo' | 'teleporte' | 'escudo' | 'transmutacao'
  | 'tempo' | 'arma' | 'sopro' | 'onda' | 'palavra';

export type Elemento =
  | 'fogo' | 'frio' | 'eletricidade' | 'acido' | 'luz' | 'trevas' | 'arcano' | 'psiquico' | 'natureza' | 'terra'
  | 'agua' | 'ar' | 'som' | 'veneno' | 'sangue' | 'tormenta' | 'ouro' | 'caos' | 'metal' | 'espirito' | 'tempo';

export interface Anim {
  tipo: TipoAnim;
  elemento: Elemento;
  /** Detalhe do desenho (ex.: 'seta', 'meteoro', 'tentaculos', 'cranio', 'punho'). */
  forma?: string;
  /** Quantos projeteis/raios saem de uma vez. */
  qtd?: number;
}

export interface EfeitoMagia {
  alvo: AlvoMagia;
  /** Limite de alvos (0 = sem limite, ex.: area). */
  maxAlvos: number;
  dano?: string;
  tipoDano?: TipoDano;
  /** Segundo dano no mesmo alvo (ex.: Furia dos Antepassados: psiquico + luz). */
  dano2?: string;
  tipoDano2?: TipoDano;
  /** O segundo dano so acontece se o alvo falhar (Erupcao Glacial). */
  dano2SoFalha?: boolean;
  /** Dano no lugar do normal quando o alvo passa (Desintegrar: 2d12). */
  danoPassou?: string;
  /** Soma um atributo do conjurador ao dano (Soco de Arsenal: + Forca). */
  somaAtributo?: Atributo;
  /** O conjurador recupera metade do dano causado (Toque Vampirico). */
  drenar?: boolean;
  cura?: string;
  /** PV temporarios concedidos. */
  temp?: string;
  res?: Resistencia;
  sucesso?: Sucesso;
  /**
   * Condicoes se o alvo falhar na resistencia (ou sempre, se nao houver resistencia).
   * "atordoado:1" = dura 1 rodada; sem numero, ate o fim da cena.
   */
  falhou?: string[];
  /** Condicoes mesmo se passar (efeito parcial). Mesmo formato de `falhou`. */
  passou?: string[];
  /** Condicoes que a magia remove do alvo (Purificacao...). */
  remove?: string[];
  /** O dano e perda de vida: ignora RD e imunidade a tipo. */
  perda?: boolean;
  /** Fica marcado no telao ate acabar ou ser dissipada. */
  persistente?: 'sustentada' | 'cena' | 'rodadas' | 'longa';
  anim: Anim;
  /** Lembrete para o mestre no registro (o que a mesa nao automatiza). */
  nota?: string;
  /**
   * Efeitos que o conjurador aciona de novo enquanto a magia dura, sem gastar PM
   * (o enxame que morde, o chicote, a nuvem que solta raios...).
   */
  usos?: Uso[];
}

/** Um uso repetivel de uma magia que ficou ativa. */
export type Uso = Omit<EfeitoMagia, 'usos' | 'persistente' | 'anim' | 'maxAlvos'> & {
  nome: string;
  maxAlvos?: number;
  anim: Anim;
  /** Usar este efeito encerra a magia (Rajada mista de Reynard). */
  encerra?: boolean;
};

type AnimCurta = [TipoAnim, Elemento, string?, number?];
export type UsoAjuste = Omit<Uso, 'anim'> & { anim: AnimCurta };
export type Ajuste = Partial<Omit<EfeitoMagia, 'anim' | 'usos'>> & { anim?: Partial<Anim> | AnimCurta; usos?: UsoAjuste[] };

export const animDe = (a: AnimCurta): Anim => ({ tipo: a[0], elemento: a[1], ...(a[2] ? { forma: a[2] } : {}), ...(a[3] ? { qtd: a[3] } : {}) });

// ---------------- regras gerais ----------------

const TIPO_DO_TEXTO: [RegExp, TipoDano][] = [
  [/fogo/i, 'fogo'], [/frio/i, 'frio'], [/eletricidade/i, 'eletricidade'], [/[áa]cido/i, 'acido'], [/\bluz\b/i, 'luz'],
  [/trevas/i, 'trevas'], [/ess[êe]ncia/i, 'essencia'], [/ps[íi]quico/i, 'psiquico'], [/impacto/i, 'impacto'],
  [/corte/i, 'corte'], [/perfura[çc][ãa]o/i, 'perfuracao'],
];

const tipoNoTexto = (t: string) => TIPO_DO_TEXTO.find(([rx]) => rx.test(t))?.[1];

// Condicoes que aparecem nas descricoes ("fica atordoado", "deixando-os ofuscados"...).
const CONDICOES_TEXTO: [RegExp, string][] = [
  [/atordoad/i, 'atordoado'], [/\blent[oa]s?\b/i, 'lento'], [/ofuscad/i, 'ofuscado'], [/enredad/i, 'enredado'],
  [/em chamas/i, 'em-chamas'], [/fascinad/i, 'fascinado'], [/\bpasm[oa]s?\b/i, 'pasmo'], [/apavorad/i, 'apavorado'],
  [/abalad/i, 'abalado'], [/paralisad/i, 'paralisado'], [/inconscien/i, 'inconsciente'], [/vulner[áa]ve/i, 'vulneravel'],
  [/desprevenid/i, 'desprevenido'], [/fatigad/i, 'fatigado'], [/\bfrac[oa]s?\b/i, 'fraco'], [/debilitad/i, 'debilitado'],
  [/enjoad/i, 'enjoado'], [/\bceg[oa]s?\b/i, 'cego'], [/\bsurd[oa]s?\b/i, 'surdo'], [/confus[oa]/i, 'confuso'],
  [/\bca[íi]d[oa]s?\b/i, 'caido'], [/imóve|imove/i, 'imovel'], [/enfeiti[çc]ad/i, 'enfeiticado'], [/sangrando/i, 'sangrando'],
  [/esmorecid/i, 'esmorecido'], [/frustrad/i, 'frustrado'], [/alquebrad/i, 'alquebrado'], [/exaust/i, 'exausto'],
  [/petrificad/i, 'petrificado'],
];

function lerResistencia(m: Magia): { res?: Resistencia; sucesso?: Sucesso } {
  const r = m.resistencia.toLowerCase();
  const res: Resistencia | undefined = r.startsWith('fort') ? 'fort' : r.startsWith('ref') ? 'ref' : r.startsWith('von') ? 'von' : undefined;
  if (!res) return {};
  const sucesso: Sucesso = /metade/.test(r) ? 'metade' : /parcial/.test(r) ? 'parcial' : 'anula';
  return { res, sucesso };
}

function rolagemPrincipal(m: Magia, rx: RegExp) {
  return m.rolagens.find((r) => rx.test(r.rotulo) && !/aprimoramento|truque|vs mortos|por rodada/i.test(r.rotulo));
}

const ESCOLA_ELEMENTO: Record<string, Elemento> = {
  Abjur: 'luz', Adiv: 'ouro', Conv: 'arcano', Encan: 'psiquico', Evoc: 'arcano', Ilusão: 'caos', Necro: 'trevas', Trans: 'natureza',
};
const DANO_ELEMENTO: Partial<Record<TipoDano, Elemento>> = {
  fogo: 'fogo', frio: 'frio', eletricidade: 'eletricidade', acido: 'acido', luz: 'luz', trevas: 'trevas',
  essencia: 'arcano', psiquico: 'psiquico', impacto: 'ar', corte: 'metal', perfuracao: 'metal',
};

function animPadrao(m: Magia, e: Omit<EfeitoMagia, 'anim'>): Anim {
  const area = m.area.toLowerCase();
  const elemento = (e.tipoDano && DANO_ELEMENTO[e.tipoDano]) || (m.tipo === 'divina' && m.escola !== 'Necro' ? 'ouro' : ESCOLA_ELEMENTO[m.escola]);
  if (e.cura) return { tipo: 'cura', elemento: e.tipoDano === 'trevas' ? 'trevas' : 'luz' };
  if (e.dano) {
    if (/cone/.test(area)) return { tipo: 'cone', elemento };
    if (/linha/.test(area)) return { tipo: 'raio', elemento };
    if (/esfera|explos|cilindro|quadrado|cubo/.test(area)) return { tipo: 'explosao', elemento };
    if (/toque/i.test(m.alcance)) return { tipo: 'toque', elemento };
    return { tipo: 'projetil', elemento };
  }
  if (m.escola === 'Encan') return { tipo: 'mental', elemento: 'psiquico' };
  if (m.escola === 'Ilusão') return { tipo: 'ilusao', elemento: 'caos' };
  if (m.escola === 'Adiv') return { tipo: 'adivinhacao', elemento: 'ouro' };
  if (m.escola === 'Necro') return { tipo: e.alvo === 'inimigo' || e.alvo === 'inimigos' ? 'dreno' : 'aura', elemento: 'trevas' };
  if (m.escola === 'Abjur') return { tipo: 'escudo', elemento: m.tipo === 'divina' ? 'ouro' : 'arcano' };
  if (m.escola === 'Conv') return { tipo: area ? 'campo' : 'convocacao', elemento: 'arcano' };
  if (m.escola === 'Trans') return { tipo: 'transmutacao', elemento: m.tipo === 'divina' ? 'natureza' : 'arcano' };
  return { tipo: 'aura', elemento };
}

function alvoPadrao(m: Magia, nocivo: boolean): { alvo: AlvoMagia; maxAlvos: number } {
  const alvo = m.alvo.toLowerCase();
  if (/^voc[êe]$/.test(alvo) || (/pessoal/i.test(m.alcance) && !m.area && !alvo)) return { alvo: 'si', maxAlvos: 1 };
  if (m.area && !/^1 /.test(alvo)) return { alvo: nocivo ? 'inimigos' : 'aliados', maxAlvos: 0 };
  if (/aliados|escolhidas|criaturas/.test(alvo)) return { alvo: nocivo ? 'inimigos' : 'aliados', maxAlvos: 0 };
  const n = /^(\d+)\s/.exec(alvo)?.[1];
  if (/criatura|humanoide|animal|esp[íi]rito|monstro|morto-vivo|construto/.test(alvo)) {
    return { alvo: nocivo ? 'inimigo' : 'aliado', maxAlvos: n ? Number(n) : 1 };
  }
  return { alvo: 'nenhum', maxAlvos: 0 };
}

function persistenciaPadrao(m: Magia, e: Omit<EfeitoMagia, 'anim'>): EfeitoMagia['persistente'] {
  const d = m.duracao.toLowerCase();
  if (/sustentada/.test(d)) return 'sustentada';
  if (/instant/.test(d)) return undefined;
  if (/rodada/.test(d)) return 'rodadas';
  if (/cena/.test(d)) return e.dano && !e.falhou?.length ? undefined : 'cena';
  if (/dia|hora|semana|permanente|minuto/.test(d)) return 'longa';
  return undefined;
}

export function derivar(m: Magia): EfeitoMagia {
  const { res, sucesso } = lerResistencia(m);
  const rDano = rolagemPrincipal(m, /dano/i);
  const rCura = rolagemPrincipal(m, /recupera|cura/i);
  const tipoDano = rDano ? (tipoNoTexto(rDano.tipoDano ?? '') ?? tipoNoTexto(rDano.rotulo) ?? tipoNoTexto(m.descricao)) : undefined;
  const condicoes = [...new Set(CONDICOES_TEXTO.filter(([rx]) => rx.test(m.descricao)).map(([, c]) => c))];
  const nocivo = Boolean(rDano || res || condicoes.length) && !rCura;
  const base: Omit<EfeitoMagia, 'anim'> = {
    ...alvoPadrao(m, nocivo),
    ...(rDano ? { dano: rDano.dados, tipoDano } : {}),
    ...(rCura ? { cura: rCura.dados } : {}),
    ...(res ? { res, sucesso: sucesso === 'parcial' && rDano ? 'metade' : sucesso } : {}),
    ...(condicoes.length ? { falhou: condicoes } : {}),
  };
  base.persistente = persistenciaPadrao(m, base);
  return { ...base, anim: animPadrao(m, base) };
}

function aplicarAjuste(e: EfeitoMagia, a: Ajuste): EfeitoMagia {
  const { anim, usos, ...resto } = a;
  const novaAnim = Array.isArray(anim) ? animDe(anim) : { ...e.anim, ...(anim ?? {}) };
  return {
    ...e, ...resto, anim: novaAnim,
    ...(usos ? { usos: usos.map((u) => ({ ...u, anim: animDe(u.anim) })) } : {}),
  };
}

const CACHE = new Map<string, EfeitoMagia>();

/** Efeito final de uma magia: regras gerais + ajuste revisado a mao. */
export function efeitoDaMagia(m: Magia): EfeitoMagia {
  let e = CACHE.get(m.id);
  if (!e) {
    e = AJUSTES[m.id] ? aplicarAjuste(derivar(m), AJUSTES[m.id]) : derivar(m);
    CACHE.set(m.id, e);
  }
  return e;
}

export function efeitoPorId(id: string) {
  const m = buscarMagia(id);
  return m ? efeitoDaMagia(m) : undefined;
}

export const TODAS_COM_EFEITO = () => MAGIAS.map((m) => ({ m, e: efeitoDaMagia(m) }));
