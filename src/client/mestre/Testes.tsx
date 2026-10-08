// Testes pedidos aos celulares: o mestre escolhe a pericia (e a CD), cada jogador rola o seu.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Estado, Heroi } from '../comum/tipos-cliente.ts';
import { PERICIAS } from '../../shared/ficha.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

const COMUNS = ['Percepção', 'Iniciativa', 'Reflexos', 'Fortitude', 'Vontade', 'Furtividade', 'Intuição', 'Investigação', 'Atletismo', 'Sobrevivência'];

/** Janela para pedir um teste. */
export function PedirTeste({ estado, aberto, fechar }: { estado: Estado; aberto: boolean; fechar: () => void }) {
  const { enviar } = usePainel();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pericia, setPericia] = useState('Percepção');
  const [cd, setCd] = useState('');
  const [secreto, setSecreto] = useState(false);
  const [quem, setQuem] = useState<Set<string>>(new Set());

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      setQuem(new Set(estado.aliados.filter((h) => h.pv > 0).map((h) => h.id)));
      d.showModal();
    }
    if (!aberto && d.open) d.close();
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const pedir = async () => {
    const ok = await enviar({ tipo: 'pedirTeste', pericia, cd: pericia === 'Iniciativa' ? null : cd === '' ? null : Number(cd), secreto, alvos: [...quem] });
    if (ok) fechar();
  };
  const alternar = (id: string) => setQuem((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <dialog className="dialogo-teste" ref={dialogo} onClose={fechar}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); pedir(); }}>
        <h3><Icone nome="d20" />Pedir teste aos jogadores</h3>
        <div className="chips-pericia">
          {COMUNS.map((p) => (
            <button key={p} type="button" className={`chip-acao ${pericia === p ? 'on' : ''}`} onClick={() => setPericia(p)}>{p}</button>
          ))}
        </div>
        <div className="grade">
          <label>Perícia
            <select value={pericia} onChange={(e) => setPericia(e.target.value)}>
              {PERICIAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>CD (opcional)
            <input type="number" min={1} max={99} value={pericia === 'Iniciativa' ? '' : cd} disabled={pericia === 'Iniciativa'} placeholder="sem CD" onChange={(e) => setCd(e.target.value)} />
          </label>
        </div>
        <span className="rotulo-quem">Quem rola</span>
        <div className="chips-entrar">
          {estado.aliados.map((h) => (
            <button key={h.id} type="button" className={`chip-entrar ${quem.has(h.id) ? 'on' : ''}`} style={{ '--cor': (h as Heroi).cor } as CSSProperties} onClick={() => alternar(h.id)}>
              <Retrato ent={h} />{h.nome}{h.fichaId ? null : <span className="sem-celular" title="Sem celular: você rola por ele na faixa de testes"><Icone nome="tela" /></span>}
            </button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={secreto} onChange={(e) => setSecreto(e.target.checked)} />Secreto (o telão não mostra; só você vê o resultado)</label>
        {pericia === 'Iniciativa' ? <p className="dica-cena">O resultado já entra como iniciativa de cada herói.</p> : null}
        <div className="rodape">
          <Botao classe="fantasma" texto="Cancelar" onClick={fechar} />
          <button type="submit" className="btn ouro" disabled={!quem.size}><Icone nome="d20" /><span>Pedir</span></button>
        </div>
      </form>
    </dialog>
  );
}

/** Faixa com os testes em aberto: quem ja rolou (e quanto) e quem falta. */
export function FaixaTestes({ estado }: { estado: Estado }) {
  const { enviar } = usePainel();
  if (!estado.pedidos.length) return null;
  return (
    <div className="faixa testes-m">
      <span className="faixa-rotulo">Testes</span>
      {estado.pedidos.map((p) => (
        <div key={p.id} className="teste-m">
          <b>{p.pericia}{p.cd !== null ? <small> CD {p.cd}</small> : null}{p.secreto ? <small> 🔒</small> : null}</b>
          {p.alvos.map((id) => {
            const h = estado.aliados.find((x) => x.id === id);
            if (!h) return null;
            const r = p.respostas[id];
            return r ? (
              <span key={id} className={`resp-teste ${r.passou === true ? 'passou' : r.passou === false ? 'falhou' : ''}`} style={{ '--cor': h.cor } as CSSProperties} title={h.nome}>
                <Retrato ent={h} /><strong>{r.total}</strong>
              </span>
            ) : (
              <button key={id} type="button" className="resp-teste esperando" style={{ '--cor': h.cor } as CSSProperties} title={`${h.nome} ainda não rolou — clique para rolar por ele`} onClick={() => enviar({ tipo: 'responderTeste', autorId: id, pedidoId: p.id })}>
                <Retrato ent={h} /><Icone nome="d20" />
              </button>
            );
          })}
          <button type="button" className="fechar-teste" title="Encerrar este teste" onClick={() => enviar({ tipo: 'fecharTeste', id: p.id })}><Icone nome="fechar" /></button>
        </div>
      ))}
    </div>
  );
}
