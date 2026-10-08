// Mensagens secretas do mestre no celular: chegam como carta lacrada, o jogador abre, ve o texto
// e a imagem, e pode responder em segredo. Ninguem mais na mesa ve.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Segredo } from '../comum/tipos-cliente.ts';
import { postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import type { Avisar } from './Aviso.tsx';

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function urlImagem(s: Segredo, codigo: string) {
  if (!s.imagem) return '';
  return s.imagem.startsWith('segredo:') ? `/api/segredo/${s.id}/imagem?codigo=${encodeURIComponent(codigo)}` : s.imagem;
}

interface Props {
  codigo: string;
  fichaId: string;
  lista: Segredo[];
  avisar: Avisar;
}

/** Botao do envelope (no topo) e as janelas das mensagens. */
export function Segredos({ codigo, fichaId, lista, avisar }: Props) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [caixa, setCaixa] = useState(false);
  const naoLidas = lista.filter((s) => !s.lidas[fichaId]);
  const conhecidas = useRef<Set<string> | null>(null);

  // Chegou mensagem nova: vibra e ja mostra a carta lacrada.
  useEffect(() => {
    const ids = new Set(lista.map((s) => s.id));
    const antes = conhecidas.current;
    conhecidas.current = ids;
    if (!antes) {
      if (naoLidas.length) setAberta(naoLidas[naoLidas.length - 1].id);
      return;
    }
    const nova = lista.filter((s) => !antes.has(s.id) && !s.lidas[fichaId]).pop();
    if (nova) {
      navigator.vibrate?.([80, 60, 80, 60, 160]);
      setAberta(nova.id);
    }
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  const atual = lista.find((s) => s.id === aberta) ?? null;

  return (
    <>
      <button type="button" className={`j-envelope ${naoLidas.length ? 'nova' : ''}`} aria-label="Mensagens secretas" onClick={() => setCaixa(true)}>
        <Icone nome="carta" />
        {naoLidas.length ? <i>{naoLidas.length}</i> : null}
      </button>

      {caixa ? createPortal(
        <div className="j-folha-fundo" onClick={() => setCaixa(false)}>
          <div className="j-caixa-segredos" onClick={(e) => e.stopPropagation()}>
            <header><Icone nome="carta" /><b>Mensagens secretas</b><button type="button" className="fechar" onClick={() => setCaixa(false)} aria-label="Fechar"><Icone nome="fechar" /></button></header>
            {lista.length ? (
              <ol>
                {[...lista].reverse().map((s) => (
                  <li key={s.id} className={s.lidas[fichaId] ? '' : 'nova'}>
                    <button type="button" onClick={() => { setCaixa(false); setAberta(s.id); }}>
                      <span className="selo-mini">{s.lidas[fichaId] ? '✉' : '●'}</span>
                      <span className="resumo">{s.lidas[fichaId] ? (s.texto || 'Imagem') : 'Carta lacrada — toque para abrir'}</span>
                      <time>{hora(s.criadoEm)}</time>
                      {s.revelado ? <em>revelada</em> : null}
                    </button>
                  </li>
                ))}
              </ol>
            ) : <p className="j-vazio">Nenhuma mensagem do mestre ainda.</p>}
          </div>
        </div>,
        document.body,
      ) : null}

      {/* Fora do topo: o desfoque do cabecalho prenderia a janela dentro dele. */}
      {atual ? createPortal(<Carta s={atual} codigo={codigo} fichaId={fichaId} avisar={avisar} fechar={() => setAberta(null)} />, document.body) : null}
    </>
  );
}

function Carta({ s, codigo, fichaId, avisar, fechar }: { s: Segredo; codigo: string; fichaId: string; avisar: Avisar; fechar: () => void }) {
  const lida = Boolean(s.lidas[fichaId]);
  const [aberta, setAberta] = useState(lida);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [zoom, setZoom] = useState(false);
  const img = urlImagem(s, codigo);

  const abrir = async () => {
    setAberta(true);
    navigator.vibrate?.(40);
    await postar('/api/jogador/segredo', { acao: 'ler', id: s.id }, { 'x-codigo': codigo });
  };
  const responder = async () => {
    if (!resposta.trim()) return;
    setEnviando(true);
    const r = await postar('/api/jogador/segredo', { acao: 'responder', id: s.id, texto: resposta }, { 'x-codigo': codigo });
    setEnviando(false);
    if (r.ok) { setResposta(''); avisar('Resposta enviada ao mestre.', 'info'); } else avisar(r.erro ?? 'Não deu para responder.');
  };

  return (
    <div className="j-folha-fundo escuro" onClick={fechar}>
      <div className={`carta-secreta ${aberta ? 'aberta' : 'lacrada'}`} onClick={(e) => e.stopPropagation()}>
        {!aberta ? (
          <button type="button" className="lacre" onClick={abrir}>
            <span className="selo-cera"><Icone nome="cadeado" /></span>
            <b>Mensagem secreta</b>
            <small>Só você está vendo isto. Toque para quebrar o lacre.</small>
          </button>
        ) : (
          <>
            <small className="de">Do mestre · {hora(s.criadoEm)}{s.revelado ? ' · revelada à mesa' : ''}</small>
            {img ? <img src={img} alt="" className={zoom ? 'zoom' : ''} onClick={() => setZoom((z) => !z)} /> : null}
            {s.texto ? <p>{s.texto}</p> : null}
            {s.respostas.length ? (
              <ul className="minhas-respostas">
                {s.respostas.map((r, i) => <li key={i}><b>Você:</b> {r.texto}</li>)}
              </ul>
            ) : null}
            <form className="responder" onSubmit={(e) => { e.preventDefault(); responder(); }}>
              <textarea rows={2} maxLength={600} placeholder="Responder em segredo ao mestre…" value={resposta} onChange={(e) => setResposta(e.target.value)} />
              <button type="submit" className="j-btn ouro" disabled={!resposta.trim() || enviando} aria-label="Enviar resposta"><Icone nome="enviar" /></button>
            </form>
            <button type="button" className="j-btn largo" onClick={fechar}>Guardar</button>
          </>
        )}
      </div>
    </div>
  );
}
