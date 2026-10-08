// Aba "Acoes": ataques com arma. Escolhe a arma, o alvo e os extras; o servidor rola e resolve.
import { useState } from 'react';
import type { Ataque } from '../../shared/tipos.ts';
import { poderUsavel, type Poder } from '../../shared/ficha.ts';
import { CONDICAO_POR_ID } from '../../shared/condicoes.ts';
import { NOME_DANO } from '../../shared/tipos.ts';
import { expressaoValida } from '../../shared/rolagem.ts';
import { Icone } from '../comum/Icone.tsx';
import type { PropsAba } from './Jogo.tsx';
import { Folha } from './Folha.tsx';
import { SeletorAlvos, type QuemPode } from './Alvos.tsx';
import { dadosDaExpressao } from './Grimorio.tsx';

export const ICONE_ARMA: Record<string, string> = {
  corte: '⚔️', perfuracao: '🗡️', impacto: '🔨', flecha: '🏹', virote: '🎯', tiro: '🔫', arremesso: '🪃', natural: '👊',
};

export const descreverAtaque = (a: Ataque) =>
  [`${a.bonus >= 0 ? '+' : ''}${a.bonus}`, a.dano + (a.tipoDano ? ` ${NOME_DANO[a.tipoDano]}` : ''),
    `${a.margem < 20 ? `${a.margem}/` : ''}x${a.mult}`, a.distancia ? a.alcance : a.arremessavel ? 'corpo a corpo ou arremesso' : 'corpo a corpo']
    .join(' · ');

export function Acoes(props: PropsAba) {
  const { ficha } = props;
  const [arma, setArma] = useState<Ataque | null>(null);
  const [usando, setUsando] = useState<{ lista: 'poderes' | 'itens'; indice: number } | null>(null);
  const usaveis = (lista: 'poderes' | 'itens') => (ficha[lista] ?? []).map((p, indice) => ({ p, indice, lista })).filter(({ p }) => poderUsavel(p));
  const poderes = [...usaveis('poderes'), ...usaveis('itens')];
  return (
    <main>
      {props.bloqueio ? <p className="aviso-bloqueio">{props.bloqueio}</p> : null}
      <div className="j-secao"><h3>Ataques</h3><span className="conta">{ficha.ataques.length}</span><span className="deco" /></div>
      {ficha.ataques.length ? (
        <div className="j-lista">
          {ficha.ataques.map((a) => (
            <button key={a.id} type="button" className="j-item" onClick={() => setArma(a)}>
              <span className="icone-item">{ICONE_ARMA[a.arquetipo] ?? '⚔️'}</span>
              <span style={{ minWidth: 0 }}><b>{a.nome}</b><small>{descreverAtaque(a)}</small></span>
              <span className="valor-item">{a.bonus >= 0 ? '+' : ''}{a.bonus}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="j-vazio"><b>Nenhuma arma na ficha</b>Adicione em Mais → Editar ficha → Ataques (ou atualize o PDF do Nimb).</div>
      )}
      {poderes.length ? (
        <>
          <div className="j-secao"><h3>Poderes e itens</h3><span className="conta">{poderes.length}</span><span className="deco" /></div>
          <div className="j-lista">
            {poderes.map(({ p, indice, lista }) => (
              <button key={`${lista}${indice}`} type="button" className={`j-item ${(p.pm ?? 0) > (props.heroi?.pm ?? 0) ? 'sem-pm' : ''}`} onClick={() => setUsando({ lista, indice })}>
                <span className="icone-item">{lista === 'itens' ? '🎒' : '⚡'}</span>
                <span style={{ minWidth: 0 }}><b>{p.nome}</b><small>{resumoPoder(p)}</small></span>
                <span className="custo">{p.pm ? `${p.pm} PM` : 'usar'}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {arma ? <FolhaAtaque {...props} arma={arma} fechar={() => setArma(null)} /> : null}
      {usando ? <FolhaPoder {...props} {...usando} fechar={() => setUsando(null)} /> : null}
    </main>
  );
}

function FolhaAtaque({ arma, fechar, estado, heroi, agir, bloqueio }: PropsAba & { arma: Ataque; fechar: () => void }) {
  const [alvos, setAlvos] = useState<string[]>([]);
  const [bonus, setBonus] = useState(0);
  const [extra, setExtra] = useState('');
  const [arremessar, setArremessar] = useState(false);
  const [aliados, setAliados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const extraValido = !extra.trim() || expressaoValida(extra);

  const atacar = async () => {
    setEnviando(true);
    const ok = await agir(
      { tipo: 'atacar', ataqueId: arma.id, alvoId: alvos[0], extras: { bonus, danoExtra: extra.trim() || undefined, arremessar } },
      { dados: [20], titulo: arma.nome },
    );
    setEnviando(false);
    if (ok) fechar();
  };

  return (
    <Folha fechar={fechar}>
      <h2>{ICONE_ARMA[arma.arquetipo]} {arma.nome}</h2>
      <div className="meta">
        <span className="destaque">Ataque {arma.bonus >= 0 ? '+' : ''}{arma.bonus}</span>
        <span>Dano {arma.dano}{arma.tipoDano ? ` ${NOME_DANO[arma.tipoDano]}` : ''}</span>
        <span>Crítico {arma.margem < 20 ? `${arma.margem}/` : ''}x{arma.mult}</span>
        <span>{arma.distancia ? `Alcance ${arma.alcance}` : 'Corpo a corpo'}</span>
      </div>

      <SeletorAlvos estado={estado} quem={aliados ? 'todos' : 'inimigos'} max={1} escolhidos={alvos} mudar={setAlvos} eu={heroi?.id} semEu />
      <label className="check-j"><input type="checkbox" checked={aliados} onChange={(e) => setAliados(e.target.checked)} />Mostrar aliados também</label>

      <span className="j-rotulo">Bônus da situação</span>
      <div className="chips-bonus">
        {[[-5, 'Caído/difícil'], [-2, '−2'], [2, 'Flanqueando +2'], [5, '+5']].map(([v, t]) => (
          <button key={String(v)} type="button" className={bonus === v ? 'ativo' : ''} onClick={() => setBonus(bonus === v ? 0 : Number(v))}>{t}</button>
        ))}
        <span className="valor-bonus">{bonus >= 0 ? `+${bonus}` : bonus}</span>
      </div>
      <span className="j-rotulo">Dano extra (não multiplica no crítico)</span>
      <input className={`j-campo ${extraValido ? '' : 'invalido'}`} placeholder="Ex.: 2d6 (Ataque Furtivo)" value={extra} onChange={(e) => setExtra(e.target.value)} />
      {arma.arremessavel ? (
        <label className="check-j"><input type="checkbox" checked={arremessar} onChange={(e) => setArremessar(e.target.checked)} />Arremessar a arma</label>
      ) : null}

      <div className="acoes-folha">
        {bloqueio ? <p className="aviso-bloqueio">{bloqueio}</p> : null}
        <button type="button" className="j-btn ouro largo rolar-grande" disabled={!alvos.length || enviando || !extraValido || Boolean(bloqueio && !heroi)} onClick={atacar}>
          <Icone nome="espada" />{enviando ? 'Atacando…' : alvos.length ? 'Atacar!' : 'Escolha o alvo'}
        </button>
      </div>
    </Folha>
  );
}

/** Uma linha sobre o que o poder faz: bonus, dano, cura, condicao. */
function resumoPoder(p: Poder) {
  const b = p.bonus;
  const e = p.efeito;
  return [
    b?.ataque ? `${b.ataque > 0 ? '+' : ''}${b.ataque} ataque` : '', b?.dano ? `${b.dano > 0 ? '+' : ''}${b.dano} dano` : '',
    b?.defesa ? `${b.defesa > 0 ? '+' : ''}${b.defesa} Defesa` : '',
    e?.dano ? `${e.dano}${e.tipoDano ? ` ${NOME_DANO[e.tipoDano]}` : ''}` : '', e?.cura ? `cura ${e.cura}` : '',
    e?.falhou?.length ? CONDICAO_POR_ID[e.falhou[0].split(':')[0]]?.nome.toLowerCase() ?? '' : '',
  ].filter(Boolean).join(' · ') || p.texto.slice(0, 60);
}

const QUEM_DO_ALVO: Record<string, QuemPode> = { inimigo: 'inimigos', inimigos: 'inimigos', aliado: 'aliados', aliados: 'aliados', qualquer: 'todos' };

function FolhaPoder({ lista, indice, fechar, ficha, estado, heroi, agir, bloqueio }: PropsAba & { lista: 'poderes' | 'itens'; indice: number; fechar: () => void }) {
  const p = ficha[lista][indice];
  const [alvos, setAlvos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  if (!p) return null;
  const e = p.efeito;
  const precisaAlvo = Boolean(e && !['si', 'nenhum'].includes(e.alvo));
  const max = e?.maxAlvos ?? 1;
  const semPm = (p.pm ?? 0) > (heroi?.pm ?? 0);

  const usar = async () => {
    setEnviando(true);
    const ok = await agir({ tipo: 'poder', lista, indice, alvos }, { dados: dadosDaExpressao(e?.dano, e?.cura), titulo: p.nome });
    setEnviando(false);
    if (ok) fechar();
  };

  return (
    <Folha fechar={fechar}>
      <h2>{lista === 'itens' ? '🎒' : '⚡'} {p.nome}</h2>
      <div className="meta">
        {p.pm ? <span className="destaque">{p.pm} PM</span> : null}
        {resumoPoder(p) !== p.texto.slice(0, 60) ? <span>{resumoPoder(p)}</span> : null}
        {e?.persistente || p.bonus ? <span>Fica ativo {e?.persistente === 'sustentada' ? '(sustentado)' : 'na cena'}</span> : null}
      </div>
      {p.texto ? <p className="j-texto">{p.texto}</p> : null}
      {precisaAlvo ? (
        <SeletorAlvos estado={estado} quem={QUEM_DO_ALVO[e!.alvo] ?? 'todos'} max={max} escolhidos={alvos} mudar={setAlvos} eu={heroi?.id} />
      ) : null}
      <div className="acoes-folha">
        {semPm ? <p className="aviso-bloqueio">PM insuficientes.</p> : bloqueio ? <p className="aviso-bloqueio">{bloqueio}</p> : null}
        <button type="button" className="j-btn ouro largo rolar-grande" disabled={enviando || semPm || (precisaAlvo && !alvos.length) || Boolean(bloqueio && !heroi)} onClick={usar}>
          <Icone nome="raio" />{enviando ? 'Usando…' : precisaAlvo && !alvos.length ? 'Escolha o alvo' : 'Usar'}
        </button>
      </div>
    </Folha>
  );
}
