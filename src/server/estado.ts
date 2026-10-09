// Estado da mesa: herois, inimigos, boss em cena e ordem de turno.
// Toda regra de "quem pode ver o que" mora aqui (visaoPublica / filtrarEvento),
// no servidor, para que nada escondido saia pela rede.

import fs from 'node:fs';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { gastoNovo } from '../shared/execucao.ts';
import { CONDICAO_POR_ID, TEMAS, TIERS, REVELAR, EFEITOS } from '../shared/condicoes.ts';
import { pvDepoisDoDano } from '../shared/modificadores.ts';
import type {
  Estado, Heroi, Inimigo, Entidade, Lado, Evento, EventoValor, EstadoPublico, InimigoPublico, FichaOrdem, Habilidade, Ataque,
  Ator, Cena, Palco, TipoDano,
} from '../shared/tipos.ts';
import { TIPOS_DANO } from '../shared/tipos.ts';
import type { EfeitoAtivo } from '../shared/acoes.ts';
import { expressaoValida } from '../shared/rolagem.ts';

const ARQUETIPOS = ['corte', 'perfuracao', 'impacto', 'flecha', 'virote', 'tiro', 'arremesso', 'natural'];

/** Ataques de inimigo vindos do painel: so passa o que e valido. */
export function validarAtaques(v: unknown): Ataque[] {
  return (Array.isArray(v) ? v : []).slice(0, 12).flatMap((a, i) => {
    const dano = String(a?.dano ?? '').replace(/\s/g, '');
    if (!expressaoValida(dano)) return [];
    return [{
      id: `at${i + 1}`, nome: txt(a?.nome, 40) || 'Ataque', bonus: num(a?.bonus, -20, 80), dano,
      tipoDano: (TIPOS_DANO as readonly string[]).includes(a?.tipoDano) ? a.tipoDano : '',
      margem: num(a?.margem ?? 20, 2, 20), mult: num(a?.mult ?? 2, 2, 6), alcance: txt(a?.alcance, 30),
      distancia: Boolean(a?.distancia), ...(a?.arremessavel ? { arremessavel: true } : {}),
      arquetipo: ARQUETIPOS.includes(a?.arquetipo) ? a.arquetipo : 'corte',
    } as Ataque];
  });
}

const listaTexto = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(/,| e /)).map((x) => txt(x, 40)).filter(Boolean).slice(0, 20);

export const novoId = () => randomUUID().slice(0, 8);

// ---------------- validacao ----------------

export const num = (v: unknown, min = 0, max = 9999) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
export const txt = (v: unknown, max = 60) => String(v ?? '').trim().slice(0, max);
const corValida = (v: unknown, padrao: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? '')) ? String(v) : padrao);
export const imagemValida = (v: unknown) => {
  const s = String(v ?? '');
  return /^\/(personagens|bosses|galeria|cenarios)\/[^/\\]+$/.test(s) && !s.includes('..') ? s : '';
};
const daLista = <T extends string>(lista: readonly T[], padrao: T) => (v: unknown): T =>
  (lista.includes(v as T) ? (v as T) : padrao);

type Validador = (v: unknown) => unknown;

const CAMPOS: Record<string, Validador> = {
  nome: (v) => txt(v, 40) || 'Sem nome',
  jogador: (v) => txt(v, 30),
  classe: (v) => txt(v, 40),
  nivel: (v) => num(v, 1, 20),
  subtitulo: (v) => txt(v, 70),
  nd: (v) => txt(v, 8),
  imagem: imagemValida,
  cor: (v) => corValida(v, '#e9c46a'),
  pv: (v) => num(v, -999, 9999),
  pvMax: (v) => num(v, 1, 9999),
  pvTemp: (v) => num(v, 0, 9999),
  pm: (v) => num(v, 0, 999),
  pmMax: (v) => num(v, 0, 999),
  defesa: (v) => num(v, 0, 99),
  bonusIni: (v) => num(v, -20, 40),
  iniciativa: (v) => (v === null || v === '' || v === undefined ? null : num(v, -20, 99)),
  naTela: (v) => Boolean(v),
  revelar: daLista(REVELAR, 'oculto'),
  tema: daLista(TEMAS, 'trevas'),
  tier: daLista(TIERS, 'comum'),
  notas: (v) => txt(v, 2000),
  fort: (v) => num(v, -20, 60),
  ref: (v) => num(v, -20, 60),
  von: (v) => num(v, -20, 60),
  ataques: validarAtaques,
  rd: (v) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>)
    .filter(([k]) => k === 'geral' || (TIPOS_DANO as readonly string[]).includes(k)).map(([k, n]) => [k, num(n, 0, 200)]).filter(([, n]) => n)),
  imunidades: listaTexto,
  vulnerabilidades: listaTexto,
  habilidades: (v): Habilidade[] => (Array.isArray(v) ? v : []).slice(0, 40).map(validarHabilidade).filter((h) => h.nome),
};

const ALVOS_HABILIDADE = ['inimigos', 'um', 'si', 'aliados', 'nenhum'];

/** Habilidade de inimigo: nome e chip do telao, mais o que o botao de usar faz (tudo opcional). */
function validarHabilidade(h: Record<string, unknown>): Habilidade {
  const dano = String(h?.dano ?? '').replace(/\s/g, '');
  const cura = String(h?.cura ?? '').replace(/\s/g, '');
  const res = ['fort', 'ref', 'von'].includes(String(h?.res)) ? (h.res as 'fort' | 'ref' | 'von') : '';
  const tipoDano = (TIPOS_DANO as readonly string[]).includes(String(h?.tipoDano)) ? h.tipoDano as TipoDano : '';
  const condicoes = (Array.isArray(h?.condicoes) ? h.condicoes : []).map(String).filter((c) => CONDICAO_POR_ID[c.split(':')[0]]).slice(0, 4);
  const pm = num(h?.pm, 0, 999);
  return {
    nome: txt(h?.nome, 60),
    ativa: Boolean(h?.ativa),
    ...(h?.texto ? { texto: txt(h.texto, 3000) } : {}),
    ...(h?.execucao ? { execucao: txt(h.execucao, 30) } : {}),
    ...(pm ? { pm } : {}),
    ...(ALVOS_HABILIDADE.includes(String(h?.alvo)) ? { alvo: h.alvo as Habilidade['alvo'] } : {}),
    ...(dano && expressaoValida(dano) ? { dano } : {}),
    ...(tipoDano ? { tipoDano } : {}),
    ...(cura && expressaoValida(cura) ? { cura } : {}),
    ...(res ? { res, cd: num(h?.cd ?? 15, 1, 99), sucesso: h?.sucesso === 'anula' ? 'anula' as const : 'metade' as const } : {}),
    ...(condicoes.length ? { condicoes } : {}),
  };
}

const CAMPOS_DO_LADO: Record<Lado, string[]> = {
  aliados: ['nome', 'jogador', 'classe', 'nivel', 'imagem', 'cor', 'pv', 'pvMax', 'pvTemp', 'pm', 'pmMax', 'defesa', 'bonusIni', 'iniciativa'],
  inimigos: ['nome', 'subtitulo', 'nd', 'imagem', 'pv', 'pvMax', 'pvTemp', 'pm', 'pmMax', 'defesa', 'bonusIni', 'iniciativa', 'naTela', 'revelar', 'tema', 'tier', 'notas', 'habilidades', 'fort', 'ref', 'von', 'ataques', 'rd', 'imunidades', 'vulnerabilidades'],
};

export function aplicarCampos(ent: Entidade, lado: Lado, dados: Record<string, unknown>) {
  const alvo = ent as unknown as Record<string, unknown>;
  for (const campo of CAMPOS_DO_LADO[lado]) {
    if (dados[campo] !== undefined) alvo[campo] = CAMPOS[campo](dados[campo]);
  }
  ent.pv = Math.min(ent.pv, ent.pvMax);
  ent.pm = Math.min(ent.pm, ent.pmMax);
}

const comum = () => ({
  id: novoId(), nome: '', imagem: '', pv: 10, pvMax: 10, pvTemp: 0, pm: 0, pmMax: 0,
  defesa: 10, bonusIni: 0, iniciativa: null, condicoes: [] as string[],
});

export function baseHeroi(): Heroi {
  return { ...comum(), jogador: '', classe: '', nivel: 1, cor: '#e9c46a', fichaId: null };
}

export function baseInimigo(): Inimigo {
  return {
    ...comum(), subtitulo: '', nd: '', naTela: false, revelar: 'oculto', tema: 'trevas', tier: 'comum', notas: '',
    habilidades: [], fort: 0, ref: 0, von: 0, rd: {}, imunidades: [], vulnerabilidades: [], ataques: [], ameacaId: null,
  };
}

export function criar(lado: Lado, dados: Record<string, unknown> = {}): Entidade {
  const ent = lado === 'aliados' ? baseHeroi() : baseInimigo();
  aplicarCampos(ent, lado, { nome: 'Sem nome', ...dados });
  if (dados.pv === undefined) ent.pv = ent.pvMax;
  if (dados.pm === undefined) ent.pm = ent.pmMax;
  return ent;
}

// ---------------- estado inicial (mesa vazia) ----------------

const OPCOES_PADRAO = { importarPeloCelular: true, acaoSoNaVez: true, fichaLivre: true, zerarAntes: true, iniciativaUnica: true };
export const palcoVazio = (): Palco => ({ fundo: '', atores: [], destaque: null });
const cenaVazia = (): Cena => ({ modo: 'combate', bossId: null, idInvocacao: '', mostrar: null, palco: palcoVazio(), revelacao: null });

/** Mesa vazia: sem herois nem inimigos de exemplo. As fichas e o bestiario ficam em data/. */
export function estadoVazio(): Estado {
  return {
    versao: 3,
    aliados: [],
    inimigos: [],
    cena: cenaVazia(),
    turnos: { ativo: false, rodada: 1, atual: null, gasto: gastoNovo() },
    opcoes: { ...OPCOES_PADRAO },
    efeitos: [],
    temporizadores: [],
    pedidos: [],
  };
}

// ---------------- persistencia ----------------

// Completa campos que versoes antigas nao tinham. Assim o estado.json v2 abre sem perder nada.
export function migrar(bruto: unknown): Estado | null {
  const e = bruto as Omit<Partial<Estado>, 'versao'> & { versao?: number };
  if (!e || (e.versao !== 2 && e.versao !== 3) || !Array.isArray(e.aliados) || !Array.isArray(e.inimigos)) return null;
  const aliados = e.aliados.map((h) => ({ ...baseHeroi(), ...h }));
  const inimigos = e.inimigos.map((i) => ({ ...baseInimigo(), ...i }));
  return {
    versao: 3,
    aliados,
    inimigos,
    cena: { ...cenaVazia(), ...(e.cena ?? {}), palco: migrarPalco(e.cena?.palco) },
    turnos: { ativo: false, rodada: 1, atual: null, gasto: gastoNovo(), ...(e.turnos ?? {}) },
    opcoes: { ...OPCOES_PADRAO, ...(e.opcoes ?? {}) },
    efeitos: Array.isArray(e.efeitos) ? e.efeitos : [],
    temporizadores: Array.isArray(e.temporizadores) ? e.temporizadores : [],
    pedidos: Array.isArray(e.pedidos) ? e.pedidos : [],
  };
}

export function carregar(arquivo: string): Estado {
  try {
    const e = migrar(JSON.parse(fs.readFileSync(arquivo, 'utf8')));
    if (e) return e;
  } catch {
    // primeira execucao ou arquivo corrompido: comeca com a mesa vazia
  }
  return estadoVazio();
}

let timer: NodeJS.Timeout | undefined;
export function salvar(arquivo: string, estado: Estado) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify(estado, null, 2));
    } catch (erro) {
      console.warn('Nao consegui salvar o estado:', (erro as Error).message);
    }
  }, 300);
}

// ---------------- consultas ----------------

/** Tira efeitos da mesa; as condicoes que cada um impôs saem junto (se nenhum outro efeito as mantem). */
export function tirarEfeitos(estado: Estado, sai: (e: EfeitoAtivo) => boolean) {
  const saindo = estado.efeitos.filter(sai);
  if (!saindo.length) return saindo;
  estado.efeitos = estado.efeitos.filter((e) => !saindo.includes(e));
  for (const e of saindo) {
    for (const [alvoId, conds] of Object.entries(e.impostas ?? {})) {
      const a = buscar(estado, alvoId);
      if (!a) continue;
      const mantidas = new Set(estado.efeitos.flatMap((x) => x.impostas?.[alvoId] ?? []));
      a.ent.condicoes = a.ent.condicoes.filter((c) => !conds.includes(c) || mantidas.has(c));
      estado.temporizadores = estado.temporizadores.filter((t) => !(t.alvoId === alvoId && conds.includes(t.condicao) && !mantidas.has(t.condicao)));
    }
  }
  return saindo;
}

export function buscar(estado: Estado, id: string): { ent: Entidade; lado: Lado } | null {
  const h = estado.aliados.find((x) => x.id === id);
  if (h) return { ent: h, lado: 'aliados' };
  const i = estado.inimigos.find((x) => x.id === id);
  if (i) return { ent: i, lado: 'inimigos' };
  return null;
}

// Ordem de turno: quem tem iniciativa, do maior para o menor. Empate: maior bonus de Iniciativa
// age primeiro; persistindo, os herois antes dos inimigos (e depois a ordem da lista).
export function ordemDeTurno(estado: Estado) {
  return [
    ...estado.aliados.map((ent) => ({ ent: ent as Entidade, lado: 'aliados' as Lado })),
    ...estado.inimigos.map((ent) => ({ ent: ent as Entidade, lado: 'inimigos' as Lado })),
  ]
    .filter(({ ent }) => ent.iniciativa !== null && ent.iniciativa !== undefined)
    .sort((a, b) => (b.ent.iniciativa ?? 0) - (a.ent.iniciativa ?? 0)
      || (b.ent.bonusIni ?? 0) - (a.ent.bonusIni ?? 0)
      || (a.lado === b.lado ? 0 : a.lado === 'aliados' ? -1 : 1));
}

export const visivelParaTodos = (estado: Estado, ent: Inimigo) => ent.naTela || ent.id === estado.cena.bossId;

function rotuloDeEstado(pct: number) {
  if (pct <= 0) return 'Derrotado';
  if (pct <= 0.25) return 'Quase morto';
  if (pct <= 0.5) return 'Gravemente ferido';
  if (pct <= 0.75) return 'Ferido';
  if (pct < 1) return 'Arranhado';
  return 'Ileso';
}

function visaoInimigo(i: Inimigo): InimigoPublico {
  const pct = i.pvMax ? Math.max(0, i.pv) / i.pvMax : 0;
  const o: InimigoPublico = {
    id: i.id, nome: i.nome, subtitulo: i.subtitulo, nd: i.nd, imagem: i.imagem, condicoes: i.condicoes,
    revelar: i.revelar, tema: i.tema, tier: i.tier, caido: i.pv <= 0, iniciativa: i.iniciativa,
    habilidades: i.habilidades.filter((h) => h.ativa).map((h) => h.nome),
  };
  if (i.revelar === 'estado') o.rotulo = rotuloDeEstado(pct);
  if (i.revelar === 'barra' || i.revelar === 'numero') o.pct = pct;
  if (i.revelar === 'numero') Object.assign(o, { pv: i.pv, pvMax: i.pvMax, pvTemp: i.pvTemp });
  return o;
}

// O que herois e telao recebem: sem defesa, resistencias, notas nem PV de inimigo escondido.
export function visaoPublica(estado: Estado): EstadoPublico {
  const boss = estado.inimigos.find((i) => i.id === estado.cena.bossId);
  const ordem: FichaOrdem[] = estado.turnos.ativo
    ? ordemDeTurno(estado)
        .filter(({ ent, lado }) => lado === 'aliados' || visivelParaTodos(estado, ent as Inimigo))
        .map(({ ent, lado }) => ({
          id: ent.id, lado, nome: ent.nome, imagem: ent.imagem, iniciativa: ent.iniciativa ?? 0,
          cor: lado === 'aliados' ? (ent as Heroi).cor : null,
        }))
    : [];
  const atualVisivel = ordem.some((o) => o.id === estado.turnos.atual);
  return {
    aliados: estado.aliados,
    inimigos: estado.inimigos.filter((i) => visivelParaTodos(estado, i)).map(visaoInimigo),
    cena: { ...estado.cena, bossId: boss?.id ?? null },
    turnos: { ...estado.turnos, atual: atualVisivel ? estado.turnos.atual : null, ordem },
    opcoes: estado.opcoes,
    // Teste secreto: os outros so sabem que a pessoa ja rolou.
    pedidos: estado.pedidos.map((p) => (p.secreto
      ? { ...p, cd: null, respostas: Object.fromEntries(Object.keys(p.respostas).map((id) => [id, { total: null, passou: null }])) }
      : p)),
    efeitos: estado.efeitos.filter((e) => {
      // Efeito so em inimigos escondidos nao aparece.
      const alvosVisiveis = e.alvos.filter((id) => estado.aliados.some((h) => h.id === id) || estado.inimigos.some((i) => i.id === id && visivelParaTodos(estado, i)));
      return !e.alvos.length || alvosVisiveis.length > 0;
    }),
  };
}

export function filtrarEvento(estado: Estado, ev: Evento): Evento | null {
  if (ev.tipo === 'fx' || ev.lado !== 'inimigos') return ev;
  const alvo = estado.inimigos.find((i) => i.id === ev.alvo);
  if (!alvo || !visivelParaTodos(estado, alvo)) return null;
  return alvo.revelar === 'numero' ? ev : { ...ev, valor: null };
}

// ---------------- acoes do mestre ----------------

export type Acao = { tipo: string; [chave: string]: unknown };

function alvos(estado: Estado, ids: unknown) {
  const lista = (Array.isArray(ids) ? ids : [ids])
    .map((id) => buscar(estado, String(id)))
    .filter((x): x is { ent: Entidade; lado: Lado } => Boolean(x));
  if (!lista.length) throw new Error('Nenhum alvo valido.');
  return lista;
}

function aplicarValor({ ent, lado }: { ent: Entidade; lado: Lado }, modo: EventoValor['tipo'], valor: number, eventos: Evento[], zerarAntes: boolean) {
  const evento: EventoValor = { tipo: modo, alvo: ent.id, lado, nome: ent.nome, valor };
  if (modo === 'dano') {
    const absorvido = Math.min(ent.pvTemp, valor);
    ent.pvTemp -= absorvido;
    const antes = ent.pv;
    ent.pv = pvDepoisDoDano(ent.pv, valor - absorvido, ent.pvMax, lado === 'aliados', zerarAntes);
    if (antes > 0 && ent.pv <= 0) {
      evento.caiu = true;
      if (lado === 'aliados') for (const c of ['inconsciente', 'sangrando']) if (!ent.condicoes.includes(c)) ent.condicoes.push(c);
    }
  } else if (modo === 'cura') {
    ent.pv = Math.min(ent.pvMax, ent.pv + valor);
    ent.condicoes = ent.condicoes.filter((c) => c !== 'sangrando' && (ent.pv <= 0 || (c !== 'inconsciente' && c !== 'morrendo')));
  } else if (modo === 'temp') {
    ent.pvTemp = Math.max(ent.pvTemp, valor); // PV temporarios nao acumulam
  } else {
    ent.pm = modo === 'pmGasta' ? Math.max(0, ent.pm - valor) : Math.min(ent.pmMax, ent.pm + valor);
  }
  eventos.push(evento);
}

// Passa a vez. direcao = +1 / -1. Volta ao inicio da lista = nova rodada.
function moverTurno(estado: Estado, direcao: number) {
  const ordem = ordemDeTurno(estado);
  if (!ordem.length) throw new Error('Defina a iniciativa de alguem primeiro.');
  const t = estado.turnos;
  const pos = ordem.findIndex(({ ent }) => ent.id === t.atual);
  let prox = pos === -1 ? 0 : pos + direcao;
  if (prox >= ordem.length) { prox = 0; t.rodada += 1; }
  if (prox < 0) {
    if (t.rodada > 1) { t.rodada -= 1; prox = ordem.length - 1; } else prox = 0;
  }
  t.atual = ordem[prox].ent.id;
  t.gasto = gastoNovo();
  if (direcao > 0) aoIniciarTurno(estado, t.atual);
}

// Quem conta as rodadas das condicoes (regras.ts registra aqui para evitar import circular).
let aoIniciarTurno: (estado: Estado, id: string) => void = () => {};
let aoEncerrarCombate: (estado: Estado) => void = () => {};
export function ganchosDeTurno(inicio: typeof aoIniciarTurno, fim: typeof aoEncerrarCombate) {
  aoIniciarTurno = inicio;
  aoEncerrarCombate = fim;
}

const MODOS_VALOR: EventoValor['tipo'][] = ['dano', 'cura', 'temp', 'pmGasta', 'pmRecupera'];


// ---------------- palco do modo cena ----------------

/** Lugar livre no palco: o centro, depois o meio do maior vao entre quem ja esta na frente. */
function lugarLivre(p: Palco) {
  const naFrente = p.atores.filter((a) => a.y >= 70);
  if (!naFrente.length) return 50;
  const xs = [8, ...naFrente.map((a) => a.x).sort((a, b) => a - b), 92];
  let melhor = { vao: -1, x: 50 };
  for (let i = 1; i < xs.length; i++) {
    const vao = xs[i] - xs[i - 1];
    if (vao > melhor.vao) melhor = { vao, x: Math.round((xs[i] + xs[i - 1]) / 2) };
  }
  return melhor.x;
}

const Y_FRENTE = 90;

/** Em fila: todo mundo na frente, espalhado por igual, mantendo a ordem da esquerda para a direita. */
function organizar(p: Palco) {
  const ordem = [...p.atores].sort((a, b) => a.x - b.x);
  const n = ordem.length;
  ordem.forEach((a, i) => {
    a.x = n === 1 ? 50 : Math.round(12 + (76 * i) / (n - 1));
    a.y = Y_FRENTE;
  });
}

/** Em roda (ex.: em volta de uma mesa): numa elipse, os de tras menores. Comeca pela frente. */
function emRoda(p: Palco) {
  const n = p.atores.length;
  const ordem = [...p.atores].sort((a, b) => a.x - b.x);
  ordem.forEach((a, i) => {
    const ang = Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n); // pi/2 = frente
    a.x = Math.round(50 + 34 * Math.cos(ang));
    a.y = Math.round(72 + 18 * Math.sin(ang));
  });
}

/** Ator de um combatente da mesa (refId) ou NPC avulso (nome + imagem da galeria). */
export function novoAtor(estado: Estado, a: Record<string, unknown>): Ator {
  const p = estado.cena.palco;
  const x = lugarLivre(p);
  if (a.refId) {
    const { ent, lado } = alvos(estado, a.refId)[0];
    if (p.atores.some((y) => y.refId === ent.id)) throw new Error(`${ent.nome} já está na cena.`);
    return { id: novoId(), refId: ent.id, nome: ent.nome, imagem: ent.imagem, cor: lado === 'aliados' ? (ent as Heroi).cor : '#ff6b4a', x, y: Y_FRENTE, espelhar: x > 50, expressao: '' };
  }
  return {
    id: novoId(), refId: null, nome: txt(a.nome, 40) || 'NPC', imagem: imagemValida(a.imagem),
    cor: corValida(a.cor, '#c9b8ff'), x, y: Y_FRENTE, espelhar: x > 50, expressao: '',
  };
}

/** Palco de versoes anteriores (que tinha caixa de dialogo) vira o palco atual. */
function migrarPalco(bruto: Partial<Palco> | undefined): Palco {
  const atores = (Array.isArray(bruto?.atores) ? bruto.atores : []).map((a) => ({ ...a, y: a.y ?? Y_FRENTE, expressao: a.expressao ?? '' }));
  return { fundo: bruto?.fundo ?? '', atores, destaque: atores.some((a) => a.id === bruto?.destaque) ? bruto!.destaque! : null };
}

// ---------------- chefe final (Ameacas de Arton, p. 370) ----------------

/** "ND 1/2" -> 0.5, "ND 7" -> 7, "ND S" -> 20. */
export function valorNd(nd: string) {
  const m = /(\d+)\s*\/\s*(\d+)|(\d+)|S/i.exec(nd);
  if (!m) return 0;
  if (m[1]) return Number(m[1]) / Number(m[2]);
  if (m[3]) return Number(m[3]);
  return 20;
}

/** Patamar pelo ND (mesma divisao dos niveis: 1-4, 5-10, 11-16, 17+). */
export const patamarDoNd = (nd: number) => (nd >= 17 ? 'lenda' : nd >= 11 ? 'campeao' : nd >= 5 ? 'veterano' : 'iniciante');

/** Dobra o PV, +2 PM por ND, Maior que a Morte, RD 5/10/20 (veterano/campeao/lenda) e ND +2. */
export function tornarChefeFinal(i: Inimigo) {
  if (i.chefeFinal) throw new Error(`${i.nome} já é chefe final.`);
  const nd = valorNd(i.nd);
  i.pvMax *= 2;
  i.pv = Math.min(i.pvMax, i.pv * 2);
  if (i.pmMax) {
    const pm = Math.round(2 * nd);
    i.pmMax += pm;
    i.pm += pm;
  }
  if (!i.habilidades.some((h) => /maior que a morte/i.test(h.nome))) i.habilidades = [...i.habilidades, { nome: 'Maior que a Morte', ativa: true }];
  const rd = { veterano: 5, campeao: 10, lenda: 20, iniciante: 0 }[patamarDoNd(nd)];
  if (rd) i.rd = { ...i.rd, geral: (i.rd.geral ?? 0) + rd };
  if (i.nd) i.nd = `ND ${nd < 1 ? 2 : Math.round(nd) + 2}${/S/i.test(i.nd) ? '+' : ''}`;
  if (i.tier === 'comum') i.tier = 'epico';
  i.chefeFinal = true;
}

const ACOES: Record<string, (estado: Estado, a: Acao, eventos: Evento[]) => void> = {
  dano(estado, a, eventos) {
    const modo = MODOS_VALOR.includes(a.modo as EventoValor['tipo']) ? (a.modo as EventoValor['tipo']) : 'dano';
    const valor = num(a.valor, 0, 9999);
    if (!valor) throw new Error('Informe um valor maior que zero.');
    for (const alvo of alvos(estado, a.ids)) aplicarValor(alvo, modo, valor, eventos, estado.opcoes.zerarAntes);
  },

  definir(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    aplicarCampos(ent, lado, (a.patch ?? {}) as Record<string, unknown>);
  },

  criar(estado, a) {
    const lado: Lado = a.lado === 'inimigos' ? 'inimigos' : 'aliados';
    const ent = criar(lado, (a.dados ?? {}) as Record<string, unknown>);
    if (lado === 'aliados') estado.aliados.push(ent as Heroi);
    else estado.inimigos.push(ent as Inimigo);
  },

  duplicar(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    const copia = structuredClone(ent);
    copia.id = novoId();
    copia.iniciativa = null;
    const base = ent.nome.replace(/ \d+$/, '');
    const lista = estado[lado] as Entidade[];
    copia.nome = `${base} ${lista.filter((x) => x.nome.startsWith(base)).length + 1}`;
    lista.splice(lista.indexOf(ent) + 1, 0, copia);
  },

  remover(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    if (lado === 'aliados') estado.aliados = estado.aliados.filter((x) => x !== ent);
    else estado.inimigos = estado.inimigos.filter((x) => x !== ent);
    if (estado.cena.bossId === ent.id) estado.cena.bossId = null;
    if (estado.turnos.atual === ent.id) {
      estado.turnos.atual = null;
      if (estado.turnos.ativo && ordemDeTurno(estado).length) moverTurno(estado, 1);
    }
  },

  condicao(estado, a) {
    const id = String(a.condicao);
    if (!CONDICAO_POR_ID[id]) throw new Error('Condicao desconhecida.');
    for (const { ent } of alvos(estado, a.ids ?? a.id)) {
      const tem = ent.condicoes.includes(id);
      if (a.ligado && !tem) ent.condicoes.push(id);
      if (!a.ligado && tem) ent.condicoes = ent.condicoes.filter((c) => c !== id);
    }
  },

  cena(estado, a) {
    if (a.acao === 'retirar') {
      estado.cena.bossId = null;
      return;
    }
    const { ent, lado } = alvos(estado, a.id)[0];
    if (lado !== 'inimigos') throw new Error('So inimigos podem ser invocados.');
    estado.cena = { ...estado.cena, bossId: ent.id, idInvocacao: novoId() };
  },

  // ---------- testes pedidos aos celulares ----------

  pedirTeste(estado, a) {
    const pericia = txt(a.pericia, 40);
    if (!pericia) throw new Error('Escolha a perícia.');
    const ids = (Array.isArray(a.alvos) && a.alvos.length ? a.alvos.map(String) : estado.aliados.map((h) => h.id))
      .filter((id) => estado.aliados.some((h) => h.id === id));
    if (!ids.length) throw new Error('Nenhum herói na mesa.');
    const cd = a.cd === null || a.cd === undefined || a.cd === '' ? null : num(a.cd, 1, 99);
    estado.pedidos = [
      ...estado.pedidos.slice(-4),
      { id: novoId(), pericia, cd, secreto: Boolean(a.secreto), alvos: ids, respostas: {}, criadoEm: Date.now() },
    ];
  },

  fecharTeste(estado, a) {
    estado.pedidos = estado.pedidos.filter((p) => p.id !== a.id);
  },

  // ---------- modo cena (visual novel) ----------

  modo(estado, a) {
    estado.cena.modo = a.modo === 'roleplay' ? 'roleplay' : 'combate';
  },

  palco(estado, a) {
    const p = estado.cena.palco;
    const ator = () => {
      const x = p.atores.find((y) => y.id === a.atorId);
      if (!x) throw new Error('Esse personagem não está na cena.');
      return x;
    };
    switch (a.acao) {
      case 'fundo': {
        const fundo = a.imagem ? imagemValida(a.imagem) : '';
        if (a.imagem && !fundo) throw new Error('Imagem inválida.');
        p.fundo = fundo;
        break;
      }
      case 'entrar': {
        if (p.atores.length >= 8) throw new Error('No máximo 8 personagens em cena.');
        p.atores.push(novoAtor(estado, a));
        break;
      }
      case 'mover': {
        const x = ator();
        x.x = num(a.x, 0, 100);
        if (a.y !== undefined) x.y = num(a.y, 0, 100);
        break;
      }
      case 'espelhar': { const x = ator(); x.espelhar = !x.espelhar; break; }
      case 'frente': { const x = ator(); p.atores = [...p.atores.filter((y) => y !== x), x]; break; }
      case 'sair': {
        const x = ator();
        p.atores = p.atores.filter((y) => y !== x);
        if (p.destaque === x.id) p.destaque = null;
        break;
      }
      // Clicar em quem ja esta em destaque tira o destaque.
      case 'destacar': p.destaque = a.atorId && p.destaque !== a.atorId ? ator().id : null; break;
      case 'expressao': {
        const x = ator();
        const img = a.imagem ? imagemValida(a.imagem) : '';
        if (a.imagem && !img) throw new Error('Imagem inválida.');
        x.expressao = img;
        break;
      }
      case 'organizar': organizar(p); break;
      case 'roda': emRoda(p); break;
      case 'limpar': p.atores = []; p.destaque = null; break;
      default: throw new Error('Ação de cena desconhecida.');
    }
  },

  // Imagem em destaque no telao ("mostrar aos jogadores"). Trocar so o titulo nao reabre a animacao.
  mostrar(estado, a) {
    if (a.acao === 'esconder') {
      estado.cena.mostrar = null;
      return;
    }
    const imagem = imagemValida(a.imagem);
    if (!imagem) throw new Error('Imagem invalida.');
    const atual = estado.cena.mostrar;
    estado.cena.mostrar = { imagem, titulo: txt(a.titulo, 80), id: atual?.imagem === imagem ? atual.id : novoId() };
  },

  fx(_estado, a, eventos) {
    if (!EFEITOS.some((e) => e.id === a.efeito)) throw new Error('Efeito desconhecido.');
    eventos.push({ tipo: 'fx', efeito: String(a.efeito) });
  },

  /** Tira todos os inimigos da mesa de uma vez (um desfazer so). */
  limparInimigos(estado) {
    estado.inimigos = [];
    estado.cena.bossId = null;
    if (estado.turnos.atual && !estado.aliados.some((h) => h.id === estado.turnos.atual)) estado.turnos.atual = null;
  },

  chefeFinal(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    if (lado !== 'inimigos') throw new Error('Só inimigos viram chefe final.');
    tornarChefeFinal(ent as Inimigo);
  },

  descanso(estado) {
    for (const h of estado.aliados) {
      h.pv = h.pvMax;
      h.pm = h.pmMax;
      h.pvTemp = 0;
      h.condicoes = [];
    }
    estado.temporizadores = [];
    tirarEfeitos(estado, (e) => e.persistente !== 'longa');
  },

  iniciativa(estado, a) {
    for (const { ent } of alvos(estado, a.id)) ent.iniciativa = CAMPOS.iniciativa(a.valor) as number | null;
  },

  rolarIniciativa(estado, a) {
    const ids = Array.isArray(a.ids) ? a.ids : [];
    const lista = (ids.length ? alvos(estado, ids) : [
      ...estado.aliados.map((ent) => ({ ent: ent as Entidade, lado: 'aliados' as Lado })),
      ...estado.inimigos.map((ent) => ({ ent: ent as Entidade, lado: 'inimigos' as Lado })),
    ]).filter(({ ent }) => !(a.somenteVazios && ent.iniciativa !== null));
    const d20 = () => randomInt(1, 21);
    // Regra do livro: os inimigos fazem um teste so, com o menor bonus entre eles.
    const inimigos = lista.filter(({ lado }) => lado === 'inimigos');
    if (estado.opcoes.iniciativaUnica && inimigos.length) {
      const valor = d20() + Math.min(...inimigos.map(({ ent }) => ent.bonusIni ?? 0));
      for (const { ent } of inimigos) ent.iniciativa = valor;
    }
    for (const { ent, lado } of lista) {
      if (lado === 'inimigos' && estado.opcoes.iniciativaUnica) continue;
      ent.iniciativa = d20() + (ent.bonusIni ?? 0);
    }
  },

  turno(estado, a) {
    const t = estado.turnos;
    if (a.acao === 'iniciar') {
      if (!ordemDeTurno(estado).length) throw new Error('Defina a iniciativa de alguem primeiro.');
      t.ativo = true;
      t.rodada = 1;
      t.atual = ordemDeTurno(estado)[0].ent.id;
      t.gasto = gastoNovo();
      aoIniciarTurno(estado, t.atual);
    } else if (a.acao === 'encerrar') {
      t.ativo = false;
      t.atual = null;
      t.rodada = 1;
      aoEncerrarCombate(estado);
    } else if (a.acao === 'proximo') {
      moverTurno(estado, 1);
    } else if (a.acao === 'anterior') {
      moverTurno(estado, -1);
    } else if (a.acao === 'definir') {
      alvos(estado, a.id);
      t.atual = String(a.id);
      t.ativo = true;
      t.gasto = gastoNovo();
    } else if (a.acao === 'liberarAcoes') {
      // O mestre devolve as acoes de quem esta na vez (engano, poder que da acao extra...).
      t.gasto = gastoNovo();
    }
  },

  encerrarEfeito(estado, a) {
    if (!tirarEfeitos(estado, (e) => e.id === a.id).length) throw new Error('Esse efeito já acabou.');
  },

  opcoes(estado, a) {
    const o = (a.opcoes ?? {}) as Record<string, unknown>;
    if (o.importarPeloCelular !== undefined) estado.opcoes.importarPeloCelular = Boolean(o.importarPeloCelular);
    if (o.acaoSoNaVez !== undefined) estado.opcoes.acaoSoNaVez = Boolean(o.acaoSoNaVez);
    if (o.fichaLivre !== undefined) estado.opcoes.fichaLivre = Boolean(o.fichaLivre);
    if (o.zerarAntes !== undefined) estado.opcoes.zerarAntes = Boolean(o.zerarAntes);
    if (o.iniciativaUnica !== undefined) estado.opcoes.iniciativaUnica = Boolean(o.iniciativaUnica);
  },
};

// Aplica uma acao do mestre. Devolve os eventos (numeros flutuantes, efeitos).
export function executar(estado: Estado, acao: Acao): Evento[] {
  const funcao = ACOES[acao?.tipo];
  if (!funcao) throw new Error('Acao desconhecida.');
  const eventos: Evento[] = [];
  funcao(estado, acao, eventos);
  return eventos;
}

export const ACAO_SEM_HISTORICO = new Set(['fx', 'palco']);
