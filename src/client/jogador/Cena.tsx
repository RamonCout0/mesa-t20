// Aba Cena (modo roleplay): o que esta sendo dito no telao e uma caixa para o heroi falar.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import { Retrato } from '../comum/pecas.tsx';
import type { PropsAba } from './Jogo.tsx';

export function Cena({ estado, heroi, codigo, avisar }: PropsAba) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const lista = useRef<HTMLOListElement>(null);
  const palco = estado?.cena.palco;
  const falas = palco?.falas.slice(-25) ?? [];

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' });
  }, [falas.length]);

  if (!estado || !palco) return null;
  const pode = estado.opcoes.falasPeloCelular && Boolean(heroi);
  const emCena = heroi ? palco.atores.some((a) => a.refId === heroi.id) : false;

  const falar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    const r = await postar('/api/jogador/acao', { tipo: 'falar', texto: t }, { 'x-codigo': codigo });
    setEnviando(false);
    if (r.ok) {
      setTexto('');
      navigator.vibrate?.(30);
    } else avisar(r.erro ?? 'Não deu para falar agora.');
  };

  return (
    <main className="j-cena">
      <div className="cena-vista" style={palco.fundo ? { backgroundImage: `url("${palco.fundo}")` } : undefined}>
        <div className="cena-atores">
          {palco.atores.map((a) => (
            <span key={a.id} className={`cena-ator ${palco.fala?.atorId === a.id ? 'falando' : ''}`} style={{ left: `${a.x}%`, '--cor': a.cor } as CSSProperties}>
              <Retrato ent={a} />
            </span>
          ))}
        </div>
        {palco.fala ? (
          <div className={`cena-fala ${palco.fala.atorId ? '' : 'narracao'}`} style={{ '--cor': palco.fala.cor } as CSSProperties}>
            {palco.fala.atorId || palco.fala.nome ? <b>{palco.fala.nome || 'Narrador'}</b> : null}
            <p>{palco.fala.texto}</p>
          </div>
        ) : null}
      </div>

      {falas.length ? (
        <ol className="cena-log" ref={lista}>
          {falas.map((f) => {
            const minha = heroi && palco.atores.find((a) => a.id === f.atorId)?.refId === heroi.id;
            return (
              <li key={f.id} className={`${minha ? 'minha' : ''} ${f.atorId ? '' : 'narracao'}`} style={{ '--cor': f.cor } as CSSProperties}>
                {f.atorId || f.nome ? <b>{f.nome || 'Narrador'}</b> : null}
                <span>{f.texto}</span>
              </li>
            );
          })}
        </ol>
      ) : <p className="j-vazio">Quando o mestre ou alguém falar, aparece aqui.</p>}

      {pode ? (
        <form className="cena-falar" onSubmit={(e) => { e.preventDefault(); falar(); }}>
          <textarea
            value={texto}
            maxLength={600}
            rows={2}
            placeholder={emCena ? `O que ${heroi!.nome} diz?` : `Fale e ${heroi!.nome} entra em cena`}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); falar(); } }}
          />
          <button type="submit" className="j-btn ouro" disabled={!texto.trim() || enviando} aria-label="Falar">
            <Icone nome="balao" />
          </button>
        </form>
      ) : (
        <p className="j-vazio">{heroi ? 'O mestre desligou as falas pelo celular.' : 'Você ainda não está na mesa.'}</p>
      )}
    </main>
  );
}
