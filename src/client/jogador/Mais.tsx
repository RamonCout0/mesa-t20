// Aba "Mais": pericias, poderes, equipamento, anotacoes, atualizar a ficha e sair.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorFicha } from '../comum/EditorFicha.tsx';
import { baixarJson, nomeArquivo } from '../comum/arquivo.ts';
import { PERICIAS } from '../../shared/ficha.ts';
import { NOME_ATRIBUTO, ATRIBUTOS, type Atributo } from '../../shared/tipos.ts';
import { enviarArquivo, postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import type { PropsAba } from './Jogo.tsx';

export function Mais({ ficha, codigo, avisar, sair, estado }: PropsAba & { sair: () => void }) {
  const pdf = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);
  const fichaLivre = estado?.opcoes.fichaLivre ?? true;
  const pericias = PERICIAS.filter((p) => ficha.pericias[p]);

  const salvar = async (patch: Record<string, unknown>) => {
    const r = await postar('/api/jogador/ficha', patch, { 'x-codigo': codigo });
    if (!r.ok) avisar(r.erro ?? 'Não consegui salvar.');
  };

  const atualizar = async (f: File) => {
    setEnviando(true);
    const r = await enviarArquivo(`/api/importar-ficha?substituir=${ficha.id}`, f, { 'x-codigo': codigo });
    setEnviando(false);
    if (!r.ok) return avisar(r.erro ?? 'Não consegui atualizar.');
    const mud = (r.mudancas as string[] | undefined) ?? [];
    avisar(mud.length ? `Ficha atualizada: ${mud.join(' · ')}` : 'Ficha atualizada (nada mudou).', 'info');
  };

  return (
    <main>
      <button type="button" className="j-btn ouro largo editar-ficha" onClick={() => setEditando(true)}>
        <Icone nome="editar" />{fichaLivre ? 'Editar ficha (itens, magias, poderes…)' : 'Anotações da ficha'}
      </button>
      {editando ? createPortal(
        <EditorFicha
          ficha={ficha}
          completo={fichaLivre}
          cabecalhos={{ 'x-codigo': codigo }}
          fechar={() => setEditando(false)}
          salvar={async (patch) => {
            const r = await postar('/api/jogador/ficha', patch, { 'x-codigo': codigo });
            if (!r.ok) avisar(r.erro ?? 'Não consegui salvar.');
            else avisar('Ficha salva.', 'info');
            return r.ok;
          }}
        />,
        document.body,
      ) : null}

      <div className="j-secao"><h3>Perícias</h3><span className="deco" /></div>
      <div className="pericias">
        {pericias.map((p) => {
          const x = ficha.pericias[p];
          return (
            <div key={p} className={`pericia ${x.treinada ? 'treinada' : ''}`}>
              <span>{x.rotulo ?? p}</span><b>{x.total >= 0 ? `+${x.total}` : x.total}</b>
            </div>
          );
        })}
      </div>

      {ficha.poderes.length ? (
        <>
          <div className="j-secao"><h3>Poderes</h3><span className="conta">{ficha.poderes.length}</span><span className="deco" /></div>
          <div className="j-lista">
            {ficha.poderes.map((p) => <div key={p.nome} className="poder"><b>{p.nome}</b><p className="j-texto">{p.texto}</p></div>)}
          </div>
        </>
      ) : null}

      {ficha.itens?.length ? (
        <>
          <div className="j-secao"><h3>Itens mágicos</h3><span className="conta">{ficha.itens.length}</span><span className="deco" /></div>
          <div className="j-lista">
            {ficha.itens.map((p, i) => <div key={i} className="poder"><b>{p.nome}</b><p className="j-texto">{p.texto}</p></div>)}
          </div>
        </>
      ) : null}

      {ficha.equipamento ? (
        <>
          <div className="j-secao"><h3>Equipamento</h3><span className="deco" /></div>
          <div className="poder"><p className="j-texto">{ficha.equipamento}</p></div>
        </>
      ) : null}

      <div className="j-secao"><h3>Magia</h3><span className="deco" /></div>
      <label className="j-rotulo" htmlFor="chave">Atributo-chave (CD das magias)</label>
      <select
        id="chave"
        className="j-campo"
        value={ficha.atributoChave ?? ''}
        onChange={(e) => salvar({ atributoChave: e.target.value || null })}
      >
        <option value="">Não lança magias</option>
        {ATRIBUTOS.map((a: Atributo) => <option key={a} value={a}>{NOME_ATRIBUTO[a]}</option>)}
      </select>
      <label className="j-rotulo" htmlFor="bonusCd">Bônus extra na CD (poderes, itens)</label>
      <input id="bonusCd" className="j-campo" type="number" defaultValue={ficha.bonusCd} onBlur={(e) => salvar({ bonusCd: Number(e.target.value) || 0 })} />

      <div className="j-secao"><h3>Anotações</h3><span className="deco" /></div>
      <textarea
        className="j-campo"
        defaultValue={ficha.notas}
        placeholder="Coisas para lembrar durante a sessão"
        onBlur={(e) => { if (e.target.value !== ficha.notas) salvar({ notas: e.target.value }); }}
      />

      <div className="j-secao"><h3>Ficha</h3><span className="deco" /></div>
      <div className="j-lista">
        <button type="button" className="j-btn largo" disabled={enviando} onClick={() => pdf.current?.click()}>
          <Icone nome="arquivo" />{enviando ? 'Lendo…' : 'Atualizar ficha (novo PDF do Nimb)'}
        </button>
        <button type="button" className="j-btn largo" onClick={() => {
          const { codigo: _c, ...semCodigo } = ficha;
          baixarJson(`${nomeArquivo(ficha.nome)}.json`, { app: 'mesa-t20', ficha: semCodigo });
        }}>
          <Icone nome="enviar" />Baixar minha ficha (arquivo)
        </button>
        <input ref={pdf} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) atualizar(f); e.target.value = ''; }} />
        <button type="button" className="j-btn perigo largo" onClick={() => { if (confirm('Sair deste personagem neste celular? Para voltar você vai precisar do código.')) sair(); }}>
          <Icone nome="sair" />Sair do personagem
        </button>
        <p className="j-texto" style={{ textAlign: 'center', fontSize: 12.5 }}>Código deste personagem: <b style={{ letterSpacing: '0.2em', color: 'var(--ouro)' }}>{codigo}</b></p>
      </div>
    </main>
  );
}
