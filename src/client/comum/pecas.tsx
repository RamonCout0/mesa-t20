// Pecas visuais compartilhadas pelas telas (telao, mestre, jogador).
import type { CSSProperties } from 'react';
import { CONDICAO_POR_ID } from '../../shared/condicoes.ts';
import type { InimigoPublico, Revelar } from './tipos-cliente.ts';

export const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Retrato: imagem se houver, senao um brasao com as iniciais. */
interface PropsRetrato {
  ent: { imagem?: string; nome: string };
  classe?: string;
  style?: CSSProperties;
  title?: string;
  onClick?: () => void;
}

export function Retrato({ ent, classe = '', style, title, onClick }: PropsRetrato) {
  const fundo = ent.imagem ? { backgroundImage: `url("${ent.imagem}")` } : {};
  return (
    <div className={`retrato ${classe}`.trim()} style={{ ...fundo, ...style }} title={title} onClick={onClick}>
      {ent.imagem ? null : iniciais(ent.nome || '?')}
    </div>
  );
}

interface PropsBarra {
  tipo: 'pv' | 'pm';
  atual: number;
  max: number;
  temp?: number;
  texto?: string;
  revelar?: Revelar;
  classe?: string;
}

/** A faixa "rastro" desce mais devagar que o enchimento (CSS), mostrando o dano recebido. */
export function Barra({ tipo, atual, max, temp = 0, texto, revelar, classe = '' }: PropsBarra) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0;
  const tempPct = max > 0 ? Math.min(100, (temp / max) * 100) : 0;
  const classes = [
    'barra', tipo, classe,
    pct <= 50 && pct > 25 ? 'baixo' : '',
    pct <= 25 ? 'critico' : '',
    atual <= 0 ? 'zerado' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} data-revelar={revelar}>
      <div className="rastro" style={{ width: `${pct}%` }} />
      <div className="enchimento" style={{ width: `${pct}%` }} />
      <div className="temp" style={{ width: `${tempPct}%` }} />
      <span className="valor">{texto ?? `${atual}/${max}${temp ? ` +${temp}` : ''}`}</span>
    </div>
  );
}

/** Barra de um inimigo, respeitando o quanto o mestre deixou revelar. */
export function BarraInimigo({ ini, classe }: { ini: InimigoPublico; classe?: string }) {
  if (ini.revelar === 'numero') {
    return <Barra tipo="pv" classe={classe} atual={ini.pv ?? 0} max={ini.pvMax ?? 1} temp={ini.pvTemp ?? 0} revelar="numero" />;
  }
  if (ini.revelar === 'barra') {
    return <Barra tipo="pv" classe={classe} atual={(ini.pct ?? 0) * 100} max={100} texto="" revelar="barra" />;
  }
  if (ini.revelar === 'estado') {
    return <Barra tipo="pv" classe={classe} atual={0} max={100} texto={ini.rotulo ?? ''} revelar="estado" />;
  }
  return <Barra tipo="pv" classe={classe} atual={0} max={100} texto={ini.caido ? 'Derrotado' : '???'} revelar="oculto" />;
}

export function Condicoes({ ids, classe = 'conds' }: { ids: string[]; classe?: string }) {
  return (
    <div className={classe}>
      {ids.map((id) => {
        const c = CONDICAO_POR_ID[id];
        return c ? <span key={id} className="cond" title={`${c.nome}: ${c.resumo}`}>{c.icone}</span> : null;
      })}
    </div>
  );
}
