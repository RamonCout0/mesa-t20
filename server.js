// Servidor local da mesa de Tormenta 20.
//
//   Telao (OBS / TV) .. http://localhost:8787/telao
//   Mestre ............ http://localhost:8787/mestre   (so neste computador, ou com PIN)
//   Outra tela (TV/tablet/PC no Wi-Fi) .. http://<ip-do-mestre>:8787/telao

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  carregar, salvar, executar, estadoDemo, visaoPublica, filtrarEvento, ACAO_SEM_HISTORICO,
} from './src/estado.js';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_ESTADO = path.join(RAIZ, 'data', 'estado.json');

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'mesa.json'), 'utf8'));
  } catch {
    return {};
  }
}
const config = lerConfig();
const PORTA = Number(process.env.PORTA ?? config.porta ?? 8787);
const PIN = String(process.env.PIN ?? config.pin ?? '');

let estado = carregar(ARQUIVO_ESTADO);
const historico = []; // fotos do estado, para o botao Desfazer

// ---------------- acesso do mestre ----------------

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function ehMestre(req, url) {
  if (LOOPBACK.has(req.socket.remoteAddress)) return true;
  return Boolean(PIN) && (req.headers['x-pin'] === PIN || url.searchParams.get('pin') === PIN);
}

// ---------------- tempo real (SSE) ----------------

const clientes = new Set();

function enviar(cliente, evento, dados) {
  cliente.res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
}

function transmitir(eventos = []) {
  const publico = visaoPublica(estado);
  for (const c of clientes) {
    enviar(c, 'estado', c.mestre ? estado : publico);
    for (const ev of eventos) {
      const visto = c.mestre ? ev : filtrarEvento(estado, ev);
      if (visto) enviar(c, 'evento', visto);
    }
  }
}

setInterval(() => {
  for (const c of clientes) c.res.write(': batimento\n\n');
}, 15000);

function abrirFluxo(req, res, url) {
  const mestre = url.searchParams.get('visao') === 'mestre';
  if (mestre && !ehMestre(req, url)) {
    res.writeHead(403).end('Acesso do mestre negado.');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 1500\n\n');
  const cliente = { res, mestre };
  clientes.add(cliente);
  enviar(cliente, 'estado', mestre ? estado : visaoPublica(estado));
  req.on('close', () => clientes.delete(cliente));
}

// ---------------- API do mestre ----------------

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', (parte) => {
      corpo += parte;
      if (corpo.length > 100_000) {
        reject(new Error('Pedido grande demais.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(corpo));
    req.on('error', reject);
  });
}

function responder(res, codigo, objeto) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(objeto));
}

function aplicarAcao(acao) {
  if (acao.tipo === 'desfazer') {
    const foto = historico.pop();
    if (!foto) throw new Error('Nada para desfazer.');
    estado = JSON.parse(foto);
    return [];
  }
  if (acao.tipo === 'reiniciar') {
    historico.push(JSON.stringify(estado));
    estado = estadoDemo();
    return [];
  }
  const foto = JSON.stringify(estado);
  const eventos = executar(estado, acao);
  if (!ACAO_SEM_HISTORICO.has(acao.tipo)) {
    historico.push(foto);
    if (historico.length > 60) historico.shift();
  }
  return eventos;
}

async function tratarAcao(req, res, url) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode fazer isso.' });
  try {
    const eventos = aplicarAcao(JSON.parse(await lerCorpo(req)));
    salvar(ARQUIVO_ESTADO, estado);
    transmitir(eventos);
    return responder(res, 200, { ok: true, podeDesfazer: historico.length > 0 });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: erro.message });
  }
}

// ---------------- arquivos ----------------

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
};
const EXT_IMAGEM = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
const PASTAS = { '/personagens/': 'personagens', '/bosses/': 'bosses', '/galeria/': 'galeria' };
const PAGINAS = { '/': 'index.html', '/telao': 'telao.html', '/overlay': 'telao.html', '/mestre': 'mestre.html', '/painel': 'mestre.html' };

for (const pasta of [...Object.values(PASTAS), 'lixeira']) fs.mkdirSync(path.join(RAIZ, pasta), { recursive: true });

// Imagens enviadas pelo mestre nunca rodam script, mesmo um SVG aberto direto no navegador.
const CABECALHO_IMAGEM = { 'Content-Security-Policy': "script-src 'none'", 'X-Content-Type-Options': 'nosniff' };

function servir(res, caminho, extras = {}) {
  fs.readFile(caminho, (erro, dados) => {
    if (erro) {
      res.writeHead(404).end('Nao encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(caminho).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...extras });
    res.end(dados);
  });
}

function dentroDe(pasta, relativo) {
  const completo = path.join(RAIZ, pasta, relativo);
  return completo.startsWith(path.join(RAIZ, pasta) + path.sep) ? completo : null;
}

function listarImagens() {
  return Object.entries(PASTAS).flatMap(([prefixo, pasta]) => {
    const dir = path.join(RAIZ, pasta);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((n) => EXT_IMAGEM.has(path.extname(n).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((n) => ({ url: prefixo + encodeURIComponent(n), nome: n, pasta, data: fs.statSync(path.join(dir, n)).mtimeMs }));
  });
}

// ---------------- envio e remocao de imagens (galeria) ----------------

const LIMITE_IMAGEM = 25 * 1024 * 1024;
const EXT_DO_TIPO = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };

function lerBinario(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (parte) => {
      total += parte.length;
      if (total > limite) {
        reject(new Error('Imagem grande demais (máximo 25 MB).'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

// Confere a assinatura do arquivo: so entra o que e imagem de verdade.
function pareceImagem(dados, ext) {
  const inicio = dados.subarray(0, 12);
  if (ext === '.png') return inicio.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (ext === '.jpg' || ext === '.jpeg') return inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff;
  if (ext === '.gif') return inicio.toString('latin1', 0, 4) === 'GIF8';
  if (ext === '.webp') return inicio.toString('latin1', 0, 4) === 'RIFF' && inicio.toString('latin1', 8, 12) === 'WEBP';
  if (ext === '.svg') return dados.subarray(0, 4000).toString('utf8').includes('<svg');
  return false;
}

// "Mapa da Região (1).JPG" -> "mapa-da-região-1.jpg", sem sobrescrever o que ja existe.
function nomeLivre(pasta, original, ext) {
  const base = original.normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'imagem';
  let nome = `${base}${ext}`;
  for (let i = 2; fs.existsSync(path.join(RAIZ, pasta, nome)); i += 1) nome = `${base}-${i}${ext}`;
  return nome;
}

async function tratarEnvio(req, res, url) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode enviar imagens.' });
  try {
    const pasta = Object.values(PASTAS).includes(url.searchParams.get('pasta')) ? url.searchParams.get('pasta') : 'galeria';
    let original = 'imagem';
    try { original = decodeURIComponent(String(req.headers['x-nome'] ?? 'imagem')); } catch { /* nome estranho: usa o padrao */ }
    const ext = (path.extname(original).toLowerCase() || EXT_DO_TIPO[req.headers['content-type']] || '').replace('.jpeg', '.jpg');
    if (!EXT_IMAGEM.has(ext)) throw new Error('Formato não suportado. Use PNG, JPG, WEBP, GIF ou SVG.');
    if (Number(req.headers['content-length']) > LIMITE_IMAGEM) throw new Error('Imagem grande demais (máximo 25 MB).');
    const dados = await lerBinario(req, LIMITE_IMAGEM);
    if (!pareceImagem(dados, ext)) throw new Error(`"${original}" não parece ser uma imagem válida.`);
    const nome = nomeLivre(pasta, path.basename(original, path.extname(original)), ext);
    fs.writeFileSync(path.join(RAIZ, pasta, nome), dados);
    return responder(res, 200, { ok: true, url: `/${pasta}/${encodeURIComponent(nome)}` });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: erro.message });
  }
}

// "Remover" nao apaga: move para a pasta lixeira/, de onde da para recuperar.
async function tratarRemocao(req, res, url) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode remover imagens.' });
  try {
    const alvo = String(JSON.parse(await lerCorpo(req)).url ?? '');
    const partes = /^\/(galeria|personagens|bosses)\/([^/\\]+)$/.exec(alvo);
    if (!partes) throw new Error('Imagem inválida.');
    const dono = [...estado.aliados, ...estado.inimigos].find((e) => e.imagem === alvo);
    if (dono) throw new Error(`${dono.nome} usa esta imagem. Troque a imagem dele antes de remover.`);
    if (estado.cena.mostrar?.imagem === alvo) throw new Error('Esconda a imagem do telão antes de remover.');
    const arquivo = dentroDe(partes[1], decodeURIComponent(partes[2]));
    if (!arquivo || !fs.existsSync(arquivo)) throw new Error('Arquivo não encontrado.');
    const ext = path.extname(arquivo);
    fs.renameSync(arquivo, path.join(RAIZ, 'lixeira', nomeLivre('lixeira', path.basename(arquivo, ext), ext)));
    return responder(res, 200, { ok: true });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: erro.message });
  }
}

function enderecosDaRede() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    .filter((ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))
    .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.'))); // Wi-Fi de casa primeiro
}

// ---------------- servidor ----------------

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  const rota = decodeURIComponent(url.pathname);

  if (rota === '/eventos') return abrirFluxo(req, res, url);
  if (rota === '/api/acao' && req.method === 'POST') return tratarAcao(req, res, url);
  if (rota === '/api/imagens') return responder(res, 200, listarImagens());
  if (rota === '/api/enviar-imagem' && req.method === 'POST') return tratarEnvio(req, res, url);
  if (rota === '/api/remover-imagem' && req.method === 'POST') return tratarRemocao(req, res, url);
  if (rota === '/api/info') {
    return responder(res, 200, {
      mestre: ehMestre(req, url),
      precisaPin: Boolean(PIN),
      enderecos: enderecosDaRede().map((ip) => `http://${ip}:${PORTA}`),
      podeDesfazer: historico.length > 0,
    });
  }

  if (PAGINAS[rota]) return servir(res, path.join(RAIZ, 'public', PAGINAS[rota]));

  for (const [prefixo, pasta] of Object.entries(PASTAS)) {
    if (rota.startsWith(prefixo)) {
      const arquivo = dentroDe(pasta, rota.slice(prefixo.length));
      return arquivo ? servir(res, arquivo, CABECALHO_IMAGEM) : res.writeHead(404).end();
    }
  }

  const arquivo = dentroDe('public', rota.slice(1));
  return arquivo ? servir(res, arquivo) : res.writeHead(404).end();
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log('  MESA TORMENTA 20');
  console.log('  ------------------------------------------------------');
  console.log(`  Mestre (so neste PC) ..... http://localhost:${PORTA}/mestre`);
  console.log(`  Telao (neste PC / OBS) ... http://localhost:${PORTA}/telao`);
  for (const ip of enderecosDaRede()) console.log(`  Outra tela (no Wi-Fi) .... http://${ip}:${PORTA}/telao`);
  if (PIN) console.log('  PIN do mestre ativo: o painel tambem abre de outros aparelhos com o PIN.');
  console.log('  ------------------------------------------------------');
  console.log('  Deixe esta janela aberta durante a sessao.');
  console.log('');
});

servidor.on('error', (erro) => {
  console.error(erro.code === 'EADDRINUSE' ? `A porta ${PORTA} ja esta em uso. Feche a outra janela do programa.` : erro.message);
  process.exit(1);
});
