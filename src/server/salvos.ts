// Preparo do mestre: encontros (grupos de ameacas do bestiario) e cenas (cenario + personagens no
// palco) salvos para carregar com um clique durante a sessao. Ficam em data/encontros.json e data/cenas.json.

import fs from 'node:fs';
import path from 'node:path';
import type { Estado, Inimigo, Palco } from '../shared/tipos.ts';
import { imagemValida, novoId, num, txt } from './estado.ts';

export interface ItemEncontro {
  ameacaId: string;
  quantidade: number;
  chefeFinal?: boolean;
}

export interface Encontro {
  id: string;
  nome: string;
  itens: ItemEncontro[];
  criadoEm: number;
}

export interface CenaSalva {
  id: string;
  nome: string;
  palco: Palco;
  criadoEm: number;
}

class ListaSalva<T extends { id: string; nome: string }> {
  private readonly arquivo: string;
  private itens: T[] = [];

  constructor(arquivo: string) {
    this.arquivo = arquivo;
    try {
      const lido = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (Array.isArray(lido)) this.itens = lido;
    } catch { /* primeira vez */ }
  }

  lista() {
    return [...this.itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  exigir(id: string) {
    const x = this.itens.find((i) => i.id === id);
    if (!x) throw new Error('Não encontrado (já foi apagado?).');
    return x;
  }

  /** Mesmo nome substitui (salvar de novo atualiza). */
  guardar(item: T) {
    this.itens = [...this.itens.filter((i) => i.nome.toLowerCase() !== item.nome.toLowerCase()), item];
    this.gravar();
    return item;
  }

  remover(id: string) {
    this.exigir(id);
    this.itens = this.itens.filter((i) => i.id !== id);
    this.gravar();
  }

  private gravar() {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.itens, null, 1));
  }
}

export class Salvos {
  readonly encontros: ListaSalva<Encontro>;
  readonly cenas: ListaSalva<CenaSalva>;

  constructor(raiz: string) {
    this.encontros = new ListaSalva<Encontro>(path.join(raiz, 'data', 'encontros.json'));
    this.cenas = new ListaSalva<CenaSalva>(path.join(raiz, 'data', 'cenas.json'));
  }

  tudo() {
    return { encontros: this.encontros.lista(), cenas: this.cenas.lista() };
  }

  salvarEncontro(nome: unknown, itens: ItemEncontro[]) {
    const n = txt(nome, 50);
    if (!n) throw new Error('Dê um nome ao encontro.');
    if (!itens.length) throw new Error('Não há inimigos para salvar.');
    return this.encontros.guardar({ id: novoId(), nome: n, itens, criadoEm: Date.now() });
  }

  salvarCena(nome: unknown, estado: Estado) {
    const n = txt(nome, 50);
    if (!n) throw new Error('Dê um nome à cena.');
    const p = estado.cena.palco;
    if (!p.fundo && !p.atores.length) throw new Error('O palco está vazio.');
    return this.cenas.guardar({ id: novoId(), nome: n, palco: structuredClone({ ...p, destaque: null }), criadoEm: Date.now() });
  }

  /** Volta a cena salva para o palco. Quem nao esta mais na mesa vira NPC (mesmo nome e imagem). */
  carregarCena(id: string, estado: Estado) {
    const c = this.cenas.exigir(id);
    const existe = (refId: string | null) => Boolean(refId && [...estado.aliados, ...estado.inimigos].some((x) => x.id === refId));
    estado.cena.palco = {
      fundo: c.palco.fundo,
      destaque: null,
      atores: c.palco.atores.map((a) => ({ ...a, id: novoId(), refId: existe(a.refId) ? a.refId : null })),
    };
  }
}

/** Inimigos da mesa agrupados pela ficha do bestiario (para salvar como encontro). */
export function agruparInimigos(inimigos: Inimigo[]): ItemEncontro[] {
  const grupos = new Map<string, ItemEncontro>();
  for (const i of inimigos) {
    if (!i.ameacaId) continue;
    const chave = `${i.ameacaId}:${i.chefeFinal ? 1 : 0}`;
    const g = grupos.get(chave) ?? { ameacaId: i.ameacaId, quantidade: 0, ...(i.chefeFinal ? { chefeFinal: true } : {}) };
    g.quantidade += 1;
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

/** Encontros e cenas de um backup (por nome: o que ja existe com o mesmo nome e substituido). */
export function restaurarSalvos(salvos: Salvos, bruto: { encontros?: unknown; cenas?: unknown }) {
  let n = 0;
  for (const e of Array.isArray(bruto.encontros) ? bruto.encontros : []) {
    const itens = (Array.isArray(e?.itens) ? e.itens : []).flatMap((it: Record<string, unknown>) => (typeof it?.ameacaId === 'string'
      ? [{ ameacaId: it.ameacaId, quantidade: Math.min(20, Math.max(1, Number(it.quantidade) || 1)), ...(it.chefeFinal ? { chefeFinal: true } : {}) }]
      : []));
    if (txt(e?.nome, 50) && itens.length) { salvos.encontros.guardar({ id: novoId(), nome: txt(e.nome, 50), itens, criadoEm: Date.now() }); n += 1; }
  }
  for (const c of Array.isArray(bruto.cenas) ? bruto.cenas : []) {
    const p = c?.palco;
    if (!txt(c?.nome, 50) || !p || !Array.isArray(p.atores)) continue;
    const atores = p.atores.slice(0, 8).map((a: Record<string, unknown>) => ({
      id: novoId(), refId: typeof a.refId === 'string' ? a.refId : null, nome: txt(a.nome, 40) || 'NPC', imagem: imagemValida(a.imagem),
      cor: /^#[0-9a-f]{6}$/i.test(String(a.cor)) ? String(a.cor) : '#c9b8ff', x: num(a.x, 0, 100), y: num(a.y ?? 90, 0, 100),
      espelhar: Boolean(a.espelhar), expressao: imagemValida(a.expressao),
    }));
    salvos.cenas.guardar({ id: novoId(), nome: txt(c.nome, 50), palco: { fundo: imagemValida(p.fundo), atores, destaque: null }, criadoEm: Date.now() });
    n += 1;
  }
  return n;
}
