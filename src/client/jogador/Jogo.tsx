// Tela principal do jogador: topo com PV/PM e cinco abas (carta, acoes, magias, dados, mais).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ResultadoAcao } from '../../shared/acoes.ts';
import type { Ficha } from '../../shared/ficha.ts';
import type { EstadoPublico, Heroi } from '../comum/tipos-cliente.ts';
import { useMesa } from '../comum/conexao.ts';
import { Barra, Condicoes, Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import type { Avisar } from './Aviso.tsx';
import { Carta } from './Carta.tsx';
import { Acoes } from './Acoes.tsx';
import { Grimorio } from './Grimorio.tsx';
import { Mais } from './Mais.tsx';
import { Dados } from './Dados.tsx';
import { Segredos } from './Segredos.tsx';
import type { Segredo } from '../comum/tipos-cliente.ts';
import { Lancamento, type PedidoLancamento } from './Resultado.tsx';
import { postar } from '../comum/conexao.ts';

export type Aba = 'carta' | 'acoes' | 'magias' | 'dados' | 'mais';

const ABAS: [Aba, string, string][] = [
  ['carta', 'cartas', 'Carta'],
  ['acoes', 'espada', 'Ações'],
  ['magias', 'varinha', 'Magias'],
  ['dados', 'd20', 'Dados'],
  ['mais', 'reticencias', 'Mais'],
];

export interface PropsAba {
  ficha: Ficha;
  heroi: Heroi | null;
  estado: EstadoPublico | null;
  codigo: string;
  avisar: Avisar;
  /**
   * Manda uma acao (atacar, magia, usar, rolar). Se houver dados, eles giram na mao do jogador
   * ate ele lancar para o telao. Resolve `true` quando o servidor aceita.
   */
  agir: (acao: Record<string, unknown>, opcoes?: { dados?: number[]; titulo?: string; secreta?: boolean }) => Promise<boolean>;
  /** Posso agir agora? (vez na iniciativa, consciente...) Devolve o motivo se nao. */
  bloqueio: string | null;
}

function abaGuardada(): Aba {
  try {
    const a = sessionStorage.getItem('mesa-aba-jogador') as Aba | null;
    return a && ABAS.some(([x]) => x === a) ? a : 'carta';
  } catch {
    return 'carta';
  }
}

export function Jogo({ codigo, inicial, sair, avisar }: { codigo: string; inicial: Ficha; sair: () => void; avisar: Avisar }) {
  const [ficha, setFicha] = useState(inicial);
  const [aba, setAba] = useState<Aba>(abaGuardada);
  const meuId = useRef<string | null>(null);
  const [segredos, setSegredos] = useState<Segredo[]>([]);
  const { estado, online } = useMesa<EstadoPublico>('jogador', {
    codigo,
    ouvintes: {
      ficha: (d) => { const r = d as { ficha: Ficha } | null; if (r?.ficha) setFicha(r.ficha); },
      segredos: (d) => setSegredos(d as Segredo[]),
      // O telao mostrou a acao: o lancamento aberto mostra o resumo.
      apresentado: (d) => dispatchEvent(new CustomEvent('mesa-apresentado', { detail: (d as { id: string }).id })),
      // Levou um golpe: o celular treme (mais forte no critico).
      acao: (d) => {
        const meu = (d as ResultadoAcao).alvos.find((a) => a.id === meuId.current);
        if (meu?.dano) navigator.vibrate?.(meu.desfecho === 'critico' ? [90, 50, 90, 50, 220] : [70, 40, 120]);
      },
    },
  });

  useEffect(() => {
    try { sessionStorage.setItem('mesa-aba-jogador', aba); } catch { /* sem armazenamento */ }
    window.scrollTo({ top: 0 });
  }, [aba]);

  const [lancamento, setLancamento] = useState<PedidoLancamento | null>(null);
  const heroi = estado?.aliados.find((h) => h.fichaId === ficha.id) ?? null;
  meuId.current = heroi?.id ?? null;
  const naVez = Boolean(estado?.turnos.ativo && heroi && estado.turnos.atual === heroi.id);

  // Chegou a vez: o celular vibra.
  useEffect(() => {
    if (naVez) navigator.vibrate?.([140, 80, 140]);
  }, [naVez]);


  const enviar = (acao: Record<string, unknown>) => postar('/api/jogador/acao', acao, { 'x-codigo': codigo });
  const agir: PropsAba['agir'] = async (acao, opcoes = {}) => {
    // Acoes sem rolagem nem animacao (encerrar efeito) vao direto.
    if (acao.tipo === 'encerrarEfeito') {
      const r = await enviar(acao);
      if (!r.ok) avisar(r.erro ?? 'Não deu certo.');
      return r.ok;
    }
    return new Promise<boolean>((resolve) => {
      let pronto = false;
      const responder = (ok: boolean) => { if (!pronto) { pronto = true; resolve(ok); } };
      setLancamento({
        acao, dados: opcoes.dados ?? [], titulo: opcoes.titulo ?? '', secreta: opcoes.secreta,
        aceito: () => responder(true),
        fechar: (ok) => { responder(ok); setLancamento(null); },
      });
    });
  };
  const bloqueio = !heroi ? 'Você ainda não está na mesa.'
    : heroi.pv <= 0 ? 'Você está caído.'
      : estado?.turnos.ativo && estado.opcoes.acaoSoNaVez && !naVez ? 'Não é a sua vez.' : null;
  const props: PropsAba = { ficha, heroi, estado, codigo, avisar, agir, bloqueio };

  // Testes que o mestre pediu e este heroi ainda nao rolou.
  const pedidos = heroi ? (estado?.pedidos ?? []).filter((p) => p.alvos.includes(heroi.id) && !p.respostas[heroi.id]) : [];
  const temPedido = pedidos.length > 0;
  useEffect(() => {
    if (temPedido) navigator.vibrate?.([60, 60, 60]);
  }, [temPedido]);

  return (
    <>
      <header className="j-topo" style={{ '--cor': ficha.cor } as CSSProperties}>
        <Retrato ent={{ nome: ficha.nome, imagem: ficha.imagem || heroi?.imagem }} />
        <div style={{ minWidth: 0 }}>
          <div className="nome">{ficha.nome}</div>
          <div className="sub">{[ficha.classe, `Nível ${ficha.nivel}`, ficha.raca].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="j-topo-dir">
          <span className={`j-status ${online ? 'on' : ''}`}><i />{online ? 'Ao vivo' : 'Sem sinal'}</span>
          <Segredos codigo={codigo} fichaId={ficha.id} lista={segredos} avisar={avisar} />
        </div>
        <div className="barras">
          <Barra tipo="pv" atual={heroi?.pv ?? ficha.pvMax} max={heroi?.pvMax ?? ficha.pvMax} temp={heroi?.pvTemp ?? 0} />
          {ficha.pmMax ? <Barra tipo="pm" atual={heroi?.pm ?? ficha.pmMax} max={heroi?.pmMax ?? ficha.pmMax} /> : null}
        </div>
        {heroi?.condicoes.length ? <Condicoes ids={heroi.condicoes} /> : null}
        {naVez ? <div className="j-vez"><Icone nome="raio" />Sua vez!</div> : null}
        {!heroi ? <div className="j-vez" style={{ animation: 'none', letterSpacing: '0.06em', textTransform: 'none' }}>Você ainda não está na mesa. Peça ao mestre para colocar.</div> : null}
      </header>

      {pedidos.map((p) => {
        const bonus = ficha.pericias[p.pericia]?.total ?? (p.pericia === 'Iniciativa' ? heroi?.bonusIni ?? 0 : 0);
        return (
          <div key={p.id} className="pedido-teste">
            <span className="pedido-ic"><Icone nome="d20" /></span>
            <div>
              <small>O mestre pede um teste{p.secreto ? ' secreto' : ''}</small>
              <b>{p.pericia}{p.cd !== null ? <i> · CD {p.cd}</i> : null}</b>
            </div>
            <button
              type="button"
              className="j-btn ouro"
              onClick={() => agir({ tipo: 'responderTeste', pedidoId: p.id }, { dados: [20], titulo: p.pericia, secreta: p.secreto })}
            >
              Rolar {bonus >= 0 ? `+${bonus}` : bonus}
            </button>
          </div>
        );
      })}
      {aba === 'carta' ? <Carta {...props} /> : null}
      {aba === 'acoes' ? <Acoes {...props} /> : null}
      {aba === 'magias' ? <Grimorio {...props} /> : null}
      {aba === 'dados' ? <Dados {...props} /> : null}
      {aba === 'mais' ? <Mais {...props} sair={sair} /> : null}

      {lancamento ? <Lancamento pedido={lancamento} modelo={ficha.dado} enviar={enviar} avisar={avisar} /> : null}

      <nav className="j-nav">
        {ABAS.map(([id, icone, nome]) => (
          <button key={id} type="button" className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
            <Icone nome={icone} />{nome}
          </button>
        ))}
      </nav>
    </>
  );
}
