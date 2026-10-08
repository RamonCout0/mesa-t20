// Enche o bestiario com os blocos de estatisticas de um livro de Tormenta20 (PDF do proprio mestre).
//   npm run bestiario -- "caminho/Ameaças de Arton.pdf"            (so acrescenta as novas)
//   npm run bestiario -- "caminho/Ameaças de Arton.pdf" --atualizar (refaz os numeros das que ja existem)
// As fichas ficam em data/bestiario/ e nao vao para o git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bestiario } from '../src/server/bestiario.ts';
import { ameacasDoLivro, dadosDaAmeaca, linhasDoPdf } from '../src/server/bestiario-livro.ts';

const arquivo = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!arquivo) {
  console.log('Uso: npm run bestiario -- "caminho/do/livro.pdf" [--atualizar]');
  process.exit(1);
}
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dados = fs.readFileSync(arquivo);
const pdf = dados.subarray(0, 5).toString('latin1') === '%PDF-';
const lidas = ameacasDoLivro(pdf
  ? await linhasDoPdf(new Uint8Array(dados), (p, n) => process.stdout.write(`\rLendo página ${p}/${n}`))
  : dados.toString('utf8'));
console.log(`\n${lidas.length} blocos de ameaça encontrados.`);
const r = new Bestiario(raiz).importar(lidas.map(dadosDaAmeaca), process.argv.includes('--atualizar'));
console.log(`Novas: ${r.novas} · atualizadas: ${r.atualizadas} · já existiam: ${r.iguais} · sem ND (confira no painel): ${lidas.filter((f) => !f.nd).length}`);
console.log('Abra a aba Bestiário do painel do mestre para ver.');
