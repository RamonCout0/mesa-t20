// Confere o importador do PDF do Nimb: node ferramentas/testar-importacao.ts <pasta com .pdf e .json>
import fs from 'node:fs';
import path from 'node:path';
import { importarPdfNimb } from '../src/server/importar-nimb.ts';
import { buscarMagia } from '../src/shared/magias.ts';

const pasta = process.argv[2];
let erros = 0;
for (const arq of fs.readdirSync(pasta).filter((a) => a.endsWith('.pdf'))) {
  const { ficha: f, avisos } = await importarPdfNimb(new Uint8Array(fs.readFileSync(path.join(pasta, arq))));
  const gab = JSON.parse(fs.readFileSync(path.join(pasta, arq.replace(/\.pdf$/, '.json')), 'utf8'));
  const prob: string[] = [];
  if (f.nome !== gab.nome) prob.push(`nome ${f.nome} != ${gab.nome}`);
  if (f.nivel !== gab.nivel) prob.push(`nivel ${f.nivel} != ${gab.nivel}`);
  if (f.pvMax !== gab.pv) prob.push(`pv ${f.pvMax} != ${gab.pv}`);
  if (f.pmMax !== gab.pm) prob.push(`pm ${f.pmMax} != ${gab.pm}`);
  if (f.defesa !== gab.defesa) prob.push(`defesa ${f.defesa} != ${gab.defesa}`);
  const esperadas = gab.spells.map((n: string) => buscarMagia(n)?.id ?? `?${n}`).sort();
  const lidas = [...f.magias].sort();
  if (JSON.stringify(esperadas) !== JSON.stringify(lidas)) prob.push(`magias ${lidas} != ${esperadas}`);
  const attrs = Object.values(gab.atributos).join(',');
  if (Object.values(f.atributos).join(',') !== attrs) prob.push(`atributos ${Object.values(f.atributos)} != ${attrs}`);
  if (prob.length) erros += 1;
  console.log(prob.length ? 'FALHOU' : 'ok    ', arq, `| ${f.classe} ${f.nivel} | CD ${f.atributoChave ?? '-'}+${f.bonusCd} | Ini ${f.pericias.Iniciativa?.total} | ${f.ataques.map((a) => `${a.nome} ${a.bonus >= 0 ? '+' : ''}${a.bonus} ${a.dano} ${a.margem}/x${a.mult} ${a.tipoDano} [${a.arquetipo}]`).join('; ')} | RD ${JSON.stringify(f.rd)}`);
  for (const p of prob) console.log('   ', p);
  for (const a of avisos) console.log('    aviso:', a);
}
process.exit(erros ? 1 : 0);
