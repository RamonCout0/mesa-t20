// Modo cena (roleplay) no telao, com cara de visual novel: cenario de fundo, personagens em pe
// no palco, quem fala fica em destaque e o texto corre na caixa de dialogo.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Ator, EstadoPublico, Fala, Palco } from '../comum/tipos-cliente.ts';
import { iniciais } from '../comum/pecas.tsx';

// ---------------- imagem recortada (PNG com fundo transparente) ou retrato com moldura ----------------

const recortes = new Map<string, boolean>();

/** Imagem com os cantos transparentes vira "sprite" de corpo inteiro; o resto ganha moldura. */
function useRecortada(url: string) {
  const [recortada, setRecortada] = useState(() => recortes.get(url) ?? false);
  useEffect(() => {
    if (!url) return;
    if (recortes.has(url)) {
      setRecortada(recortes.get(url)!);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let r = false;
      try {
        const lado = 48;
        const c = document.createElement('canvas');
        c.width = lado;
        c.height = lado;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, lado, lado);
        const d = g.getImageData(0, 0, lado, lado).data;
        const alfa = (x: number, y: number) => d[(y * lado + x) * 4 + 3];
        const cantos = [alfa(1, 1), alfa(lado - 2, 1), alfa(1, lado >> 1), alfa(lado - 2, lado >> 1)];
        r = cantos.filter((a) => a < 16).length >= 3;
      } catch { /* imagem de outra origem: fica com moldura */ }
      recortes.set(url, r);
      setRecortada(r);
    };
    img.src = url;
  }, [url]);
  return recortada;
}

// ---------------- quem saiu de cena ainda anima a saida ----------------

function useComSaida(atores: Ator[], ms = 650) {
  const [saindo, setSaindo] = useState<Ator[]>([]);
  const antes = useRef(atores);
  useEffect(() => {
    const foram = antes.current.filter((a) => !atores.some((b) => b.id === a.id));
    antes.current = atores;
    if (!foram.length) return;
    setSaindo((s) => [...s, ...foram]);
    setTimeout(() => setSaindo((s) => s.filter((x) => !foram.includes(x))), ms);
  }, [atores, ms]);
  return saindo;
}

// ---------------- fundo com troca suave ----------------

function Fundo({ url }: { url: string }) {
  const [camadas, setCamadas] = useState<{ url: string; chave: number }[]>(() => (url ? [{ url, chave: 0 }] : []));
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setCamadas((c) => [...c.slice(-1), { url, chave: Date.now() }]);
  }, [url]);
  return (
    <div className="vn-fundos" aria-hidden="true">
      {camadas.map((c, i) => (
        <div
          key={c.chave}
          className={`vn-fundo ${i === camadas.length - 1 ? 'atual' : 'antigo'} ${c.url ? '' : 'vazio'}`}
          style={c.url ? { backgroundImage: `url("${c.url}")` } : undefined}
        />
      ))}
      <div className="vn-luz" />
    </div>
  );
}

// ---------------- personagem ----------------

function Personagem({ ator, estado, falando, calado, saindo, falaId }: {
  ator: Ator; estado: EstadoPublico; falando: boolean; calado: boolean; saindo?: boolean; falaId?: string;
}) {
  // Heroi/inimigo da mesa: nome e imagem atualizados ao vivo.
  const vivo = ator.refId ? [...estado.aliados, ...estado.inimigos].find((x) => x.id === ator.refId) : undefined;
  const imagem = vivo?.imagem || ator.imagem;
  const nome = vivo?.nome ?? ator.nome;
  const recortada = useRecortada(imagem);
  const classes = [
    'vn-ator', recortada ? 'recortado' : 'moldurado', falando ? 'falando' : '', calado ? 'calado' : '', saindo ? 'saindo' : '',
    ator.espelhar ? 'espelhado' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} data-ref={ator.refId ?? undefined} style={{ left: `${ator.x}%`, '--cor': ator.cor } as CSSProperties}>
      <div className="vn-corpo">
        <div className="vn-pulo" key={falando ? falaId : 'parado'}>
          <div className="vn-sprite" style={imagem ? { backgroundImage: `url("${imagem}")` } : undefined}>
            {imagem ? null : <span className="vn-iniciais">{iniciais(nome)}</span>}
          </div>
          {recortada ? null : <div className="vn-plaquinha">{nome}</div>}
        </div>
      </div>
      <div className="vn-sombra" />
    </div>
  );
}

// ---------------- caixa de dialogo ----------------

function CaixaFala({ fala }: { fala: Fala }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const passo = Math.max(1, Math.round(fala.texto.length / 260)); // falas longas correm mais rapido
    const id = setInterval(() => {
      setN((v) => {
        if (v >= fala.texto.length) {
          clearInterval(id);
          return v;
        }
        return v + passo;
      });
    }, 24);
    return () => clearInterval(id);
  }, [fala.id, fala.texto]);
  const narrador = !fala.atorId;
  const pronta = n >= fala.texto.length;
  return (
    <div className={`vn-caixa ${narrador ? 'narrador' : ''}`} key={fala.id} style={{ '--cor': fala.cor } as CSSProperties}>
      {!narrador || fala.nome ? <div className="vn-nome">{fala.nome || 'Narrador'}</div> : null}
      <p className="vn-texto">
        <span>{fala.texto.slice(0, n)}</span>
        <span className="vn-resto">{fala.texto.slice(n)}</span>
      </p>
      <i className={`vn-seta ${pronta ? 'visivel' : ''}`} aria-hidden="true">▼</i>
      <i className="vn-canto c1" /><i className="vn-canto c2" /><i className="vn-canto c3" /><i className="vn-canto c4" />
    </div>
  );
}

// ---------------- palco ----------------

export function PalcoCena({ palco, estado, ativo }: { palco: Palco; estado: EstadoPublico; ativo: boolean }) {
  const saindo = useComSaida(palco.atores);
  const falandoId = palco.fala?.atorId ?? null;
  return (
    <div className={`vn-palco ${ativo ? 'ativo' : ''}`} aria-hidden={!ativo}>
      <Fundo url={palco.fundo} />
      <div className="vn-atores" style={{ '--n': Math.max(3, palco.atores.length) } as CSSProperties}>
        {palco.atores.map((a) => (
          <Personagem
            key={a.id}
            ator={a}
            estado={estado}
            falando={falandoId === a.id}
            calado={Boolean(falandoId) && falandoId !== a.id}
            falaId={palco.fala?.id}
          />
        ))}
        {saindo.map((a) => <Personagem key={a.id} ator={a} estado={estado} falando={false} calado={false} saindo />)}
      </div>
      {palco.fala && ativo ? <CaixaFala fala={palco.fala} /> : null}
    </div>
  );
}
