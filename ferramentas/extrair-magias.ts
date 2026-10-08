// Extrai o grimorio do Fichas de Nimb (projeto MIT) para src/shared/dados/magias.json.
//
//   node ferramentas/extrair-magias.ts <pasta do gerador-ficha-tormenta20>
//
// Le os arquivos de magias em TypeScript do Nimb, empacota com o rolldown (que ja vem com o Vite)
// e grava so os dados: nome, tipo, circulo, escola, execucao, alcance, alvo/area, duracao,
// resistencia, descricao, aprimoramentos e rolagens de dano.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

const nimb = path.resolve(process.argv[2] ?? '');
const dadosNimb = path.join(nimb, 'src/data/systems/tormenta20');
if (!fs.existsSync(path.join(dadosNimb, 'magias/generalSpells.ts'))) {
  console.error('Uso: node ferramentas/extrair-magias.ts <pasta do gerador-ficha-tormenta20>');
  process.exit(1);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'magias-'));
const entrada = path.join(temp, 'entrada.ts');
fs.writeFileSync(entrada, `
import * as geral from ${JSON.stringify(path.join(dadosNimb, 'magias/generalSpells.ts'))};
import * as arcanas from ${JSON.stringify(path.join(dadosNimb, 'magias/arcane.ts'))};
import * as divinas from ${JSON.stringify(path.join(dadosNimb, 'magias/divine.ts'))};
import deuses from ${JSON.stringify(path.join(dadosNimb, 'deuses-de-arton/spells.ts'))};
import herois from ${JSON.stringify(path.join(dadosNimb, 'herois-de-arton/spells.ts'))};
import ameacas from ${JSON.stringify(path.join(dadosNimb, 'ameacas-de-arton/spells.ts'))};
export { geral, arcanas, divinas, deuses, herois, ameacas };
`);

// Dependencias do Nimb que nao importam para os dados viram stubs.
const STUBS: Record<string, string> = {
  uuid: 'export const v4 = () => "";',
  lodash: 'export const cloneDeep = (x) => structuredClone(x); export default {};',
  randomUtils: 'export const pickFromArray = (a) => a; export const getRandomItemFromArray = (a) => a[0];',
};

const saida = path.join(temp, 'magias.mjs');
await build({
  input: entrada,
  platform: 'node',
  logLevel: 'silent',
  resolve: { alias: { '@': path.join(nimb, 'src') } },
  plugins: [{
    name: 'stubs',
    resolveId(id) {
      if (id === 'uuid' || id === 'lodash') return `\0stub:${id}`;
      if (/functions\/randomUtils$/.test(id)) return '\0stub:randomUtils';
      return null;
    },
    load(id) {
      return id.startsWith('\0stub:') ? STUBS[id.slice(6)] : null;
    },
  }],
  output: { file: saida, format: 'esm' },
});

interface Rolagem { label: string; dice: string; damageType?: string }
interface Aprim { addPm: number; text: string; trick?: boolean; damageBonus?: unknown[] }
interface MagiaNimb {
  nome: string; execucao: string; alcance: string; alvo?: string; area?: string; duracao: string;
  resistencia?: string; description: string; spellCircle: string; school: string;
  aprimoramentos?: Aprim[]; rolls?: Rolagem[];
}

const m = await import(pathToFileURL(saida).href);
fs.rmSync(temp, { recursive: true, force: true });

const nomesDe = (lista: MagiaNimb[]) => new Set(lista.map((x) => x.nome));
const todasDoCirculo = (prefixo: string) => [1, 2, 3, 4, 5].flatMap((c) => Object.values(m[prefixo][`${prefixo === 'arcanas' ? 'arcane' : 'divine'}SpellsCircle${c}`] as Record<string, MagiaNimb[]>).flat());
const arcanasBasico = nomesDe(todasDoCirculo('arcanas'));
const divinasBasico = nomesDe(todasDoCirculo('divinas'));

const basico: MagiaNimb[] = [1, 2, 3, 4, 5].flatMap((c) => Object.values(m.geral[`spellsCircle${c}`] as Record<string, MagiaNimb>));

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const circulo = (s: string) => Number.parseInt(s, 10);

function normalizar(x: MagiaNimb, tipo: string, fonte: string) {
  return {
    id: slug(x.nome),
    nome: x.nome,
    tipo,
    circulo: circulo(x.spellCircle),
    escola: x.school,
    execucao: x.execucao,
    alcance: x.alcance,
    alvo: x.alvo ?? '',
    area: x.area ?? '',
    duracao: x.duracao,
    resistencia: x.resistencia ?? '',
    descricao: x.description,
    aprimoramentos: (x.aprimoramentos ?? []).map((a) => ({
      pm: a.addPm, texto: a.text, ...(a.trick ? { truque: true } : {}), ...(a.damageBonus ? { dano: a.damageBonus } : {}),
    })),
    rolagens: (x.rolls ?? []).map((r) => ({ rotulo: r.label, dados: r.dice, ...(r.damageType ? { tipoDano: r.damageType } : {}) })),
    fonte,
  };
}

const lista = [
  ...basico.map((x) => {
    const a = arcanasBasico.has(x.nome);
    const d = divinasBasico.has(x.nome);
    return normalizar(x, a && d ? 'universal' : a ? 'arcana' : d ? 'divina' : 'universal', 'Tormenta20');
  }),
  ...[['deuses', 'Deuses de Arton'], ['herois', 'Heróis de Arton'], ['ameacas', 'Ameaças de Arton']].flatMap(([chave, fonte]) => {
    const s = m[chave] as { arcane?: MagiaNimb[]; divine?: MagiaNimb[]; universal?: MagiaNimb[] };
    return [
      ...(s.arcane ?? []).map((x) => normalizar(x, 'arcana', fonte)),
      ...(s.divine ?? []).map((x) => normalizar(x, 'divina', fonte)),
      ...(s.universal ?? []).map((x) => normalizar(x, 'universal', fonte)),
    ];
  }),
];

// Mesma magia em duas listas (ex.: arcana e divina num suplemento) vira uma so, universal.
const porId = new Map<string, (typeof lista)[number]>();
for (const x of lista) {
  const ja = porId.get(x.id);
  if (ja && ja.tipo !== x.tipo) ja.tipo = 'universal';
  else if (!ja) porId.set(x.id, x);
}
const final = [...porId.values()].sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

const destino = path.join(import.meta.dirname, '..', 'src', 'shared', 'dados', 'magias.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, `${JSON.stringify(final, null, 1)}\n`);
const porFonte = final.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.fonte]: (acc[x.fonte] ?? 0) + 1 }), {});
console.log(`${final.length} magias gravadas em ${path.relative(process.cwd(), destino)}`, porFonte);
