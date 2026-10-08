// Painel do mestre: combate, galeria e os controles do telao.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EFEITOS } from '../../shared/condicoes.ts';
import type { Ameaca, Entidade, Estado, ImagemGaleria, InfoServidor, Lado } from '../comum/tipos-cliente.ts';
import { useMesa } from '../comum/conexao.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { Painel, criarEnviar, pin, type Avisar } from './contexto.ts';
import { Botao } from './Botao.tsx';
import { Card } from './Card.tsx';
import { Editor, type AlvoEditor } from './Editor.tsx';
import { Galeria } from './Galeria.tsx';
import { Jogadores } from './Jogadores.tsx';
import { Registro } from './Registro.tsx';
import { Bestiario } from './Bestiario.tsx';
import { CenaPainel } from './CenaPainel.tsx';
import { FaixaTestes, PedirTeste } from './Testes.tsx';
import type { ResultadoAcao } from '../../shared/acoes.ts';
import type { Ficha } from '../../shared/ficha.ts';

type Aba = 'combate' | 'cena' | 'bestiario' | 'jogadores' | 'galeria';
const ABAS: Aba[] = ['combate', 'cena', 'bestiario', 'jogadores', 'galeria'];

function abaGuardada(): Aba {
  try {
    const a = localStorage.getItem('mesa-aba') as Aba | null;
    return a && ABAS.includes(a) ? a : 'combate';
  } catch {
    return 'combate';
  }
}

export function App() {
  const [info, setInfo] = useState<InfoServidor | null>(null);
  useEffect(() => {
    fetch('/api/info', { headers: { 'x-pin': pin } }).then((r) => r.json()).then(setInfo).catch(() => {});
  }, []);
  if (!info) return null;
  if (!info.mestre) return <Bloqueio precisaPin={info.precisaPin} />;
  return <PainelMestre info={info} />;
}

function Bloqueio({ precisaPin }: { precisaPin: boolean }) {
  const [valor, setValor] = useState('');
  return (
    <div className="bloqueio">
      <div className="cartao-bloqueio">
        <span className="emblema"><Icone nome="cadeado" /></span>
        <h2>Painel do mestre</h2>
        {precisaPin ? (
          <>
            <p>Digite o PIN do mestre para entrar.</p>
            <form className="linha-pin" onSubmit={(e) => { e.preventDefault(); sessionStorage.setItem('pin', valor); location.reload(); }}>
              <input type="password" placeholder="PIN" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
              <button className="btn ouro">Entrar</button>
            </form>
          </>
        ) : (
          <p>O painel do mestre só abre no computador onde o programa está rodando (endereço localhost). A outra tela deve abrir /telao.</p>
        )}
      </div>
    </div>
  );
}

function PainelMestre({ info }: { info: InfoServidor }) {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [registro, setRegistro] = useState<ResultadoAcao[]>([]);
  const [bestiario, setBestiario] = useState<Ameaca[]>([]);
  const [registroAberto, setRegistroAberto] = useState(false);
  const [pedindoTeste, setPedindoTeste] = useState(false);
  const [novidades, setNovidades] = useState(0);
  const { estado, online } = useMesa<Estado>('mestre', {
    pin,
    ouvintes: {
      fichas: (d) => setFichas(d as Ficha[]),
      registro: (d) => setRegistro(d as ResultadoAcao[]),
      bestiario: (d) => setBestiario(d as Ameaca[]),
      acao: (d) => {
        const r = d as ResultadoAcao;
        setRegistro((lista) => [r, ...lista.filter((x) => x.id !== r.id)].slice(0, 80));
        setNovidades((n) => n + 1);
      },
    },
  });
  const [aba, setAba] = useState<Aba>(abaGuardada);
  const [imagens, setImagens] = useState<ImagemGaleria[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<AlvoEditor | null>(null);
  const [fxAberto, setFxAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [valorSel, setValorSel] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [toast, setToast] = useState<{ texto: string; tipo: string; visivel: boolean }>({ texto: '', tipo: 'erro', visivel: false });
  const timerToast = useRef<number>(undefined);
  const receberArquivos = useRef<(a: FileList | File[]) => void>(() => {});
  const menu = useRef<HTMLDetailsElement>(null);

  const avisar: Avisar = useCallback((texto, tipo = 'erro') => {
    setToast({ texto, tipo, visivel: true });
    clearTimeout(timerToast.current);
    timerToast.current = window.setTimeout(() => setToast((t) => ({ ...t, visivel: false })), 2800);
  }, []);
  const enviar = useMemo(() => criarEnviar(avisar), [avisar]);
  const ctx = useMemo(() => ({ enviar, avisar }), [enviar, avisar]);

  const carregarImagens = useCallback(async () => {
    try {
      setImagens(await (await fetch('/api/imagens')).json());
    } catch { /* sem servidor: mantem a lista */ }
  }, []);
  useEffect(() => { carregarImagens(); }, [carregarImagens]);

  const abrirAba = useCallback((nova: Aba) => {
    setAba(nova);
    document.body.dataset.aba = nova;
    try { localStorage.setItem('mesa-aba', nova); } catch { /* sem armazenamento: so nao lembra a aba */ }
    if (nova === 'galeria') carregarImagens(); // pega tambem o que foi copiado direto para as pastas
  }, [carregarImagens]);
  useEffect(() => { document.body.dataset.aba = aba; }, [aba]);
  useEffect(() => { document.body.classList.toggle('arrastando', arrastando); }, [arrastando]);

  // Selecao some quando o combatente sai da mesa.
  useEffect(() => {
    if (!estado) return;
    const ids = new Set([...estado.aliados, ...estado.inimigos].map((x) => x.id));
    setSelecionados((s) => (([...s].every((id) => ids.has(id))) ? s : new Set([...s].filter((id) => ids.has(id)))));
  }, [estado]);

  // Atalhos: N / seta = proximo turno, Ctrl+Z = desfazer.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select')) return;
      if (e.key === 'n' || e.key === 'ArrowRight') enviar({ tipo: 'turno', acao: 'proximo' });
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) enviar({ tipo: 'desfazer' });
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [enviar]);

  // Fecha o menu "..." ao clicar fora.
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) setMenuAberto(false);
    };
    addEventListener('click', clique);
    return () => removeEventListener('click', clique);
  }, []);

  // Arrastar arquivos para qualquer lugar do painel e Ctrl+V com imagem.
  useEffect(() => {
    let profundidade = 0;
    const temArquivos = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const entrar = (e: DragEvent) => { if (temArquivos(e)) { profundidade += 1; setArrastando(true); } };
    const sair = (e: DragEvent) => { if (temArquivos(e) && --profundidade <= 0) { profundidade = 0; setArrastando(false); } };
    const sobre = (e: DragEvent) => { if (temArquivos(e)) e.preventDefault(); };
    const soltar = (e: DragEvent) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      profundidade = 0;
      setArrastando(false);
      receberArquivos.current(e.dataTransfer!.files);
    };
    const colar = (e: ClipboardEvent) => {
      const arquivos = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!arquivos.length) return;
      e.preventDefault();
      receberArquivos.current(arquivos);
    };
    addEventListener('dragenter', entrar);
    addEventListener('dragleave', sair);
    addEventListener('dragover', sobre);
    addEventListener('drop', soltar);
    addEventListener('paste', colar);
    return () => {
      removeEventListener('dragenter', entrar);
      removeEventListener('dragleave', sair);
      removeEventListener('dragover', sobre);
      removeEventListener('drop', soltar);
      removeEventListener('paste', colar);
    };
  }, []);

  const registrarEnvio = useCallback((f: (a: FileList | File[]) => void) => { receberArquivos.current = f; }, []);
  const enderecoTelao = `${info.enderecos[0] ?? location.origin}/telao?fundo=1`;

  if (!estado) return <Topo online={false} />;

  const alternar = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  };
  const m = estado.cena.mostrar;
  const t = estado.turnos;
  const todos = [
    ...estado.aliados.map((e) => ({ e: e as Entidade, lado: 'aliados' as Lado })),
    ...estado.inimigos.map((e) => ({ e: e as Entidade, lado: 'inimigos' as Lado })),
  ].filter(({ e }) => e.iniciativa !== null && e.iniciativa !== undefined).sort((a, b) => (b.e.iniciativa ?? 0) - (a.e.iniciativa ?? 0));

  const lista = (lado: Lado) => (estado[lado] as Entidade[]).map((ent) => (
    <Card
      key={ent.id}
      ent={ent}
      lado={lado}
      estado={estado}
      selecionado={selecionados.has(ent.id)}
      aberto={abertos.has(ent.id)}
      alternarSelecao={() => setSelecionados((s) => alternar(s, ent.id))}
      alternarAberto={() => setAbertos((s) => alternar(s, ent.id))}
      editar={() => setEditor({ lado, ent })}
      ficha={lado === 'aliados' ? fichas.find((f) => f.id === (ent as { fichaId?: string | null }).fichaId) : undefined}
    />
  ));

  const aplicarSelecao = async (modo: string) => {
    if (await enviar({ tipo: 'dano', ids: [...selecionados], modo, valor: Number.parseInt(valorSel, 10) || 0 })) setValorSel('');
  };

  return (
    <Painel.Provider value={ctx}>
      <header className="topo">
        <div className="topo-esq">
          <div className="marca">
            <span className="emblema"><Icone nome="d20" /></span>
            <div><b>Mesa T20</b><small>Painel do mestre</small></div>
          </div>
          <nav className="abas" role="tablist">
            <button className={`aba ${aba === 'combate' ? 'ativa' : ''}`} role="tab" aria-selected={aba === 'combate'} onClick={() => abrirAba('combate')}>
              <Icone nome="espada" /><span>Combate</span>
            </button>
            <button className={`aba ${aba === 'cena' ? 'ativa' : ''}`} role="tab" aria-selected={aba === 'cena'} onClick={() => abrirAba('cena')}>
              <Icone nome="mascara" /><span>Cena</span>
              <i className="ponto-ar" title="O telão está no modo cena" hidden={estado.cena.modo !== 'roleplay'} />
            </button>
            <button className={`aba ${aba === 'bestiario' ? 'ativa' : ''}`} role="tab" aria-selected={aba === 'bestiario'} onClick={() => abrirAba('bestiario')}>
              <Icone nome="caveira" /><span>Bestiário</span>
            </button>
            <button className={`aba ${aba === 'jogadores' ? 'ativa' : ''}`} role="tab" aria-selected={aba === 'jogadores'} onClick={() => abrirAba('jogadores')}>
              <Icone nome="celular" /><span>Jogadores</span>
            </button>
            <button className={`aba ${aba === 'galeria' ? 'ativa' : ''}`} role="tab" aria-selected={aba === 'galeria'} onClick={() => abrirAba('galeria')}>
              <Icone nome="imagem" /><span>Galeria</span>
              <i className="ponto-ar" title="Há uma imagem no telão" hidden={!m} />
            </button>
          </nav>
        </div>

        <div className="turno-barra">
          {t.ativo ? (
            <>
              <Botao classe="icone" icone="anterior" title="Turno anterior" onClick={() => enviar({ tipo: 'turno', acao: 'anterior' })} />
              <span className="rodada-m">Rodada<b>{t.rodada}</b></span>
              <button type="button" className="btn ouro proximo" title="Próximo turno (N)" onClick={() => enviar({ tipo: 'turno', acao: 'proximo' })}>
                <span>Próximo</span><Icone nome="proximo" />
              </button>
              <Botao classe="icone perigo" icone="parar" title="Encerrar combate" onClick={() => enviar({ tipo: 'turno', acao: 'encerrar' })} />
              <Botao classe="icone" icone="celular" title="Pedir teste aos celulares" onClick={() => setPedindoTeste(true)} />
            </>
          ) : (
            <>
              <Botao icone="d20" texto="Rolar iniciativa" title="d20 + bônus de cada um" onClick={() => enviar({ tipo: 'rolarIniciativa' })} />
              <Botao icone="celular" texto="Pedir teste" title="Cada jogador rola no celular (perícia, resistência ou iniciativa)" onClick={() => setPedindoTeste(true)} />
              <Botao classe="ouro" icone="play" texto="Iniciar combate" onClick={() => enviar({ tipo: 'turno', acao: 'iniciar' })} />
            </>
          )}
        </div>

        <div className="topo-acoes">
          {m ? (
            <div className="no-telao">
              <span className="retrato" style={{ backgroundImage: `url("${m.imagem}")` }} />
              <button className="no-telao-texto" title="Abrir a galeria" onClick={() => abrirAba('galeria')}>
                <small>No telão</small><b>{m.titulo || m.imagem.split('/').pop()!.replace(/\.[^.]+$/, '')}</b>
              </button>
              <Botao classe="icone pequeno fantasma" icone="fechar" title="Esconder dos jogadores" onClick={() => enviar({ tipo: 'mostrar', acao: 'esconder' })} />
            </div>
          ) : null}
          <span className={`status ${online ? 'on' : ''}`} title="Conexão com o servidor"><i /><span>{online ? 'Ao vivo' : 'Sem conexão'}</span></span>
          <button className={`btn ${fxAberto ? 'ativo' : ''}`} title="Efeitos de tela" onClick={() => setFxAberto((v) => !v)}>
            <Icone nome="faisca" /><span className="rotulo-btn">Efeitos</span>
          </button>
          <button className={`btn icone ${registroAberto ? 'ativo' : ''}`} title="Registro das ações" onClick={() => { setRegistroAberto((v) => !v); setNovidades(0); }}>
            <Icone nome="log" />
            {novidades && !registroAberto ? <i className="contador">{novidades > 9 ? '9+' : novidades}</i> : null}
          </button>
          <Botao classe="icone" icone="desfazer" title="Desfazer (Ctrl+Z)" onClick={() => enviar({ tipo: 'desfazer' })} />
          <details className="menu" ref={menu} open={menuAberto} onToggle={(e) => setMenuAberto(e.currentTarget.open)}>
            <summary className="btn icone" title="Mais opções"><Icone nome="reticencias" /></summary>
            <div className="menu-lista">
              <button onClick={() => { setMenuAberto(false); navigator.clipboard?.writeText(enderecoTelao); avisar(`Abra no outro aparelho: ${enderecoTelao}`, 'info'); }}>
                <Icone nome="tela" />Copiar endereço do telão
              </button>
              <button onClick={() => { setMenuAberto(false); if (confirm('Curar todos os heróis, restaurar PM e remover condições?')) enviar({ tipo: 'descanso' }); }}>
                <Icone nome="lua" />Descanso (cura todos os heróis)
              </button>
              <hr />
              <button onClick={() => { setMenuAberto(false); if (confirm('Voltar ao grupo de exemplo? (dá para desfazer)')) enviar({ tipo: 'reiniciar' }); }}>
                <Icone nome="reiniciar" />Reiniciar grupo de exemplo
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="faixas">
        {fxAberto ? (
          <div className="faixa fx-painel">
            <span className="faixa-rotulo">Efeitos no telão</span>
            {EFEITOS.map((e) => (
              <button key={e.id} type="button" className="btn efeito" onClick={() => enviar({ tipo: 'fx', efeito: e.id })}>
                <span className="emoji">{e.icone}</span>{e.nome}
              </button>
            ))}
          </div>
        ) : null}
        {todos.length ? (
          <div className="faixa ordem-m" id="ordemM">
            <span className="faixa-rotulo">Iniciativa</span>
            {todos.map(({ e, lado }) => {
              const escondido = lado === 'inimigos' && !(e as { naTela?: boolean }).naTela && estado.cena.bossId !== e.id;
              const classes = ['chip-ordem', lado === 'inimigos' ? 'inimigo' : '', t.ativo && t.atual === e.id ? 'atual' : '', escondido ? 'oculto' : '', e.pv <= 0 ? 'caido' : ''].filter(Boolean).join(' ');
              return (
                <button
                  key={e.id}
                  type="button"
                  className={classes}
                  style={{ '--cor': lado === 'aliados' ? (e as { cor: string }).cor : 'var(--inimigo)' } as CSSProperties}
                  title={escondido ? 'Escondido dos jogadores. Clique para dar a vez.' : 'Clique para dar a vez'}
                  onClick={() => enviar({ tipo: 'turno', acao: 'definir', id: e.id })}
                >
                  <Retrato ent={e} />
                  <span className="nome-chip">{e.nome}</span>
                  <b>{e.iniciativa}</b>
                </button>
              );
            })}
          </div>
        ) : null}
        <FaixaTestes estado={estado} />
        {estado.efeitos.length ? (
          <div className="faixa efeitos-m">
            <span className="faixa-rotulo">Magias ativas</span>
            {estado.efeitos.map((ef) => {
              const nomeDe = (id: string) => [...estado.aliados, ...estado.inimigos].find((x) => x.id === id)?.nome ?? '?';
              const quem = estado.aliados.find((h) => h.id === ef.conjuradorId);
              const alvos = ef.alvos.length ? ef.alvos.map(nomeDe).join(', ') : 'si mesmo / área';
              const dur = ef.persistente === 'rodadas' ? `${ef.rodadas ?? 1} rod.` : ef.persistente === 'sustentada' ? 'sustentada' : 'cena';
              return (
                <span key={ef.id} className="chip-efeito" style={{ '--cor': quem?.cor ?? 'var(--ouro)' } as CSSProperties} title={`${nomeDe(ef.conjuradorId)} → ${alvos}`}>
                  <b>{ef.nome}</b>
                  <small>{nomeDe(ef.conjuradorId)} → {alvos}</small>
                  <i>{dur}</i>
                  <button type="button" title="Encerrar efeito (as condições que ele impôs saem junto)" onClick={() => enviar({ tipo: 'encerrarEfeito', id: ef.id })}>
                    <Icone nome="fechar" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <Jogadores estado={estado} fichas={fichas} info={info} visivel={aba === 'jogadores'} />
      <CenaPainel visivel={aba === 'cena'} estado={estado} imagens={imagens} abrirGaleria={() => abrirAba('galeria')} />
      <Bestiario
        visivel={aba === 'bestiario'}
        estado={estado}
        bestiario={bestiario}
        editar={(a) => setEditor({ lado: 'inimigos', ent: null, ameaca: a })}
        irParaCombate={() => abrirAba('combate')}
      />

      <Galeria
        visivel={aba === 'galeria'}
        estado={estado}
        imagens={imagens}
        recarregar={carregarImagens}
        registrarEnvio={registrarEnvio}
        abrirGaleria={() => abrirAba('galeria')}
      />

      <div className="soltar-aviso" aria-hidden="true">
        <div><span className="icone-grande"><Icone nome="enviar" /></span><b>Solte para enviar</b><small>As imagens vão para a galeria</small></div>
      </div>

      {aba === 'combate' ? (
        <main className="colunas" id="abaCombate">
          <section>
            <header className="secao-topo">
              <h2>Heróis</h2><span className="conta">{estado.aliados.length}</span><span className="deco" />
              <Botao classe="pequeno" icone="mais" texto="Novo herói" onClick={() => setEditor({ lado: 'aliados', ent: null })} />
            </header>
            <div className="lista">{lista('aliados')}</div>
          </section>
          <section>
            <header className="secao-topo">
              <h2>Inimigos</h2><span className="conta">{estado.inimigos.length}</span><span className="deco" />
              <Botao classe="pequeno" icone="caveira" texto="Bestiário" title="Pôr inimigos guardados na mesa" onClick={() => abrirAba('bestiario')} />
              <Botao classe="pequeno" icone="mais" texto="Novo inimigo" onClick={() => setEditor({ lado: 'inimigos', ent: null })} />
            </header>
            <div className="lista">{lista('inimigos')}</div>
          </section>
        </main>
      ) : null}

      {selecionados.size ? (
        <div className="selecao">
          <span className="conta-sel">{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span>
          <input type="number" min="1" placeholder="Valor" value={valorSel} onChange={(e) => setValorSel(e.target.value)} />
          <Botao classe="dano" icone="espada" texto="Dano" onClick={() => aplicarSelecao('dano')} />
          <Botao classe="cura" icone="coracao" texto="Cura" onClick={() => aplicarSelecao('cura')} />
          <Botao classe="icone fantasma" icone="fechar" title="Limpar seleção" onClick={() => setSelecionados(new Set())} />
        </div>
      ) : null}

      <PedirTeste estado={estado} aberto={pedindoTeste} fechar={() => setPedindoTeste(false)} />
      <Registro aberto={registroAberto} fechar={() => setRegistroAberto(false)} registro={registro} />
      <Editor alvo={editor} imagens={imagens} fechar={() => setEditor(null)} aoRemover={(id) => setSelecionados((s) => { const n = new Set(s); n.delete(id); return n; })} />
      <div className={`toast ${toast.tipo} ${toast.visivel ? 'visivel' : ''}`}>{toast.texto}</div>
    </Painel.Provider>
  );
}

function Topo({ online }: { online: boolean }) {
  return (
    <header className="topo">
      <div className="topo-esq">
        <div className="marca"><span className="emblema"><Icone nome="d20" /></span><div><b>Mesa T20</b><small>Painel do mestre</small></div></div>
      </div>
      <div />
      <div className="topo-acoes"><span className={`status ${online ? 'on' : ''}`}><i /><span>Conectando…</span></span></div>
    </header>
  );
}
