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

import type { Ataque, ArquetipoArma, Habilidade, TipoDano } from './tipos.ts';

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

// ---------------- habilidades ----------------

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EXECUCAO = /^(Padrão|Movimento|Completa|Livre|Reação)/;
// Palavras que comecam a descricao, nao o nome ("Aura Aterradora Vontade CD 32 evita").
const FIM_DO_NOME = new Set([
  'vontade', 'fortitude', 'reflexos', 'fort', 'ref', 'von', 'cd', 'um', 'uma', 'o', 'a', 'os', 'as', 'quando', 'se', 'criaturas',
  'todos', 'todas', 'cada', 'enquanto', 'no', 'na', 'ao', 'sempre', 'este', 'esta', 'esse', 'essa', 'seu', 'sua', 'como', 'ate',
  'uma', 'inimigos', 'aliados', 'pode', 'recebe', 'sofre', 'faz', 'fica', 'ganha', 'possui', 'tem',
]);
const LIGA_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "Aura Aterradora Vontade CD 32 evita." -> "Aura Aterradora" (2+ palavras com maiuscula, ou nada). */
function nomeSemParenteses(linha: string) {
  const palavras = linha.split(' ');
  const nome: string[] = [];
  for (const p of palavras) {
    const limpa = sem(p.replace(/[.,:;]$/, ''));
    if (FIM_DO_NOME.has(limpa)) break;
    if (/^[A-ZÀ-Ú][\wÀ-ú'-]*$/.test(p)) { nome.push(p); continue; }
    if (LIGA_NOME.has(p) && nome.length) { nome.push(p); continue; }
    break;
  }
  while (nome.length && LIGA_NOME.has(nome[nome.length - 1])) nome.pop();
  return nome.length >= 2 && nome.length <= 5 ? nome.join(' ') : '';
}

const CONDICOES_TEXTO: [RegExp, string][] = [
  [/abalad/, 'abalado'], [/agarrad/, 'agarrado'], [/alquebrad/, 'alquebrado'], [/apavorad/, 'apavorado'], [/atordoad/, 'atordoado'],
  [/\bca[ií]d[oa]s?\b/, 'caido'], [/\bceg[oa]s?\b/, 'cego'], [/confus[oa]/, 'confuso'], [/debilitad/, 'debilitado'],
  [/desprevenid/, 'desprevenido'], [/em chamas/, 'em-chamas'], [/enfeiti[çc]ad/, 'enfeiticado'], [/enjoad/, 'enjoado'],
  [/enredad/, 'enredado'], [/envenenad/, 'envenenado'], [/esmorecid/, 'esmorecido'], [/exaust/, 'exausto'], [/fascinad/, 'fascinado'],
  [/fatigad/, 'fatigado'], [/\bfrac[oa]s?\b/, 'fraco'], [/frustrad/, 'frustrado'], [/im[oó]ve(l|is)/, 'imovel'], [/inconscient/, 'inconsciente'],
  [/indefes/, 'indefeso'], [/\blent[oa]s?\b/, 'lento'], [/ofuscad/, 'ofuscado'], [/paralisad/, 'paralisado'], [/\bpasm[oa]s?\b/, 'pasmo'],
  [/petrificad/, 'petrificado'], [/sangrand/, 'sangrando'], [/\bsurd[oa]s?\b/, 'surdo'], [/vulner[aá]ve(l|is)/, 'vulneravel'],
];

/**
 * Le o que da para automatizar numa habilidade: dano, teste (CD), metade/anula, condicoes, cura e PM.
 * O resto continua no texto para o mestre ler.
 */
export function mecanicaDoTexto(texto: string, cdPadrao?: number): Omit<Habilidade, 'nome' | 'ativa' | 'texto' | 'execucao'> {
  const t = texto.replace(/\s+/g, ' ');
  const dano = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(?:pontos\s+de\s+)?dano(?:\s+de\s+([a-zà-ú]+))?/i.exec(t);
  // "Von CD 32 evita" ou, nas magias do bloco, "(Von anula)" com a CD do conjurador.
  const res = /\b(Fort(?:itude)?|Ref(?:lexos)?|Von(?:tade)?)\s+CD\s+(\d+)/i.exec(t)
    ?? (cdPadrao ? /\b(Fort(?:itude)?|Ref(?:lexos)?|Von(?:tade)?)\s+()(?:anula|evita|reduz|parcial)/i.exec(t) : null);
  const cura = /(?:recupera|cura)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)/i.exec(t);
  const pm = /\b(\d+)\s*PM\b/.exec(t);
  const rodadas = /por\s+(\d+)\s+rodadas?/i.exec(t);
  // Condicoes so quando a habilidade impoe algo ("fica cego", "ficam lentas"), nao quando so cita.
  const impoe = /\b(fic(a|am|ando|ar)|torna(-se)?|deixa|cai|caem)\b/i.test(t);
  const condicoes = impoe
    ? [...new Set(CONDICOES_TEXTO.filter(([rx]) => rx.test(sem(t))).map(([, id]) => id))].slice(0, 3).map((c) => (rodadas ? `${c}:${rodadas[1]}` : c))
    : [];
  const r = res ? (sem(res[1]).startsWith('f') ? 'fort' : sem(res[1]).startsWith('r') ? 'ref' : 'von') : '';
  const sucesso: 'metade' | 'anula' = /reduz\w*\s+(?:à|a)\s+metade|metade do dano/i.test(t) ? 'metade' : 'anula';
  const temEfeito = Boolean(dano || res || condicoes.length);
  return {
    ...(pm ? { pm: Number(pm[1]) } : {}),
    alvo: temEfeito ? 'inimigos' : cura ? 'si' : 'nenhum',
    ...(dano ? { dano: dano[1].replace(/\s/g, ''), tipoDano: tipoNoTexto(dano[2] ?? '') } : {}),
    ...(cura ? { cura: cura[1].replace(/\s/g, '') } : {}),
    ...(r ? { res: r, cd: Number(res![2]) || cdPadrao || 15, sucesso: dano ? sucesso : 'anula' } : {}),
    ...(condicoes.length ? { condicoes } : {}),
  };
}

/**
 * Habilidades do bloco: tudo entre os ataques e os atributos ("For ..."), uma por paragrafo.
 * Comeca habilidade nova: "Nome (Execução, X PM) ...", "• Magia (...)" ou, depois de um ponto final,
 * duas ou mais palavras com maiuscula ("Aura Aterradora Vontade CD 32 evita.").
 */
export function lerHabilidades(trecho: string, nomeAmeaca = ''): Habilidade[] {
  // Magia em lista que veio colada no fim de outra linha ("Lich de Aslothia • Conjurar Monstro").
  const linhas = trecho.replace(/\r/g, '').replace(/\s+•\s+/g, '\n• ').split('\n').map((l) => l.trim()).filter(Boolean)
    // Rodape/cabecalho de pagina que vem junto do PDF ("69Dragão Venerável").
    .filter((l) => !/^\d+\s*[A-ZÀ-Ú]/.test(l) && sem(l) !== sem(nomeAmeaca));
  const lidas: { nome: string; parenteses: string; texto: string[] }[] = [];
  let fimDeFrase = true;
  for (const linha of linhas) {
    const corpo = linha.replace(/^[•·▪-]\s*/, '');
    const bala = corpo !== linha;
    const comPar = /^([A-ZÀ-Ú][\wÀ-ú'’ -]{1,50}?)\s*\(([^)]*)\)\s*(.*)$/.exec(corpo);
    const parValido = comPar && (EXECUCAO.test(comPar[2]) || bala);
    if (parValido) {
      lidas.push({ nome: comPar[1].trim(), parenteses: comPar[2], texto: [comPar[3]] });
    } else if (/^Magias\b/.test(corpo) && fimDeFrase) {
      lidas.push({ nome: 'Magias', parenteses: '', texto: [corpo.replace(/^Magias\s*/, '')] });
    } else if (fimDeFrase && nomeSemParenteses(corpo)) {
      const nome = nomeSemParenteses(corpo);
      lidas.push({ nome, parenteses: '', texto: [corpo.slice(nome.length).trim()] });
    } else if (lidas.length) {
      lidas[lidas.length - 1].texto.push(corpo);
    }
    fimDeFrase = /[.!:)]$/.test(linha);
  }
  // CD das magias da ameaca: "Magias Como um conjurador arcano de 11º nível (CD 32)."
  const cdMagias = Number(/CD\s+(\d+)/.exec(lidas.find((l) => l.nome === 'Magias')?.texto.join(' ') ?? '')?.[1]) || undefined;
  return lidas.map(({ nome, parenteses, texto }) => {
    // "imposi-\nção" -> "imposição"
    const t = texto.join('\n').replace(/-\n(?=[a-zà-ú])/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    // "Magias Como um mago de 17º nível (CD 42...)": so informacao, cada magia vem logo abaixo.
    if (nome === 'Magias') return { nome, ativa: false, texto: t.slice(0, 3000), alvo: 'nenhum' as const };
    const execucao = EXECUCAO.exec(parenteses)?.[1] ?? '';
    const mec = mecanicaDoTexto(`${parenteses} ${t}`, cdMagias);
    const pmPar = /(\d+)\s*PM/i.exec(parenteses);
    return {
      nome: nome.slice(0, 60), ativa: false, texto: (parenteses ? `(${parenteses}) ${t}` : t).slice(0, 3000),
      ...(execucao ? { execucao } : {}),
      ...mec,
      ...(pmPar ? { pm: Number(pmPar[1]) } : {}),
    };
  }).filter((h) => h.texto.replace(/^\([^)]*\)\s*/, '').length > 2 || h.execucao);
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
  habilidades: Habilidade[];
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
  let fimAtaques = -1;
  // So no comeco da linha: "corpo a corpo" tambem aparece no meio das descricoes de habilidade.
  for (const m of t.matchAll(/(?:^|\n)\s*(Corpo a Corpo|(?:À\s+)?Dist[âa]ncia)\s+([\s\S]*?\)\.)/g)) {
    ataquesTexto.push(`${m[1]} ${m[2].replace(/\n/g, ' ')}`);
    fimAtaques = Math.max(fimAtaques, m.index! + m[0].length);
  }
  const ataques = ataquesTexto.flatMap((l) => lerAtaques(l.replace(/^(Corpo a Corpo|(?:À\s+)?Dist[âa]ncia)\s+/i, ''), !/^corpo/i.test(l)))
    .map((a, i) => ({ ...a, id: `at${i + 1}` }));

  // Habilidades: do fim dos ataques (ou do PV/PM/deslocamento) ate a linha de atributos.
  const inicioHab = fimAtaques >= 0 ? fimAtaques
    : Math.max(...[/Pontos de Mana[^\n]*/i, /Deslocamento[^\n]*/i, /Pontos de Vida[^\n]*/i].map((rx) => { const m = rx.exec(t); return m ? m.index + m[0].length : -1; }));
  const fimHab = (() => {
    const m = /\n\s*(For\s+[–\-\d]|Per[íi]cias\s|Equipamento\s|Tesouro\s)/i.exec(t.slice(inicioHab));
    return m ? inicioHab + m.index : t.length;
  })();
  const habilidades = lerHabilidades(t.slice(inicioHab, fimHab), nome);

  return {
    nome, nd, tipo: linhaTipo, tamanho, papel: '',
    iniciativa: numero(ini?.[1]), percepcao: numero(per?.[1]),
    defesa: Number(def[1]), fort: numero(def[2]), ref: numero(def[3]), von: numero(def[4]),
    pv: Number(pv[1].replace(/\./g, '')), pm: pm ? Number(pm[1]) : 0, deslocamento: desl,
    ataques, habilidades,
    defesas: lerDefesas((def[5] ?? '').replace(/\n/g, ' ')),
    atributos: /(For\s+[–\-\d][^\n]*)/.exec(t)?.[1] ?? '',
    pericias: /Per[íi]cias\s+([^\n]+)/i.exec(t)?.[1] ?? '',
    equipamento: /Equipamento\s+([^\n]+)/i.exec(t)?.[1] ?? '',
    texto: texto.trim(),
  };
}
