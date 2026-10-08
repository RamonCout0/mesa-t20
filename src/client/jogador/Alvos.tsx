// Escolha de alvos no celular: inimigos visiveis no telao e/ou herois da mesa.
import type { CSSProperties } from 'react';
import type { EstadoPublico } from '../comum/tipos-cliente.ts';
import { BarraInimigo, Barra, Retrato } from '../comum/pecas.tsx';

export type QuemPode = 'inimigos' | 'aliados' | 'todos';

interface Props {
  estado: EstadoPublico | null;
  quem: QuemPode;
  max: number; // 0 = sem limite
  escolhidos: string[];
  mudar: (ids: string[]) => void;
  /** Heroi do proprio jogador (aparece como "Você"). */
  eu?: string | null;
  semEu?: boolean;
}

export function SeletorAlvos({ estado, quem, max, escolhidos, mudar, eu, semEu }: Props) {
  if (!estado) return null;
  const inimigos = quem === 'aliados' ? [] : estado.inimigos.filter((i) => !i.caido);
  const herois = quem === 'inimigos' ? [] : estado.aliados.filter((h) => !(semEu && h.id === eu));
  const alternar = (id: string) => {
    if (escolhidos.includes(id)) return mudar(escolhidos.filter((x) => x !== id));
    if (max === 1) return mudar([id]);
    if (max && escolhidos.length >= max) return mudar([...escolhidos.slice(1), id]);
    mudar([...escolhidos, id]);
  };
  const todos = [...inimigos.map((i) => i.id), ...herois.map((h) => h.id)];

  return (
    <div className="alvos">
      <div className="alvos-topo">
        <span>{max === 1 ? 'Escolha o alvo' : max ? `Escolha até ${max} alvos` : 'Escolha os alvos'}</span>
        {max !== 1 && todos.length > 1 ? (
          <button type="button" onClick={() => mudar(escolhidos.length ? [] : max ? todos.slice(0, max) : todos)}>
            {escolhidos.length ? 'Limpar' : 'Todos'}
          </button>
        ) : null}
      </div>
      <div className="alvos-grade">
        {inimigos.map((i) => (
          <button key={i.id} type="button" className={`alvo inimigo ${escolhidos.includes(i.id) ? 'on' : ''}`} onClick={() => alternar(i.id)}>
            <Retrato ent={i} />
            <b>{i.nome}</b>
            <BarraInimigo ini={i} />
          </button>
        ))}
        {herois.map((h) => (
          <button key={h.id} type="button" className={`alvo heroi ${escolhidos.includes(h.id) ? 'on' : ''}`} style={{ '--cor': h.cor } as CSSProperties} onClick={() => alternar(h.id)}>
            <Retrato ent={h} />
            <b>{h.id === eu ? 'Você' : h.nome}</b>
            <Barra tipo="pv" atual={h.pv} max={h.pvMax} />
          </button>
        ))}
        {!inimigos.length && !herois.length ? <p className="j-texto">Nenhum alvo disponível no momento.</p> : null}
      </div>
    </div>
  );
}
