// Servidor local da mesa de Tormenta 20.
//
//   Telao (OBS / TV) .. http://localhost:8787/telao
//   Mestre ............ http://localhost:8787/mestre   (so neste computador, ou com PIN)
//   Jogador (celular) . http://<ip-do-mestre>:8787/jogador
//
// `node src/server/main.ts --dev` liga o Vite junto (recarrega as telas ao editar).

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  carregar, salvar, executar, estadoDemo, visaoPublica, filtrarEvento, ganchosDeTurno, ACAO_SEM_HISTORICO, tirarEfeitos, novoAtor, falar, type Acao,
} from './estado.ts';
import { responder, lerBinario, lerJson, type Req, type Res } from './http.ts';
import {
  PASTAS, NOMES_PASTA, EXT_IMAGEM, EXT_DO_TIPO, LIMITE_IMAGEM, criarPastas, dentroDe, listarImagens, pareceImagem, nomeLivre,
} from './imagens.ts';
import type { Estado, Evento } from '../shared/tipos.ts';
import type { Ficha } from '../shared/ficha.ts';
import QRCode from 'qrcode';
import { Fichas, colocarNaMesa, heroiDaFicha, sincronizarHeroi } from './fichas.ts';
import { Bestiario, porNaMesa } from './bestiario.ts';
import { ameacasDoLivro, dadosDaAmeaca, linhasDoPdf } from './bestiario-livro.ts';
import { importarPdfNimb } from './importar-nimb.ts';
import {
  iniciarTurno, encerrarCena, resolverAtaque, resolverMagia, resolverUso, resolverRolagem,
  resolverHabilidade, resolverSangramento, resolverTeste, resultadoPublico, type Contexto,
} from './regras.ts';
import type { ResultadoAcao } from '../shared/acoes.ts';
import type { Heroi, Ataque } from '../shared/tipos.ts';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARQUIVO_ESTADO = path.join(RAIZ, 'data', 'estado.json');
const DIST = path.join(RAIZ, 'dist');
const DEV = process.argv.includes('--dev');

function lerConfig(): { porta?: number; pin?: string } {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'mesa.json'), 'utf8'));
  } catch {
    return {};
  }
}
const config = lerConfig();
const PORTA = Number(process.env.PORTA ?? config.porta ?? 8787);
const PIN = String(process.env.PIN ?? config.pin ?? '');

let estado: Estado = carregar(ARQUIVO_ESTADO);
// Fotos do estado, para o botao Desfazer. A foto de uma acao do motor lembra qual foi.
const historico: { foto: string; acaoId?: string }[] = [];
function guardarFoto(foto: string, acaoId?: string) {
  historico.push({ foto, acaoId });
  if (historico.length > 60) historico.shift();
}

criarPastas(RAIZ);
const fichas = new Fichas(RAIZ);
const bestiario = new Bestiario(RAIZ);
// Inicio de turno: conta as rodadas e, se o heroi estiver sangrando, rola o teste de Constituicao.
// O resultado fica pendente e e publicado junto com o estado novo.
const resultadosDoTurno: ResultadoAcao[] = [];
ganchosDeTurno((est, id) => {
  iniciarTurno(est, id);
  const r = resolverSangramento(contexto(), id);
  if (r) resultadosDoTurno.push(r);
}, encerrarCena);
// Ultimas acoes resolvidas, para o painel do mestre (sobrevive a reinicios).
const ARQUIVO_REGISTRO = path.join(RAIZ, 'data', 'registro.json');
const registro: ResultadoAcao[] = (() => {
  try {
    const lido = JSON.parse(fs.readFileSync(ARQUIVO_REGISTRO, 'utf8'));
    return Array.isArray(lido) ? lido.slice(0, 80) : [];
  } catch {
    return [];
  }
})();
let gravarRegistro: ReturnType<typeof setTimeout> | undefined;
function salvarRegistro() {
  clearTimeout(gravarRegistro);
  gravarRegistro = setTimeout(() => fs.writeFile(ARQUIVO_REGISTRO, JSON.stringify(registro), () => {}), 400);
}
// Fichas editadas com o programa fechado: o heroi na mesa pega os valores novos.
for (const h of estado.aliados) {
  const f = h.fichaId ? fichas.porId(h.fichaId) : undefined;
  if (f) sincronizarHeroi(h, f);
}

// ---------------- acesso do mestre ----------------

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function ehMestre(req: Req, url: URL) {
  if (LOOPBACK.has(req.socket.remoteAddress ?? '')) return true;
  return Boolean(PIN) && (req.headers['x-pin'] === PIN || url.searchParams.get('pin') === PIN);
}

// ---------------- tempo real (SSE) ----------------

type Visao = 'mestre' | 'publico' | 'jogador';
interface Cliente { res: Res; visao: Visao; fichaId?: string }
const clientes = new Set<Cliente>();

function enviar(cliente: Cliente, evento: string, dados: unknown) {
  cliente.res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
}

function transmitir(eventos: Evento[] = []) {
  const publico = visaoPublica(estado);
  for (const c of clientes) {
    const mestre = c.visao === 'mestre';
    enviar(c, 'estado', mestre ? estado : publico);
    for (const ev of eventos) {
      const visto = mestre ? ev : filtrarEvento(estado, ev);
      if (visto) enviar(c, 'evento', visto);
    }
  }
}

// Fichas mudaram: o mestre recebe a lista (com os codigos) e cada jogador a sua.
function transmitirFichas(id?: string) {
  for (const c of clientes) {
    if (c.visao === 'mestre') enviar(c, 'fichas', fichas.lista());
    else if (c.visao === 'jogador' && c.fichaId && (!id || c.fichaId === id)) {
      const f = fichas.porId(c.fichaId);
      enviar(c, 'ficha', f ? { ficha: f, heroiId: heroiDaFicha(estado, f)?.id ?? null } : null);
    }
  }
}

setInterval(() => {
  for (const c of clientes) c.res.write(': batimento\n\n');
}, 15000);

function abrirFluxo(req: Req, res: Res, url: URL) {
  const pedida = url.searchParams.get('visao');
  const visao: Visao = pedida === 'mestre' ? 'mestre' : pedida === 'jogador' ? 'jogador' : 'publico';
  if (visao === 'mestre' && !ehMestre(req, url)) {
    res.writeHead(403).end('Acesso do mestre negado.');
    return;
  }
  const ficha = visao === 'jogador' ? fichas.porCodigo(url.searchParams.get('codigo') ?? '') : undefined;
  if (visao === 'jogador' && !ficha) {
    res.writeHead(403).end('Codigo de jogador invalido.');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 1500\n\n');
  const cliente: Cliente = { res, visao, fichaId: ficha?.id };
  clientes.add(cliente);
  enviar(cliente, 'estado', visao === 'mestre' ? estado : visaoPublica(estado));
  if (visao === 'mestre') {
    enviar(cliente, 'fichas', fichas.lista());
    enviar(cliente, 'registro', registro);
    bestiario.recarregar(); // pega fichas criadas pela ferramenta de linha de comando
    enviar(cliente, 'bestiario', bestiario.lista());
  }
  if (ficha) enviar(cliente, 'ficha', { ficha, heroiId: heroiDaFicha(estado, ficha)?.id ?? null });
  req.on('close', () => clientes.delete(cliente));
}

// ---------------- API do mestre ----------------

function aplicarAcao(acao: Acao): Evento[] {
  if (acao.tipo === 'desfazer') {
    const ultima = historico.pop();
    if (!ultima) throw new Error('Nada para desfazer.');
    estado = JSON.parse(ultima.foto);
    const r = ultima.acaoId ? registro.find((x) => x.id === ultima.acaoId) : undefined;
    if (r) {
      r.desfeita = true;
      salvarRegistro();
      for (const c of clientes) if (c.visao === 'mestre') enviar(c, 'registro', registro);
    }
    return [];
  }
  if (acao.tipo === 'reiniciar') {
    guardarFoto(JSON.stringify(estado));
    estado = estadoDemo();
    return [];
  }
  const foto = JSON.stringify(estado);
  const eventos = executar(estado, acao);
  if (!ACAO_SEM_HISTORICO.has(acao.tipo)) guardarFoto(foto);
  return eventos;
}

// Acoes do mestre que passam pelo motor de regras (o inimigo ataca, usa habilidade...).
const ACOES_DE_REGRA = new Set(['atacarComo', 'magiaComo', 'usarComo', 'habilidade', 'rolarComo', 'responderTeste']);

async function tratarAcao(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode fazer isso.' });
  try {
    const acao = await lerJson<Acao>(req);
    if (ACOES_DE_REGRA.has(acao.tipo)) {
      const r = resolverPeloMotor(acao, false);
      return responder(res, 200, { ok: true, resultado: r, podeDesfazer: historico.length > 0 });
    }
    const eventos = aplicarAcao(acao);
    salvar(ARQUIVO_ESTADO, estado);
    for (const r of resultadosDoTurno.splice(0)) registrarResultado(r);
    transmitir(eventos);
    return responder(res, 200, { ok: true, podeDesfazer: historico.length > 0 });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

// ---------------- acoes resolvidas pelo motor de regras ----------------

const contexto = (): Contexto => ({
  estado,
  fichaDe: (h: Heroi) => (h.fichaId ? fichas.porId(h.fichaId) : undefined),
});

function ataqueDe(autorId: string, ataqueId: unknown, avulso: unknown): Ataque {
  const h = estado.aliados.find((x) => x.id === autorId);
  const lista = h ? (h.fichaId ? fichas.porId(h.fichaId)?.ataques : undefined) ?? [] : estado.inimigos.find((x) => x.id === autorId)?.ataques ?? [];
  const achado = lista.find((a) => a.id === ataqueId);
  if (achado) return achado;
  // Ataque avulso digitado pelo mestre (inimigo sem ficha completa).
  const a = (avulso ?? {}) as Partial<Ataque>;
  if (!a.dano) throw new Error('Ataque não encontrado.');
  return {
    id: 'avulso', nome: String(a.nome ?? 'Ataque').slice(0, 40), bonus: Math.trunc(Number(a.bonus) || 0), dano: String(a.dano),
    tipoDano: a.tipoDano ?? '', margem: Math.min(20, Math.max(2, Number(a.margem) || 20)), mult: Math.min(6, Math.max(2, Number(a.mult) || 2)),
    alcance: '', distancia: Boolean(a.distancia), arquetipo: a.arquetipo ?? 'corte',
  };
}

/** Resolve, guarda no historico (desfazer), registra e publica. */
function resolverPeloMotor(a: Acao, ehJogador: boolean, autorForcado?: string): ResultadoAcao {
  const foto = JSON.stringify(estado);
  const ctx = contexto();
  const autorId = autorForcado ?? String(a.autorId ?? '');
  let r: ResultadoAcao;
  if (a.tipo === 'atacar' || a.tipo === 'atacarComo') {
    r = resolverAtaque(ctx, autorId, ataqueDe(autorId, a.ataqueId, a.ataque), String(a.alvoId ?? ''), (a.extras ?? {}) as Record<string, never>, ehJogador);
  } else if (a.tipo === 'magia' || a.tipo === 'magiaComo') {
    r = resolverMagia(ctx, autorId, { magiaId: String(a.magiaId ?? ''), alvos: (a.alvos as string[]) ?? [], aprimoramentos: (a.aprimoramentos ?? {}) as Record<string, number> }, ehJogador);
  } else if (a.tipo === 'usar' || a.tipo === 'usarComo') {
    r = resolverUso(ctx, autorId, String(a.efeitoId ?? ''), Number(a.indice ?? 0), (a.alvos as string[]) ?? [], ehJogador);
  } else if (a.tipo === 'habilidade') {
    r = resolverHabilidade(ctx, autorId, (a.habilidade ?? {}) as never, (a.alvos as string[]) ?? []);
  } else if (a.tipo === 'responderTeste') {
    r = resolverTeste(ctx, autorId, String(a.pedidoId ?? ''));
  } else if (a.tipo === 'rolar' || a.tipo === 'rolarComo') {
    r = resolverRolagem(ctx, autorId, String(a.expressao ?? '1d20'), String(a.rotulo ?? ''), Boolean(a.secreta));
  } else {
    throw new Error('Ação desconhecida.');
  }
  if (r.tipo !== 'rolagem' || a.tipo === 'responderTeste') guardarFoto(foto, r.id);
  registrarResultado(r);
  salvar(ARQUIVO_ESTADO, estado);
  transmitir();
  return r;
}

function registrarResultado(r: ResultadoAcao) {
  registro.unshift(r);
  registro.splice(80);
  salvarRegistro();
  publicarAcao(r);
}

/** A acao vai antes do estado novo: o telao segura a barra de PV ate o golpe chegar. */
function publicarAcao(r: ResultadoAcao) {
  const publico = resultadoPublico(estado, r);
  for (const c of clientes) {
    if (c.visao === 'mestre') { enviar(c, 'acao', r); continue; }
    const ehAutor = c.visao === 'jogador' && heroiIdDaFicha(c.fichaId) === r.autor.id;
    const visto = r.secreta && ehAutor ? r : publico;
    if (visto) enviar(c, 'acao', visto);
  }
}

const heroiIdDaFicha = (fichaId?: string) => (fichaId ? estado.aliados.find((h) => h.fichaId === fichaId)?.id : undefined);

async function tratarAcaoJogador(req: Req, res: Res, url: URL) {
  const f = jogadorDe(req, url);
  if (!f) return responder(res, 401, { ok: false, erro: 'Código inválido.' });
  try {
    const a = await lerJson<Acao>(req);
    if (a.tipo === 'encerrarEfeito') {
      const e = estado.efeitos.find((x) => x.id === a.id);
      if (!e || e.conjuradorId !== heroiIdDaFicha(f.id)) throw new Error('Esse efeito não é seu.');
      guardarHistorico();
      tirarEfeitos(estado, (x) => x.id === e.id);
      depoisDeMexerNaMesa();
      return responder(res, 200, { ok: true });
    }
    if (a.tipo === 'falar') {
      // Modo cena: o heroi do jogador fala na caixa de dialogo (entra no palco se ainda nao estiver).
      if (!estado.opcoes.falasPeloCelular) throw new Error('O mestre desligou as falas pelo celular.');
      if (estado.cena.modo !== 'roleplay') throw new Error('As falas aparecem no modo cena.');
      const heroiId = heroiIdDaFicha(f.id);
      if (!heroiId) throw new Error('Seu personagem não está na mesa. Peça ao mestre para colocá-lo.');
      const palco = estado.cena.palco;
      let ator = palco.atores.find((x) => x.refId === heroiId);
      if (!ator) {
        if (palco.atores.length >= 8) throw new Error('A cena está cheia. Peça ao mestre para abrir espaço.');
        ator = novoAtor(estado, { refId: heroiId });
        palco.atores.push(ator);
      }
      falar(estado, ator.id, a.texto, '', true);
      depoisDeMexerNaMesa();
      return responder(res, 200, { ok: true });
    }
    if (!['atacar', 'magia', 'usar', 'rolar', 'responderTeste'].includes(a.tipo)) throw new Error('Ação desconhecida.');
    const heroiId = heroiIdDaFicha(f.id);
    if (!heroiId) throw new Error('Seu personagem não está na mesa. Peça ao mestre para colocá-lo.');
    const r = resolverPeloMotor(a, true, heroiId);
    return responder(res, 200, { ok: true, resultado: r.secreta ? r : resultadoPublico(estado, r) });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

// ---------------- arquivos ----------------

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.map': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

// Imagens enviadas pelo mestre nunca rodam script, mesmo um SVG aberto direto no navegador.
const CABECALHO_IMAGEM = { 'Content-Security-Policy': "script-src 'none'", 'X-Content-Type-Options': 'nosniff' };

function servir(res: Res, caminho: string, extras: Record<string, string> = {}) {
  fs.readFile(caminho, (erro, dados) => {
    if (erro) {
      res.writeHead(404).end('Nao encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(caminho).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...extras });
    res.end(dados);
  });
}

// ---------------- envio e remocao de imagens (galeria) ----------------

async function tratarEnvio(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode enviar imagens.' });
  try {
    const pedida = url.searchParams.get('pasta') ?? '';
    const pasta = (NOMES_PASTA as string[]).includes(pedida) ? pedida : 'galeria';
    let original = 'imagem';
    try { original = decodeURIComponent(String(req.headers['x-nome'] ?? 'imagem')); } catch { /* nome estranho: usa o padrao */ }
    const ext = (path.extname(original).toLowerCase() || EXT_DO_TIPO[String(req.headers['content-type'])] || '').replace('.jpeg', '.jpg');
    if (!EXT_IMAGEM.has(ext)) throw new Error('Formato não suportado. Use PNG, JPG, WEBP, GIF ou SVG.');
    if (Number(req.headers['content-length']) > LIMITE_IMAGEM) throw new Error('Imagem grande demais (máximo 25 MB).');
    const dados = await lerBinario(req, LIMITE_IMAGEM, 'Imagem grande demais (máximo 25 MB).');
    if (!pareceImagem(dados, ext)) throw new Error(`"${original}" não parece ser uma imagem válida.`);
    const nome = nomeLivre(RAIZ, pasta, path.basename(original, path.extname(original)), ext);
    fs.writeFileSync(path.join(RAIZ, pasta, nome), dados);
    return responder(res, 200, { ok: true, url: `/${pasta}/${encodeURIComponent(nome)}` });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

// "Remover" nao apaga: move para a pasta lixeira/, de onde da para recuperar.
async function tratarRemocao(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode remover imagens.' });
  try {
    const alvo = String((await lerJson(req)).url ?? '');
    const partes = /^\/(galeria|personagens|bosses|cenarios)\/([^/\\]+)$/.exec(alvo);
    if (!partes) throw new Error('Imagem inválida.');
    const dono = [...estado.aliados, ...estado.inimigos].find((e) => e.imagem === alvo);
    if (dono) throw new Error(`${dono.nome} usa esta imagem. Troque a imagem dele antes de remover.`);
    if (estado.cena.mostrar?.imagem === alvo) throw new Error('Esconda a imagem do telão antes de remover.');
    const arquivo = dentroDe(RAIZ, partes[1], decodeURIComponent(partes[2]));
    if (!arquivo || !fs.existsSync(arquivo)) throw new Error('Arquivo não encontrado.');
    const ext = path.extname(arquivo);
    fs.renameSync(arquivo, path.join(RAIZ, 'lixeira', nomeLivre(RAIZ, 'lixeira', path.basename(arquivo, ext), ext)));
    return responder(res, 200, { ok: true });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

// ---------------- fichas (jogadores e mestre) ----------------

const LIMITE_PDF = 15 * 1024 * 1024;

const jogadorDe = (req: Req, url: URL) =>
  fichas.porCodigo(String(req.headers['x-codigo'] ?? url.searchParams.get('codigo') ?? ''));

function depoisDeMexerNaMesa(eventos: Evento[] = []) {
  salvar(ARQUIVO_ESTADO, estado);
  transmitir(eventos);
}

function guardarHistorico() {
  guardarFoto(JSON.stringify(estado));
}

async function lerPdfDoPedido(req: Req) {
  if (Number(req.headers['content-length']) > LIMITE_PDF) throw new Error('PDF grande demais (máximo 15 MB).');
  const dados = await lerBinario(req, LIMITE_PDF, 'PDF grande demais (máximo 15 MB).');
  if (dados.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Isso não é um PDF. Exporte a ficha pelo Fichas de Nimb (botão PDF).');
  return importarPdfNimb(new Uint8Array(dados));
}

/** Importa o PDF do Nimb e ja poe o personagem na mesa. Serve ao celular e ao mestre. */
async function tratarImportacao(req: Req, res: Res, url: URL) {
  const mestre = ehMestre(req, url);
  try {
    if (!mestre && !estado.opcoes.importarPeloCelular) throw new Error('O mestre desligou a importação pelo celular. Peça para ele importar sua ficha.');
    const { ficha: dados, avisos } = await lerPdfDoPedido(req);
    const atual = url.searchParams.get('substituir');
    let f: Ficha;
    if (atual) {
      const dono = mestre ? fichas.porId(atual) : jogadorDe(req, url);
      if (!dono || dono.id !== atual) throw new Error('Você só pode atualizar a sua própria ficha.');
      f = fichas.substituir(dono.id, dados);
    } else {
      f = fichas.criar(dados);
    }
    guardarHistorico();
    const h = heroiDaFicha(estado, f);
    if (h) sincronizarHeroi(h, f);
    else colocarNaMesa(estado, f);
    depoisDeMexerNaMesa();
    transmitirFichas();
    return responder(res, 200, { ok: true, codigo: f.codigo, id: f.id, avisos });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

async function tratarFichaJogador(req: Req, res: Res, url: URL) {
  const f = jogadorDe(req, url);
  if (!f) return responder(res, 401, { ok: false, erro: 'Código inválido. Peça o QR code ao mestre.' });
  try {
    if (req.method === 'GET') return responder(res, 200, { ok: true, ficha: f, heroiId: heroiDaFicha(estado, f)?.id ?? null });
    const nova = fichas.editar(f.id, await lerJson(req), false);
    const h = heroiDaFicha(estado, nova);
    if (h) { sincronizarHeroi(h, nova); depoisDeMexerNaMesa(); }
    transmitirFichas(nova.id);
    return responder(res, 200, { ok: true });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

/** Foto do personagem tirada/escolhida no celular: vai para personagens/. */
async function tratarFotoJogador(req: Req, res: Res, url: URL) {
  const f = jogadorDe(req, url);
  if (!f) return responder(res, 401, { ok: false, erro: 'Código inválido.' });
  try {
    const ext = EXT_DO_TIPO[String(req.headers['content-type'])];
    if (!ext || ext === '.svg') throw new Error('Use uma foto PNG, JPG, WEBP ou GIF.');
    const dados = await lerBinario(req, LIMITE_IMAGEM, 'Imagem grande demais (máximo 25 MB).');
    if (!pareceImagem(dados, ext)) throw new Error('Esse arquivo não parece uma imagem.');
    const nome = nomeLivre(RAIZ, 'personagens', `${f.nome}-${f.id}`, ext);
    fs.writeFileSync(path.join(RAIZ, 'personagens', nome), dados);
    const nova = fichas.editar(f.id, { imagem: `/personagens/${encodeURIComponent(nome)}` }, false);
    const h = heroiDaFicha(estado, nova);
    if (h) { sincronizarHeroi(h, nova); h.imagem = nova.imagem; depoisDeMexerNaMesa(); }
    transmitirFichas(nova.id);
    return responder(res, 200, { ok: true, imagem: nova.imagem });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

/** Acoes do mestre sobre as fichas. */
async function tratarFichaMestre(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode fazer isso.' });
  try {
    const a = await lerJson(req);
    const id = String(a.id ?? '');
    if (a.acao === 'editar') {
      const f = fichas.editar(id, (a.patch ?? {}) as Record<string, unknown>, true);
      const h = heroiDaFicha(estado, f);
      if (h) { sincronizarHeroi(h, f); depoisDeMexerNaMesa(); }
    } else if (a.acao === 'naMesa') {
      guardarHistorico();
      colocarNaMesa(estado, fichas.exigir(id));
      depoisDeMexerNaMesa();
    } else if (a.acao === 'novoCodigo') {
      fichas.novoCodigoPara(id);
    } else if (a.acao === 'remover') {
      guardarHistorico();
      estado.aliados = estado.aliados.filter((h) => h.fichaId !== id);
      fichas.remover(id);
      depoisDeMexerNaMesa();
    } else if (a.acao === 'vincular') {
      // Heroi criado a mao passa a usar a ficha (e some o heroi duplicado, se houver).
      const f = fichas.exigir(id);
      const h = estado.aliados.find((x) => x.id === a.heroiId);
      if (!h) throw new Error('Herói não encontrado.');
      guardarHistorico();
      estado.aliados = estado.aliados.filter((x) => x === h || x.fichaId !== f.id);
      sincronizarHeroi(h, f);
      depoisDeMexerNaMesa();
    } else {
      throw new Error('Ação desconhecida.');
    }
    transmitirFichas();
    return responder(res, 200, { ok: true });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

/** Bestiario do mestre: guardar fichas de ameaca e pôr cartas na mesa. */
async function tratarBestiario(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode fazer isso.' });
  try {
    const a = await lerJson(req);
    const id = String(a.id ?? '');
    let resposta: Record<string, unknown> = {};
    if (a.acao === 'salvar') {
      resposta.ameaca = bestiario.salvar((a.dados ?? {}) as Record<string, unknown>, id || undefined);
    } else if (a.acao === 'remover') {
      bestiario.remover(id);
    } else if (a.acao === 'daMesa') {
      // Carta que ja esta na mesa vira (ou atualiza) uma ficha do bestiario.
      const i = estado.inimigos.find((x) => x.id === a.inimigoId);
      if (!i) throw new Error('Inimigo não encontrado.');
      const existente = i.ameacaId && bestiario.porId(i.ameacaId) ? i.ameacaId : undefined;
      const nome = i.nome.replace(/ \d+$/, '');
      const ameaca = bestiario.salvar({ ...i, nome }, existente);
      i.ameacaId = ameaca.id;
      depoisDeMexerNaMesa();
      resposta = { ameaca, atualizada: Boolean(existente) };
    } else if (a.acao === 'naMesa') {
      guardarHistorico();
      const novos = porNaMesa(estado, bestiario.exigir(id), a.quantidade, a.naTela !== false);
      depoisDeMexerNaMesa();
      resposta.ids = novos.map((x) => x.id);
    } else {
      throw new Error('Ação desconhecida.');
    }
    for (const c of clientes) if (c.visao === 'mestre') enviar(c, 'bestiario', bestiario.lista());
    return responder(res, 200, { ok: true, ...resposta });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

/** Livro de ameacas (PDF do proprio mestre): cada bloco de estatisticas vira ficha do bestiario. */
const LIMITE_LIVRO = 400 * 1024 * 1024;
async function tratarLivro(req: Req, res: Res, url: URL) {
  if (!ehMestre(req, url)) return responder(res, 403, { ok: false, erro: 'Somente o mestre pode fazer isso.' });
  try {
    if (Number(req.headers['content-length']) > LIMITE_LIVRO) throw new Error('Arquivo grande demais (máximo 400 MB).');
    const dados = await lerBinario(req, LIMITE_LIVRO, 'Arquivo grande demais (máximo 400 MB).');
    const pdf = dados.subarray(0, 5).toString('latin1') === '%PDF-';
    const fichasLidas = ameacasDoLivro(pdf ? await linhasDoPdf(new Uint8Array(dados)) : dados.toString('utf8'));
    if (!fichasLidas.length) throw new Error('Não achei blocos de ameaça nesse arquivo (procuro "Iniciativa", "Defesa ..." e "Pontos de Vida").');
    const r = bestiario.importar(fichasLidas.map(dadosDaAmeaca), url.searchParams.get('atualizar') === '1');
    for (const c of clientes) if (c.visao === 'mestre') enviar(c, 'bestiario', bestiario.lista());
    return responder(res, 200, { ok: true, lidas: fichasLidas.length, ...r, semNd: fichasLidas.filter((f) => !f.nd).length });
  } catch (erro) {
    return responder(res, 400, { ok: false, erro: (erro as Error).message });
  }
}

async function tratarQr(res: Res, url: URL) {
  const texto = (url.searchParams.get('texto') ?? '').slice(0, 300);
  if (!texto) return res.writeHead(400).end();
  const svg = await QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#140c1e', light: '#fff6e0' } });
  res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' });
  res.end(svg);
}

function enderecosDaRede() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i): i is os.NetworkInterfaceInfo => Boolean(i) && i!.family === 'IPv4' && !i!.internal)
    .map((i) => i.address)
    .filter((ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))
    .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.'))); // Wi-Fi de casa primeiro
}

// ---------------- telas (Vite no dev, dist/ no uso normal) ----------------

const PAGINAS: Record<string, string> = {
  '/': 'index.html', '/telao': 'telao.html', '/overlay': 'telao.html', '/mestre': 'mestre.html', '/painel': 'mestre.html',
  '/jogador': 'jogador.html',
};

type Middleware = (req: Req, res: Res, next: () => void) => void;
let vite: { middlewares: Middleware } | null = null;

function servirTela(req: Req, res: Res, rota: string) {
  if (vite) {
    if (PAGINAS[rota]) req.url = `/${PAGINAS[rota]}${req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    vite.middlewares(req, res, () => res.writeHead(404).end());
    return;
  }
  if (PAGINAS[rota]) {
    const html = path.join(DIST, PAGINAS[rota]);
    if (!fs.existsSync(html)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('As telas ainda nao foram compiladas. Rode "npm run build" (o iniciar.sh/.bat faz isso sozinho).');
      return;
    }
    servir(res, html);
    return;
  }
  const arquivo = dentroDe(RAIZ, 'dist', rota.slice(1));
  if (!arquivo) return res.writeHead(404).end();
  // Arquivos com hash no nome nunca mudam: o navegador pode guardar.
  servir(res, arquivo, rota.startsWith('/assets/') ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {});
}

// ---------------- servidor ----------------

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  let rota = '/';
  try { rota = decodeURIComponent(url.pathname); } catch { return res.writeHead(400).end(); }

  if (rota === '/eventos') return abrirFluxo(req, res, url);
  if (rota === '/api/acao' && req.method === 'POST') return tratarAcao(req, res, url);
  if (rota === '/api/imagens') return responder(res, 200, listarImagens(RAIZ));
  if (rota === '/api/enviar-imagem' && req.method === 'POST') return tratarEnvio(req, res, url);
  if (rota === '/api/remover-imagem' && req.method === 'POST') return tratarRemocao(req, res, url);
  if (rota === '/api/importar-ficha' && req.method === 'POST') return tratarImportacao(req, res, url);
  if (rota === '/api/jogador/ficha') return tratarFichaJogador(req, res, url);
  if (rota === '/api/jogador/foto' && req.method === 'POST') return tratarFotoJogador(req, res, url);
  if (rota === '/api/jogador/acao' && req.method === 'POST') return tratarAcaoJogador(req, res, url);
  if (rota === '/api/mestre/ficha' && req.method === 'POST') return tratarFichaMestre(req, res, url);
  if (rota === '/api/mestre/bestiario' && req.method === 'POST') return tratarBestiario(req, res, url);
  if (rota === '/api/mestre/bestiario/livro' && req.method === 'POST') return tratarLivro(req, res, url);
  if (rota === '/api/qr') return tratarQr(res, url);
  if (rota === '/api/info') {
    return responder(res, 200, {
      mestre: ehMestre(req, url),
      precisaPin: Boolean(PIN),
      enderecos: enderecosDaRede().map((ip) => `http://${ip}:${PORTA}`),
      podeDesfazer: historico.length > 0,
    });
  }

  for (const [prefixo, pasta] of Object.entries(PASTAS)) {
    if (rota.startsWith(prefixo)) {
      const arquivo = dentroDe(RAIZ, pasta, rota.slice(prefixo.length));
      return arquivo ? servir(res, arquivo, CABECALHO_IMAGEM) : res.writeHead(404).end();
    }
  }

  return servirTela(req, res, rota);
});

if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({
    configFile: path.join(RAIZ, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server: servidor } },
    appType: 'mpa',
  });
}

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log(`  MESA TORMENTA 20${DEV ? '  (modo desenvolvimento)' : ''}`);
  console.log('  ------------------------------------------------------');
  console.log(`  Mestre (so neste PC) ..... http://localhost:${PORTA}/mestre`);
  console.log(`  Telao (neste PC / OBS) ... http://localhost:${PORTA}/telao`);
  for (const ip of enderecosDaRede()) {
    console.log(`  Telao em outra tela ...... http://${ip}:${PORTA}/telao`);
    console.log(`  Jogadores (celular) ...... http://${ip}:${PORTA}/jogador`);
  }
  if (PIN) console.log('  PIN do mestre ativo: o painel tambem abre de outros aparelhos com o PIN.');
  console.log('  ------------------------------------------------------');
  console.log('  Deixe esta janela aberta durante a sessao.');
  console.log('');
});

servidor.on('error', (erro: NodeJS.ErrnoException) => {
  console.error(erro.code === 'EADDRINUSE' ? `A porta ${PORTA} ja esta em uso. Feche a outra janela do programa.` : erro.message);
  process.exit(1);
});
