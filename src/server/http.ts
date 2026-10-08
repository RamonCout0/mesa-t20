// Pecas pequenas de HTTP usadas pelas rotas.
import type http from 'node:http';

export type Req = http.IncomingMessage;
export type Res = http.ServerResponse;

export function responder(res: Res, codigo: number, objeto: unknown) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(objeto));
}

export function lerBinario(req: Req, limite: number, mensagem = 'Arquivo grande demais.'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (parte: Buffer) => {
      total += parte.length;
      if (total > limite) {
        reject(new Error(mensagem));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

export async function lerJson<T = Record<string, unknown>>(req: Req, limite = 200_000): Promise<T> {
  const corpo = await lerBinario(req, limite, 'Pedido grande demais.');
  return JSON.parse(corpo.toString('utf8') || '{}') as T;
}
