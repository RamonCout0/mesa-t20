// Cartao de um combatente no painel do mestre (heroi ou inimigo).
import { useState, type CSSProperties } from 'react';
import { CONDICOES, REVELAR } from '../../shared/condicoes.ts';
import type { Entidade, Estado, Heroi, Inimigo, Lado } from '../comum/tipos-cliente.ts';
import { Barra, Condicoes, Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';
import { AcoesCard } from './AcoesCard.tsx';
import type { Ficha } from '../../shared/ficha.ts';

export const NOME_REVELAR: Record<string, string> = {
  oculto: '🙈 PV oculto', estado: '💬 Só o estado', barra: '▮ Só a barra', numero: '🔢 Número exato',
};

interface Props {
  ent: Entidade;
  lado: Lado;
  estado: Estado;
  selecionado: boolean;
  aberto: boolean;
  alternarSelecao: () => void;
  alternarAberto: () => void;
  editar: () => void;
  ficha?: Ficha;
}

const lerValor = (v: string) => Number.parseInt(v, 10) || 0;
const tag = (classe: string, texto: string) => <span key={classe} className={`tag-m ${classe}`}>{texto}</span>;

export function Card({ ent, lado, estado, selecionado, aberto, alternarSelecao, alternarAberto, editar, ficha }: Props) {
  const { enviar } = usePainel();
  const [valor, setValor] = useState('');
  const [ini, setIni] = useState<string | null>(null); // enquanto digita
  const heroi = lado === 'aliados';
  const h = ent as Heroi;
  const i = ent as Inimigo;
  const vez = estado.turnos.ativo && estado.turnos.atual === ent.id;
  const noBoss = !heroi && estado.cena.bossId === ent.id;

  const aplicar = (modo: string, v?: number) => enviar({ tipo: 'dano', ids: [ent.id], modo, valor: v ?? lerValor(valor) });
  const aplicarCampo = async (modo: string) => {
    if (await aplicar(modo)) setValor('');
  };
  const rapido = (n: number) => (
    <button key={n} type="button" className={`btn pequeno rapido ${n < 0 ? 'neg' : 'pos'}`} onClick={() => aplicar(n < 0 ? 'dano' : 'cura', Math.abs(n))}>
      {n > 0 ? `+${n}` : `−${-n}`}
    </button>
  );

  const sub = heroi
    ? [h.classe, h.nivel && `Nível ${h.nivel}`, h.jogador].filter(Boolean).join(' · ')
    : [i.subtitulo, i.nd, `Def ${i.defesa}`, `F${i.fort} R${i.ref} V${i.von}`].filter(Boolean).join(' · ');

  const classes = ['card', heroi ? 'heroi' : 'inimigo', selecionado ? 'selecionado' : '', ent.pv <= 0 ? 'caido' : '', vez ? 'atual' : '', noBoss ? 'no-boss' : '']
    .filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ '--cor': heroi ? h.cor : 'var(--inimigo)' } as CSSProperties}>
      <div className="card-corpo">
        <Retrato ent={ent} classe="c-retrato" title="Clique para selecionar (dano em vários de uma vez)" onClick={alternarSelecao} />
        <div className="c-titulo">
          <div className="linha-nome">
            <b className="nome">{ent.nome}</b>
            <span className="tags">
              {[
                vez ? tag('vez', 'Na vez') : null,
                noBoss ? tag('boss', 'Boss') : null,
                !heroi && !i.naTela && !noBoss ? tag('oculto', 'Oculto') : null,
                ent.pv <= 0 ? tag('caido', heroi ? 'Caído' : 'Derrotado') : null,
                heroi && h.fichaId ? tag('ficha', 'Ficha') : null,
              ]}
            </span>
          </div>
          <small className="sub">{sub}</small>
          <Condicoes ids={ent.condicoes} />
        </div>
        <div className="c-barras">
          <Barra tipo="pv" atual={ent.pv} max={ent.pvMax} temp={ent.pvTemp} />
          {ent.pmMax ? <Barra tipo="pm" atual={ent.pm} max={ent.pmMax} /> : null}
        </div>
        <label className="c-ini" title="Iniciativa">
          <span>Ini</span>
          <input
            type="number"
            className="ini"
            placeholder="–"
            value={ini ?? (ent.iniciativa ?? '')}
            onFocus={() => setIni(String(ent.iniciativa ?? ''))}
            onChange={(e) => setIni(e.target.value)}
            onBlur={() => {
              if (ini !== null && ini !== String(ent.iniciativa ?? '')) enviar({ tipo: 'iniciativa', id: ent.id, valor: ini === '' ? null : ini });
              setIni(null);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </label>
        <div className="c-acoes">
          <input
            type="number"
            min="1"
            className="valor"
            placeholder="Valor"
            title="Enter = dano · Shift+Enter = cura"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') aplicarCampo(e.shiftKey ? 'cura' : 'dano'); }}
          />
          <Botao classe="dano" icone="espada" texto="Dano" onClick={() => aplicarCampo('dano')} />
          <Botao classe="cura" icone="coracao" texto="Cura" onClick={() => aplicarCampo('cura')} />
          <Botao classe={`icone btn-mais ${aberto ? 'ativo' : ''}`} icone="reticencias" title="Mais opções: botões rápidos, PM e condições" onClick={alternarAberto} />
          <Botao classe="icone fantasma" icone="editar" title="Editar" onClick={editar} />
        </div>
        {heroi ? null : (
          <div className="c-controle">
            <select
              className="revelar"
              title="O que os jogadores veem do PV deste inimigo"
              value={i.revelar}
              onChange={(e) => enviar({ tipo: 'definir', id: ent.id, patch: { revelar: e.target.value } })}
            >
              {REVELAR.map((r) => <option key={r} value={r}>{NOME_REVELAR[r]}</option>)}
            </select>
            <button
              type="button"
              className={`btn icone btn-tela ${i.naTela ? 'on' : ''}`}
              title={i.naTela ? 'Aparece no telão — clique para esconder' : 'Escondido dos jogadores — clique para mostrar no telão'}
              onClick={() => enviar({ tipo: 'definir', id: ent.id, patch: { naTela: !i.naTela } })}
            >
              <Icone nome={i.naTela ? 'olho' : 'olhoFechado'} />
            </button>
            <button
              type="button"
              className={`btn btn-boss ${noBoss ? 'perigo' : 'ouro'}`}
              title={noBoss ? 'Tirar do centro do telão' : 'Invocar no centro do telão'}
              onClick={() => enviar(noBoss ? { tipo: 'cena', acao: 'retirar' } : { tipo: 'cena', acao: 'invocar', id: ent.id })}
            >
              <Icone nome={noBoss ? 'ejetar' : 'coroa'} />
              <span>{noBoss ? 'Retirar' : 'Invocar'}</span>
            </button>
            <AcoesCard ent={ent} lado={lado} estado={estado} />
            <div className="habs">
              {i.habilidades.map((hab, n) => (
                <button
                  key={hab.nome}
                  type="button"
                  className={`hab ${hab.ativa ? 'on' : ''}`}
                  title={hab.ativa ? 'Aparece no telão — clique para esconder' : 'Escondida — clique para mostrar no telão'}
                  onClick={() => enviar({ tipo: 'definir', id: ent.id, patch: { habilidades: i.habilidades.map((x, j) => (j === n ? { ...x, ativa: !x.ativa } : x)) } })}
                >
                  {hab.ativa ? <Icone nome="raio" /> : null}
                  {hab.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={`mais ${aberto ? 'aberto' : ''}`}>
          {heroi ? <AcoesCard ent={ent} lado={lado} estado={estado} ficha={ficha} /> : null}
          <div className="grupo-m">
            <span className="rotulo">Rápido</span>
            {[-10, -5, -1, 1, 5, 10].map(rapido)}
            <Botao classe="pequeno" icone="escudo" texto="PV temp" title="Dá PV temporários (usa o valor digitado)" onClick={() => aplicar('temp')} />
          </div>
          {ent.pmMax || heroi ? (
            <div className="grupo-m">
              <span className="rotulo">PM</span>
              <button type="button" className="btn pequeno" onClick={() => aplicar('pmGasta', 1)}>−1</button>
              <button type="button" className="btn pequeno" onClick={() => aplicar('pmGasta', 3)}>−3</button>
              <button type="button" className="btn pequeno" onClick={() => aplicar('pmRecupera', 1)}>+1</button>
              <Botao classe="pequeno" icone="gota" texto="− valor" title="Gasta o valor digitado" onClick={() => aplicar('pmGasta')} />
              <Botao classe="pequeno" icone="gota" texto="+ valor" title="Recupera o valor digitado" onClick={() => aplicar('pmRecupera')} />
            </div>
          ) : null}
          <div className="grupo-m alto">
            <span className="rotulo">Condições</span>
            <div className="cond-grid">
              {CONDICOES.map((c) => {
                const on = ent.condicoes.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={on ? 'on' : ''}
                    title={c.resumo}
                    onClick={() => enviar({ tipo: 'condicao', id: ent.id, condicao: c.id, ligado: !on })}
                  >
                    <span className="emoji">{c.icone}</span>
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </div>
          {!heroi && i.notas ? (
            <div className="notas">
              <Icone nome="cadeado" />
              <span className="texto-notas">{i.notas}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
