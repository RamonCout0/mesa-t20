// Magias que continuam valendo na mesa (sustentadas, de cena, por rodadas): aura no alvo,
// anel girando em quem sustenta e um selo com o nome e quanto falta. Ficam ate serem desfeitas.
import type { CSSProperties } from 'react';
import type { EfeitoAtivo } from '../../shared/acoes.ts';
import { ICONE_ELEMENTO, PALETAS } from '../fx/paletas.ts';

const MAX_SELOS = 3;

function cores(e: EfeitoAtivo): CSSProperties {
  const p = PALETAS[e.elemento ?? 'arcano'] ?? PALETAS.arcano;
  return { '--fx-cor': p.cor, '--fx-brilho': p.brilho } as CSSProperties;
}

function duracao(e: EfeitoAtivo) {
  if (e.persistente === 'rodadas') return `${e.rodadas ?? 1} rod.`;
  if (e.persistente === 'sustentada') return 'sustentada';
  return 'cena';
}

/** Efeitos sobre esta carta e os que ela esta sustentando. */
export function efeitosDe(id: string, efeitos: EfeitoAtivo[]) {
  const sobre = efeitos.filter((e) => e.alvos.includes(id) || (e.conjuradorId === id && !e.alvos.length));
  const sustenta = efeitos.filter((e) => e.conjuradorId === id && e.persistente === 'sustentada' && !sobre.includes(e));
  return { sobre, sustenta };
}

export function EfeitosAtivos({ id, efeitos, partes = 'tudo' }: { id: string; efeitos: EfeitoAtivo[]; partes?: 'tudo' | 'aura' | 'selos' }) {
  const { sobre, sustenta } = efeitosDe(id, efeitos);
  if (!sobre.length && !sustenta.length) return null;
  const todos = [...sobre, ...sustenta];
  const concentrando = sustenta[0] ?? sobre.find((e) => e.conjuradorId === id && e.persistente === 'sustentada');
  const aura = partes !== 'selos';
  const selos = partes !== 'aura';
  return (
    <>
      {aura && sobre.length ? <div className="aura-efeito" style={cores(sobre[sobre.length - 1])} aria-hidden="true"><i /><i /><i /><i /><i /></div> : null}
      {aura && concentrando ? <div className="anel-sustentado" style={cores(concentrando)} aria-hidden="true" /> : null}
      {selos ? (
        <div className="selos-efeito">
          {todos.slice(0, MAX_SELOS).map((e) => (
            <span
              key={e.id}
              className={`selo-efeito ${sobre.includes(e) ? '' : 'sustentando'}`}
              style={cores(e)}
              title={`${e.nome} — ${duracao(e)}${sobre.includes(e) ? '' : ' (mantendo)'}`}
            >
              <span className="ic">{sobre.includes(e) ? ICONE_ELEMENTO[e.elemento ?? 'arcano'] : '🔗'}</span>
              <b>{e.nome}</b>
              <i>{duracao(e)}</i>
            </span>
          ))}
          {todos.length > MAX_SELOS ? <span className="selo-efeito mais">+{todos.length - MAX_SELOS}</span> : null}
        </div>
      ) : null}
    </>
  );
}
