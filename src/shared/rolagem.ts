// Notacao de dados ("2d6+1d4+3") e rolagem. O sorteio vem de fora (o servidor usa crypto),
// assim o mesmo codigo serve para testes com resultado fixo.

export type Sorteio = (faces: number) => number;

export interface Termo {
  qtd: number;
  faces: number; // 0 = numero fixo
  sinal: 1 | -1;
}

export interface DadoRolado {
  faces: number;
  valor: number;
}

export interface Rolada {
  expressao: string;
  dados: DadoRolado[];
  bonus: number;
  total: number;
}

export const FACES_VALIDAS = [2, 3, 4, 6, 8, 10, 12, 20, 100];

/** "2d6+1d4+3" -> termos. Aceita "d20", "-2", espacos e "x" no lugar de "*". Lanca erro se nao entender. */
export function lerExpressao(texto: string): Termo[] {
  const limpo = texto.toLowerCase().replace(/\s+/g, '');
  if (!limpo || !/^[-+]?(\d*d\d+|\d+)([-+](\d*d\d+|\d+))*$/.test(limpo)) throw new Error(`Não entendi a rolagem "${texto}".`);
  const termos: Termo[] = [];
  for (const m of limpo.matchAll(/([-+]?)(\d*)d(\d+)|([-+]?)(\d+)/g)) {
    if (m[3]) {
      const qtd = m[2] === '' ? 1 : Number(m[2]);
      const faces = Number(m[3]);
      if (qtd > 100 || !FACES_VALIDAS.includes(faces)) throw new Error(`Dado estranho em "${texto}".`);
      termos.push({ qtd, faces, sinal: m[1] === '-' ? -1 : 1 });
    } else if (m[5]) {
      termos.push({ qtd: Number(m[5]), faces: 0, sinal: m[4] === '-' ? -1 : 1 });
    }
  }
  return termos;
}

export const expressaoValida = (texto: string) => {
  try {
    lerExpressao(texto);
    return true;
  } catch {
    return false;
  }
};

/** Escreve termos de volta ("2d6+3"). */
export function escreverTermos(termos: Termo[]) {
  const partes = termos.filter((t) => t.qtd).map((t, i) => {
    const corpo = t.faces ? `${t.qtd}d${t.faces}` : `${t.qtd}`;
    return t.sinal < 0 ? `-${corpo}` : i ? `+${corpo}` : corpo;
  });
  return partes.join('') || '0';
}

/** Multiplica so os dados (critico): "1d8+3" x2 -> "2d8+3". */
export function multiplicarDados(expressao: string, mult: number) {
  return escreverTermos(lerExpressao(expressao).map((t) => (t.faces ? { ...t, qtd: t.qtd * mult } : t)));
}

/** Soma dados a uma expressao. `extra` pode ser "2d6", "+5" ou "1d6+2". */
export function somarExpressao(expressao: string, extra: string) {
  const a = lerExpressao(expressao);
  for (const t of lerExpressao(extra)) {
    const igual = a.find((x) => x.faces === t.faces && x.sinal === t.sinal);
    if (igual) igual.qtd += t.qtd;
    else a.push({ ...t });
  }
  return escreverTermos(a);
}

/** Acrescenta `n` dados do mesmo tipo do primeiro dado da expressao (aprimoramento "+2d6"). */
export function maisDadosIguais(expressao: string, n: number) {
  const a = lerExpressao(expressao);
  const dado = a.find((t) => t.faces && t.sinal > 0);
  if (dado) dado.qtd += n;
  return escreverTermos(a);
}

export function rolar(expressao: string, sorteio: Sorteio): Rolada {
  const dados: DadoRolado[] = [];
  let bonus = 0;
  let total = 0;
  for (const t of lerExpressao(expressao)) {
    if (!t.faces) {
      bonus += t.sinal * t.qtd;
      total += t.sinal * t.qtd;
      continue;
    }
    for (let i = 0; i < t.qtd; i += 1) {
      const valor = sorteio(t.faces);
      dados.push({ faces: t.faces, valor: t.sinal * valor });
      total += t.sinal * valor;
    }
  }
  return { expressao, dados, bonus, total };
}

/** Media de uma expressao (para o mestre ver antes de rolar). */
export function media(expressao: string) {
  return lerExpressao(expressao).reduce((s, t) => s + t.sinal * (t.faces ? (t.qtd * (t.faces + 1)) / 2 : t.qtd), 0);
}
