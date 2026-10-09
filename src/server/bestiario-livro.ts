// Le os blocos de estatisticas de um livro de Tormenta20 (PDF do proprio mestre) e
// transforma cada um numa ficha do bestiario. Usado pela ferramenta gerar-bestiario.

import { lerBlocoAmeaca, type FichaAmeaca } from '../shared/bloco-ameaca.ts';
import { TEMAS, type Tema, type Tier } from '../shared/condicoes.ts';

/** Uma linha de texto do PDF com a pagina e a posicao do comeco dela. */
export interface LinhaPdf { texto: string; pagina: number; x: number; y: number }

/** Linhas do PDF na ordem de leitura do proprio arquivo, com a posicao de cada uma. */
export async function linhasDoPdf(dados: Uint8Array, progresso?: (pagina: number, total: number) => void) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({ data: dados, verbosity: 0, disableFontFace: true });
  const doc = await tarefa.promise;
  const linhas: LinhaPdf[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    let atual: LinhaPdf | null = null;
    for (const item of conteudo.items) {
      if (!('str' in item)) continue;
      if (!atual) atual = { texto: '', pagina: p, x: NaN, y: NaN };
      if (Number.isNaN(atual.x) && item.str.trim()) { atual.x = item.transform[4]; atual.y = item.transform[5]; }
      atual.texto += item.str;
      if (item.hasEOL) { linhas.push(atual); atual = null; }
    }
    if (atual) linhas.push(atual);
    pagina.cleanup();
    progresso?.(p, doc.numPages);
  }
  await tarefa.destroy();
  return linhas;
}

/** Texto corrido (ex.: pdftotext) vira linhas; "\f" separa paginas. Sem posicao. */
function linhasDoTexto(texto: string): LinhaPdf[] {
  let pagina = 1;
  return texto.replace(/\r/g, '').split('\n').flatMap((l) => {
    const partes = l.split('\f');
    return partes.map((t, i) => {
      if (i > 0) pagina += 1;
      return { texto: t, pagina, x: NaN, y: NaN };
    });
  });
}

const RE_PV = /^Pontos de Vida\s+\d+/;
const RE_INI = /^Iniciativa\s+[+–-]\s?\d+/;
const RE_ND = /^ND\s+(\d+\/\d+|\d+|S\+?)\s*$/;
const RE_TIPO = /^(Humanoide|Animal|Monstro|Esp[íi]rito|Construto|Morto-vivo|Lefeu|Fada|Elemental|Planta|Gigante|Drag[ãa]o|Aberra[çc][ãa]o)\b|\b(Min[úu]sculo|Pequeno|M[ée]dio|Grande|Enorme|Colossal)\s*$/i;

interface Bloco { linhas: string[]; nd: string; cabeca: LinhaPdf }

const nomeValido = (n: string) => n.length >= 2 && n.length <= 42 && /^[A-ZÀ-Ú]/.test(n) && !/[.:;…!?,]$/.test(n)
  && n.split(' ').length <= 6 && !/^(Tesouro|Per[íi]cias|Equipamento|For\s|Corpo|Dist|Defesa|Iniciativa)/.test(n);

/**
 * Recorta cada bloco de estatisticas: nome e tipo logo acima da Iniciativa, estatisticas ate o
 * "Tesouro". O "ND" pode vir junto (texto corrido) ou solto na pagina (a caixinha de ND do livro):
 * nesse caso vale o ND mais perto do nome do bloco.
 */
export function recortarBlocos(entrada: string | LinhaPdf[]) {
  const fonte = typeof entrada === 'string' ? linhasDoTexto(entrada) : entrada;
  const linhas = fonte.map((l) => ({ ...l, texto: l.texto.replace(/[ \t]+/g, ' ').trim() }));
  const blocos: Bloco[] = [];
  const usadas = new Set<number>();
  for (let i = 0; i < linhas.length; i++) {
    if (!RE_INI.test(linhas[i].texto)) continue;
    // A Iniciativa precisa ter "Pontos de Vida" logo abaixo (Defesa pode quebrar a linha).
    let pv = -1;
    for (let j = i + 1; j < Math.min(linhas.length, i + 9); j++) if (RE_PV.test(linhas[j].texto)) { pv = j; break; }
    if (pv < 0) continue;
    // Para cima: ND (se estiver junto), tipo e nome.
    let nd = '';
    let k = i - 1;
    const acima: LinhaPdf[] = [];
    while (k >= 0 && acima.length < 2 && i - k < 8) {
      const l = linhas[k];
      if (!l.texto) { k--; continue; }
      const m = RE_ND.exec(l.texto);
      if (m) { nd = m[1]; usadas.add(k); k--; continue; }
      acima.unshift(l);
      usadas.add(k);
      if (acima.length === 1 && !RE_TIPO.test(l.texto)) break; // sem linha de tipo: esta ja e o nome
      k--;
    }
    if (!acima.length) continue;
    // Nome quebrado em duas linhas ("Sacerdote" / "de Hyninn").
    if (/^[a-zà-ú]/.test(acima[0].texto) && k >= 0 && linhas[k].texto.length < 30 && !/[.:;]$/.test(linhas[k].texto)) {
      const cima = linhas[k].texto;
      // Letra capitular separada ("Avatar de Kallyadranoch" / "allyadranoch"): fica so a de cima.
      const junto = cima.toLowerCase().endsWith(acima[0].texto.toLowerCase()) ? cima : `${cima} ${acima[0].texto}`;
      acima[0] = { ...acima[0], texto: junto };
    }
    // Para baixo: ate o Tesouro, o proximo bloco ou um limite seguro.
    let fim = pv;
    for (let j = pv + 1; j < Math.min(linhas.length, pv + 60); j++) {
      if (RE_INI.test(linhas[j].texto) || RE_PV.test(linhas[j].texto)) break;
      fim = j;
      if (/\bTesouro\b/.test(linhas[j].texto)) break;
    }
    // A caixinha de ND de outro bloco pode cair no meio deste texto: ela continua livre.
    for (let j = i; j <= fim; j++) if (!RE_ND.test(linhas[j].texto)) usadas.add(j);
    const corpo = linhas.slice(i, fim + 1).map((l) => l.texto).filter((t) => t && !RE_ND.test(t));
    blocos.push({ linhas: [...acima.map((l) => l.texto), ...corpo], nd, cabeca: acima[0] });
    i = fim;
  }

  // ND soltos da mesma pagina: pelo mais perto do nome (com posicao) ou pela ordem (texto corrido).
  const soltos = linhas.flatMap((l, idx) => {
    const m = RE_ND.exec(l.texto);
    return m && !usadas.has(idx) ? [{ nd: m[1], l, livre: true }] : [];
  });
  const pares: { b: Bloco; s: (typeof soltos)[number]; d: number }[] = [];
  for (const b of blocos) {
    if (b.nd) continue;
    soltos.forEach((s, ordem) => {
      if (s.l.pagina !== b.cabeca.pagina) return;
      const temPosicao = Number.isFinite(s.l.x) && Number.isFinite(b.cabeca.x);
      const d = temPosicao ? Math.abs(s.l.y - b.cabeca.y) + 0.35 * Math.abs(s.l.x - b.cabeca.x) : ordem + blocos.indexOf(b) * 1e-3;
      pares.push({ b, s, d });
    });
  }
  pares.sort((a, b) => a.d - b.d);
  for (const { b, s } of pares) {
    if (b.nd || !s.livre) continue;
    b.nd = s.nd;
    s.livre = false;
  }

  return blocos.flatMap((b) => {
    const [nome, ...resto] = b.linhas;
    // Numero de pagina grudado no nome ("44 Chefe do Crime", "31Meio-Orc").
    const limpo = nome.replace(/^\d+\s*(?=[A-ZÀ-Ú])/, '');
    // Texto que caiu no lugar do nome (frase, numero de pagina...): melhor nao importar.
    if (!nomeValido(limpo)) return [];
    return [[limpo, ...(b.nd ? [`ND ${b.nd}`] : []), ...resto].join('\n')];
  });
}

const TEMA_POR_PALAVRA: [RegExp, Tema][] = [
  [/fogo|chama|brasa|inferno|vulc/i, 'fogo'],
  [/gelo|frio|neve|congel/i, 'gelo'],
  [/veneno|ácido|acido|peçonh/i, 'veneno'],
  [/sangue|tormenta|lefeu|aberra/i, 'sangue'],
  [/luz|sagrad|celestial|anjo/i, 'luz'],
  [/arcan|mago|feiti|runa|construto/i, 'arcano'],
];

const TEMA_DO_DANO: Record<string, Tema> = { fogo: 'fogo', frio: 'gelo', acido: 'veneno', luz: 'luz', trevas: 'trevas', eletricidade: 'arcano', essencia: 'arcano', psiquico: 'arcano' };

/** Cor do efeito da carta: pelo nome/tipo; senao pelo dano dos ataques; senao trevas. */
function temaDe(f: FichaAmeaca): Tema {
  const cabeca = `${f.nome} ${f.tipo}`;
  for (const [re, tema] of TEMA_POR_PALAVRA) if (re.test(cabeca) && TEMAS.includes(tema)) return tema;
  for (const a of f.ataques) if (a.tipoDano && TEMA_DO_DANO[a.tipoDano]) return TEMA_DO_DANO[a.tipoDano];
  return 'trevas';
}

function tierDe(nd: string): Tier {
  if (/^S/i.test(nd)) return 'mitico';
  const n = nd.includes('/') ? 0 : Number(nd) || 0;
  if (n >= 20) return 'mitico';
  if (n >= 15) return 'lendario';
  if (n >= 10) return 'epico';
  if (n >= 5) return 'elite';
  return 'comum';
}

/** Ficha de ameaca pronta para o bestiario (mesmos campos do editor do mestre). */
export function dadosDaAmeaca(f: FichaAmeaca) {
  return {
    nome: f.nome, subtitulo: f.tipo, nd: f.nd ? `ND ${f.nd}` : '', pvMax: f.pv, pmMax: f.pm, defesa: f.defesa, bonusIni: f.iniciativa,
    fort: f.fort, ref: f.ref, von: f.von, rd: f.defesas.rd, imunidades: f.defesas.imunidades, vulnerabilidades: f.defesas.vulnerabilidades,
    ataques: f.ataques, habilidades: f.habilidades,
    notas: [f.atributos, f.pericias && `Perícias: ${f.pericias}`, f.equipamento && `Equipamento: ${f.equipamento}`].filter(Boolean).join('\n'),
    texto: f.texto, tema: temaDe(f), tier: tierDe(f.nd), revelar: 'estado',
  };
}

export function ameacasDoLivro(entrada: string | LinhaPdf[]) {
  return recortarBlocos(entrada).flatMap((b) => {
    const f = lerBlocoAmeaca(b);
    return f && f.nome && f.pv > 0 ? [f] : [];
  });
}
