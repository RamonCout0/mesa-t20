// Fichas dos jogadores, uma por arquivo em data/fichas/<id>.json.
// A ficha e a fonte da verdade do personagem; o heroi no estado da mesa so aponta para ela
// (fichaId) e copia o que o telao precisa (nome, PV max, Defesa...).

import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import type { Ficha } from '../shared/ficha.ts';
import { ATRIBUTOS, type Atributo, type Estado, type Heroi } from '../shared/tipos.ts';
import { baseHeroi, novoId, num, txt, imagemValida } from './estado.ts';
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
        if (f?.id && f.codigo) this.todas.set(f.id, f);
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
  editar(id: string, patch: Record<string, unknown>, mestre: boolean) {
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
    if (mestre) {
      if (patch.nome !== undefined) f.nome = txt(patch.nome, 40) || f.nome;
      if (patch.pvMax !== undefined) f.pvMax = num(patch.pvMax, 1, 9999);
      if (patch.pmMax !== undefined) f.pmMax = num(patch.pmMax, 0, 999);
      if (patch.defesa !== undefined) f.defesa = num(patch.defesa, 0, 99);
      if (patch.nivel !== undefined) f.nivel = num(patch.nivel, 1, 20);
    }
    this.gravar(f);
    return f;
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
