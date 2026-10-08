// Aba Cena: o modo roleplay do telao (visual novel). O mestre escolhe o cenario, poe herois,
// inimigos e NPCs no palco e arrasta cada um para onde quiser (mais para cima = mais ao fundo).
// A fala e na voz dos jogadores: aqui so se escolhe quem esta falando, para ficar em destaque.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Ator, Entidade, Estado, Heroi, ImagemGaleria } from '../comum/tipos-cliente.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { pedirSalvos, usePainel, type CenaSalva } from './contexto.ts';
import { Botao } from './Botao.tsx';

interface Props {
  visivel: boolean;
  estado: Estado;
  imagens: ImagemGaleria[];
  abrirGaleria: () => void;
  cenas: CenaSalva[];
}

const limitar = (v: number) => Math.min(100, Math.max(0, v));
/** Mesma perspectiva do telao: quem esta no fundo fica menor. */
const escala = (y: number) => 0.42 + 0.6 * (y / 100);

export function CenaPainel({ visivel, estado, imagens, abrirGaleria, cenas }: Props) {
  const { enviar, avisar } = usePainel();
  const palco = estado.cena.palco;
  const roleplay = estado.cena.modo === 'roleplay';
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ id: string; x: number; y: number } | null>(null);
  const [npc, setNpc] = useState({ nome: '', imagem: '', cor: '#c9b8ff' });
  const caixaPalco = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ id: string; px: number; py: number; x: number; y: number; moveu: boolean } | null>(null);

  // Quem saiu de cena deixa de ser selecionado.
  useEffect(() => {
    if (selecionado && !palco.atores.some((a) => a.id === selecionado)) setSelecionado(null);
  }, [palco.atores, selecionado]);

  const palcoAcao = (acao: string, extra: Record<string, unknown> = {}) => enviar({ tipo: 'palco', acao, ...extra });
  const naCena = (id: string) => palco.atores.some((a) => a.refId === id);
  const sel = palco.atores.find((a) => a.id === selecionado) ?? null;
  const imagemDe = (a: Ator) => a.expressao || [...estado.aliados, ...estado.inimigos].find((x) => x.id === a.refId)?.imagem || a.imagem;

  // ---------- arrastar no palco (em qualquer direcao) ----------
  const apertar = (e: PointerEvent<HTMLDivElement>, a: Ator) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { id: a.id, px: e.clientX, py: e.clientY, x: a.x, y: a.y, moveu: false };
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const i = inicio.current;
    const caixa = caixaPalco.current;
    if (!i || !caixa) return;
    const dx = e.clientX - i.px;
    const dy = e.clientY - i.py;
    if (Math.hypot(dx, dy) > 3) i.moveu = true;
    if (i.moveu) setArrasto({ id: i.id, x: limitar(i.x + (dx / caixa.clientWidth) * 100), y: limitar(i.y + (dy / caixa.clientHeight) * 100) });
  };
  const soltar = async () => {
    const i = inicio.current;
    inicio.current = null;
    if (!i) return;
    if (!i.moveu) {
      setSelecionado(i.id);
      return;
    }
    await palcoAcao('mover', { atorId: i.id, x: Math.round(arrasto?.x ?? i.x), y: Math.round(arrasto?.y ?? i.y) });
    setArrasto(null);
  };

  const cenarios = imagens.filter((i) => i.pasta === 'cenarios' || i.pasta === 'galeria');
  const retratos = imagens.filter((i) => i.pasta !== 'cenarios');
  const entrar = (ent: Entidade) => palcoAcao('entrar', { refId: ent.id });

  return (
    <section className="cena-m" hidden={!visivel}>
      <div className="cena-coluna">
        <header className="cena-topo">
          <div className="modo-telao" role="group" aria-label="O que o telão mostra">
            <button type="button" className={roleplay ? '' : 'on'} onClick={() => enviar({ tipo: 'modo', modo: 'combate' })}>
              <Icone nome="espada" />Combate
            </button>
            <button type="button" className={roleplay ? 'on' : ''} onClick={() => enviar({ tipo: 'modo', modo: 'roleplay' })}>
              <Icone nome="mascara" />Cena
            </button>
          </div>
          <span className="dica-cena">{roleplay ? 'O telão está mostrando a cena.' : 'Monte a cena à vontade: o telão só muda quando você escolher “Cena”.'}</span>
        </header>

        <div
          className="palco-m"
          ref={caixaPalco}
          style={palco.fundo ? { backgroundImage: `url("${palco.fundo}")` } : undefined}
          onClick={(e) => { if (e.target === e.currentTarget) setSelecionado(null); }}
        >
          {palco.atores.length ? null : <p className="palco-vazio">Ninguém em cena. Escolha heróis, inimigos ou NPCs ao lado.</p>}
          {palco.atores.map((a) => {
            const pos = arrasto?.id === a.id ? arrasto : a;
            const classes = ['ator-m', selecionado === a.id ? 'sel' : '', palco.destaque === a.id ? 'falando' : '', palco.destaque && palco.destaque !== a.id ? 'calado' : '', a.espelhar ? 'espelhado' : ''];
            return (
              <div
                key={a.id}
                className={classes.filter(Boolean).join(' ')}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) + (arrasto?.id === a.id ? 200 : 0), '--cor': a.cor, '--escala': escala(pos.y) } as CSSProperties}
                onPointerDown={(e) => apertar(e, a)}
                onPointerMove={mover}
                onPointerUp={soltar}
                onDoubleClick={() => palcoAcao('destacar', { atorId: a.id })}
                title="Arraste para qualquer lugar · clique para selecionar · dois cliques = falando"
              >
                <div className="ator-corpo">
                  <Retrato ent={{ nome: a.nome, imagem: imagemDe(a) }} />
                  <span>{a.nome}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="quem-fala">
          <span className="rotulo-quem">Falando agora</span>
          <button type="button" className={`chip-fala ${palco.destaque ? '' : 'on'}`} onClick={() => palcoAcao('destacar', { atorId: null })}>Ninguém</button>
          {palco.atores.map((a) => (
            <button key={a.id} type="button" className={`chip-fala ${palco.destaque === a.id ? 'on' : ''}`} style={{ '--cor': a.cor } as CSSProperties} onClick={() => palcoAcao('destacar', { atorId: a.id })}>
              <Retrato ent={{ nome: a.nome, imagem: imagemDe(a) }} />{a.nome}
            </button>
          ))}
        </div>

        <div className={`ator-barra ${sel ? '' : 'vazia'}`}>
          {sel ? (
            <>
              <Retrato ent={{ nome: sel.nome, imagem: imagemDe(sel) }} style={{ '--cor': sel.cor } as CSSProperties} />
              <b>{sel.nome}</b>
              <label className="expressao" title="Outra imagem só para a cena (ex.: bravo, ferido, disfarçado)">
                <span>Expressão</span>
                <select value={sel.expressao} onChange={(e) => palcoAcao('expressao', { atorId: sel.id, imagem: e.target.value })}>
                  <option value="">Normal</option>
                  {retratos.map((i) => <option key={i.url} value={i.url}>{i.nome}</option>)}
                </select>
              </label>
              <span className="deco" />
              <Botao classe={`pequeno ${palco.destaque === sel.id ? 'ativo' : 'ouro'}`} icone="balao" texto={palco.destaque === sel.id ? 'Parar destaque' : 'Falando'} onClick={() => palcoAcao('destacar', { atorId: sel.id })} />
              <Botao classe="pequeno" icone="reiniciar" texto="Virar" title="Espelhar a imagem" onClick={() => palcoAcao('espelhar', { atorId: sel.id })} />
              <Botao classe="pequeno perigo" icone="sair" texto="Sair de cena" onClick={() => palcoAcao('sair', { atorId: sel.id })} />
            </>
          ) : <span className="dica-cena">Arraste os personagens para qualquer ponto: mais para cima fica mais ao fundo (e menor). Clique para selecionar; dois cliques põe em destaque.</span>}
        </div>
      </div>

      <aside className="cena-lado">
        <h3>Cenas prontas</h3>
        <div className="cenas-salvas">
          {cenas.map((c) => (
            <div key={c.id} className="cena-salva">
              <button type="button" className="cena-salva-abrir" style={c.palco.fundo ? { backgroundImage: `url("${c.palco.fundo}")` } : undefined}
                title={`Carregar “${c.nome}” no palco`}
                onClick={async () => { if (await pedirSalvos(avisar, { tipo: 'cena', acao: 'carregar', id: c.id })) avisar(`Cena “${c.nome}” no palco.`, 'info'); }}>
                <b>{c.nome}</b><small>{c.palco.atores.length} personagem{c.palco.atores.length === 1 ? '' : 's'}</small>
              </button>
              <button type="button" className="cena-salva-x" aria-label={`Apagar ${c.nome}`} onClick={async () => { if (confirm(`Apagar a cena “${c.nome}”?`)) await pedirSalvos(avisar, { tipo: 'cena', acao: 'remover', id: c.id }); }}><Icone nome="lixo" /></button>
            </div>
          ))}
        </div>
        <Botao
          classe="pequeno"
          icone="mais"
          texto="Salvar este palco"
          disabled={!palco.fundo && !palco.atores.length}
          onClick={async () => {
            const nome = prompt('Nome da cena (ex.: Taverna do Javali Cego):');
            if (nome && await pedirSalvos(avisar, { tipo: 'cena', acao: 'salvar', nome })) avisar(`Cena “${nome}” salva.`, 'info');
          }}
        />

        <h3>Entrar em cena</h3>
        <div className="grupo-entrar">
          <small>Heróis</small>
          <div className="chips-entrar">
            {estado.aliados.map((h) => (
              <button key={h.id} type="button" className="chip-entrar" disabled={naCena(h.id)} style={{ '--cor': (h as Heroi).cor } as CSSProperties} onClick={() => entrar(h)}>
                <Retrato ent={h} />{h.nome}
              </button>
            ))}
          </div>
          {estado.inimigos.length ? (
            <>
              <small>Inimigos da mesa</small>
              <div className="chips-entrar">
                {estado.inimigos.map((i) => (
                  <button key={i.id} type="button" className="chip-entrar inimigo" disabled={naCena(i.id)} onClick={() => entrar(i)}>
                    <Retrato ent={i} />{i.nome}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <small>NPC avulso</small>
          <form
            className="form-npc"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await palcoAcao('entrar', npc)) setNpc({ ...npc, nome: '' });
            }}
          >
            <input placeholder="Nome (ex.: Taverneiro Gruff)" value={npc.nome} maxLength={40} onChange={(e) => setNpc({ ...npc, nome: e.target.value })} required />
            <select value={npc.imagem} onChange={(e) => setNpc({ ...npc, imagem: e.target.value })}>
              <option value="">(sem imagem)</option>
              {retratos.map((i) => <option key={i.url} value={i.url}>{i.nome}</option>)}
            </select>
            <input type="color" value={npc.cor} title="Cor do nome" onChange={(e) => setNpc({ ...npc, cor: e.target.value })} />
            <button type="submit" className="btn pequeno ouro"><Icone nome="mais" /><span>Entrar</span></button>
          </form>
          {palco.atores.length ? (
            <div className="linha-botoes">
              <Botao classe="pequeno" icone="cartas" texto="Em fila" title="Todo mundo na frente, espalhado por igual" onClick={() => palcoAcao('organizar')} />
              <Botao classe="pequeno" icone="alvo" texto="Em roda" title="Em volta de uma mesa ou fogueira: os de trás ficam menores" onClick={() => palcoAcao('roda')} />
              <Botao classe="pequeno fantasma" icone="lixo" texto="Esvaziar" onClick={() => { if (confirm('Tirar todo mundo de cena?')) palcoAcao('limpar'); }} />
            </div>
          ) : null}
        </div>

        <h3>Cenário</h3>
        <div className="grade-cenarios">
          <button type="button" className={`cenario-m vazio ${palco.fundo ? '' : 'on'}`} onClick={() => palcoAcao('fundo', { imagem: '' })}>Sem cenário</button>
          {cenarios.map((i) => (
            <button key={i.url} type="button" className={`cenario-m ${palco.fundo === i.url ? 'on' : ''}`} style={{ backgroundImage: `url("${i.url}")` }} title={i.nome} onClick={() => palcoAcao('fundo', { imagem: i.url })} />
          ))}
        </div>
        <p className="dica-cena">Envie fundos na aba <button type="button" className="link" onClick={abrirGaleria}>Galeria</button> (pasta “Cenários”). PNG com fundo transparente aparece como personagem de corpo inteiro.</p>
      </aside>
    </section>
  );
}
