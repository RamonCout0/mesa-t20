// Roteiro rapido do motor de regras: node ferramentas/testar-regras.ts <pdf de arcanista do Nimb ou data/fichas/<id>.json>
import fs from 'node:fs';
import { estadoDemo, buscar, tirarEfeitos } from '../src/server/estado.ts';
import { importarPdfNimb } from '../src/server/importar-nimb.ts';
import { resolverAtaque, resolverMagia, resolverPoder, iniciarTurno, aplicarDano, type Contexto } from '../src/server/regras.ts';
import type { Ficha } from '../src/shared/ficha.ts';
import type { Heroi } from '../src/shared/tipos.ts';

let falhas = 0;
const confere = (nome: string, ok: boolean, detalhe = '') => { if (!ok) falhas += 1; console.log(ok ? 'ok   ' : 'FALHA', nome, detalhe); };

// Aceita o PDF do Nimb ou uma ficha ja salva (data/fichas/<id>.json).
const dados = process.argv[2].endsWith('.json')
  ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  : (await importarPdfNimb(new Uint8Array(fs.readFileSync(process.argv[2])))).ficha;
const ficha = { ...dados, id: 'f1', codigo: 'TESTE1', criadaEm: 0, atualizadaEm: 0 } as Ficha;
const estado = estadoDemo();
const heroi = estado.aliados[1] as Heroi; // Lyra vira a ficha importada
Object.assign(heroi, { fichaId: 'f1', nome: ficha.nome, pvMax: ficha.pvMax, pv: ficha.pvMax, pmMax: ficha.pmMax, pm: ficha.pmMax, nivel: ficha.nivel });

// Sorteio controlado: devolve os valores da fila, depois o maximo.
let fila: number[] = [];
const ctx: Contexto = { estado, fichaDe: (h) => (h.fichaId === 'f1' ? ficha : undefined), sorteio: (f) => fila.shift() ?? f };

const cultista = estado.inimigos[1];
const pvAntes = cultista.pv;

// 1) Ataque que acerta critico: d20=20 com margem 19, dano 1d6 x2 -> 2d6 = 4+5
const espada = ficha.ataques.find((a) => a.margem <= 19) ?? ficha.ataques[0];
fila = [20, 4, 5];
let r = resolverAtaque(ctx, heroi.id, espada, cultista.id, {}, true);
confere('ataque critico', r.alvos[0].desfecho === 'critico', `${r.texto}`);
confere('dano do critico aplicado', cultista.pv === pvAntes - r.alvos[0].dano!, `pv ${pvAntes} -> ${cultista.pv}`);

// 2) Ataque que erra: d20=1
fila = [1];
r = resolverAtaque(ctx, heroi.id, espada, cultista.id, {}, true);
confere('ataque erra', r.alvos[0].desfecho === 'erro', r.texto);

// 3) Relampago (6d6, Reflexos metade) em dois cultistas: dano 6x3=18; um falha (d20=1) outro passa (d20=20)
const c2 = estado.inimigos[2];
const pmAntes = heroi.pm;
fila = [3, 3, 3, 3, 3, 3, 1, 20];
r = resolverMagia(ctx, heroi.id, { magiaId: 'relampago', alvos: [cultista.id, c2.id] }, true);
confere('relampago gastou 3 PM', heroi.pm === pmAntes - 3, `${pmAntes} -> ${heroi.pm}`);
confere('quem falhou leva 18', r.alvos[0].dano === 18 && r.alvos[0].desfecho === 'acerto', JSON.stringify(r.alvos[0].salvamento));
confere('quem passou leva 9', r.alvos[1].dano === 9 && r.alvos[1].desfecho === 'resistiu', JSON.stringify(r.alvos[1].salvamento));
console.log('     ', r.texto);

// 4) Aprimoramento +2d6 duas vezes (limite = nivel 5): 3 + 2 + 2 = 7 PM > 5 -> erro
let erro = '';
try { resolverMagia(ctx, heroi.id, { magiaId: 'relampago', alvos: [c2.id], aprimoramentos: { 0: 2 } }, true); } catch (e) { erro = (e as Error).message; }
confere('limite de PM pelo nivel', /no máximo 5 PM/.test(erro), erro);

// 5) Condicao com duracao: Raio do Enfraquecimento -> fatigado (cena); Sono -> inconsciente
fila = [1];
r = resolverMagia(ctx, heroi.id, { magiaId: 'raio-do-enfraquecimento', alvos: [c2.id] }, true);
confere('fatigado aplicado', c2.condicoes.includes('fatigado'), r.texto);
// Adaga mental nao esta na ficha: deve recusar para jogador
try { resolverMagia(ctx, heroi.id, { magiaId: 'adaga-mental', alvos: [c2.id] }, true); erro = ''; } catch (e) { erro = (e as Error).message; }
confere('magia fora da ficha recusada', /não está na sua ficha/.test(erro), erro);
// Mestre pode (ehJogador = false), com timer de 1 rodada
fila = [6, 6, 1];
r = resolverMagia(ctx, heroi.id, { magiaId: 'adaga-mental', alvos: [cultista.id] }, false);
confere('atordoado com timer', cultista.condicoes.includes('atordoado') && estado.temporizadores.length === 1, r.texto);
iniciarTurno(estado, heroi.id);
confere('timer acabou no turno do conjurador', !cultista.condicoes.includes('atordoado') && estado.temporizadores.length === 0);

// 6) PV negativo e morte do heroi: Aldric (62 PV) morre em -31
const aldric = { ent: estado.aliados[0], lado: 'aliados' as const };
// Regra do livro: o golpe ja leva o PV para o negativo.
estado.opcoes.zerarAntes = false;
aldric.ent.pv = 5;
let d = aplicarDano(ctx, aldric, [{ valor: 20, tipo: 'corte' }]);
confere('heroi cai inconsciente', d.caiu && aldric.ent.pv === -15 && aldric.ent.condicoes.includes('inconsciente'), `pv ${aldric.ent.pv}`);
d = aplicarDano(ctx, aldric, [{ valor: 50, tipo: 'corte' }]);
confere('heroi morre no limite', d.morreu && aldric.ent.pv === -31, `pv ${aldric.ent.pv}`);
// Regra da casa: ninguem morre direto; o golpe que derruba para no 0.
estado.opcoes.zerarAntes = true;
aldric.ent.pv = 5;
aldric.ent.condicoes = [];
d = aplicarDano(ctx, aldric, [{ valor: 200, tipo: 'corte' }]);
confere('regra da casa: para no 0', d.caiu && !d.morreu && aldric.ent.pv === 0, `pv ${aldric.ent.pv}`);
d = aplicarDano(ctx, aldric, [{ valor: 12, tipo: 'corte' }]);
confere('regra da casa: depois desce', aldric.ent.pv === -12 && !d.morreu, `pv ${aldric.ent.pv}`);

// 7) RD e imunidade de inimigo
const boss = buscar(estado, estado.inimigos[0].id)!;
Object.assign(boss.ent, { rd: { geral: 5 }, imunidades: ['fogo'] });
d = aplicarDano(ctx, boss, [{ valor: 30, tipo: 'fogo' }]);
confere('imune a fogo', d.dano === 0 && d.imune);
d = aplicarDano(ctx, boss, [{ valor: 12, tipo: 'corte' }]);
confere('RD 5 geral', d.dano === 7 && d.reduzido === 5);

// 8) Magia de cena: a condicao imposta sai quando o efeito acaba
const preso = estado.inimigos.find((i) => i.nome === 'Cultista das Cinzas 2')!;
preso.condicoes = [];
heroi.pm = heroi.pmMax;
fila = [1];
r = resolverMagia(ctx, heroi.id, { magiaId: 'teia', alvos: [preso.id] }, false);
const teia = estado.efeitos.find((e) => e.id === r.efeitoId);
confere('teia fica na mesa e prende', Boolean(teia) && preso.condicoes.includes('enredado'), r.texto);
tirarEfeitos(estado, (e) => e.id === teia?.id);
confere('desfazer a teia solta o alvo', !preso.condicoes.includes('enredado') && !estado.efeitos.some((e) => e.id === teia?.id), preso.condicoes.join(','));

// 9) Magia propria (homebrew) da ficha, lancada como jogador
// (a ficha de teste pode nao ter nenhuma: cria uma so na memoria)
ficha.magiasProprias = ficha.magiasProprias?.length ? ficha.magiasProprias : [{
  id: 'propria-teste', nome: 'Lança de Brasas', circulo: 1, execucao: 'padrão', alcance: 'curto', duracao: 'instantânea', descricao: '',
  efeito: { alvo: 'inimigo', maxAlvos: 1, dano: '3d6', tipoDano: 'fogo', res: 'ref', sucesso: 'metade', anim: { tipo: 'raio', elemento: 'fogo' } },
}];
const propria = ficha.magiasProprias[0];
{
  const alvo = estado.inimigos.find((i) => i.pv > 0 && i.naTela)!;
  heroi.pm = heroi.pmMax;
  fila = [1];
  r = resolverMagia(ctx, heroi.id, { magiaId: propria.id, alvos: [alvo.id] }, true);
  confere('magia propria lancada', r.titulo === propria.nome && r.anim.magia?.elemento === propria.efeito.anim.elemento, r.texto);
}

// 10) Poder com custo e bonus (Furia): gasta PM, fica ativo e soma no ataque e no dano
ficha.poderes = [...ficha.poderes, { nome: 'Fúria', texto: '', pm: 2, bonus: { ataque: 2, dano: 2 } }];
Object.assign(heroi, { pm: heroi.pmMax, pv: heroi.pvMax, condicoes: [] });
r = resolverPoder(ctx, heroi.id, ficha.poderes.length - 1, [], true);
confere('furia gasta PM e fica ativa', heroi.pm === heroi.pmMax - 2 && estado.efeitos.some((e) => e.nome === 'Fúria' && e.bonus?.ataque === 2), r.texto);
const vivo = estado.inimigos.find((i) => i.pv > 0 && i.naTela)!;
fila = [10, 1];
const atq = resolverAtaque(ctx, heroi.id, ficha.ataques[0], vivo.id, {}, true);
confere('furia soma no ataque', atq.rolagens[0].bonus === ficha.ataques[0].bonus + 2, `bonus ${atq.rolagens[0].bonus}`);

console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);
