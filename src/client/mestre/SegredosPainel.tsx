// Gaveta "Segredos": o mestre manda texto e/ou imagem so para um ou mais jogadores (chega no
// celular como carta lacrada), ve quem ja leu e as respostas, e pode revelar a todos no telao.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Estado, ImagemGaleria, Segredo } from '../comum/tipos-cliente.ts';
import type { Ficha } from '../../shared/ficha.ts';
import { enviarArquivo, postar } from '../comum/conexao.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { pin, usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const urlImagem = (s: Segredo) => (s.imagem.startsWith('segredo:') ? `/api/segredo/${s.id}/imagem` : s.imagem);

interface Props {
  aberto: boolean;
  fechar: () => void;
  estado: Estado;
  fichas: Ficha[];
  segredos: Segredo[];
  imagens: ImagemGaleria[];
}

export function SegredosPainel({ aberto, fechar, estado, fichas, segredos, imagens }: Props) {
  const { avisar } = usePainel();
  const [para, setPara] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState(''); // url da galeria ou "segredo:arquivo"
  const [previa, setPrevia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  // Quem tem celular: as fichas; a cor vem do heroi na mesa.
  const jogadores = fichas.map((f) => ({ f, heroi: estado.aliados.find((h) => h.fichaId === f.id) }));

  const pedir = async (corpo: Record<string, unknown>) => {
    const r = await postar('/api/mestre/segredo', corpo, { 'x-pin': pin });
    if (!r.ok) avisar(r.erro ?? 'Algo deu errado.');
    return r.ok;
  };

  const anexar = async (f: File) => {
    if (!f.type.startsWith('image/')) return avisar('Escolha uma imagem.');
    const r = await enviarArquivo('/api/mestre/segredo/imagem', f, { 'x-pin': pin });
    if (!r.ok) return avisar(r.erro ?? 'Não consegui enviar a imagem.');
    setImagem(String(r.imagem));
    setPrevia(URL.createObjectURL(f));
  };

  // Colar imagem (Ctrl+V) com a gaveta aberta anexa ao segredo, nao a galeria.
  useEffect(() => {
    if (!aberto) return undefined;
    const colar = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (!f) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      anexar(f);
    };
    addEventListener('paste', colar, true);
    return () => removeEventListener('paste', colar, true);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const mandar = async () => {
    setEnviando(true);
    const ok = await pedir({ acao: 'enviar', para: [...para], texto, imagem });
    setEnviando(false);
    if (ok) {
      setTexto('');
      setImagem('');
      setPrevia('');
      avisar('Mensagem secreta enviada.', 'info');
    }
  };

  const alternar = (id: string) => setPara((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nomeDa = (fichaId: string) => fichas.find((f) => f.id === fichaId)?.nome ?? '?';
  const revelada = estado.cena.revelacao?.id;

  return (
    <aside className={`gaveta segredos-m ${aberto ? 'aberto' : ''}`} aria-hidden={!aberto}>
      <header>
        <Icone nome="carta" />
        <h3>Segredos</h3>
        <span className="deco" />
        <Botao classe="icone pequeno fantasma" icone="fechar" title="Fechar" onClick={fechar} />
      </header>

      <div className="compor-segredo">
        <span className="rotulo-quem">Para</span>
        {jogadores.length ? (
          <div className="chips-entrar">
            {jogadores.map(({ f, heroi }) => (
              <button key={f.id} type="button" className={`chip-entrar ${para.has(f.id) ? 'on' : ''}`} style={{ '--cor': heroi?.cor ?? f.cor ?? 'var(--ouro)' } as CSSProperties} onClick={() => alternar(f.id)}>
                <Retrato ent={{ nome: f.nome, imagem: f.imagem || heroi?.imagem }} />{f.nome}
              </button>
            ))}
          </div>
        ) : <p className="dica-cena">Só jogadores com ficha (celular) recebem segredos.</p>}
        <textarea value={texto} maxLength={2000} placeholder="O que só ele(s) vai(ão) saber… (ex.: “Você reconhece o símbolo no anel do taverneiro.”)" onChange={(e) => setTexto(e.target.value)} />
        <div className="anexo">
          {previa || imagem ? (
            <div className="previa-anexo">
              <img src={previa || imagem} alt="" />
              <Botao classe="icone pequeno fantasma" icone="fechar" title="Tirar a imagem" onClick={() => { setImagem(''); setPrevia(''); }} />
            </div>
          ) : (
            <>
              <Botao classe="pequeno" icone="enviar" texto="Anexar foto" title="Ou cole com Ctrl+V. A foto fica só com quem recebe." onClick={() => arquivo.current?.click()} />
              <select value="" onChange={(e) => { setImagem(e.target.value); setPrevia(''); }}>
                <option value="">ou uma da galeria…</option>
                {imagens.map((i) => <option key={i.url} value={i.url}>{i.nome}</option>)}
              </select>
            </>
          )}
          <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) anexar(f); e.target.value = ''; }} />
        </div>
        <Botao classe="ouro" icone="carta" texto={enviando ? 'Enviando…' : `Enviar em segredo${para.size ? ` (${para.size})` : ''}`} disabled={enviando || !para.size || (!texto.trim() && !imagem)} onClick={mandar} />
      </div>

      {segredos.length ? (
        <ol className="lista-segredos">
          {[...segredos].reverse().map((s) => (
            <li key={s.id} className={revelada === s.id ? 'no-telao' : ''}>
              <div className="seg-topo">
                <span>Para {s.para.map(nomeDa).join(', ')}</span>
                <time>{hora(s.criadoEm)}</time>
              </div>
              <div className="seg-corpo">
                {s.imagem ? <img src={urlImagem(s)} alt="" /> : null}
                {s.texto ? <p>{s.texto}</p> : null}
              </div>
              <div className="seg-lidas">
                {s.para.map((f) => <span key={f} className={s.lidas[f] ? 'lida' : ''} title={s.lidas[f] ? `Leu às ${hora(s.lidas[f])}` : 'Ainda não abriu'}>{s.lidas[f] ? '✓' : '…'} {nomeDa(f)}</span>)}
              </div>
              {s.respostas.length ? (
                <ul className="seg-respostas">
                  {s.respostas.map((r, i) => <li key={i}><b>{r.nome}:</b> {r.texto} <time>{hora(r.em)}</time></li>)}
                </ul>
              ) : null}
              <div className="seg-botoes">
                {revelada === s.id
                  ? <Botao classe="pequeno ativo" icone="olho" texto="Esconder do telão" onClick={() => pedir({ acao: 'esconder' })} />
                  : <Botao classe="pequeno" icone="olho" texto="Revelar no telão" title="Mostra a mensagem para todos" onClick={() => pedir({ acao: 'revelar', id: s.id })} />}
                <span className="deco" />
                <Botao classe="icone pequeno fantasma" icone="lixo" title="Apagar (some também do celular)" onClick={() => { if (confirm('Apagar esta mensagem?')) pedir({ acao: 'apagar', id: s.id }); }} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </aside>
  );
}
