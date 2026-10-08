// Le o PDF exportado pelo Fichas de Nimb e monta uma Ficha da mesa.
//
// O PDF do Nimb e um formulario preenchido (nao achatado): os dados ficam nos campos.
// O que nao coube no formulario (resto das magias, RD, idade...) e desenhado em paginas
// extras, por isso o texto dessas paginas tambem e lido.

import { PERICIAS, atributoChavePadrao, type Ficha, type Pericia, type Poder } from '../shared/ficha.ts';
import { buscarMagia } from '../shared/magias.ts';
import type { Ataque, ArquetipoArma, Atributo, TipoDano } from '../shared/tipos.ts';

type Campos = Record<string, string>;

async function lerPdf(dados: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({ data: dados, verbosity: 0, disableFontFace: true });
  const doc = await tarefa.promise;
  const campos: Campos = {};
  const textos: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const pagina = await doc.getPage(p);
    for (const a of await pagina.getAnnotations()) {
      if (!a.fieldName) continue;
      const v = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
      if (typeof v === 'string' && v !== '' && v !== 'Off') campos[a.fieldName] = v;
      else if (a.checkBox && a.fieldValue && a.fieldValue !== 'Off') campos[a.fieldName] = 'sim';
    }
    const conteudo = await pagina.getTextContent();
    textos.push(conteudo.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  await tarefa.destroy();
  return { campos, texto: textos.join('\n') };
}

const inteiro = (v: string | undefined, padrao = 0) => {
  const n = Number.parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : padrao;
};

const ATRIBUTO_DO_CAMPO: Record<string, Atributo> = {
  modFor: 'for', modDes: 'des', modCon: 'con', modInt: 'int', modSab: 'sab', modCar: 'car',
};

const TIPO_DANO: [RegExp, TipoDano][] = [
  [/^perf/i, 'perfuracao'], [/^cort/i, 'corte'], [/^impac/i, 'impacto'], [/^fogo/i, 'fogo'], [/^frio/i, 'frio'],
  [/^[áa]cido/i, 'acido'], [/^eletr/i, 'eletricidade'], [/^ess[êe]n/i, 'essencia'], [/^luz/i, 'luz'],
  [/^ps[íi]q/i, 'psiquico'], [/^trev/i, 'trevas'],
];

export function tipoDeDano(texto: string): TipoDano | '' {
  const t = texto.trim();
  for (const [rx, tipo] of TIPO_DANO) if (rx.test(t)) return tipo;
  return '';
}

/** "19", "x3", "19/x3", "18/x4" -> margem e multiplicador. */
export function lerCritico(texto: string) {
  const margem = /(\d{2})/.exec(texto)?.[1];
  const mult = /x\s*(\d)/i.exec(texto)?.[1];
  return { margem: margem ? Number(margem) : 20, mult: mult ? Number(mult) : 2 };
}

/** Escolhe a animacao do ataque pelo nome da arma, tipo de dano e alcance. */
export function arquetipoDaArma(nome: string, tipo: TipoDano | '', distancia: boolean): ArquetipoArma {
  const n = nome.toLowerCase();
  if (/besta|virote/.test(n)) return 'virote';
  if (/arco|flecha/.test(n)) return 'flecha';
  if (/pistola|mosquete|arcabuz|bacamarte|canh[ãa]o|espingarda|garrucha|rifle/.test(n)) return 'tiro';
  if (/funda|dardo|azagaia|shuriken|faca de arremesso|machadinha de arremesso|chakram|bumerangue|rede/.test(n) || (distancia && !/arco|besta/.test(n))) return 'arremesso';
  if (/desarmado|garra|mordida|chifre|cauda|pancada|punho/.test(n)) return 'natural';
  if (tipo === 'perfuracao') return 'perfuracao';
  if (tipo === 'impacto') return 'impacto';
  return 'corte';
}

// Armas corpo a corpo que o Nimb lista com alcance porque tambem podem ser arremessadas.
const CORPO_A_CORPO_ARREMESSAVEL = /adaga|lan[çc]a|tridente|machadinha|martelo leve|faca|punhal|kama|sai\b/i;

function lerAtaques(c: Campos): Ataque[] {
  const ataques: Ataque[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const nome = c[`ataque${i}`]?.trim();
    if (!nome) continue;
    // Arma dupla ("1d6/1d6") ou versatil: usa a primeira forma. Municao vem sem dado: nao e ataque.
    const dano = (c[`dano${i}`] ?? '').split('/')[0].replace(/\s+/g, '');
    if (!/\d*d\d+/i.test(dano)) continue;
    const alcance = (c[`alcance${i}`] ?? '').trim();
    const temAlcance = Boolean(alcance) && alcance !== '-' && !/^corpo/i.test(alcance);
    const arremessavel = temAlcance && CORPO_A_CORPO_ARREMESSAVEL.test(nome);
    const distancia = temAlcance && !arremessavel;
    const tipoDano = tipoDeDano(c[`tipo${i}`] ?? '');
    ataques.push({
      id: `a${i}`,
      nome,
      bonus: inteiro(c[`tAtak${i}`]),
      dano,
      tipoDano,
      ...lerCritico(c[`critico${i}`] ?? ''),
      alcance: temAlcance ? alcance : 'Corpo a corpo',
      distancia,
      ...(arremessavel ? { arremessavel } : {}),
      arquetipo: arquetipoDaArma(nome, tipoDano, distancia),
    });
  }
  return ataques;
}

function lerPericias(c: Campos): Record<string, Pericia> {
  const pericias: Record<string, Pericia> = {};
  PERICIAS.forEach((nome, i) => {
    const total = c[i === 22 ? 'tota23' : `total${i + 1}`];
    if (total === undefined) return;
    const atributo = ATRIBUTO_DO_CAMPO[c[`modSelect${i}`] ?? ''] ?? 'des';
    const treinada = c[`treinado${i + 1}`] === 'sim' || inteiro(c[`treino${i}`]) > 0;
    const oficio = i === 21 ? c.Texto8 : i === 22 ? c.Texto9 : undefined;
    if ((i === 21 || i === 22) && !oficio && !treinada) return;
    pericias[nome] = { total: inteiro(total), treinada, atributo, ...(oficio ? { rotulo: `Ofício (${oficio})` } : {}) };
  });
  return pericias;
}

// "- Nome: texto" por linha.
function lerPoderes(texto: string): Poder[] {
  return texto.split('\n').map((l) => /^-\s*([^:]+):\s*(.*)$/.exec(l.trim())).filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ nome: m[1].replace(/\s*\(x\d+\)$/, '').trim(), texto: m[2].trim() }));
}

// "- Nome (1º, Escola, ...): descricao" no campo de magias e nas paginas de continuacao.
function lerMagias(campo: string, extra: string) {
  const nomes = new Set<string>();
  const rx = /-\s+(?:\[Engenhoca\]\s+)?([^\n()\-][^\n()]*?)\s+\((?:[^()]*\)\s+\()?\dº,/g;
  for (const fonte of [campo, extra]) {
    for (const m of fonte.matchAll(rx)) nomes.add(m[1].replace(/\s+/g, ' ').trim());
  }
  const magias: string[] = [];
  const extras: string[] = [];
  for (const nome of nomes) {
    const m = buscarMagia(nome);
    if (m) { if (!magias.includes(m.id)) magias.push(m.id); } else extras.push(nome);
  }
  return { magias, extras };
}

const RD_TIPOS: Record<string, TipoDano | 'geral'> = {
  ácido: 'acido', acido: 'acido', corte: 'corte', eletricidade: 'eletricidade', essência: 'essencia', essencia: 'essencia',
  fogo: 'fogo', frio: 'frio', impacto: 'impacto', luz: 'luz', perfuração: 'perfuracao', perfuracao: 'perfuracao',
  psíquico: 'psiquico', psiquico: 'psiquico', trevas: 'trevas', geral: 'geral',
};

function lerRd(texto: string) {
  const rd: Partial<Record<TipoDano | 'geral', number>> = {};
  const trecho = /Redu[çc][ãa]o de Dano([\s\S]{0,400})/i.exec(texto)?.[1] ?? '';
  for (const m of trecho.matchAll(/-\s*([A-Za-zÀ-ú]+):\s*(\d+)/g)) {
    const tipo = RD_TIPOS[m[1].toLowerCase()];
    if (tipo) rd[tipo] = Number(m[2]);
  }
  return rd;
}

export interface ResultadoImportacao {
  ficha: Omit<Ficha, 'id' | 'codigo' | 'criadaEm' | 'atualizadaEm'>;
  avisos: string[];
}

export async function importarPdfNimb(dados: Uint8Array): Promise<ResultadoImportacao> {
  let lido;
  try {
    lido = await lerPdf(dados);
  } catch (erro) {
    if (process.env.DEPURAR) console.error(erro);
    throw new Error('Não consegui abrir esse PDF. Exporte a ficha de novo pelo Fichas de Nimb (botão PDF).');
  }
  const c = lido.campos;
  if (!c.Nome && !c.vidaMax) throw new Error('Esse PDF não parece ser uma ficha do Fichas de Nimb.');

  const avisos: string[] = [];
  const nivel = Math.max(1, Math.min(20, inteiro(c.nivel, 1)));
  const atributos = Object.fromEntries(
    Object.entries(ATRIBUTO_DO_CAMPO).map(([campo, attr]) => [attr, inteiro(c[campo])]),
  ) as Record<Atributo, number>;
  const poderes = lerPoderes(c.Historico ?? '');
  const { magias, extras } = lerMagias(c['Atualização'] ?? '', lido.texto);
  if (extras.length) avisos.push(`Magias fora do grimório (ficam só como texto): ${extras.join(', ')}.`);
  const classe = (c.Classe ?? '').trim();
  // Quem conjura so por raca ou poder fica com o maior atributo mental (da para trocar na ficha).
  const maiorMental = (['int', 'sab', 'car'] as Atributo[]).reduce((a, b) => (atributos[b] > atributos[a] ? b : a));
  const atributoChave = magias.length || extras.length ? (atributoChavePadrao(classe, poderes) ?? maiorMental) : null;
  // Fortalecimento Arcano: +1 na CD (+2 a partir do 4º circulo, que chega no 13º nivel).
  const fortalecimento = poderes.some((p) => /fortalecimento arcano/i.test(p.nome)) ? (nivel >= 13 ? 2 : 1) : 0;

  return {
    ficha: {
      fonte: 'nimb',
      nome: (c.Nome ?? 'Sem nome').trim().slice(0, 40),
      jogador: '',
      raca: (c.Raca ?? '').trim(),
      origem: (c.Origem ?? '').trim(),
      classe: classe.replace(/\s+\d+$/, '') || classe,
      nivel,
      divindade: (c.Divindade ?? '').trim(),
      atributos,
      pvMax: Math.max(1, inteiro(c.vidaMax, 1)),
      pmMax: Math.max(0, inteiro(c.manaMax)),
      defesa: inteiro(c.Texto13, 10),
      deslocamento: inteiro(c.deslocamento, 9),
      pericias: lerPericias(c),
      ataques: lerAtaques(c),
      magias,
      magiasExtras: extras,
      magiasProprias: [],
      itens: [],
      atributoChave,
      bonusCd: fortalecimento,
      rd: lerRd(lido.texto),
      poderes,
      proficiencias: (c.caracteristicas ?? '').trim(),
      equipamento: [c.item1, c.item2].filter(Boolean).join('\n').trim(),
      notas: '',
      imagem: '',
      cor: '#e9c46a',
      dado: 'ouro',
    },
    avisos,
  };
}
