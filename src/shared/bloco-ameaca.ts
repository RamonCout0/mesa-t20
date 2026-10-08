// Le blocos de estatisticas de ameacas no formato dos livros de Tormenta20:
//
//   Orc Chefe                                   ND 2
//   Humanoide (orc) Médio
//   Iniciativa +5, Percepção +3, visão no escuro
//   Defesa 19, Fort +13, Ref +7, Von +2
//   Pontos de Vida 66
//   Deslocamento 9m (6q)
//   Corpo a Corpo Machado de batalha +11 (1d8+12, x3).
//   Urro Selvagem (Movimento) O orc chefe recebe +2...
//   For 5, Des 2, Con 4, Int 0, Sab 0, Car 0
//   Perícias Intimidação +4, Sobrevivência +5.
//   Equipamento Gibão de peles, machado de batalha. Tesouro Padrão.
//
// Serve para o editor de inimigos (colar o bloco do livro) e para gerar o bestiario.

import type { Ataque, ArquetipoArma, TipoDano } from './tipos.ts';

const TIPOS: [RegExp, TipoDano][] = [
  [/[áa]cido/i, 'acido'], [/corte/i, 'corte'], [/eletricidade/i, 'eletricidade'], [/ess[êe]ncia/i, 'essencia'],
  [/fogo/i, 'fogo'], [/frio/i, 'frio'], [/impacto/i, 'impacto'], [/\bluz\b/i, 'luz'], [/perfura/i, 'perfuracao'],
  [/ps[íi]quico/i, 'psiquico'], [/trevas/i, 'trevas'],
];
export const tipoNoTexto = (t: string): TipoDano | '' => TIPOS.find(([rx]) => rx.test(t))?.[1] ?? '';

// Arma natural ou de criatura -> tipo de dano padrao (Ameacas de Arton, tabela 2-1).
const NATURAIS: [RegExp, TipoDano][] = [
  [/cascos|cauda|marrada|pancada|tent[áa]culo|tromba|punho|soco|desarmad|clava|ma[çc]a|martelo|tacape|bord[ãa]o|porrete|mangual/i, 'impacto'],
  [/chifre|ferr[ãa]o|mordida|presas|lan[çc]a|adaga|flecha|arco|besta|virote|dardo|tridente|pique|florete|espeto|garfo/i, 'perfuracao'],
  [/garra|pin[çc]a|espada|machado|cimitarra|foice|alabarda|katana|l[âa]mina|chicote|serra/i, 'corte'],
];

function arquetipo(nome: string, tipo: TipoDano | '', distancia: boolean): ArquetipoArma {
  const n = nome.toLowerCase();
  if (/besta|virote/.test(n)) return 'virote';
  if (/arco|flecha/.test(n)) return 'flecha';
  if (/pistola|mosquete|arcabuz|canh[ãa]o|bacamarte|rifle/.test(n)) return 'tiro';
  if (distancia) return 'arremesso';
  if (/garra|mordida|presas|chifre|ferr[ãa]o|cauda|pancada|tent[áa]culo|pin[çc]a|cascos|marrada|desarmad|punho/.test(n)) return 'natural';
  if (tipo === 'perfuracao') return 'perfuracao';
  if (tipo === 'impacto') return 'impacto';
  return 'corte';
}

const DISTANCIA_NOME = /arco|besta|funda|arremess|dardo|azagaia|pistola|mosquete|arcabuz|canh[ãa]o|disparo|rajada|sopro|raio|espinhos/i;

/**
 * "Machado de batalha +11 (1d8+12, x3) e mordida +20 (1d6+18 mais 1d6 fogo)" -> ataques.
 * `distancia` vem do rotulo da linha ("Distância ...").
 */
export function lerAtaques(texto: string, distanciaPadrao = false): Ataque[] {
  const ataques: Ataque[] = [];
  const rx = /([A-Za-zÀ-ú][A-Za-zÀ-ú' \-]*?)\s*(?:x\d\s+)?([+–-]\s?\d+)\s*\(([^)]+)\)/g;
  let n = 0;
  for (const m of texto.matchAll(rx)) {
    const nome = m[1].replace(/^(e|ou|corpo a corpo|distância|à distância)\s+/i, '').trim();
    if (!nome || /^(defesa|fort|ref|von|iniciativa|percep)/i.test(nome)) continue;
    const bonus = Number(m[2].replace('–', '-').replace(/\s/g, ''));
    const partes = m[3].split(',').map((x) => x.trim());
    const danoTexto = partes[0];
    const dado = /(\d*d\d+(?:\s*[+-]\s*\d+)?)/i.exec(danoTexto)?.[1]?.replace(/\s/g, '');
    if (!dado) continue;
    // "1d6+18 mais 1d6 fogo": o extra vira parte do dano (tipo do principal).
    const extra = /mais\s+(\d*d\d+)/i.exec(danoTexto)?.[1];
    let margem = 20;
    let mult = 2;
    for (const p of partes.slice(1)) {
      const crit = /^(\d{2})(?:\/x(\d))?$/.exec(p);
      if (crit) { margem = Number(crit[1]); if (crit[2]) mult = Number(crit[2]); }
      const x = /^x(\d)$/.exec(p);
      if (x) mult = Number(x[1]);
    }
    const tipoDano = tipoNoTexto(danoTexto) || NATURAIS.find(([r]) => r.test(nome))?.[1] || '';
    const distancia = distanciaPadrao || (DISTANCIA_NOME.test(nome) && !/corpo/i.test(nome));
    n += 1;
    ataques.push({
      id: `at${n}`, nome: nome.charAt(0).toUpperCase() + nome.slice(1), bonus,
      dano: extra ? `${dado}+${extra}` : dado, tipoDano, margem, mult,
      alcance: distancia ? 'Distância' : 'Corpo a corpo', distancia, arquetipo: arquetipo(nome, tipoDano, distancia),
    });
  }
  return ataques;
}

/** Ataques num texto com varias linhas "Corpo a Corpo ..." / "Distância ...". */
export function lerLinhasDeAtaque(texto: string): Ataque[] {
  const todos: Ataque[] = [];
  for (const linha of texto.split(/\n/)) {
    const corpo = /^\s*corpo a corpo\s+(.*)$/i.exec(linha);
    const dist = /^\s*(?:à\s+)?dist[âa]ncia\s+(.*)$/i.exec(linha);
    if (corpo) todos.push(...lerAtaques(corpo[1], false));
    else if (dist) todos.push(...lerAtaques(dist[1], true));
    else todos.push(...lerAtaques(linha, false));
  }
  return todos.map((a, i) => ({ ...a, id: `at${i + 1}` }));
}

/** Ataques de volta para texto (o editor mostra assim). */
export function escreverAtaques(ataques: Ataque[]) {
  return ataques.map((a) => {
    const crit = a.margem < 20 ? (a.mult !== 2 ? `${a.margem}/x${a.mult}` : `${a.margem}`) : a.mult !== 2 ? `x${a.mult}` : '';
    const tipo = a.tipoDano ? ` ${({ perfuracao: 'perfuração', psiquico: 'psíquico', acido: 'ácido', essencia: 'essência' } as Record<string, string>)[a.tipoDano] ?? a.tipoDano}` : '';
    return `${a.distancia ? 'Distância ' : ''}${a.nome} ${a.bonus >= 0 ? '+' : ''}${a.bonus} (${a.dano}${tipo}${crit ? `, ${crit}` : ''})`;
  }).join('\n');
}

export interface DefesasAmeaca {
  rd: Partial<Record<TipoDano | 'geral', number>>;
  imunidades: string[];
  vulnerabilidades: string[];
}

/**
 * "imunidade a ácido e veneno, redução de dano 15, vulnerabilidade a frio".
 * Virgula separa habilidades; " e " junta tipos dentro da mesma habilidade.
 */
export function lerDefesas(texto: string): DefesasAmeaca {
  const rd: DefesasAmeaca['rd'] = {};
  const imunidades: string[] = [];
  const vulnerabilidades: string[] = [];
  for (const item of texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    const geral = /^(?:redu[çc][ãa]o de dano|RD)\s*(\d+)/i.exec(item);
    if (geral) { rd.geral = Number(geral[1]); continue; }
    const porTipo = /^redu[çc][ãa]o de (.+?)\s+(\d+)/i.exec(item);
    if (porTipo) {
      for (const t of porTipo[1].split(/ e /)) { const tipo = tipoNoTexto(t); if (tipo) rd[tipo] = Number(porTipo[2]); }
      continue;
    }
    const imune = /^imunidades? a (.+)$/i.exec(item);
    if (imune) { imunidades.push(...imune[1].split(/ e /).map((x) => x.trim())); continue; }
    const vuln = /^vulnerabilidades? a (.+)$/i.exec(item);
    if (vuln) vulnerabilidades.push(...vuln[1].split(/ e /).map((x) => x.trim()));
  }
  return { rd, imunidades, vulnerabilidades };
}

export interface FichaAmeaca {
  nome: string;
  nd: string;
  tipo: string;
  tamanho: string;
  papel: string;
  iniciativa: number;
  percepcao: number;
  defesa: number;
  fort: number;
  ref: number;
  von: number;
  pv: number;
  pm: number;
  deslocamento: string;
  ataques: Ataque[];
  habilidades: string[];
  defesas: DefesasAmeaca;
  atributos: string;
  pericias: string;
  equipamento: string;
  /** Texto original (para o mestre conferir). */
  texto: string;
}

const numero = (t: string | undefined) => {
  const n = Number(String(t ?? '').replace('–', '-').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Le um bloco inteiro colado do livro. Devolve null se nao achar o essencial (Defesa e PV). */
export function lerBlocoAmeaca(texto: string): FichaAmeaca | null {
  const t = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  // A linha de Defesa pode quebrar (imunidades, RD...) ate "Pontos de Vida".
  const def = /Defesa\s+(\d+)\s*,\s*Fort\s+([+–-]\s?\d+)\s*,\s*Ref\s+([+–-]\s?\d+)\s*,\s*Von\s+([+–-]\s?\d+)([\s\S]*?)Pontos de Vida/i.exec(t);
  const pv = /Pontos de Vida\s+(\d{1,3}(?:\.\d{3})+|\d+)/i.exec(t);
  if (!def || !pv) return null;
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const nd = /\bND\s+(\d+\/\d+|\d+|S\+?)/i.exec(t)?.[1] ?? '';
  // Nome: primeira linha que nao e ND, tipo ou estatistica.
  const nome = linhas.find((l) => !/^ND\b|^(Iniciativa|Defesa|Pontos|Deslocamento|Corpo|Dist)/i.test(l) && !/^(Humanoide|Animal|Monstro|Esp[íi]rito|Construto|Morto-vivo)/i.test(l))
    ?.replace(/\s+ND\s+.*$/i, '').trim() ?? 'Ameaça';
  const linhaTipo = linhas.find((l) => /^(Humanoide|Animal|Monstro|Esp[íi]rito|Construto|Morto-vivo)/i.test(l)) ?? '';
  const tamanho = /(Minúsculo|Pequeno|Médio|Grande|Enorme|Colossal)/i.exec(linhaTipo)?.[1] ?? 'Médio';
  const ini = /Iniciativa\s+([+–-]\s?\d+)/i.exec(t);
  const per = /Percep[çc][ãa]o\s+([+–-]\s?\d+)/i.exec(t);
  const pm = /Pontos de Mana\s+(\d+)/i.exec(t);
  const desl = /Deslocamento\s+([^\n]+)/i.exec(t)?.[1].trim() ?? '9m';

  // Ataques: linhas "Corpo a Corpo"/"Distância" (podem quebrar em varias linhas ate o ponto final).
  const ataquesTexto: string[] = [];
  for (const m of t.matchAll(/(Corpo a Corpo|(?:À\s+)?Dist[âa]ncia)\s+([\s\S]*?\)\.)/gi)) ataquesTexto.push(`${m[1]} ${m[2].replace(/\n/g, ' ')}`);
  const ataques = ataquesTexto.flatMap((l) => lerAtaques(l.replace(/^(Corpo a Corpo|(?:À\s+)?Dist[âa]ncia)\s+/i, ''), !/^corpo/i.test(l)))
    .map((a, i) => ({ ...a, id: `at${i + 1}` }));

  // Habilidades: "Nome (Acao, X PM) texto" entre ataques e atributos.
  const habilidades: string[] = [];
  for (const m of t.matchAll(/(?:^|\n)([A-ZÀ-Ú][A-Za-zÀ-ú' -]{2,40}?)\s*\((Padrão|Movimento|Completa|Livre|Reação)[^)]*\)/g)) {
    if (!/^(Corpo|Dist)/i.test(m[1])) habilidades.push(m[1].trim());
  }

  return {
    nome, nd, tipo: linhaTipo, tamanho, papel: '',
    iniciativa: numero(ini?.[1]), percepcao: numero(per?.[1]),
    defesa: Number(def[1]), fort: numero(def[2]), ref: numero(def[3]), von: numero(def[4]),
    pv: Number(pv[1].replace(/\./g, '')), pm: pm ? Number(pm[1]) : 0, deslocamento: desl,
    ataques, habilidades: [...new Set(habilidades)].slice(0, 12),
    defesas: lerDefesas((def[5] ?? '').replace(/\n/g, ' ')),
    atributos: /(For\s+[–\-\d][^\n]*)/.exec(t)?.[1] ?? '',
    pericias: /Per[íi]cias\s+([^\n]+)/i.exec(t)?.[1] ?? '',
    equipamento: /Equipamento\s+([^\n]+)/i.exec(t)?.[1] ?? '',
    texto: texto.trim(),
  };
}
