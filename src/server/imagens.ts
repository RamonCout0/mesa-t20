// Imagens do mestre: tokens de herois e inimigos, galeria e cenarios.
import fs from 'node:fs';
import path from 'node:path';
import type { ImagemGaleria } from '../shared/tipos.ts';

export const EXT_IMAGEM = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
export const PASTAS = {
  '/personagens/': 'personagens',
  '/bosses/': 'bosses',
  '/galeria/': 'galeria',
  '/cenarios/': 'cenarios',
} as const;
export type Pasta = (typeof PASTAS)[keyof typeof PASTAS];
export const NOMES_PASTA = Object.values(PASTAS) as Pasta[];

export const LIMITE_IMAGEM = 25 * 1024 * 1024;
export const EXT_DO_TIPO: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
};

export function criarPastas(raiz: string) {
  for (const pasta of [...NOMES_PASTA, 'lixeira']) fs.mkdirSync(path.join(raiz, pasta), { recursive: true });
}

export function dentroDe(raiz: string, pasta: string, relativo: string) {
  const completo = path.join(raiz, pasta, relativo);
  return completo.startsWith(path.join(raiz, pasta) + path.sep) ? completo : null;
}

export function listarImagens(raiz: string): ImagemGaleria[] {
  return Object.entries(PASTAS).flatMap(([prefixo, pasta]) => {
    const dir = path.join(raiz, pasta);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((n) => EXT_IMAGEM.has(path.extname(n).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((n) => ({
        url: prefixo + encodeURIComponent(n),
        nome: n,
        pasta: pasta as ImagemGaleria['pasta'],
        data: fs.statSync(path.join(dir, n)).mtimeMs,
      }));
  });
}

// Confere a assinatura do arquivo: so entra o que e imagem de verdade.
export function pareceImagem(dados: Buffer, ext: string) {
  const inicio = dados.subarray(0, 12);
  if (ext === '.png') return inicio.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (ext === '.jpg' || ext === '.jpeg') return inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff;
  if (ext === '.gif') return inicio.toString('latin1', 0, 4) === 'GIF8';
  if (ext === '.webp') return inicio.toString('latin1', 0, 4) === 'RIFF' && inicio.toString('latin1', 8, 12) === 'WEBP';
  if (ext === '.svg') return dados.subarray(0, 4000).toString('utf8').includes('<svg');
  return false;
}

// "Mapa da Região (1).JPG" -> "mapa-da-região-1.jpg", sem sobrescrever o que ja existe.
export function nomeLivre(raiz: string, pasta: string, original: string, ext: string) {
  const base = original.normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'imagem';
  let nome = `${base}${ext}`;
  for (let i = 2; fs.existsSync(path.join(raiz, pasta, nome)); i += 1) nome = `${base}-${i}${ext}`;
  return nome;
}
