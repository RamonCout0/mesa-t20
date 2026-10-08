// Telao: o que todo mundo ve. Herois embaixo, boss no centro, capangas nos flancos,
// ordem de turno no topo e a imagem que o mestre mostrar.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EstadoPublico, Evento, Heroi, InimigoPublico, Mostrar, Turnos, FichaOrdem } from '../comum/tipos-cliente.ts';
import type { EfeitoAtivo, ResultadoAcao } from '../../shared/acoes.ts';
import { EfeitosAtivos } from './EfeitosAtivos.tsx';
import { PalcoCena } from './PalcoCena.tsx';
import { alternarMudo, aoMudarSom, liberarAudioNoPrimeiroGesto, somBloqueado, somDissipar, somInvocacao, somMudo } from './sons.ts';

liberarAudioNoPrimeiroGesto();
import { Apresentacao } from './Apresentacao.tsx';
import { useMesa } from '../comum/conexao.ts';
import { Barra, BarraInimigo, Condicoes, Retrato } from '../comum/pecas.tsx';
import { efeitoDeTela, elementoDe, flutuante, pulsar, sorte } from './efeitos.ts';

const NOME_TIER: Record<string, string> = { elite: 'Elite', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico' };
const params = new URLSearchParams(location.search);

function aoEvento(ev: Evento) {
  if (ev.tipo === 'fx') return efeitoDeTela(ev.efeito);
  const elemento = elementoDe(ev.alvo);
  if (!elemento) return;
  const caixa = elemento.id === 'boss' ? document.getElementById('molduraBoss')! : elemento;
  if (ev.tipo === 'dano') pulsar(elemento, 'tomou-dano', 600);
  if (ev.valor !== null && ev.valor !== undefined) {
    const pm = ev.tipo === 'pmGasta' || ev.tipo === 'pmRecupera';
    const sinal = ev.tipo === 'dano' || ev.tipo === 'pmGasta' ? '−' : '+';
    flutuante(caixa, `${pm ? 'pm' : ev.tipo}${ev.tipo === 'dano' && ev.valor >= 20 ? ' forte' : ''}`, `${sinal}${ev.valor}`);
  }
}

export function App() {
  const receberAcao = useRef<(r: ResultadoAcao) => void>(() => {});
  // Efeito novo (magia sustentada...) so aparece quando a magia chega no alvo.
  const [efeitosOcultos, setEfeitosOcultos] = useState<Record<string, string[]>>({});
  const { estado: vivo, online } = useMesa<EstadoPublico>('publico', {
    aoEvento: (e) => aoEvento(e as Evento),
    ouvintes: {
      acao: (dados) => {
        const r = dados as ResultadoAcao;
        if (r.efeitoId) {
          const id = r.efeitoId;
          setEfeitosOcultos((o) => ({ ...o, [id]: r.alvos.map((a) => a.id) }));
          setTimeout(() => setEfeitosOcultos((o) => { const n = { ...o }; delete n[id]; return n; }), 12000);
        }
        receberAcao.current(r);
      },
    },
  });
  const [fundo, setFundo] = useState(params.get('fundo') === '1');

  // Enquanto a animacao do golpe nao chega, o alvo continua com o PV de antes.
  const ultimo = useRef<EstadoPublico | null>(null);
  ultimo.current = vivo;
  const [segurados, setSegurados] = useState<Record<string, Heroi | InimigoPublico>>({});
  const segurar = useCallback((ids: string[]) => {
    const e = ultimo.current;
    if (!e) return;
    setSegurados((s) => {
      const n = { ...s };
      for (const id of ids) {
        const ent = e.aliados.find((h) => h.id === id) ?? e.inimigos.find((i) => i.id === id);
        if (ent && !n[id]) n[id] = ent;
      }
      return n;
    });
    // Seguranca: nada fica preso se a animacao falhar.
    setTimeout(() => setSegurados((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !ids.includes(id)))), 12000);
  }, []);
  const soltar = useCallback((id: string) => {
    setSegurados((s) => {
      if (!s[id]) return s;
      const n = { ...s };
      delete n[id];
      return n;
    });
    setEfeitosOcultos((o) => (Object.values(o).some((alvos) => alvos.includes(id))
      ? Object.fromEntries(Object.entries(o).filter(([, alvos]) => !alvos.includes(id)))
      : o));
  }, []);
  const terminou = useCallback((r: ResultadoAcao) => {
    if (r.efeitoId) setEfeitosOcultos((o) => { const n = { ...o }; delete n[r.efeitoId!]; return n; });
  }, []);
  const registrar = useCallback((f: (r: ResultadoAcao) => void) => { receberAcao.current = f; }, []);
  const estado = useMemo<EstadoPublico | null>(() => {
    if (!vivo || (!Object.keys(segurados).length && !Object.keys(efeitosOcultos).length)) return vivo;
    return {
      ...vivo,
      aliados: vivo.aliados.map((h) => (segurados[h.id] as Heroi | undefined) ?? h),
      inimigos: vivo.inimigos.map((i) => (segurados[i.id] as InimigoPublico | undefined) ?? i),
      efeitos: vivo.efeitos.filter((e) => !efeitosOcultos[e.id]),
    };
  }, [vivo, segurados, efeitosOcultos]);

  // Efeito que acabou (desfeito, tempo esgotado): some com um brilho em quem estava sob ele.
  const efeitosAntes = useRef<EfeitoAtivo[] | null>(null);
  useEffect(() => {
    const agora = vivo?.efeitos;
    if (!agora) return;
    const antes = efeitosAntes.current;
    efeitosAntes.current = agora;
    if (!antes) return;
    const acabaram = antes.filter((x) => !agora.some((y) => y.id === x.id));
    if (acabaram.length) somDissipar();
    for (const e of acabaram) {
      for (const id of new Set([...e.alvos, e.conjuradorId])) {
        const el = elementoDe(id);
        if (!el) continue;
        pulsar(el, 'dissipando', 1200);
        flutuante(el.id === 'boss' ? document.getElementById('molduraBoss')! : el, 'dissipou', `${e.nome} se desfaz`);
      }
    }
  }, [vivo?.efeitos]);

  useEffect(() => { document.body.classList.toggle('com-fundo', fundo); }, [fundo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'b') setFundo((f) => !f);
      if (e.key.toLowerCase() === 'm') alternarMudo();
      if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, []);

  const atual = estado?.turnos.ativo ? estado.turnos.atual : null;
  const boss = estado?.inimigos.find((i) => i.id === estado.cena.bossId) ?? null;
  const capangas = estado?.inimigos.filter((i) => i.id !== estado.cena.bossId) ?? [];

  // Boss invocado de novo: a chave remonta a caixa (animacao de entrada) e vem tremor + clarao.
  // Na primeira carga da pagina so aparece, sem susto.
  const invocacao = useRef<{ id: string | null; primeira: boolean }>({ id: null, primeira: true });
  const idInvocacao = boss ? estado!.cena.idInvocacao : null;
  useEffect(() => {
    if (!estado) return;
    const r = invocacao.current;
    if (idInvocacao && idInvocacao !== r.id && !r.primeira) {
      somInvocacao();
      efeitoDeTela('tremor');
      pulsar(document.getElementById('clarao'), 'dispara');
    }
    r.id = idInvocacao;
    r.primeira = false;
  }, [estado, idInvocacao]);

  const efeitos = estado?.efeitos ?? [];
  const roleplay = estado?.cena.modo === 'roleplay';
  const classesRaiz = ['raiz', boss ? 'boss-ativo' : '', boss ? `tier-${boss.tier}` : '', roleplay ? 'modo-roleplay' : ''].filter(Boolean).join(' ');

  return (
    <div className={classesRaiz} id="raiz" data-tema={boss?.tema}>
      <Ambiente />
      {estado ? <PalcoCena palco={estado.cena.palco} estado={estado} ativo={roleplay} /> : null}
      {estado ? <Ordem turnos={estado.turnos} /> : null}
      <main className={`campo ${boss ? '' : 'sem-boss'}`} id="campo">
        <Flanco lado="esq" lista={boss ? capangas.filter((_, i) => i % 2 === 0) : capangas} comBoss={Boolean(boss)} atual={atual} efeitos={efeitos} />
        {boss && estado ? <Boss key={estado.cena.idInvocacao} boss={boss} atual={atual} efeitos={efeitos} /> : <div className="boss" id="boss" />}
        <Flanco lado="dir" lista={boss ? capangas.filter((_, i) => i % 2 === 1) : []} comBoss={Boolean(boss)} atual={atual} efeitos={efeitos} />
      </main>
      <footer className="grupo" id="grupo">
        {estado?.aliados.map((h, i) => <CartaHeroi key={h.id} heroi={h} indice={i} atual={atual} efeitos={efeitos} />)}
      </footer>
      <Vitrine mostrar={estado?.cena.mostrar ?? null} />
      <div className="fx" id="fx" />
      <Apresentacao registrar={registrar} segurar={segurar} soltar={soltar} terminou={terminou} />
      <div className="clarao-invocacao" id="clarao" />
      <div className={`aviso-conexao ${online ? '' : 'visivel'}`} id="conexao"><i />Sem conexão com o servidor…</div>
      <AvisoSom />
    </div>
  );
}

// ---------------- ambiente ----------------

/** Brasas que sobem atras do boss e poeira dourada. Sorteadas uma vez so. */
function Ambiente() {
  const poeira = useMemo(() => Array.from({ length: 24 }, () => ({
    left: `${sorte(0, 100)}%`, top: `${sorte(0, 100)}%`, '--t': `${sorte(1.5, 3.5)}px`, '--d': `${sorte(14, 30)}s`,
    '--atraso': `${-sorte(0, 30)}s`, '--x': `${sorte(-8, 8)}vw`, '--y': `${sorte(-14, -4)}vh`,
  }) as CSSProperties), []);
  return (
    <div className="ambiente" aria-hidden="true">
      <div className="nevoa" />
      <div className="nevoa nevoa-2" />
      <div className="tingir" />
      <div className="poeira" id="poeira">{poeira.map((s, i) => <i key={i} style={s} />)}</div>
      <div className="grao" />
      <div className="vinheta" />
    </div>
  );
}

function Brasas() {
  const brasas = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    quente: i % 4 === 0,
    s: {
      left: `${sorte(4, 96)}%`, '--t': `${sorte(2, 6)}px`, '--d': `${sorte(4, 9)}s`, '--atraso': `${-sorte(0, 9)}s`,
      '--x': `${sorte(-12, 12)}vw`, '--y': `${-sorte(40, 75)}vh`,
    } as CSSProperties,
  })), []);
  return <div className="brasas" id="brasas">{brasas.map((b, i) => <i key={i} className={`brasa${b.quente ? ' quente' : ''}`} style={b.s} />)}</div>;
}

// ---------------- ordem de turno ----------------

function Ordem({ turnos }: { turnos: Turnos & { ordem: FichaOrdem[] } }) {
  const pos = turnos.ordem.findIndex((o) => o.id === turnos.atual);
  return (
    <div className={`ordem ${turnos.ativo && turnos.ordem.length ? 'ativa' : ''}`} id="ordem">
      <div className="rodada" id="rodada"><small>Rodada</small><b>{turnos.rodada}</b></div>
      <div className="fila" id="fila">
        {turnos.ordem.map((o, i) => (
          <div
            key={o.id}
            className={['ficha', o.lado === 'inimigos' ? 'inimiga' : '', o.id === turnos.atual ? 'atual' : '', pos >= 0 && i < pos ? 'passou' : ''].filter(Boolean).join(' ')}
            style={{ '--cor': o.cor ?? 'var(--inimigo)' } as CSSProperties}
            title={o.nome}
          >
            <Retrato ent={o} />
            <span className="ini">{o.iniciativa}</span>
            <span className="nome-ficha">{o.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- herois ----------------

function CartaHeroi({ heroi, indice, atual, efeitos }: { heroi: Heroi; indice: number; atual: string | null; efeitos: EfeitoAtivo[] }) {
  const classes = ['heroi', heroi.pv <= 0 ? 'caido' : '', heroi.pv > 0 && heroi.pv / heroi.pvMax <= 0.25 ? 'baixo-pv' : '', atual === heroi.id ? 'atual' : '']
    .filter(Boolean).join(' ');
  const temIni = heroi.iniciativa !== null && heroi.iniciativa !== undefined;
  return (
    <div className={classes} data-id={heroi.id} style={{ '--cor': heroi.cor, '--i': indice } as CSSProperties}>
      <div className="carta">
        <Retrato ent={heroi} />
        <div className="alerta" />
        <div className="info">
          <div className="nome"><span className="n">{heroi.nome}</span></div>
          <div className="classe">{[heroi.classe, heroi.nivel ? `Nível ${heroi.nivel}` : ''].filter(Boolean).join(' · ')}</div>
          <Barra tipo="pv" atual={heroi.pv} max={heroi.pvMax} temp={heroi.pvTemp} />
          {heroi.pmMax ? <Barra tipo="pm" atual={heroi.pm} max={heroi.pmMax} /> : <div className="barra pm" style={{ display: 'none' }} />}
        </div>
      </div>
      <div className="aro" />
      <div className={`ini ${temIni ? 'visivel' : ''}`}>{heroi.iniciativa ?? ''}</div>
      <Condicoes ids={heroi.condicoes} />
      <EfeitosAtivos id={heroi.id} efeitos={efeitos} />
      <div className="na-vez">Na vez</div>
      <div className="tag">Caído</div>
    </div>
  );
}

// ---------------- inimigos ----------------

function Flanco({ lado, lista, comBoss, atual, efeitos }: { lado: 'esq' | 'dir'; lista: InimigoPublico[]; comBoss: boolean; atual: string | null; efeitos: EfeitoAtivo[] }) {
  const n = lista.length;
  const tam = comBoss ? (n <= 2 ? 'g' : n <= 4 ? 'm' : 'p') : (n <= 4 ? 'gg' : n <= 6 ? 'g' : n <= 10 ? 'm' : 'p');
  return (
    <div className={`flanco ${lado}`} id={lado === 'esq' ? 'flancoEsq' : 'flancoDir'} data-tam={tam}>
      {lista.map((ini) => (
        <div key={ini.id} data-id={ini.id} className={['capanga', ini.caido ? 'caido' : '', atual === ini.id ? 'atual' : ''].filter(Boolean).join(' ')}>
          <div className={`ini ${ini.iniciativa !== null && ini.iniciativa !== undefined ? 'visivel' : ''}`}>{ini.iniciativa ?? ''}</div>
          <Retrato ent={ini} />
          <div className="nome">{ini.nome}</div>
          <BarraInimigo ini={ini} />
          <Condicoes ids={ini.condicoes} />
          <EfeitosAtivos id={ini.id} efeitos={efeitos} />
          <div className="na-vez">Na vez</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- boss ----------------

function Boss({ boss, atual, efeitos }: { boss: InimigoPublico; atual: string | null; efeitos: EfeitoAtivo[] }) {
  const classes = ['boss', 'ativa', boss.caido ? 'caido' : '', atual === boss.id ? 'atual' : ''].filter(Boolean).join(' ');
  const temIni = boss.iniciativa !== null && boss.iniciativa !== undefined;
  return (
    <div className={classes} id="boss" data-id={boss.id}>
      <div className="selo-ameaca" id="avisoAmeaca">{NOME_TIER[boss.tier] ?? ''}</div>
      <div className="palco">
        <div className="energia" aria-hidden="true">
          <div className="cam cam-a" /><div className="cam cam-b" /><div className="cam cam-c" />
          <div className="onda" /><div className="onda onda-2" /><div className="onda onda-3" />
          <Brasas />
        </div>
        <svg className="circulo" viewBox="-100 -100 200 200" aria-hidden="true">
          <g className="anel-a">
            <circle r="97" strokeWidth="0.6" opacity="0.7" />
            <circle r="92" strokeWidth="3.2" strokeDasharray="0.8 5.2" opacity="0.75" />
            <circle r="87" strokeWidth="0.5" opacity="0.5" />
          </g>
          <g className="anel-b">
            <circle r="79" strokeWidth="0.9" strokeDasharray="16 5 2 5" opacity="0.6" />
            <path d="M0-79 68.4 39.5-68.4 39.5ZM0 79-68.4-39.5 68.4-39.5Z" strokeWidth="0.7" opacity="0.4" />
          </g>
          <g className="anel-c">
            <circle r="58" strokeWidth="0.6" opacity="0.45" />
            <path d="M0-64 3-58 0-52-3-58ZM0 64 3 58 0 52-3 58ZM-64 0-58 3-52 0-58-3ZM64 0 58 3 52 0 58-3Z" fill="currentColor" stroke="none" opacity="0.8" />
          </g>
        </svg>
        <div className="moldura" id="molduraBoss">
          <div className="arte" id="arteBoss" style={boss.imagem ? { backgroundImage: `url("${boss.imagem}")` } : undefined} />
          <i className="canto c1" /><i className="canto c2" /><i className="canto c3" /><i className="canto c4" />
          <div className="estrela" id="estrela">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path fill="currentColor" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round" d="M50 4 61.2 34.6 93.8 35.8 68.1 55.9 77 87.2 50 69 23 87.2 31.9 55.9 6.2 35.8 38.8 34.6Z" />
              <path fill="#000" opacity="0.28" d="M50 50 50 4 61.2 34.6ZM50 50 93.8 35.8 68.1 55.9ZM50 50 77 87.2 50 69ZM50 50 23 87.2 31.9 55.9ZM50 50 6.2 35.8 38.8 34.6Z" />
              <circle cx="50" cy="50" r="7" fill="#fff" opacity="0.85" />
            </svg>
          </div>
          <div className={`iniciativa-boss ${temIni ? 'visivel' : ''}`} id="iniBoss">{boss.iniciativa ?? ''}</div>
          <div className="na-vez">Na vez</div>
          <div className="selo-derrota">Derrotado</div>
          <EfeitosAtivos id={boss.id} efeitos={efeitos} partes="aura" />
        </div>
      </div>
      <div className="placa">
        <div className="boss-nome" id="bossNome">{boss.nome}</div>
        <div className="boss-sub" id="bossSub">
          {boss.subtitulo ? <span>{boss.subtitulo}</span> : null}
          {boss.nd ? <span className="nd">{boss.nd}</span> : null}
        </div>
      </div>
      <div className="boss-vida">
        <div className="trilho"><BarraInimigo ini={boss} /></div>
        <Condicoes ids={boss.condicoes} />
        <EfeitosAtivos id={boss.id} efeitos={efeitos} partes="selos" />
      </div>
      <div className="habilidades" id="bossHabs">
        {boss.habilidades.map((n, i) => <div key={n} className="habilidade" style={{ animationDelay: `${i * 70}ms` }}>{n}</div>)}
      </div>
    </div>
  );
}

// ---------------- vitrine (imagem mostrada aos jogadores) ----------------

function Vitrine({ mostrar }: { mostrar: Mostrar | null }) {
  const [aberta, setAberta] = useState<{ id: string; src: string; w: number; h: number; vetor: boolean } | null>(null);
  const [tela, setTela] = useState({ w: innerWidth, h: innerHeight });
  const [animKey, setAnimKey] = useState(0);
  const titulo = useRef<HTMLElement>(null);

  useEffect(() => {
    const r = () => setTela({ w: innerWidth, h: innerHeight });
    addEventListener('resize', r);
    return () => removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    if (!mostrar) {
      setAberta(null);
      return;
    }
    if (aberta?.id === mostrar.id) return; // so mudou o titulo
    // Carrega antes de abrir, para a moldura ja surgir no tamanho certo.
    const previa = new Image();
    previa.onload = () => {
      setAberta({ id: mostrar.id, src: previa.src, w: previa.naturalWidth || 800, h: previa.naturalHeight || 600, vetor: /\.svg$/i.test(mostrar.imagem) });
      setAnimKey((k) => k + 1);
    };
    previa.src = mostrar.imagem;
  }, [mostrar, aberta?.id]);

  // Ocupa o maximo da tela sem distorcer; foto pequena cresce no maximo 2,5x (SVG cresce a vontade).
  let estilo: CSSProperties = {};
  if (aberta) {
    const espacoAlt = tela.h * 0.86 - (mostrar?.titulo ? (titulo.current?.offsetHeight ?? 60) + tela.h * 0.026 : 0);
    const s = Math.min((tela.w * 0.84) / aberta.w, espacoAlt / aberta.h, aberta.vetor ? Infinity : 2.5);
    estilo = { width: `${Math.round(aberta.w * s)}px`, height: `${Math.round(aberta.h * s)}px` };
  }

  return (
    <div className={`vitrine ${aberta && mostrar ? 'aberta' : ''}`} id="vitrine" aria-hidden="true" key={animKey}>
      <figure className="vitrine-quadro" id="vitrineQuadro">
        <div className="vitrine-moldura">
          <div className="vitrine-img"><img id="vitrineImg" alt="" src={aberta?.src} style={estilo} /></div>
          <i className="canto c1" /><i className="canto c2" /><i className="canto c3" /><i className="canto c4" />
        </div>
        <figcaption id="vitrineTitulo" ref={titulo} hidden={!mostrar?.titulo}><span>{mostrar?.titulo}</span></figcaption>
      </figure>
    </div>
  );
}

// ---------------- som ----------------

/** Lembrete discreto: o navegador so toca som depois de um clique na pagina. M liga/desliga. */
function AvisoSom() {
  const [, atualizar] = useState(0);
  useEffect(() => aoMudarSom(() => atualizar((n) => n + 1)), []);
  if (somMudo()) return <div className="aviso-som mudo">Som desligado · tecla M</div>;
  if (somBloqueado()) return <div className="aviso-som">Clique no telão para ligar o som</div>;
  return null;
}
