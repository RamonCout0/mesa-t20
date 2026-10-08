// Aba "Dados": rolagens livres e testes de pericia. O dado gira na mao e e lancado no telao
// (rolagem secreta cai no proprio celular).
import { useState } from 'react';
import { PERICIAS } from '../../shared/ficha.ts';
import { DADOS_3D, MODELO_POR_ID } from '../../shared/dados-3d.ts';
import { lerExpressao } from '../../shared/rolagem.ts';
import { postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import type { PropsAba } from './Jogo.tsx';
import { amostraDado } from './Carta.tsx';

const FACES = [4, 6, 8, 10, 12, 20];

const facesDe = (expr: string) => lerExpressao(expr).flatMap((t) => (t.faces ? Array<number>(t.qtd).fill(t.faces) : [])).slice(0, 6);

export function Dados({ ficha, codigo, avisar, agir }: PropsAba) {
  const [qtd, setQtd] = useState<Record<number, number>>({ 20: 1 });
  const [mod, setMod] = useState(0);
  const [secreta, setSecreta] = useState(false);

  const dadosEscolhidos = FACES.filter((f) => qtd[f]).map((f) => `${qtd[f]}d${f}`).join('+');
  const expressao = `${dadosEscolhidos || '1d20'}${mod ? `${mod > 0 ? '+' : ''}${mod}` : ''}`;

  const rolar = (expr: string, rotulo: string) =>
    agir({ tipo: 'rolar', expressao: expr, rotulo, secreta }, { dados: facesDe(expr), titulo: rotulo, secreta });

  const trocarModelo = async (id: string) => {
    const r = await postar('/api/jogador/ficha', { dado: id }, { 'x-codigo': codigo });
    if (!r.ok) avisar(r.erro ?? 'Não consegui trocar o dado.');
  };

  const pericias = PERICIAS.filter((p) => ficha.pericias[p]);

  return (
    <main>
      <div className="j-secao"><h3>Seu dado</h3><span className="deco" /><span className="conta">{MODELO_POR_ID[ficha.dado]?.nome}</span></div>
      <div className="modelos-dado rolagem">
        {DADOS_3D.map((m) => (
          <button key={m.id} type="button" className={`modelo-dado ${ficha.dado === m.id ? 'ativo' : ''}`} onClick={() => trocarModelo(m.id)} title={m.nome}>
            <i style={amostraDado(m)} />
          </button>
        ))}
      </div>

      <div className="j-secao"><h3>Rolar</h3><span className="deco" /></div>
      <div className="faces-dado">
        {FACES.map((f) => (
          <button key={f} type="button" className={qtd[f] ? 'ativo' : ''} onClick={() => setQtd((q) => ({ ...q, [f]: Math.min(20, (q[f] ?? 0) + 1) }))}
            onContextMenu={(e) => { e.preventDefault(); setQtd((q) => ({ ...q, [f]: Math.max(0, (q[f] ?? 0) - 1) })); }}>
            {qtd[f] ? <i>{qtd[f]}</i> : null}d{f}
          </button>
        ))}
      </div>
      <div className="linha-mod">
        <button type="button" className="j-btn pequeno" onClick={() => setMod((m) => m - 1)}>−</button>
        <span>Modificador <b>{mod >= 0 ? `+${mod}` : mod}</b></span>
        <button type="button" className="j-btn pequeno" onClick={() => setMod((m) => m + 1)}>+</button>
        <button type="button" className="j-btn pequeno" onClick={() => { setQtd({}); setMod(0); }}>Limpar</button>
      </div>
      <label className="check-j"><input type="checkbox" checked={secreta} onChange={(e) => setSecreta(e.target.checked)} />Rolagem secreta (só você e o mestre veem)</label>
      <button type="button" className="j-btn ouro largo rolar-grande" onClick={() => rolar(expressao, expressao)}>
        <Icone nome="d20" />Rolar {expressao}
      </button>

      <div className="j-secao"><h3>Testes de perícia</h3><span className="deco" /></div>
      <div className="pericias">
        {pericias.map((p) => {
          const x = ficha.pericias[p];
          return (
            <button key={p} type="button" className={`pericia ${x.treinada ? 'treinada' : ''}`}
              onClick={() => rolar(`1d20${x.total >= 0 ? '+' : ''}${x.total}`, x.rotulo ?? p)}>
              <span>{x.rotulo ?? p}</span><b>{x.total >= 0 ? `+${x.total}` : x.total}</b>
            </button>
          );
        })}
      </div>
    </main>
  );
}
