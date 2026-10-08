// Lancamento no celular: o dado gira na mao, o jogador arrasta para cima (ou toca) e ele voa
// para o telao. Depois que o telao mostra a rolagem, o celular mostra o resumo.
import { useEffect, useRef, useState } from 'react';
import type { AlvoResultado, ResultadoAcao } from '../../shared/acoes.ts';
import { CONDICAO_POR_ID } from '../../shared/condicoes.ts';
import type { Resposta } from '../comum/conexao.ts';
import { BandejaDados, type ControleBandeja } from '../dados3d/BandejaDados.tsx';

const NOME_DESFECHO: Record<string, string> = {
  acerto: 'Acertou!', critico: 'CRÍTICO!', erro: 'Errou', resistiu: 'Resistiu', anulado: 'Anulou', imune: 'Imune', cura: 'Curado', efeito: 'Efeito',
};
const TESTE: Record<string, string> = { fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' };

/** Tempo que o telao leva para mostrar a rolagem e o golpe (dados + efeito). */
const TEMPO_TELAO = { comDados: 3000, semDados: 1700 };

function linhaAlvo(a: AlvoResultado) {
  return [
    a.dano !== undefined ? `${a.dano} de dano${a.reduzido ? ` (${a.reduzido} reduzidos)` : ''}` : '',
    a.cura ? `+${a.cura} PV` : '', a.temp ? `+${a.temp} PV temporários` : '',
    a.condicoes?.length ? a.condicoes.map((c) => CONDICAO_POR_ID[c]?.nome).join(', ') : '',
    a.removidas?.length ? `livre de ${a.removidas.map((c) => CONDICAO_POR_ID[c]?.nome.toLowerCase()).join(', ')}` : '',
    a.caiu ? 'caiu!' : '', a.morreu ? 'morreu!' : '',
  ].filter(Boolean).join(' · ');
}

export interface PedidoLancamento {
  acao: Record<string, unknown>;
  /** Dados que giram na mao (so a forma; o valor quem sorteia e o servidor). */
  dados: number[];
  titulo: string;
  /** Rolagem secreta: cai no proprio celular em vez do telao. */
  secreta?: boolean;
  /** O servidor aceitou a acao (a folha de tras pode fechar). */
  aceito: () => void;
  /** Fecha o lancamento (ok = a acao aconteceu). */
  fechar: (ok: boolean) => void;
}

type Fase = 'mao' | 'voando' | 'telao' | 'resumo';

export function Lancamento({ pedido, modelo, enviar, avisar }: {
  pedido: PedidoLancamento;
  modelo: string;
  enviar: (acao: Record<string, unknown>) => Promise<Resposta>;
  avisar: (t: string) => void;
}) {
  const bandeja = useRef<ControleBandeja>(null);
  const [fase, setFase] = useState<Fase>(pedido.dados.length ? 'mao' : 'voando');
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const toque = useRef<{ y: number; t: number } | null>(null);
  const lancou = useRef(false);

  // Dados na mao, girando.
  useEffect(() => {
    if (fase !== 'mao') return undefined;
    const t = setTimeout(() => bandeja.current?.segurar(pedido.dados.slice(0, 6).map((faces) => ({ faces, modelo }))), 30);
    return () => clearTimeout(t);
  }, [fase, pedido.dados, modelo]);

  const lancar = async () => {
    if (lancou.current) return;
    lancou.current = true;
    setFase('voando');
    navigator.vibrate?.(25);
    const [, r] = await Promise.all([pedido.dados.length ? bandeja.current?.arremessar() : Promise.resolve(), enviar(pedido.acao)]);
    if (!r.ok) {
      avisar(r.erro ?? 'Não deu certo.');
      pedido.fechar(false);
      return;
    }
    pedido.aceito();
    const res = r.resultado as ResultadoAcao;
    setResultado(res);
    if (pedido.secreta) {
      // Secreta: o dado cai aqui mesmo.
      setFase('telao');
      await bandeja.current?.rolar(res.rolagens.flatMap((x) => x.dados).map((d) => ({ faces: d.faces, valor: Math.abs(d.valor), modelo })), 1400);
      setFase('resumo');
      return;
    }
    setFase('telao');
    setTimeout(() => {
      setFase('resumo');
      const critico = res.alvos.some((a) => a.desfecho === 'critico');
      const acertou = res.alvos.some((a) => a.desfecho === 'acerto' || a.desfecho === 'critico');
      navigator.vibrate?.(critico ? [60, 40, 140] : acertou ? 50 : 20);
    }, pedido.dados.length ? TEMPO_TELAO.comDados : TEMPO_TELAO.semDados);
  };

  // Sem dados (magia sem rolagem do jogador): ja manda.
  useEffect(() => {
    if (!pedido.dados.length) lancar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const principal = resultado && resultado.alvos.length === 1 ? resultado.alvos[0].desfecho : resultado?.alvos.some((a) => a.desfecho === 'critico') ? 'critico' : '';

  return (
    <div
      className={`lancamento fase-${fase} ${pedido.secreta ? 'secreta' : ''} ${fase === 'resumo' ? principal : ''}`}
      onPointerDown={(e) => { if (fase === 'mao') toque.current = { y: e.clientY, t: performance.now() }; }}
      onPointerMove={(e) => {
        if (fase !== 'mao' || !toque.current) return;
        if (toque.current.y - e.clientY > 70) { toque.current = null; lancar(); }
      }}
      onPointerUp={() => { toque.current = null; }}
    >
      <div className="lancamento-cabeca">
        <small>{fase === 'mao' ? 'Seus dados' : fase === 'resumo' ? 'Resultado' : pedido.secreta ? 'Rolagem secreta' : 'No telão'}</small>
        <h2>{pedido.titulo}</h2>
      </div>

      <BandejaDados controle={bandeja} classe="lancamento-bandeja" />

      {fase === 'mao' ? (
        <div className="lancamento-mao">
          <div className="seta-lancar" aria-hidden="true"><span /><span /><span /></div>
          <p>Arraste para cima para lançar</p>
          <button type="button" className="j-btn ouro largo rolar-grande" onClick={lancar}>Lançar!</button>
          <button type="button" className="j-btn largo" onClick={() => pedido.fechar(false)}>Cancelar</button>
        </div>
      ) : null}

      {fase === 'voando' || (fase === 'telao' && !pedido.secreta) ? (
        <div className="lancamento-espera">
          <div className="olho-telao" aria-hidden="true">📺</div>
          <p>Olhe o telão!</p>
        </div>
      ) : null}

      {fase === 'resumo' && resultado ? (
        <div className="resultado-corpo">
          <div className="resultado-rolagens">
            {resultado.rolagens.filter((r) => !r.alvoId).map((r, i) => (
              <div key={i}><small>{r.rotulo}</small><b>{r.total}</b></div>
            ))}
          </div>
          {principal && resultado.alvos.length === 1 ? <div className={`selo-desfecho ${principal}`}>{resultado.alvos[0].carimbo ?? NOME_DESFECHO[principal]}</div> : null}
          <ul className="resultado-alvos">
            {resultado.alvos.map((a) => (
              <li key={a.id} className={a.desfecho}>
                <b>{a.nome}</b>
                <span className="tag-desfecho">{a.carimbo ?? NOME_DESFECHO[a.desfecho]}</span>
                {a.salvamento ? <small>{TESTE[a.salvamento.teste]}: {a.salvamento.dado}{a.salvamento.total !== null ? ` (${a.salvamento.total})` : ''} contra CD {a.salvamento.cd}</small> : null}
                {a.ataque ? <small>Ataque {a.ataque.total}{a.ataque.defesa !== null ? ` contra Defesa ${a.ataque.defesa}` : ''}</small> : null}
                <span className="linha-efeito">{linhaAlvo(a)}</span>
              </li>
            ))}
          </ul>
          {resultado.autoCura ? <p className="j-texto">Você recuperou {resultado.autoCura} PV.</p> : null}
          {resultado.nota ? <p className="nota-resultado">{resultado.nota}</p> : null}
          <button type="button" className="j-btn ouro largo" onClick={() => pedido.fechar(true)}>Continuar</button>
        </div>
      ) : null}
    </div>
  );
}
