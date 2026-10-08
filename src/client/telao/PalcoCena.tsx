// Modo cena (roleplay) no telao, com cara de visual novel: cenario de fundo e personagens em pe
// no palco, cada um onde o mestre colocou (os do fundo menores). Quem fala fica em destaque com a
// placa do nome; a fala mesmo e na voz dos jogadores.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Ator, EstadoPublico, Palco } from '../comum/tipos-cliente.ts';
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

/** Perspectiva: quem esta no fundo do palco (y pequeno) fica menor. */
export const escalaDoPalco = (y: number) => 0.42 + 0.6 * (y / 100);

function dadosVivos(ator: Ator, estado: EstadoPublico) {
  // Heroi/inimigo da mesa: nome e imagem atualizados ao vivo; a expressao da cena tem prioridade.
  const vivo = ator.refId ? [...estado.aliados, ...estado.inimigos].find((x) => x.id === ator.refId) : undefined;
  return { imagem: ator.expressao || vivo?.imagem || ator.imagem, nome: vivo?.nome ?? ator.nome };
}

function Personagem({ ator, estado, falando, calado, saindo }: {
  ator: Ator; estado: EstadoPublico; falando: boolean; calado: boolean; saindo?: boolean;
}) {
  const { imagem, nome } = dadosVivos(ator, estado);
  const recortada = useRecortada(imagem);
  const classes = [
    'vn-ator', recortada ? 'recortado' : 'moldurado', falando ? 'falando' : '', calado ? 'calado' : '', saindo ? 'saindo' : '',
    ator.espelhar ? 'espelhado' : '',
  ].filter(Boolean).join(' ');
  const estilo = {
    left: `${ator.x}%`, top: `${ator.y}%`, zIndex: falando ? 200 : Math.round(ator.y), '--cor': ator.cor, '--escala': escalaDoPalco(ator.y),
  } as CSSProperties;
  return (
    <div className={classes} data-ref={ator.refId ?? undefined} style={estilo}>
      <div className="vn-sombra" />
      <div className="vn-corpo">
        <div className="vn-pulo" key={falando ? 'falando' : 'parado'}>
          <div className="vn-sprite" key={imagem} style={imagem ? { backgroundImage: `url("${imagem}")` } : undefined}>
            {imagem ? null : <span className="vn-iniciais">{iniciais(nome)}</span>}
          </div>
          {recortada ? null : <div className="vn-plaquinha">{nome}</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------- palco ----------------

export function PalcoCena({ palco, estado, ativo }: { palco: Palco; estado: EstadoPublico; ativo: boolean }) {
  const saindo = useComSaida(palco.atores);
  const destaque = palco.atores.find((a) => a.id === palco.destaque) ?? null;
  return (
    <div className={`vn-palco ${ativo ? 'ativo' : ''}`} aria-hidden={!ativo}>
      <Fundo url={palco.fundo} />
      <div className="vn-atores" style={{ '--n': Math.max(3, palco.atores.filter((a) => a.y >= 70).length) } as CSSProperties}>
        {palco.atores.map((a) => (
          <Personagem key={a.id} ator={a} estado={estado} falando={destaque?.id === a.id} calado={Boolean(destaque) && destaque?.id !== a.id} />
        ))}
        {saindo.map((a) => <Personagem key={a.id} ator={a} estado={estado} falando={false} calado={false} saindo />)}
      </div>
      {destaque && ativo ? (
        <div className="vn-placa" key={destaque.id} style={{ '--cor': destaque.cor } as CSSProperties}>
          <b>{dadosVivos(destaque, estado).nome}</b>
          <i className="vn-canto c1" /><i className="vn-canto c4" />
        </div>
      ) : null}
    </div>
  );
}
