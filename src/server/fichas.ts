// Fichas dos jogadores, uma por arquivo em data/fichas/<id>.json.
// A ficha e a fonte da verdade do personagem; o heroi no estado da mesa so aponta para ela
// (fichaId) e copia o que o telao precisa (nome, PV max, Defesa...).

import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { PERICIAS, type Ficha, type MagiaPropria, type Pericia, type Poder } from '../shared/ficha.ts';
import { ATRIBUTOS, TIPOS_DANO, type Atributo, type Estado, type Heroi, type TipoDano } from '../shared/tipos.ts';
import { baseHeroi, novoId, num, txt, imagemValida, validarAtaques } from './estado.ts';
import { buscarMagia } from '../shared/magias.ts';
import { CONDICAO_POR_ID } from '../shared/condicoes.ts';
import { DADOS_3D } from '../shared/dados-3d.ts';

// Sem letras que confundem (0/O, 1/I/L) para quem digitar o codigo.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class Fichas {
  private readonly dir: string;
  private readonly lixeira: string;
  private readonly todas = new Map<string, Ficha>();

  constructor(raiz: string) {
    this.dir = path.join(raiz, 'data', 'fichas');
    this.lixeira = path.join(this.dir, 'lixeira');
    fs.mkdirSync(this.dir, { recursive: true });
    for (const arq of fs.readdirSync(this.dir).filter((a) => a.endsWith('.json'))) {
      try {
        const f = JSON.parse(fs.readFileSync(path.join(this.dir, arq), 'utf8')) as Ficha;
        if (f?.id && f.codigo) this.todas.set(f.id, { ...f, magiasProprias: f.magiasProprias ?? [], itens: f.itens ?? [] });
      } catch {
        console.warn(`Ficha ilegivel ignorada: data/fichas/${arq}`);
      }
    }
  }

  lista() {
    return [...this.todas.values()].sort((a, b) => a.criadaEm - b.criadaEm);
  }

  porId(id: string) {
    return this.todas.get(id);
  }

  porCodigo(codigo: string) {
    const c = codigo.trim().toUpperCase();
    return c ? this.lista().find((f) => f.codigo === c) : undefined;
  }

  private novoCodigo() {
    for (;;) {
      const c = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
      if (!this.porCodigo(c)) return c;
    }
  }

  private gravar(f: Ficha) {
    f.atualizadaEm = Date.now();
    this.todas.set(f.id, f);
    fs.writeFileSync(path.join(this.dir, `${f.id}.json`), JSON.stringify(f, null, 2));
  }

  criar(dados: Omit<Ficha, 'id' | 'codigo' | 'criadaEm' | 'atualizadaEm'>) {
    const agora = Date.now();
    const f: Ficha = { ...dados, id: novoId(), codigo: this.novoCodigo(), criadaEm: agora, atualizadaEm: agora };
    this.gravar(f);
    return f;
  }

  /** Reimportar o PDF atualiza a ficha mas preserva o que o jogador escolheu na mesa. */
  substituir(id: string, dados: Omit<Ficha, 'id' | 'codigo' | 'criadaEm' | 'atualizadaEm'>) {
    const atual = this.exigir(id);
    const f: Ficha = {
      ...dados,
      id: atual.id, codigo: atual.codigo, criadaEm: atual.criadaEm, atualizadaEm: atual.atualizadaEm,
      jogador: atual.jogador, imagem: atual.imagem, cor: atual.cor, dado: atual.dado, notas: atual.notas,
      // O que foi criado aqui na mesa nao existe no PDF: continua.
      magiasProprias: atual.magiasProprias, itens: atual.itens,
    };
    this.gravar(f);
    return f;
  }

  exigir(id: string) {
    const f = this.todas.get(id);
    if (!f) throw new Error('Ficha não encontrada.');
    return f;
  }

  /** Campos que o jogador (ou o mestre) pode mudar a mao. */
  /**
   * Edicao da ficha. Aparencia (cor, dado, foto, notas) qualquer um muda; o resto so com `completo`
   * (o mestre, ou o jogador quando o mestre deixa editar a propria ficha).
   */
  editar(id: string, patch: Record<string, unknown>, completo: boolean) {
    const f = this.exigir(id);
    if (patch.jogador !== undefined) f.jogador = txt(patch.jogador, 30);
    if (patch.cor !== undefined && /^#[0-9a-fA-F]{6}$/.test(String(patch.cor))) f.cor = String(patch.cor);
    if (patch.dado !== undefined && DADOS_3D.some((d) => d.id === patch.dado)) f.dado = String(patch.dado);
    if (patch.notas !== undefined) f.notas = txt(patch.notas, 4000);
    if (patch.imagem !== undefined) f.imagem = imagemValida(patch.imagem);
    if (patch.atributoChave !== undefined) {
      f.atributoChave = ATRIBUTOS.includes(patch.atributoChave as Atributo) ? (patch.atributoChave as Atributo) : null;
    }
    if (patch.bonusCd !== undefined) f.bonusCd = num(patch.bonusCd, -10, 20);
    if (completo) editarRegras(f, patch);
    this.gravar(f);
    return f;
  }

  /** Ficha em branco (sem PDF), para preencher no editor. */
  criarEmBranco(nome: string) {
    return this.criar(fichaEmBranco(nome));
  }

  /**
   * Ficha vinda de um arquivo (backup ou "Baixar ficha"). Mesmo id: atualiza. Novo: cria, mantendo o
   * codigo do celular se ele estiver livre. Tudo passa pela mesma validacao da edicao.
   */
  restaurar(dados: Record<string, unknown>, manterId = true) {
    const id = manterId && /^[\w-]{4,20}$/.test(String(dados.id)) ? String(dados.id) : novoId();
    if (!this.todas.has(id)) {
      const pedido = String(dados.codigo ?? '');
      const codigo = manterId && /^[A-Z0-9]{6}$/.test(pedido) && !this.porCodigo(pedido) ? pedido : this.novoCodigo();
      const agora = Date.now();
      this.gravar({ ...fichaEmBranco(String(dados.nome ?? '')), fonte: dados.fonte === 'nimb' ? 'nimb' : 'manual', id, codigo, criadaEm: agora, atualizadaEm: agora });
    }
    return this.editar(id, dados, true);
  }

  novoCodigoPara(id: string) {
    const f = this.exigir(id);
    f.codigo = this.novoCodigo();
    this.gravar(f);
    return f;
  }

  /** Remover nao apaga: o arquivo vai para data/fichas/lixeira/. */
  remover(id: string) {
    this.exigir(id);
    fs.mkdirSync(this.lixeira, { recursive: true });
    fs.renameSync(path.join(this.dir, `${id}.json`), path.join(this.lixeira, `${id}-${Date.now()}.json`));
    this.todas.delete(id);
  }
}

// ---------------- ligacao ficha <-> heroi na mesa ----------------

export const iniciativaDa = (f: Ficha) => f.pericias.Iniciativa?.total ?? f.atributos.des;

/** Copia para o heroi o que vem da ficha, sem mexer no PV/PM atual (so limita ao novo maximo). */
export function sincronizarHeroi(h: Heroi, f: Ficha) {
  Object.assign(h, {
    nome: f.nome, classe: f.classe, nivel: f.nivel, jogador: f.jogador || h.jogador,
    pvMax: f.pvMax, pmMax: f.pmMax, defesa: f.defesa, bonusIni: iniciativaDa(f),
    imagem: f.imagem || h.imagem, cor: f.cor, fichaId: f.id,
  });
  h.pv = Math.min(h.pv, h.pvMax);
  h.pm = Math.min(h.pm, h.pmMax);
}

export function heroiDaFicha(estado: Estado, f: Ficha) {
  return estado.aliados.find((h) => h.fichaId === f.id);
}

/** Poe o personagem da ficha na mesa (se ainda nao estiver) com PV e PM cheios. */
export function colocarNaMesa(estado: Estado, f: Ficha) {
  const ja = heroiDaFicha(estado, f);
  if (ja) {
    sincronizarHeroi(ja, f);
    return ja;
  }
  const h = baseHeroi();
  sincronizarHeroi(h, f);
  h.pv = f.pvMax;
  h.pm = f.pmMax;
  estado.aliados.push(h);
  return h;
}

/** O que vai para o celular do proprio jogador. */
export const fichaDoJogador = (f: Ficha) => f;

// ---------------- edicao completa (homebrew, itens, magias proprias) ----------------

const ARQUETIPOS_ANIM = ['projetil', 'raio', 'explosao', 'cone', 'toque', 'queda', 'chao', 'aura', 'cura', 'mental', 'ilusao', 'dreno',
  'convocacao', 'adivinhacao', 'campo', 'teleporte', 'escudo', 'transmutacao', 'tempo', 'arma', 'sopro', 'onda', 'palavra'];
const ELEMENTOS = ['fogo', 'frio', 'eletricidade', 'acido', 'luz', 'trevas', 'arcano', 'psiquico', 'natureza', 'terra', 'agua', 'ar', 'som',
  'veneno', 'sangue', 'tormenta', 'ouro', 'caos', 'metal', 'espirito', 'tempo'];
const ALVOS = ['inimigo', 'inimigos', 'aliado', 'aliados', 'si', 'qualquer', 'nenhum'];

const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
/** Numero que pode faltar (vazio = 0, nao o minimo). */
const opcional = (v: unknown, min: number, max: number) => (v === undefined || v === null || v === '' ? 0 : num(v, min, max));
const tipoDano = (v: unknown) => ((TIPOS_DANO as readonly string[]).includes(String(v)) ? (v as TipoDano) : undefined);
const expressao = (v: unknown) => {
  const s = String(v ?? '').replace(/\s/g, '').slice(0, 40);
  return /^(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/i.test(s) ? s : undefined;
};

/** Poderes e itens: nome e texto; os usaveis tambem tem custo, efeito na mesa e bonus enquanto ativos. */
function textos(v: unknown, max: number): Poder[] {
  return lista(v, max).map((p) => {
    const pm = num(p?.pm, 0, 30);
    const b = (p?.bonus ?? {}) as Record<string, unknown>;
    const bonus = { ataque: opcional(b.ataque, -10, 20), dano: opcional(b.dano, -10, 30), defesa: opcional(b.defesa, -10, 20) };
    const temBonus = Boolean(bonus.ataque || bonus.dano || bonus.defesa);
    return {
      nome: txt(p?.nome, 60), texto: txt(p?.texto, 2000),
      ...(pm ? { pm } : {}),
      ...(p?.efeito ? { efeito: validarEfeito(p.efeito) } : {}),
      ...(temBonus ? { bonus } : {}),
    };
  }).filter((p) => p.nome || p.texto);
}

/** Efeito na mesa (magia propria, poder ou item usavel): so passa o que o motor entende. */
function validarEfeito(bruto: unknown): MagiaPropria['efeito'] {
  const e = (bruto ?? {}) as Record<string, unknown>;
  const anim = (e.anim ?? {}) as Record<string, unknown>;
  const res = ['fort', 'ref', 'von'].includes(String(e.res)) ? (e.res as 'fort' | 'ref' | 'von') : undefined;
  const falhou = lista(e.falhou, 3).map(String).filter((c) => CONDICAO_POR_ID[c.split(':')[0]]);
  const persistente = ['sustentada', 'cena', 'rodadas'].includes(String(e.persistente)) ? (e.persistente as 'sustentada' | 'cena' | 'rodadas') : undefined;
  return {
    alvo: (ALVOS.includes(String(e.alvo)) ? e.alvo : 'inimigo') as MagiaPropria['efeito']['alvo'],
    maxAlvos: num(e.maxAlvos, 0, 20),
    ...(expressao(e.dano) ? { dano: expressao(e.dano), tipoDano: tipoDano(e.tipoDano) } : {}),
    ...(expressao(e.cura) ? { cura: expressao(e.cura) } : {}),
    ...(res ? { res, sucesso: ['metade', 'anula', 'parcial'].includes(String(e.sucesso)) ? (e.sucesso as 'metade' | 'anula' | 'parcial') : 'metade' } : {}),
    ...(falhou.length ? { falhou } : {}),
    ...(persistente ? { persistente } : {}),
    anim: {
      tipo: (ARQUETIPOS_ANIM.includes(String(anim.tipo)) ? anim.tipo : 'projetil') as MagiaPropria['efeito']['anim']['tipo'],
      elemento: (ELEMENTOS.includes(String(anim.elemento)) ? anim.elemento : 'arcano') as MagiaPropria['efeito']['anim']['elemento'],
    },
  };
}

function magiaPropria(v: Record<string, unknown>): MagiaPropria | null {
  const nome = txt(v?.nome, 50);
  if (!nome) return null;
  const id = /^propria-[\w-]{1,40}$/.test(String(v.id)) ? String(v.id) : `propria-${novoId()}`;
  return {
    id, nome, circulo: num(v.circulo, 1, 5), execucao: txt(v.execucao, 30) || 'padrão', alcance: txt(v.alcance, 30), duracao: txt(v.duracao, 30) || 'instantânea',
    descricao: txt(v.descricao, 3000), efeito: validarEfeito(v.efeito),
    aprimoramentos: lista(v.aprimoramentos, 6).map((a) => ({
      pm: num(a?.pm, 1, 20), texto: txt(a?.texto, 200),
      ...(expressao(a?.dano) ? { dano: expressao(a?.dano) } : {}),
      ...(num(a?.alvos, 0, 10) ? { alvos: num(a?.alvos, 0, 10) } : {}),
    })),
    ...(v.uso && typeof v.uso === 'object' ? { uso: { ...validarEfeito(v.uso), nome: txt((v.uso as Record<string, unknown>).nome, 40) || 'Usar de novo' } } : {}),
  };
}

/** Campos de regra da ficha (identidade, numeros, pericias, ataques, magias, poderes, itens). */
function editarRegras(f: Ficha, p: Record<string, unknown>) {
  if (p.nome !== undefined) f.nome = txt(p.nome, 40) || f.nome;
  if (p.raca !== undefined) f.raca = txt(p.raca, 30);
  if (p.origem !== undefined) f.origem = txt(p.origem, 40);
  if (p.classe !== undefined) f.classe = txt(p.classe, 40);
  if (p.divindade !== undefined) f.divindade = txt(p.divindade, 30);
  if (p.nivel !== undefined) f.nivel = num(p.nivel, 1, 20);
  if (p.pvMax !== undefined) f.pvMax = num(p.pvMax, 1, 9999);
  if (p.pmMax !== undefined) f.pmMax = num(p.pmMax, 0, 999);
  if (p.defesa !== undefined) f.defesa = num(p.defesa, 0, 99);
  if (p.deslocamento !== undefined) f.deslocamento = num(p.deslocamento, 0, 60);
  if (p.atributos && typeof p.atributos === 'object') {
    for (const a of ATRIBUTOS) {
      const v = (p.atributos as Record<string, unknown>)[a];
      if (v !== undefined) f.atributos[a] = num(v, -5, 20);
    }
  }
  if (p.pericias && typeof p.pericias === 'object') {
    const novas: Record<string, Pericia> = {};
    for (const nome of PERICIAS) {
      const v = (p.pericias as Record<string, Record<string, unknown>>)[nome];
      if (!v) continue;
      novas[nome] = {
        total: num(v.total, -10, 60), treinada: Boolean(v.treinada),
        atributo: ATRIBUTOS.includes(v.atributo as Atributo) ? (v.atributo as Atributo) : f.pericias[nome]?.atributo ?? 'des',
        ...(v.rotulo ? { rotulo: txt(v.rotulo, 40) } : {}),
      };
    }
    f.pericias = novas;
  }
  if (p.ataques !== undefined) f.ataques = validarAtaques(p.ataques);
  if (p.magias !== undefined) f.magias = [...new Set(lista(p.magias, 200).map(String).filter((id) => buscarMagia(id)))];
  if (p.magiasExtras !== undefined) f.magiasExtras = lista(p.magiasExtras, 60).map((x) => txt(x, 50)).filter(Boolean);
  if (p.magiasProprias !== undefined) f.magiasProprias = lista(p.magiasProprias, 40).map(magiaPropria).filter((m): m is MagiaPropria => Boolean(m));
  if (p.rd && typeof p.rd === 'object') {
    f.rd = Object.fromEntries(Object.entries(p.rd as Record<string, unknown>)
      .filter(([k]) => k === 'geral' || (TIPOS_DANO as readonly string[]).includes(k)).map(([k, n]) => [k, num(n, 0, 200)]).filter(([, n]) => n));
  }
  if (p.poderes !== undefined) f.poderes = textos(p.poderes, 80);
  if (p.itens !== undefined) f.itens = textos(p.itens, 80);
  if (p.proficiencias !== undefined) f.proficiencias = txt(p.proficiencias, 600);
  if (p.equipamento !== undefined) f.equipamento = txt(p.equipamento, 3000);
}

function fichaEmBranco(nome: string): Omit<Ficha, 'id' | 'codigo' | 'criadaEm' | 'atualizadaEm'> {
  return {
    fonte: 'manual', nome: txt(nome, 40) || 'Novo personagem', jogador: '', raca: '', origem: '', classe: '', nivel: 1, divindade: '',
    atributos: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }, pvMax: 12, pmMax: 4, defesa: 10, deslocamento: 9,
    pericias: Object.fromEntries(PERICIAS.map((n) => [n, { total: 0, treinada: false, atributo: ATRIBUTO_DA_PERICIA[n] ?? 'des' }])),
    ataques: [], magias: [], magiasExtras: [], magiasProprias: [], atributoChave: null, bonusCd: 0, rd: {},
    poderes: [], itens: [], proficiencias: '', equipamento: '', notas: '', imagem: '', cor: '#e9c46a', dado: 'ouro',
  };
}

const ATRIBUTO_DA_PERICIA: Record<string, Atributo> = {
  Acrobacia: 'des', Adestramento: 'car', Atletismo: 'for', 'Atuação': 'car', Cavalgar: 'des', Conhecimento: 'int', Cura: 'sab',
  'Diplomacia': 'car', 'Enganação': 'car', Fortitude: 'con', Furtividade: 'des', Guerra: 'int', Iniciativa: 'des', 'Intimidação': 'car',
  'Intuição': 'sab', 'Investigação': 'int', Jogatina: 'car', Ladinagem: 'des', Luta: 'for', Misticismo: 'int', Nobreza: 'int',
  'Ofício 1': 'int', 'Ofício 2': 'int', 'Percepção': 'sab', Pilotagem: 'des', Pontaria: 'des', Reflexos: 'des', 'Religião': 'sab',
  'Sobrevivência': 'sab', Vontade: 'sab',
};
