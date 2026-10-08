// Aba "Acoes": ataques com arma. Escolhe a arma, o alvo e os extras; o servidor rola e resolve.
import { useState } from 'react';
import type { Ataque } from '../../shared/tipos.ts';
import { NOME_DANO } from '../../shared/tipos.ts';
import { expressaoValida } from '../../shared/rolagem.ts';
import { Icone } from '../comum/Icone.tsx';
import type { PropsAba } from './Jogo.tsx';
import { Folha } from './Folha.tsx';
import { SeletorAlvos } from './Alvos.tsx';

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
        <div className="j-vazio"><b>Nenhuma arma na ficha</b>Equipe uma arma no Nimb e atualize a ficha na aba Mais.</div>
      )}
      {arma ? <FolhaAtaque {...props} arma={arma} fechar={() => setArma(null)} /> : null}
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
