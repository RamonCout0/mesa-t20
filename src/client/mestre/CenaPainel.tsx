// Aba Cena: o modo roleplay do telao (visual novel). O mestre escolhe o cenario, poe herois,
// inimigos e NPCs no palco, arrasta para posicionar e escreve as falas.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Ator, Entidade, Estado, Heroi, ImagemGaleria } from '../comum/tipos-cliente.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

interface Props {
  visivel: boolean;
  estado: Estado;
  imagens: ImagemGaleria[];
  abrirGaleria: () => void;
}

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function CenaPainel({ visivel, estado, imagens, abrirGaleria }: Props) {
  const { enviar } = usePainel();
  const palco = estado.cena.palco;
  const roleplay = estado.cena.modo === 'roleplay';
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [quemFala, setQuemFala] = useState<string | null>(null); // null = narrador
  const [texto, setTexto] = useState('');
  const [arrasto, setArrasto] = useState<{ id: string; x: number } | null>(null);
  const [npc, setNpc] = useState({ nome: '', imagem: '', cor: '#c9b8ff' });
  const caixaPalco = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ id: string; px: number; x: number; moveu: boolean } | null>(null);
  const historico = useRef<HTMLOListElement>(null);

  // Quem saiu de cena deixa de ser selecionado / de falar.
  useEffect(() => {
    if (selecionado && !palco.atores.some((a) => a.id === selecionado)) setSelecionado(null);
    if (quemFala && !palco.atores.some((a) => a.id === quemFala)) setQuemFala(null);
  }, [palco.atores, selecionado, quemFala]);
  useEffect(() => {
    historico.current?.scrollTo({ top: historico.current.scrollHeight });
  }, [palco.falas.length]);

  const palcoAcao = (acao: string, extra: Record<string, unknown> = {}) => enviar({ tipo: 'palco', acao, ...extra });
  const naCena = (id: string) => palco.atores.some((a) => a.refId === id);
  const sel = palco.atores.find((a) => a.id === selecionado) ?? null;

  // ---------- arrastar no palco ----------
  const apertar = (e: PointerEvent<HTMLDivElement>, a: Ator) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { id: a.id, px: e.clientX, x: a.x, moveu: false };
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const i = inicio.current;
    const largura = caixaPalco.current?.clientWidth ?? 1;
    if (!i) return;
    const dx = e.clientX - i.px;
    if (Math.abs(dx) > 3) i.moveu = true;
    if (i.moveu) setArrasto({ id: i.id, x: Math.min(100, Math.max(0, i.x + (dx / largura) * 100)) });
  };
  const soltar = async () => {
    const i = inicio.current;
    inicio.current = null;
    if (!i) return;
    if (!i.moveu) {
      setSelecionado(i.id);
      return;
    }
    const x = Math.round(arrasto?.x ?? i.x);
    await palcoAcao('mover', { atorId: i.id, x });
    setArrasto(null);
  };

  const mandarFala = async () => {
    if (!texto.trim()) return;
    if (await enviar({ tipo: 'fala', atorId: quemFala, texto })) setTexto('');
  };
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      mandarFala();
    }
  };

  const cenarios = imagens.filter((i) => i.pasta === 'cenarios' || i.pasta === 'galeria');
  const retratos = imagens.filter((i) => i.pasta !== 'cenarios');
  const falante = palco.atores.find((a) => a.id === quemFala);

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
          {palco.atores.map((a, i) => {
            const x = arrasto?.id === a.id ? arrasto.x : a.x;
            return (
              <div
                key={a.id}
                className={`ator-m ${selecionado === a.id ? 'sel' : ''} ${palco.fala?.atorId === a.id ? 'falando' : ''} ${a.espelhar ? 'espelhado' : ''}`}
                style={{ left: `${x}%`, zIndex: i + 1, '--cor': a.cor } as CSSProperties}
                onPointerDown={(e) => apertar(e, a)}
                onPointerMove={mover}
                onPointerUp={soltar}
                title="Arraste para mover · clique para selecionar"
              >
                <Retrato ent={a} />
                <span>{a.nome}</span>
              </div>
            );
          })}
          {palco.fala ? (
            <div className="fala-m" style={{ '--cor': palco.fala.cor } as CSSProperties}>
              <b>{palco.fala.nome || 'Narrador'}</b>
              <span>{palco.fala.texto}</span>
            </div>
          ) : null}
        </div>

        <div className={`ator-barra ${sel ? '' : 'vazia'}`}>
          {sel ? (
            <>
              <Retrato ent={sel} style={{ '--cor': sel.cor } as CSSProperties} />
              <b>{sel.nome}</b>
              <span className="deco" />
              <Botao classe="pequeno ouro" icone="balao" texto="Falar como" onClick={() => setQuemFala(sel.id)} />
              <Botao classe="pequeno" icone="reiniciar" texto="Virar" title="Espelhar a imagem" onClick={() => palcoAcao('espelhar', { atorId: sel.id })} />
              <Botao classe="pequeno" icone="cartas" texto="Para frente" onClick={() => palcoAcao('frente', { atorId: sel.id })} />
              <Botao classe="pequeno perigo" icone="sair" texto="Sair de cena" onClick={() => palcoAcao('sair', { atorId: sel.id })} />
            </>
          ) : <span className="dica-cena">Clique num personagem do palco para virar, trazer para frente ou tirar de cena. Arraste para mudar de lugar.</span>}
        </div>

        <div className="compositor">
          <div className="quem-fala">
            <button type="button" className={`chip-fala ${quemFala === null ? 'on' : ''}`} onClick={() => setQuemFala(null)}>
              <span className="narrador-ic">📜</span>Narrador
            </button>
            {palco.atores.map((a) => (
              <button key={a.id} type="button" className={`chip-fala ${quemFala === a.id ? 'on' : ''}`} style={{ '--cor': a.cor } as CSSProperties} onClick={() => setQuemFala(a.id)}>
                <Retrato ent={a} />{a.nome}
              </button>
            ))}
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={tecla}
            maxLength={600}
            placeholder={falante ? `Fala de ${falante.nome}… (Enter envia, Shift+Enter quebra linha)` : 'Narração… (Enter envia, Shift+Enter quebra linha)'}
          />
          <div className="linha-botoes">
            <Botao classe="ouro" icone="balao" texto={falante ? `Falar como ${falante.nome}` : 'Narrar'} disabled={!texto.trim()} onClick={mandarFala} />
            <Botao classe="fantasma" icone="fechar" texto="Limpar caixa" disabled={!palco.fala} onClick={() => enviar({ tipo: 'fala', texto: '' })} />
            <span className="deco" />
            <label className="check">
              <input type="checkbox" checked={estado.opcoes.falasPeloCelular} onChange={(e) => enviar({ tipo: 'opcoes', opcoes: { falasPeloCelular: e.target.checked } })} />
              Jogadores falam pelo celular
            </label>
          </div>
        </div>

        {palco.falas.length ? (
          <ol className="falas-m" ref={historico}>
            {palco.falas.map((f) => (
              <li key={f.id} style={{ '--cor': f.cor } as CSSProperties} className={f.atorId ? '' : 'narracao'}>
                <time>{hora(f.em)}</time>
                <b>{f.nome || 'Narrador'}{f.jogador ? <small> 📱</small> : null}</b>
                <span>{f.texto}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <aside className="cena-lado">
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
              <Botao classe="pequeno" icone="cartas" texto="Organizar" title="Espalhar todo mundo por igual no palco" onClick={() => palcoAcao('organizar')} />
              <Botao classe="pequeno fantasma" icone="lixo" texto="Esvaziar o palco" onClick={() => { if (confirm('Tirar todo mundo de cena?')) palcoAcao('limpar'); }} />
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
