// Registro das acoes resolvidas pelo motor (ataques, magias, rolagens), com o detalhe
// de cada dado e teste, para o mestre conferir e desfazer.
import type { CSSProperties } from 'react';
import type { AlvoResultado, ResultadoAcao } from '../../shared/acoes.ts';
import { CONDICAO_POR_ID } from '../../shared/condicoes.ts';
import { Icone } from '../comum/Icone.tsx';
import { Botao } from './Botao.tsx';
import { usePainel } from './contexto.ts';

const DESFECHO: Record<string, string> = {
  acerto: 'acertou', critico: 'crítico', erro: 'errou', resistiu: 'resistiu', anulado: 'anulou', imune: 'imune', cura: 'cura', efeito: 'efeito',
};
const TESTE: Record<string, string> = { fort: 'Fort', ref: 'Ref', von: 'Von' };

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Alvo({ a }: { a: AlvoResultado }) {
  const extras: string[] = [];
  if (a.ataque) extras.push(`${a.ataque.total} vs Def ${a.ataque.defesa ?? '?'}`);
  if (a.salvamento) extras.push(`${TESTE[a.salvamento.teste]} ${a.salvamento.total ?? a.salvamento.dado} vs CD ${a.salvamento.cd}`);
  if (a.reduzido) extras.push(`RD −${a.reduzido}`);
  return (
    <li className={`reg-alvo ${a.desfecho}`}>
      <b>{a.nome}</b>
      <span className="reg-desfecho">{DESFECHO[a.desfecho]}</span>
      {a.dano ? <span className="reg-dano">−{a.dano}</span> : null}
      {a.cura ? <span className="reg-cura">+{a.cura}</span> : null}
      {a.temp ? <span className="reg-cura">+{a.temp} temp</span> : null}
      {a.condicoes?.map((c) => <span key={c} className="reg-cond">{CONDICAO_POR_ID[c.split(':')[0]]?.icone} {CONDICAO_POR_ID[c.split(':')[0]]?.nome ?? c}</span>)}
      {a.caiu ? <span className="reg-cond">caiu</span> : null}
      {a.morreu ? <span className="reg-cond">morreu</span> : null}
      {extras.length ? <small>{extras.join(' · ')}</small> : null}
    </li>
  );
}

interface Props {
  aberto: boolean;
  fechar: () => void;
  registro: ResultadoAcao[];
}

export function Registro({ aberto, fechar, registro }: Props) {
  const { enviar } = usePainel();
  return (
    <aside className={`registro ${aberto ? 'aberto' : ''}`} aria-hidden={!aberto}>
      <header>
        <Icone nome="log" />
        <h3>Registro</h3>
        <span className="deco" />
        <Botao classe="pequeno" icone="desfazer" texto="Desfazer última" title="Volta a mesa para antes da última mudança (Ctrl+Z)" onClick={() => enviar({ tipo: 'desfazer' })} />
        <Botao classe="icone pequeno fantasma" icone="fechar" title="Fechar" onClick={fechar} />
      </header>
      {registro.length ? (
        <ol>
          {registro.map((r) => (
            <li key={r.id} className={`reg ${r.desfeita ? 'desfeita' : ''}`} style={{ '--cor': r.autor.cor } as CSSProperties}>
              <div className="reg-topo">
                <i className="reg-cor" />
                <b>{r.autor.nome}</b>
                <span>{r.titulo}</span>
                {r.secreta ? <em title="Rolagem secreta">🔒</em> : null}
                {r.desfeita ? <em>desfeita</em> : null}
                <time>{hora(r.criadoEm)}</time>
              </div>
              {r.rolagens.length ? (
                <div className="reg-rolagens">
                  {r.rolagens.map((x, i) => (
                    <span key={i} title={x.expressao}>
                      {x.rotulo ? <i>{x.rotulo}</i> : null}
                      {x.dados.map((d, j) => <b key={j} className={d.faces === 20 && d.valor === 20 ? 'max' : d.faces === 20 && d.valor === 1 ? 'min' : ''}>{d.valor}</b>)}
                      {x.bonus ? <small>{x.bonus > 0 ? `+${x.bonus}` : x.bonus}</small> : null}
                      = <strong>{x.total}</strong>
                    </span>
                  ))}
                </div>
              ) : null}
              {r.alvos.length ? <ul className="reg-alvos">{r.alvos.map((a) => <Alvo key={a.id} a={a} />)}</ul> : null}
              {r.pmGasto ? <small className="reg-nota">{r.pmGasto} PM gastos</small> : null}
              {r.nota ? <small className="reg-nota">{r.nota}</small> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="vazio-reg">As ações resolvidas pelo celular ou pelos cards aparecem aqui, com cada dado e teste.</p>
      )}
    </aside>
  );
}
