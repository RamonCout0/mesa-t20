// Estado da mesa: herois, inimigos, boss em cena e ordem de turno.
// Toda regra de "quem pode ver o que" mora aqui (visaoPublica / filtrarEvento),
// no servidor, para que nada escondido saia pela rede.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CONDICAO_POR_ID, TEMAS, TIERS, REVELAR, EFEITOS } from '../public/condicoes.js';

const novoId = () => randomUUID().slice(0, 8);

// ---------------- validacao ----------------

const num = (v, min = 0, max = 9999) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const txt = (v, max = 60) => String(v ?? '').trim().slice(0, max);
const corValida = (v, padrao) => (/^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : padrao);
const imagemValida = (v) => (/^\/(personagens|bosses|galeria)\/[^/\\]+$/.test(v ?? '') && !String(v).includes('..') ? v : '');
const daLista = (lista, padrao) => (v) => (lista.includes(v) ? v : padrao);

const CAMPOS = {
  nome: (v) => txt(v, 40) || 'Sem nome',
  jogador: (v) => txt(v, 30),
  classe: (v) => txt(v, 30),
  nivel: (v) => num(v, 1, 20),
  subtitulo: (v) => txt(v, 70),
  nd: (v) => txt(v, 8),
  imagem: imagemValida,
  cor: (v) => corValida(v, '#e9c46a'),
  pv: (v) => num(v, 0, 9999),
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
  notas: (v) => txt(v, 600),
  habilidades: (v) =>
    (Array.isArray(v) ? v : [])
      .slice(0, 12)
      .map((h) => ({ nome: txt(h?.nome, 40), ativa: Boolean(h?.ativa) }))
      .filter((h) => h.nome),
};

const CAMPOS_DO_LADO = {
  aliados: ['nome', 'jogador', 'classe', 'nivel', 'imagem', 'cor', 'pv', 'pvMax', 'pvTemp', 'pm', 'pmMax', 'defesa', 'bonusIni', 'iniciativa'],
  inimigos: ['nome', 'subtitulo', 'nd', 'imagem', 'pv', 'pvMax', 'pvTemp', 'defesa', 'bonusIni', 'iniciativa', 'naTela', 'revelar', 'tema', 'tier', 'notas', 'habilidades'],
};

function aplicarCampos(ent, lado, dados) {
  for (const campo of CAMPOS_DO_LADO[lado]) {
    if (dados[campo] !== undefined) ent[campo] = CAMPOS[campo](dados[campo]);
  }
  ent.pv = Math.min(ent.pv, ent.pvMax);
  if (lado === 'aliados') ent.pm = Math.min(ent.pm, ent.pmMax);
}

function base(lado) {
  const comum = { id: novoId(), nome: '', imagem: '', pv: 10, pvMax: 10, pvTemp: 0, defesa: 10, bonusIni: 0, iniciativa: null, condicoes: [] };
  return lado === 'aliados'
    ? { ...comum, jogador: '', classe: '', nivel: 1, cor: '#e9c46a', pm: 0, pmMax: 0 }
    : { ...comum, subtitulo: '', nd: '', naTela: false, revelar: 'oculto', tema: 'trevas', tier: 'comum', notas: '', habilidades: [] };
}

function criar(lado, dados = {}) {
  const ent = base(lado);
  aplicarCampos(ent, lado, { nome: 'Sem nome', ...dados });
  if (dados.pv === undefined) ent.pv = ent.pvMax;
  if (lado === 'aliados' && dados.pm === undefined) ent.pm = ent.pmMax;
  return ent;
}

// ---------------- estado inicial (demonstracao) ----------------

export function estadoDemo() {
  return {
    versao: 2,
    aliados: [
      criar('aliados', { nome: 'Aldric', jogador: 'Jogador 1', classe: 'Guerreiro', nivel: 5, pvMax: 62, pmMax: 15, defesa: 24, cor: '#d9534f', imagem: '/personagens/aldric.svg', bonusIni: 2 }),
      criar('aliados', { nome: 'Lyra', jogador: 'Jogador 2', classe: 'Arcanista', nivel: 5, pvMax: 31, pmMax: 34, defesa: 17, cor: '#9b6bff', imagem: '/personagens/lyra.svg', bonusIni: 3 }),
      criar('aliados', { nome: 'Thorn', jogador: 'Jogador 3', classe: 'Caçador', nivel: 5, pvMax: 48, pmMax: 20, defesa: 21, cor: '#4caf6e', imagem: '/personagens/thorn.svg', bonusIni: 5 }),
      criar('aliados', { nome: 'Mirela', jogador: 'Jogador 4', classe: 'Clériga', nivel: 5, pvMax: 44, pmMax: 28, defesa: 20, cor: '#f2c94c', imagem: '/personagens/mirela.svg', bonusIni: 1 }),
      criar('aliados', { nome: 'Brom', jogador: 'Jogador 5', classe: 'Bárbaro', nivel: 5, pvMax: 70, pmMax: 10, defesa: 22, cor: '#ff8c42', imagem: '/personagens/brom.svg', bonusIni: 1 }),
      criar('aliados', { nome: 'Seren', jogador: 'Jogador 6', classe: 'Bardo', nivel: 5, pvMax: 38, pmMax: 26, defesa: 19, cor: '#3ec9c0', imagem: '/personagens/seren.svg', bonusIni: 4 }),
    ],
    inimigos: [
      criar('inimigos', {
        nome: 'Ignarax', subtitulo: 'O Dragão das Cinzas', nd: 'ND 9', imagem: '/bosses/dragao.svg',
        pvMax: 320, defesa: 28, tema: 'fogo', tier: 'lendario', revelar: 'oculto', naTela: true, bonusIni: 6,
        notas: 'Sopro de fogo a cada 1d4 rodadas. Fase 2 com metade dos PV: voa e ganha +2 na Defesa.',
        habilidades: [
          { nome: 'Aura de calor', ativa: true },
          { nome: 'Imune a fogo', ativa: true },
          { nome: 'Sopro de fogo', ativa: false },
          { nome: 'Fúria da fênix', ativa: false },
        ],
      }),
      criar('inimigos', { nome: 'Cultista das Cinzas', subtitulo: 'Fanático', nd: 'ND 2', imagem: '/bosses/cultista.svg', pvMax: 28, defesa: 14, tema: 'fogo', revelar: 'estado', naTela: true, bonusIni: 1 }),
      criar('inimigos', { nome: 'Cultista das Cinzas 2', subtitulo: 'Fanático', nd: 'ND 2', imagem: '/bosses/cultista.svg', pvMax: 28, defesa: 14, tema: 'fogo', revelar: 'estado', naTela: true, bonusIni: 1 }),
      criar('inimigos', { nome: 'Sentinela Rúnico', subtitulo: 'Construto', nd: 'ND 5', imagem: '/bosses/golem.svg', pvMax: 90, defesa: 22, tema: 'arcano', revelar: 'oculto', naTela: false, bonusIni: 0, notas: 'Emboscada: só aparece quando o mestre revelar.' }),
    ],
    cena: { bossId: null, idInvocacao: '', mostrar: null },
    turnos: { ativo: false, rodada: 1, atual: null },
  };
}

// ---------------- persistencia ----------------

export function carregar(arquivo) {
  try {
    const e = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    if (e?.versao === 2 && Array.isArray(e.aliados) && Array.isArray(e.inimigos)) return e;
  } catch {
    // primeira execucao ou arquivo corrompido: comeca da demonstracao
  }
  return estadoDemo();
}

let timer = null;
export function salvar(arquivo, estado) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify(estado, null, 2));
    } catch (erro) {
      console.warn('Nao consegui salvar o estado:', erro.message);
    }
  }, 300);
}

// ---------------- consultas ----------------

function buscar(estado, id) {
  for (const lado of ['aliados', 'inimigos']) {
    const ent = estado[lado].find((x) => x.id === id);
    if (ent) return { ent, lado };
  }
  return null;
}

// Ordem de turno: quem tem iniciativa, do maior para o menor (empate: ordem da lista).
export function ordemDeTurno(estado) {
  return [
    ...estado.aliados.map((ent) => ({ ent, lado: 'aliados' })),
    ...estado.inimigos.map((ent) => ({ ent, lado: 'inimigos' })),
  ]
    .filter(({ ent }) => ent.iniciativa !== null && ent.iniciativa !== undefined)
    .sort((a, b) => b.ent.iniciativa - a.ent.iniciativa);
}

const visivelParaTodos = (estado, ent) => ent.naTela || ent.id === estado.cena.bossId;

function rotuloDeEstado(pct) {
  if (pct <= 0) return 'Derrotado';
  if (pct <= 0.25) return 'Quase morto';
  if (pct <= 0.5) return 'Gravemente ferido';
  if (pct <= 0.75) return 'Ferido';
  if (pct < 1) return 'Arranhado';
  return 'Ileso';
}

function visaoInimigo(i) {
  const pct = i.pvMax ? i.pv / i.pvMax : 0;
  const o = {
    id: i.id, nome: i.nome, subtitulo: i.subtitulo, nd: i.nd, imagem: i.imagem, condicoes: i.condicoes,
    revelar: i.revelar, tema: i.tema, tier: i.tier, caido: i.pv <= 0, iniciativa: i.iniciativa,
    habilidades: i.habilidades.filter((h) => h.ativa).map((h) => h.nome),
  };
  if (i.revelar === 'estado') o.rotulo = rotuloDeEstado(pct);
  if (i.revelar === 'barra' || i.revelar === 'numero') o.pct = pct;
  if (i.revelar === 'numero') Object.assign(o, { pv: i.pv, pvMax: i.pvMax, pvTemp: i.pvTemp });
  return o;
}

// O que herois e telao recebem: sem defesa, notas nem PV de inimigo escondido.
export function visaoPublica(estado) {
  const boss = estado.inimigos.find((i) => i.id === estado.cena.bossId);
  const ordem = estado.turnos.ativo
    ? ordemDeTurno(estado)
        .filter(({ ent, lado }) => lado === 'aliados' || visivelParaTodos(estado, ent))
        .map(({ ent, lado }) => ({ id: ent.id, lado, nome: ent.nome, imagem: ent.imagem, iniciativa: ent.iniciativa, cor: ent.cor ?? null }))
    : [];
  const atualVisivel = ordem.some((o) => o.id === estado.turnos.atual);
  return {
    aliados: estado.aliados,
    inimigos: estado.inimigos.filter((i) => visivelParaTodos(estado, i)).map(visaoInimigo),
    cena: { bossId: boss?.id ?? null, idInvocacao: estado.cena.idInvocacao, mostrar: estado.cena.mostrar ?? null },
    turnos: { ativo: estado.turnos.ativo, rodada: estado.turnos.rodada, atual: atualVisivel ? estado.turnos.atual : null, ordem },
  };
}

export function filtrarEvento(estado, ev) {
  if (ev.lado !== 'inimigos') return ev;
  const alvo = estado.inimigos.find((i) => i.id === ev.alvo);
  if (!alvo || !visivelParaTodos(estado, alvo)) return null;
  return alvo.revelar === 'numero' ? ev : { ...ev, valor: null };
}

// ---------------- acoes do mestre ----------------

function alvos(estado, ids) {
  const lista = (Array.isArray(ids) ? ids : [ids]).map((id) => buscar(estado, id)).filter(Boolean);
  if (!lista.length) throw new Error('Nenhum alvo valido.');
  return lista;
}

function aplicarValor({ ent, lado }, modo, valor, eventos) {
  const evento = { tipo: modo, alvo: ent.id, lado, nome: ent.nome, valor };
  if (modo === 'dano') {
    const absorvido = Math.min(ent.pvTemp, valor);
    ent.pvTemp -= absorvido;
    const antes = ent.pv;
    ent.pv = Math.max(0, ent.pv - (valor - absorvido));
    if (antes > 0 && ent.pv === 0) evento.caiu = true;
  } else if (modo === 'cura') {
    ent.pv = Math.min(ent.pvMax, ent.pv + valor);
  } else if (modo === 'temp') {
    ent.pvTemp = Math.max(ent.pvTemp, valor); // PV temporarios nao acumulam
  } else if (lado === 'aliados') {
    ent.pm = modo === 'pmGasta' ? Math.max(0, ent.pm - valor) : Math.min(ent.pmMax, ent.pm + valor);
  } else {
    return;
  }
  eventos.push(evento);
}

// Passa a vez. direcao = +1 / -1. Volta ao inicio da lista = nova rodada.
function moverTurno(estado, direcao) {
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
}

const ACOES = {
  dano(estado, a, eventos) {
    const modo = ['dano', 'cura', 'temp', 'pmGasta', 'pmRecupera'].includes(a.modo) ? a.modo : 'dano';
    const valor = num(a.valor, 0, 9999);
    if (!valor) throw new Error('Informe um valor maior que zero.');
    for (const alvo of alvos(estado, a.ids)) aplicarValor(alvo, modo, valor, eventos);
  },

  definir(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    aplicarCampos(ent, lado, a.patch ?? {});
  },

  criar(estado, a) {
    const lado = a.lado === 'inimigos' ? 'inimigos' : 'aliados';
    estado[lado].push(criar(lado, a.dados ?? {}));
  },

  duplicar(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    const copia = JSON.parse(JSON.stringify(ent));
    copia.id = novoId();
    copia.iniciativa = null;
    copia.nome = `${ent.nome.replace(/ \d+$/, '')} ${estado[lado].filter((x) => x.nome.startsWith(ent.nome.replace(/ \d+$/, ''))).length + 1}`;
    estado[lado].splice(estado[lado].indexOf(ent) + 1, 0, copia);
  },

  remover(estado, a) {
    const { ent, lado } = alvos(estado, a.id)[0];
    estado[lado] = estado[lado].filter((x) => x !== ent);
    if (estado.cena.bossId === ent.id) estado.cena.bossId = null;
    if (estado.turnos.atual === ent.id) {
      estado.turnos.atual = null;
      if (estado.turnos.ativo && ordemDeTurno(estado).length) moverTurno(estado, 1);
    }
  },

  condicao(estado, a) {
    if (!CONDICAO_POR_ID[a.condicao]) throw new Error('Condicao desconhecida.');
    for (const { ent } of alvos(estado, a.ids ?? a.id)) {
      const tem = ent.condicoes.includes(a.condicao);
      if (a.ligado && !tem) ent.condicoes.push(a.condicao);
      if (!a.ligado && tem) ent.condicoes = ent.condicoes.filter((c) => c !== a.condicao);
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

  fx(estado, a, eventos) {
    if (!EFEITOS.some((e) => e.id === a.efeito)) throw new Error('Efeito desconhecido.');
    eventos.push({ tipo: 'fx', efeito: a.efeito });
  },

  descanso(estado) {
    for (const h of estado.aliados) {
      h.pv = h.pvMax;
      h.pm = h.pmMax;
      h.pvTemp = 0;
      h.condicoes = [];
    }
  },

  iniciativa(estado, a) {
    for (const { ent } of alvos(estado, a.id)) ent.iniciativa = CAMPOS.iniciativa(a.valor);
  },

  rolarIniciativa(estado, a) {
    const lista = a.ids?.length ? alvos(estado, a.ids) : [...estado.aliados.map((ent) => ({ ent })), ...estado.inimigos.map((ent) => ({ ent }))];
    for (const { ent } of lista) {
      if (a.somenteVazios && ent.iniciativa !== null) continue;
      ent.iniciativa = 1 + Math.floor(Math.random() * 20) + (ent.bonusIni ?? 0);
    }
  },

  turno(estado, a) {
    const t = estado.turnos;
    if (a.acao === 'iniciar') {
      if (!ordemDeTurno(estado).length) throw new Error('Defina a iniciativa de alguem primeiro.');
      t.ativo = true;
      t.rodada = 1;
      t.atual = ordemDeTurno(estado)[0].ent.id;
    } else if (a.acao === 'encerrar') {
      t.ativo = false;
      t.atual = null;
      t.rodada = 1;
    } else if (a.acao === 'proximo') {
      moverTurno(estado, 1);
    } else if (a.acao === 'anterior') {
      moverTurno(estado, -1);
    } else if (a.acao === 'definir') {
      alvos(estado, a.id);
      t.atual = a.id;
      t.ativo = true;
    }
  },
};

// Aplica uma acao do mestre. Devolve os eventos (numeros flutuantes, efeitos).
export function executar(estado, acao) {
  const funcao = ACOES[acao?.tipo];
  if (!funcao) throw new Error('Acao desconhecida.');
  const eventos = [];
  funcao(estado, acao, eventos);
  return eventos;
}

export const ACAO_SEM_HISTORICO = new Set(['fx']);
