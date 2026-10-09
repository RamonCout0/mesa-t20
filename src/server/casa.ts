// Biblioteca da casa: itens, poderes (regras da casa) e magias criados pelo grupo, guardados uma vez
// em data/casa.json e adicionados a qualquer ficha pelo editor (mestre ou celular).
import fs from 'node:fs';
import path from 'node:path';
import type { MagiaPropria, Poder } from '../shared/ficha.ts';
import { magiaPropria, textos } from './fichas.ts';

export interface BibliotecaCasa {
  itens: Poder[];
  poderes: Poder[];
  magias: MagiaPropria[];
}
export type TipoCasa = keyof BibliotecaCasa;
export const TIPOS_CASA: TipoCasa[] = ['itens', 'poderes', 'magias'];

export class Casa {
  private readonly arquivo: string;
  dados: BibliotecaCasa = { itens: [], poderes: [], magias: [] };

  constructor(raiz: string) {
    this.arquivo = path.join(raiz, 'data', 'casa.json');
    try {
      const lido = JSON.parse(fs.readFileSync(this.arquivo, 'utf8')) as Partial<BibliotecaCasa>;
      this.dados = {
        itens: textos(lido.itens, 200), poderes: textos(lido.poderes, 200),
        magias: (Array.isArray(lido.magias) ? lido.magias : []).map((m) => magiaPropria(m as never)).filter((m): m is MagiaPropria => Boolean(m)),
      };
    } catch { /* primeira vez: biblioteca vazia */ }
  }

  private gravar() {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.dados, null, 2));
  }

  /** Guarda (ou troca, pelo nome) um item, poder ou magia. */
  guardar(tipo: TipoCasa, bruto: unknown) {
    if (!TIPOS_CASA.includes(tipo)) throw new Error('Tipo inválido.');
    const novo = tipo === 'magias' ? magiaPropria((bruto ?? {}) as never) : textos([bruto], 1)[0];
    if (!novo || !novo.nome) throw new Error('Dê um nome antes de guardar na biblioteca.');
    const lista = this.dados[tipo] as (Poder | MagiaPropria)[];
    const i = lista.findIndex((x) => x.nome.toLowerCase() === novo.nome.toLowerCase());
    if (i >= 0) lista[i] = novo; else lista.push(novo);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    this.gravar();
    return i >= 0 ? 'atualizado' : 'novo';
  }

  remover(tipo: TipoCasa, nome: string) {
    if (!TIPOS_CASA.includes(tipo)) throw new Error('Tipo inválido.');
    (this.dados[tipo] as { nome: string }[]) = (this.dados[tipo] as { nome: string }[]).filter((x) => x.nome !== nome);
    this.gravar();
  }
}
