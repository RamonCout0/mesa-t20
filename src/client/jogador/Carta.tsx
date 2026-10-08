// Aba "Carta": o personagem em formato de carta, mais foto, cor e modelo de dado.
import { useState, type CSSProperties } from 'react';
import { cdMagia } from '../../shared/ficha.ts';
import { DADOS_3D, type ModeloDado } from '../../shared/dados-3d.ts';
import { ATRIBUTOS } from '../../shared/tipos.ts';
import { enviarArquivo, postar } from '../comum/conexao.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { Recortador } from '../comum/Recortador.tsx';
import type { PropsAba } from './Jogo.tsx';

const SIGLA: Record<string, string> = { for: 'For', des: 'Des', con: 'Con', int: 'Int', sab: 'Sab', car: 'Car' };
const CORES = ['#e9c46a', '#d9534f', '#ff8c42', '#f2c94c', '#4caf6e', '#3ec9c0', '#4c8dff', '#9b6bff', '#e879f9', '#c8c2d6'];

/** Amostra plana de um modelo de dado (o 3D aparece na aba Dados). */
export function amostraDado(m: ModeloDado): CSSProperties {
  const fundos: Record<string, string> = {
    arcoiris: 'conic-gradient(from 30deg, #ff5b5b, #ffd24a, #5bff8a, #4ad3ff, #8a5bff, #ff5bd8, #ff5b5b)',
    estrelas: `radial-gradient(circle at 30% 30%, ${m.detalhe} 0 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 1.5px), linear-gradient(160deg, ${m.base}, #000)`,
    brasa: `radial-gradient(circle at 50% 60%, ${m.detalhe}, ${m.base} 70%)`,
    cristal: `linear-gradient(135deg, ${m.detalhe}, ${m.base} 45%, color-mix(in srgb, ${m.base} 60%, #000))`,
    madeira: `repeating-linear-gradient(80deg, ${m.base} 0 4px, ${m.detalhe} 4px 6px)`,
    veios: `linear-gradient(150deg, transparent 40%, ${m.detalhe} 45%, transparent 50%), linear-gradient(160deg, ${m.base}, color-mix(in srgb, ${m.base} 70%, #000))`,
    nevoa: `radial-gradient(circle at 35% 35%, ${m.detalhe}, ${m.base} 65%)`,
  };
  return { background: fundos[m.padrao] ?? `linear-gradient(160deg, ${m.detalhe}, ${m.base})` };
}

export function Carta({ ficha, heroi, codigo, avisar }: PropsAba) {
  const [recortando, setRecortando] = useState(false);
  const cd = cdMagia(ficha);

  const salvar = async (patch: Record<string, unknown>) => {
    const r = await postar('/api/jogador/ficha', patch, { 'x-codigo': codigo });
    if (!r.ok) avisar(r.erro ?? 'Não consegui salvar.');
  };

  const trocarFoto = async (f: Blob) => {
    const r = await enviarArquivo('/api/jogador/foto', f, { 'x-codigo': codigo });
    if (!r.ok) avisar(r.erro ?? 'Não consegui enviar a foto.');
    else avisar('Foto atualizada no telão.', 'info');
    return r.ok;
  };

  return (
    <main>
      <article className="carta-tcg" style={{ '--cor': ficha.cor } as CSSProperties}>
        <div className="cabeca">
          <b>{ficha.raca || 'Aventureiro'}</b>
          <span className="nivel">Nv {ficha.nivel}</span>
        </div>
        <div className="arte">
          <Retrato ent={{ nome: ficha.nome, imagem: ficha.imagem || heroi?.imagem }} />
          <button type="button" className="trocar" onClick={() => setRecortando(true)}>
            <Icone nome="imagem" />{ficha.imagem ? 'Ajustar foto' : 'Pôr foto'}
          </button>
        </div>
        <div className="placa">
          <h2>{ficha.nome}</h2>
          <small>{[ficha.classe, ficha.origem, ficha.divindade && `Devoto de ${ficha.divindade}`].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="gemas">
          <div className="gema"><small>Defesa</small><b>{ficha.defesa}</b></div>
          <div className="gema pv"><small>PV</small><b>{ficha.pvMax}</b></div>
          <div className="gema pm"><small>PM</small><b>{ficha.pmMax}</b></div>
          <div className="gema"><small>{cd ? 'CD' : 'Desl.'}</small><b>{cd ?? `${ficha.deslocamento}m`}</b></div>
        </div>
      </article>
      {recortando ? (
        <Recortador
          titulo={ficha.nome}
          atual={ficha.imagem || heroi?.imagem}
          cabecalhos={{ 'x-codigo': codigo }}
          fechar={() => setRecortando(false)}
          concluir={trocarFoto}
        />
      ) : null}

      <div className="atributos">
        {ATRIBUTOS.map((a) => (
          <div key={a} className="atributo"><small>{SIGLA[a]}</small><b>{ficha.atributos[a] >= 0 ? `+${ficha.atributos[a]}` : ficha.atributos[a]}</b></div>
        ))}
      </div>

      <span className="j-rotulo">Cor do personagem</span>
      <div className="cores">
        {CORES.map((c) => (
          <button key={c} type="button" aria-label={`Cor ${c}`} className={ficha.cor === c ? 'ativo' : ''} style={{ background: c }} onClick={() => salvar({ cor: c })} />
        ))}
      </div>

      <span className="j-rotulo">Seu dado</span>
      <div className="modelos-dado">
        {DADOS_3D.map((m) => (
          <button key={m.id} type="button" className={`modelo-dado ${ficha.dado === m.id ? 'ativo' : ''}`} onClick={() => salvar({ dado: m.id })}>
            <i style={amostraDado(m)} />{m.nome}
          </button>
        ))}
      </div>

      <span className="j-rotulo">Nome do jogador</span>
      <input
        className="j-campo"
        defaultValue={ficha.jogador}
        placeholder="Quem joga com este personagem"
        maxLength={30}
        onBlur={(e) => { if (e.target.value !== ficha.jogador) salvar({ jogador: e.target.value }); }}
      />
    </main>
  );
}
