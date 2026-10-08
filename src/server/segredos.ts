// Mensagens secretas do mestre para os jogadores (texto e/ou imagem), em data/segredos/.
// So o mestre e quem recebeu veem; a imagem enviada fica fora das pastas publicas ate ser revelada.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Segredo } from '../shared/tipos.ts';
import { imagemValida, novoId, txt } from './estado.ts';
import { EXT_IMAGEM } from './imagens.ts';

const LIMITE = 200;

export class Segredos {
  private readonly arquivo: string;
  readonly pastaImagens: string;
  private todos: Segredo[] = [];

  constructor(raiz: string) {
    const dir = path.join(raiz, 'data', 'segredos');
    this.arquivo = path.join(dir, 'mensagens.json');
    this.pastaImagens = path.join(dir, 'imagens');
    fs.mkdirSync(this.pastaImagens, { recursive: true });
    try {
      const lido = JSON.parse(fs.readFileSync(this.arquivo, 'utf8'));
      if (Array.isArray(lido)) this.todos = lido;
    } catch { /* primeira vez */ }
  }

  private gravar() {
    this.todos = this.todos.slice(-LIMITE);
    fs.writeFileSync(this.arquivo, JSON.stringify(this.todos, null, 1));
  }

  lista() {
    return this.todos;
  }

  /** O que um jogador ve: so as mensagens para ele, e so as respostas dele. */
  daFicha(fichaId: string) {
    return this.todos
      .filter((s) => s.para.includes(fichaId))
      .map((s) => ({ ...s, para: [fichaId], respostas: s.respostas.filter((r) => r.fichaId === fichaId) }));
  }

  exigir(id: string) {
    const s = this.todos.find((x) => x.id === id);
    if (!s) throw new Error('Mensagem não encontrada.');
    return s;
  }

  /** Imagem enviada so para segredos: nome aleatorio, fora das pastas servidas. */
  guardarImagem(dados: Buffer, ext: string) {
    if (!EXT_IMAGEM.has(ext)) throw new Error('Formato não suportado.');
    const nome = `${randomUUID()}${ext}`;
    fs.writeFileSync(path.join(this.pastaImagens, nome), dados);
    return `segredo:${nome}`;
  }

  /** Caminho no disco de uma imagem "segredo:arquivo", ou null. */
  arquivoDaImagem(imagem: string) {
    const nome = /^segredo:([\w-]+\.\w+)$/.exec(imagem)?.[1];
    return nome ? path.join(this.pastaImagens, nome) : null;
  }

  enviar(para: string[], texto: unknown, imagem: unknown) {
    const t = txt(texto, 2000);
    const img = String(imagem ?? '');
    const imagemOk = this.arquivoDaImagem(img) ? img : imagemValida(img);
    if (!para.length) throw new Error('Escolha pelo menos um jogador.');
    if (!t && !imagemOk) throw new Error('Escreva algo ou escolha uma imagem.');
    const s: Segredo = { id: novoId(), para, texto: t, imagem: imagemOk, criadoEm: Date.now(), lidas: {}, respostas: [], revelado: false };
    this.todos.push(s);
    this.gravar();
    return s;
  }

  marcarLida(id: string, fichaId: string) {
    const s = this.exigir(id);
    if (!s.para.includes(fichaId)) throw new Error('Essa mensagem não é sua.');
    if (!s.lidas[fichaId]) {
      s.lidas[fichaId] = Date.now();
      this.gravar();
    }
  }

  responder(id: string, fichaId: string, nome: string, texto: unknown) {
    const s = this.exigir(id);
    if (!s.para.includes(fichaId)) throw new Error('Essa mensagem não é sua.');
    const t = txt(texto, 600);
    if (!t) throw new Error('Escreva a resposta.');
    s.respostas.push({ fichaId, nome, texto: t, em: Date.now() });
    s.lidas[fichaId] ??= Date.now();
    this.gravar();
  }

  marcarRevelado(id: string, revelado: boolean) {
    this.exigir(id).revelado = revelado;
    this.gravar();
  }

  apagar(id: string) {
    const s = this.exigir(id);
    this.todos = this.todos.filter((x) => x !== s);
    const arq = this.arquivoDaImagem(s.imagem);
    if (arq && !this.todos.some((x) => x.imagem === s.imagem)) fs.rmSync(arq, { force: true });
    this.gravar();
  }
}

/** URL para mostrar a imagem de um segredo (as da galeria ja sao publicas). */
export const urlImagemSegredo = (s: Segredo) => (s.imagem.startsWith('segredo:') ? `/api/segredo/${s.id}/imagem` : s.imagem);
