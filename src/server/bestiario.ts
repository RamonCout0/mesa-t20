// Bestiario do mestre: fichas de ameaca, uma por arquivo em data/bestiario/<id>.json.
// Cada uma vira uma ou mais cartas de inimigo na mesa ("Pôr na mesa").

import fs from 'node:fs';
import path from 'node:path';
import { CAMPOS_AMEACA, type Ameaca, type Estado, type Inimigo } from '../shared/tipos.ts';
import { criar, novoId, num, tornarChefeFinal, txt } from './estado.ts';
import { lerBlocoAmeaca } from '../shared/bloco-ameaca.ts';

export class Bestiario {
  private readonly dir: string;
  private readonly lixeira: string;
  private readonly todas = new Map<string, Ameaca>();

  constructor(raiz: string) {
    this.dir = path.join(raiz, 'data', 'bestiario');
    this.lixeira = path.join(this.dir, 'lixeira');
    this.recarregar();
  }

  /** Le de novo a pasta (fichas criadas pela ferramenta de linha de comando, por exemplo). */
  recarregar() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.todas.clear();
    for (const arq of fs.readdirSync(this.dir).filter((a) => a.endsWith('.json'))) {
      try {
        const a = JSON.parse(fs.readFileSync(path.join(this.dir, arq), 'utf8')) as Ameaca;
        if (!a?.id || !a.nome) continue;
        if (atualizarHabilidades(a)) fs.writeFileSync(path.join(this.dir, arq), JSON.stringify(a, null, 2));
        this.todas.set(a.id, a);
      } catch {
        console.warn(`Ameaça ilegível ignorada: data/bestiario/${arq}`);
      }
    }
  }

  lista() {
    return [...this.todas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  porId(id: string) {
    return this.todas.get(id);
  }

  exigir(id: string) {
    const a = this.todas.get(id);
    if (!a) throw new Error('Ameaça não encontrada no bestiário.');
    return a;
  }

  /** Cria ou atualiza. Os campos passam pelos mesmos validadores das cartas da mesa. */
  salvar(dados: Record<string, unknown>, id?: string, idNovo?: string) {
    const atual = id ? this.exigir(id) : undefined;
    const ent = criar('inimigos', { ...(atual ?? {}), ...dados }) as Inimigo;
    const agora = Date.now();
    const a = {
      ...Object.fromEntries(CAMPOS_AMEACA.map((c) => [c, ent[c]])),
      id: atual?.id ?? idNovo ?? novoId(),
      texto: txt(dados.texto ?? atual?.texto, 20000),
      criadaEm: atual?.criadaEm ?? agora,
      atualizadaEm: agora,
      versao: 3,
    } as Ameaca;
    this.todas.set(a.id, a);
    fs.writeFileSync(path.join(this.dir, `${a.id}.json`), JSON.stringify(a, null, 2));
    return a;
  }

  /**
   * Fichas lidas de um livro: entram as que ainda nao existem (pelo nome). Com `atualizar`,
   * as que ja existem recebem os numeros do livro mas mantem imagem e notas do mestre.
   */
  importar(lista: Record<string, unknown>[], atualizar = false) {
    const porNome = new Map(this.lista().map((a) => [a.nome.toLowerCase(), a]));
    const vistos = new Map<string, number>();
    let novas = 0;
    let atualizadas = 0;
    let iguais = 0;
    for (const dados of lista) {
      // Mesmo nome duas vezes no livro (ex.: dois "Dragão Filhote"): a segunda vira "(2)".
      const base = String(dados.nome).trim().slice(0, 36).trim(); // o nome da carta tem no maximo 40
      const n = (vistos.get(base.toLowerCase()) ?? 0) + 1;
      vistos.set(base.toLowerCase(), n);
      const nome = n > 1 ? `${base} (${n})` : base;
      const existente = porNome.get(nome.toLowerCase());
      if (existente && !atualizar) { iguais += 1; continue; }
      if (existente) {
        this.salvar({ ...dados, nome, imagem: existente.imagem, notas: existente.notas || dados.notas }, existente.id);
        atualizadas += 1;
      } else {
        this.salvar({ ...dados, nome });
        novas += 1;
      }
    }
    return { novas, atualizadas, iguais };
  }

  /** Ficha de ameaca vinda de um backup: mesmo id atualiza, senao cria com o id do arquivo. */
  restaurar(dados: Record<string, unknown>) {
    const id = String(dados.id ?? '');
    if (this.todas.has(id)) return this.salvar(dados, id);
    return this.salvar(dados, undefined, /^[\w-]{4,20}$/.test(id) ? id : undefined);
  }

  /** Remover nao apaga: o arquivo vai para data/bestiario/lixeira/. */
  remover(id: string) {
    this.exigir(id);
    fs.mkdirSync(this.lixeira, { recursive: true });
    fs.renameSync(path.join(this.dir, `${id}.json`), path.join(this.lixeira, `${id}-${Date.now()}.json`));
    this.todas.delete(id);
  }
}

/**
 * Fichas antigas so guardavam o nome de ate duas ou tres habilidades. Rele o bloco do livro e traz
 * todas, com texto, execucao, PM, dano e teste. Mantem as que o mestre criou e os chips ativos.
 */
function atualizarHabilidades(a: Ameaca) {
  if ((a.versao ?? 0) >= 3) return false;
  a.versao = 3;
  const bloco = a.texto ? lerBlocoAmeaca(a.texto) : null;
  if (!bloco) return true;
  const antigas = new Map((a.habilidades ?? []).map((h) => [h.nome.toLowerCase(), h]));
  const lidas = bloco.habilidades.map((h) => ({ ...h, ativa: antigas.get(h.nome.toLowerCase())?.ativa ?? false }));
  const nomes = new Set(lidas.map((h) => h.nome.toLowerCase()));
  const doMestre = (a.habilidades ?? []).filter((h) => !nomes.has(h.nome.toLowerCase()) && (h.texto || h.ativa));
  a.habilidades = (criar('inimigos', { habilidades: [...lidas, ...doMestre] }) as Inimigo).habilidades;
  return true;
}

/** Uma carta de inimigo da ficha de ameaca. Com mais de uma, numera: "Cultista 1", "Cultista 2"... */
export function porNaMesa(estado: Estado, a: Ameaca, quantidade: unknown, naTela: boolean, chefeFinal = false) {
  const qtd = num(quantidade, 1, 20);
  const iguais = () => estado.inimigos.filter((i) => i.nome === a.nome || i.nome.startsWith(`${a.nome} `));
  // Se ja havia um so, sem numero, ele vira o 1.
  const ja = iguais();
  if (ja.length === 1 && ja[0].nome === a.nome && qtd >= 1) ja[0].nome = `${a.nome} 1`;
  const numerar = qtd > 1 || ja.length > 0;
  let n = ja.length;
  const novos: Inimigo[] = [];
  for (let i = 0; i < qtd; i++) {
    n += 1;
    const dados = Object.fromEntries(CAMPOS_AMEACA.map((c) => [c, a[c]]));
    const ent = criar('inimigos', { ...dados, nome: numerar ? `${a.nome} ${n}` : a.nome, naTela }) as Inimigo;
    ent.ameacaId = a.id;
    if (chefeFinal) tornarChefeFinal(ent);
    novos.push(ent);
  }
  estado.inimigos.push(...novos);
  return novos;
}
