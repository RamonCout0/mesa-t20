// Recorte da foto do personagem: arrastar, zoom e girar antes de enviar.
// A foto sai sempre do mesmo tamanho (3:4), entao fica igual na carta, no telao e nos icones.
import { useCallback, useEffect, useRef, useState, type PointerEvent as PE } from 'react';
import { Icone } from './Icone.tsx';

const SAIDA_L = 600;
const SAIDA_A = 800;
const ZOOM_MAX = 5;

type Fonte = HTMLCanvasElement;
interface Enquadre { zoom: number; x: number; y: number } // x, y: deslocamento em fracao do quadro

async function carregar(blob: Blob): Promise<Fonte> {
  let img: CanvasImageSource & { width: number; height: number };
  try {
    img = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      img = await new Promise<HTMLImageElement>((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error('Não consegui abrir essa imagem.'));
        i.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // Fotos enormes de celular deixam o arrastar lento: guarda no maximo 2400px no lado maior.
  const escala = Math.min(1, 2400 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function girar(f: Fonte): Fonte {
  const c = document.createElement('canvas');
  c.width = f.height;
  c.height = f.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(f, 0, 0);
  return c;
}

/** Tamanho desenhado e limites do deslocamento para a foto sempre cobrir o quadro. */
function medidas(f: Fonte, l: number, a: number, zoom: number) {
  const s = Math.max(l / f.width, a / f.height) * zoom;
  const dl = f.width * s;
  const da = f.height * s;
  return { dl, da, mx: (dl - l) / 2 / l, my: (da - a) / 2 / a };
}

function prender(f: Fonte, e: Enquadre): Enquadre {
  const zoom = Math.min(ZOOM_MAX, Math.max(1, e.zoom));
  const { mx, my } = medidas(f, 1, SAIDA_A / SAIDA_L, zoom);
  return { zoom, x: Math.min(mx, Math.max(-mx, e.x)), y: Math.min(my, Math.max(-my, e.y)) };
}

function desenhar(ctx: CanvasRenderingContext2D, f: Fonte, l: number, a: number, e: Enquadre) {
  const { dl, da } = medidas(f, l, a, e.zoom);
  ctx.fillStyle = '#120c1b';
  ctx.fillRect(0, 0, l, a);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(f, (l - dl) / 2 + e.x * l, (a - da) / 2 + e.y * a, dl, da);
}

function exportar(f: Fonte, e: Enquadre): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = SAIDA_L;
  c.height = SAIDA_A;
  desenhar(c.getContext('2d')!, f, SAIDA_L, SAIDA_A, e);
  return new Promise((ok, falha) => {
    c.toBlob((webp) => {
      if (webp?.type === 'image/webp') return ok(webp);
      c.toBlob((jpg) => (jpg ? ok(jpg) : falha(new Error('Não consegui gerar a foto.'))), 'image/jpeg', 0.9);
    }, 'image/webp', 0.9);
  });
}

interface Props {
  titulo: string;
  /** Foto atual, para reajustar o recorte sem escolher de novo. */
  atual?: string;
  /** Cabecalhos de acesso para buscar foto por link (codigo do jogador ou PIN). */
  cabecalhos?: Record<string, string>;
  fechar: () => void;
  concluir: (foto: Blob) => Promise<boolean>;
}

export function Recortador({ titulo, atual, cabecalhos = {}, fechar, concluir }: Props) {
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [enq, setEnq] = useState<Enquadre>({ zoom: 1, x: 0, y: 0 });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [link, setLink] = useState('');
  const tela = useRef<HTMLCanvasElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ dist: number; zoom: number } | null>(null);

  const abrir = useCallback(async (blob: Blob, msg = 'Abrindo…') => {
    setErro('');
    setOcupado(msg);
    try {
      setFonte(await carregar(blob));
      setEnq({ zoom: 1, x: 0, y: 0 });
    } catch {
      setErro('Não consegui abrir essa imagem. Tente PNG, JPG ou WEBP.');
    } finally {
      setOcupado('');
    }
  }, []);

  const doLink = async (texto: string) => {
    const endereco = texto.trim();
    if (!endereco) return;
    setErro('');
    setOcupado('Buscando a imagem…');
    try {
      const resp = await fetch(`/api/imagem-link?url=${encodeURIComponent(endereco)}`, { headers: cabecalhos });
      if (!resp.ok) {
        const r = await resp.json().catch(() => ({})) as { erro?: string };
        throw new Error(r.erro ?? 'Não consegui buscar essa imagem.');
      }
      await abrir(await resp.blob());
      setLink('');
    } catch (e) {
      setErro((e as Error).message);
      setOcupado('');
    }
  };

  // Comeca pela foto atual (se for uma foto, nao o desenho padrao).
  useEffect(() => {
    if (!atual || /\.svg$/i.test(atual)) return;
    fetch(atual).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) abrir(b, 'Carregando a foto atual…'); }).catch(() => {});
  }, [atual, abrir]);

  // Colar (Ctrl+V) e arrastar arquivo ou link: so para o recortador enquanto ele esta aberto.
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      const texto = e.clipboardData?.getData('text/plain') ?? '';
      if (!img && !/^https?:\/\//i.test(texto.trim())) return;
      if (!img && (e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (img) abrir(img); else doLink(texto);
    };
    const sobre = (e: DragEvent) => { e.preventDefault(); e.stopImmediatePropagation(); };
    const soltar = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const img = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (img) return abrir(img);
      const uri = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
      if (/^https?:\/\//i.test(uri.trim())) doLink(uri.split('\n')[0]);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    addEventListener('paste', colar, true);
    addEventListener('dragenter', sobre, true);
    addEventListener('dragover', sobre, true);
    addEventListener('dragleave', sobre, true);
    addEventListener('drop', soltar, true);
    addEventListener('keydown', tecla);
    return () => {
      removeEventListener('paste', colar, true);
      removeEventListener('dragenter', sobre, true);
      removeEventListener('dragover', sobre, true);
      removeEventListener('dragleave', sobre, true);
      removeEventListener('drop', soltar, true);
      removeEventListener('keydown', tecla);
    };
  });

  // Previa: redesenha a cada mudanca, na resolucao da tela.
  useEffect(() => {
    const c = tela.current;
    if (!c || !fonte) return;
    const r = c.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    desenhar(c.getContext('2d')!, fonte, c.width, c.height, enq);
  }, [fonte, enq]);

  const mudar = (e: Partial<Enquadre>) => { if (fonte) setEnq((v) => prender(fonte, { ...v, ...e })); };

  const zoomEm = (zoom: number) => {
    // Zoom mantendo o centro do quadro no mesmo ponto da foto.
    setEnq((v) => (fonte ? prender(fonte, { zoom, x: (v.x * zoom) / v.zoom, y: (v.y * zoom) / v.zoom }) : v));
  };

  // Roda do mouse: listener proprio (o do React e passivo e deixaria a pagina rolar).
  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      setEnq((v) => (fonte ? prender(fonte, { zoom: v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), x: v.x, y: v.y }) : v));
    };
    c.addEventListener('wheel', roda, { passive: false });
    return () => c.removeEventListener('wheel', roda);
  }, [fonte]);

  const baixo = (e: PE<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      gesto.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: enq.zoom };
    }
  };
  const mover = (e: PE<HTMLCanvasElement>) => {
    const antes = toques.current.get(e.pointerId);
    if (!antes) return;
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size >= 2 && gesto.current) {
      const [a, b] = [...toques.current.values()];
      zoomEm(gesto.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / gesto.current.dist));
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    mudar({ x: enq.x + (e.clientX - antes.x) / r.width, y: enq.y + (e.clientY - antes.y) / r.height });
  };
  const cima = (e: PE<HTMLCanvasElement>) => {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) gesto.current = null;
  };

  const confirmar = async () => {
    if (!fonte) return;
    setOcupado('Enviando…');
    try {
      if (await concluir(await exportar(fonte, enq))) fechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className="rc-fundo" onClick={fechar}>
      <div className="rc-janela" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="rc-topo">
          <div><small>Foto do personagem</small><h2>{titulo}</h2></div>
          <button type="button" className="rc-x" aria-label="Fechar" onClick={fechar}><Icone nome="fechar" /></button>
        </div>

        <div className="rc-palco">
          {fonte ? (
            <div className="rc-quadro">
              <canvas
                ref={tela}
                onPointerDown={baixo}
                onPointerMove={mover}
                onPointerUp={cima}
                onPointerCancel={cima}
                onDoubleClick={() => setEnq({ zoom: 1, x: 0, y: 0 })}
              />
              <i className="rc-guia" title="Parte que aparece nos ícones redondos" />
            </div>
          ) : (
            <button type="button" className="rc-vazio" onClick={() => arquivo.current?.click()}>
              <Icone nome="imagem" />
              <b>Escolher foto</b>
              <span>ou arraste / cole (Ctrl+V) uma imagem aqui</span>
            </button>
          )}
          {ocupado ? <div className="rc-ocupado">{ocupado}</div> : null}
        </div>

        {fonte ? (
          <div className="rc-controles">
            <Icone nome="busca" />
            <input type="range" min={1} max={ZOOM_MAX} step={0.01} value={enq.zoom} aria-label="Zoom" onChange={(e) => zoomEm(Number(e.target.value))} />
            <button type="button" className="rc-btn" title="Girar 90°" onClick={() => { setFonte(girar(fonte)); setEnq({ zoom: 1, x: 0, y: 0 }); }}><Icone nome="reiniciar" /></button>
            <button type="button" className="rc-btn" title="Trocar imagem" onClick={() => arquivo.current?.click()}><Icone nome="imagem" /></button>
          </div>
        ) : null}
        <p className="rc-dica">{fonte ? 'Arraste para enquadrar, use a roda / pinça para zoom. O círculo é o que aparece nos ícones pequenos.' : 'No Fichas de Nimb: clique com o botão direito na foto → "Copiar imagem" e cole aqui, ou "Copiar endereço da imagem" e cole o link abaixo.'}</p>

        <form className="rc-link" onSubmit={(e) => { e.preventDefault(); doLink(link); }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link da imagem (https://…)" inputMode="url" />
          <button type="submit" className="rc-btn" disabled={!link.trim() || Boolean(ocupado)}>Buscar</button>
        </form>

        {erro ? <p className="rc-erro">{erro}</p> : null}

        <div className="rc-rodape">
          <button type="button" className="rc-btn" onClick={fechar}>Cancelar</button>
          <button type="button" className="rc-btn ouro" disabled={!fonte || Boolean(ocupado)} onClick={confirmar}><Icone nome="check" />Usar esta foto</button>
        </div>

        <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) abrir(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
