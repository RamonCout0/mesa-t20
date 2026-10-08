// Aba Jogadores: fichas importadas do Nimb, QR code para cada celular e importacao pelo PC.
import { useRef, useState, type CSSProperties } from 'react';
import type { Ficha } from '../../shared/ficha.ts';
import { cdMagia } from '../../shared/ficha.ts';
import type { Estado, InfoServidor } from '../comum/tipos-cliente.ts';
import { enviarArquivo, postar } from '../comum/conexao.ts';
import { Retrato } from '../comum/pecas.tsx';
import { pin, usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

const qr = (texto: string) => `/api/qr?texto=${encodeURIComponent(texto)}`;

export function Jogadores({ estado, fichas, info, visivel }: { estado: Estado; fichas: Ficha[]; info: InfoServidor; visivel: boolean }) {
  const { enviar, avisar } = usePainel();
  const [grande, setGrande] = useState<{ titulo: string; url: string; codigo?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pdf = useRef<HTMLInputElement>(null);
  const base = info.enderecos[0] ?? location.origin;
  const entrada = `${base}/jogador`;

  const acao = async (dados: Record<string, unknown>) => {
    const r = await postar('/api/mestre/ficha', dados, { 'x-pin': pin });
    if (!r.ok) avisar(r.erro ?? 'Algo deu errado.');
  };

  const importar = async (arquivos: FileList) => {
    setEnviando(true);
    for (const f of [...arquivos]) {
      const r = await enviarArquivo('/api/importar-ficha', f, { 'x-pin': pin });
      if (!r.ok) avisar(`${f.name}: ${r.erro}`);
      else avisar(`${f.name} importada.${(r.avisos as string[]).length ? ` ${(r.avisos as string[]).join(' ')}` : ''}`, 'info');
    }
    setEnviando(false);
  };

  const semFicha = estado.aliados.filter((h) => !h.fichaId);

  return (
    <section className="jogadores" hidden={!visivel}>
      <div className="convite">
        <img className="qr" src={qr(entrada)} alt="QR code para entrar pelo celular" onClick={() => setGrande({ titulo: 'Entrar pelo celular', url: entrada })} />
        <div>
          <h2>Jogadores no celular</h2>
          <p>Quem ainda não tem personagem aqui aponta a câmera para este QR, abre <b>{entrada}</b> e importa o PDF do Nimb.
            Quem já está na lista usa o QR do próprio personagem.</p>
          <div className="linha-botoes">
            <Botao classe="ouro" icone="arquivo" texto={enviando ? 'Importando…' : 'Importar PDF do Nimb'} onClick={() => pdf.current?.click()} disabled={enviando} />
            <label className="check">
              <input
                type="checkbox"
                checked={estado.opcoes.importarPeloCelular}
                onChange={(e) => enviar({ tipo: 'opcoes', opcoes: { importarPeloCelular: e.target.checked } })}
              />
              Jogadores podem importar pelo celular
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={estado.opcoes.acaoSoNaVez}
                onChange={(e) => enviar({ tipo: 'opcoes', opcoes: { acaoSoNaVez: e.target.checked } })}
              />
              Em combate, cada um só age na sua vez
            </label>
          </div>
          <input ref={pdf} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { if (e.target.files) importar(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <header className="secao-topo">
        <h2>Fichas</h2><span className="conta">{fichas.length}</span><span className="deco" />
      </header>
      {fichas.length ? (
        <div className="grade-fichas">
          {fichas.map((f) => {
            const heroi = estado.aliados.find((h) => h.fichaId === f.id);
            const url = `${base}/jogador?c=${f.codigo}`;
            const cd = cdMagia(f);
            return (
              <article key={f.id} className={`ficha-m ${heroi ? 'na-mesa' : ''}`} style={{ '--cor': f.cor } as CSSProperties}>
                <Retrato ent={{ nome: f.nome, imagem: f.imagem }} />
                <div className="ficha-info">
                  <b>{f.nome}</b>
                  <small>{[f.classe, `Nível ${f.nivel}`, f.raca].filter(Boolean).join(' · ')}</small>
                  <small>{f.jogador ? `Jogador: ${f.jogador}` : 'Jogador sem nome'}</small>
                  <div className="ficha-numeros">
                    <span>PV <b>{f.pvMax}</b></span><span>PM <b>{f.pmMax}</b></span><span>Def <b>{f.defesa}</b></span>
                    {cd ? <span>CD <b>{cd}</b></span> : null}
                    <span>{f.ataques.length} ataques · {f.magias.length} magias</span>
                  </div>
                </div>
                <button type="button" className="ficha-qr" title="Mostrar o QR grande" onClick={() => setGrande({ titulo: f.nome, url, codigo: f.codigo })}>
                  <img src={qr(url)} alt={`QR de ${f.nome}`} />
                  <span>{f.codigo}</span>
                </button>
                <div className="ficha-acoes">
                  {heroi ? <span className="tag-m vez">Na mesa</span> : <Botao classe="pequeno ouro" icone="mais" texto="Pôr na mesa" onClick={() => acao({ acao: 'naMesa', id: f.id })} />}
                  <Botao classe="pequeno fantasma" icone="reiniciar" title="Gerar código novo (o celular antigo sai)" onClick={() => { if (confirm(`Gerar um código novo para ${f.nome}? O celular que usa o código atual vai sair.`)) acao({ acao: 'novoCodigo', id: f.id }); }} />
                  <Botao classe="pequeno fantasma perigo" icone="lixo" title="Remover ficha" onClick={() => { if (confirm(`Remover a ficha de ${f.nome}? Ela vai para data/fichas/lixeira/.`)) acao({ acao: 'remover', id: f.id }); }} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="vazio-m">Nenhuma ficha ainda. Importe o PDF do Nimb aqui ou peça para os jogadores importarem pelo celular.</p>
      )}

      {semFicha.length && fichas.length ? (
        <>
          <header className="secao-topo"><h2>Heróis sem ficha</h2><span className="conta">{semFicha.length}</span><span className="deco" /></header>
          <div className="sem-ficha">
            {semFicha.map((h) => (
              <div key={h.id} className="linha-sem-ficha">
                <Retrato ent={h} />
                <b>{h.nome}</b>
                <select defaultValue="" onChange={(e) => { if (e.target.value) acao({ acao: 'vincular', id: e.target.value, heroiId: h.id }); e.target.value = ''; }}>
                  <option value="">Usar a ficha de…</option>
                  {fichas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {grande ? (
        <div className="qr-grande" onClick={() => setGrande(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h2>{grande.titulo}</h2>
            <img src={qr(grande.url)} alt="QR code" />
            {grande.codigo ? <b className="codigo-grande">{grande.codigo}</b> : null}
            <small>{grande.url}</small>
            <Botao classe="ouro" icone="fechar" texto="Fechar" onClick={() => setGrande(null)} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
