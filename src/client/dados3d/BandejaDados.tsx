// Componente React em volta da bandeja 3D. Carrega o Three.js so quando aparece.
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import type { DadoParaRolar } from './bandeja.ts';

export interface ControleBandeja {
  rolar: (dados: DadoParaRolar[], duracaoMs?: number, origem?: number) => Promise<void>;
  segurar: (dados: { faces: number; modelo: string }[]) => void;
  arremessar: () => Promise<void>;
  limpar: () => void;
}

interface Props {
  /** Recebe o controle quando a bandeja fica pronta. */
  controle: RefObject<ControleBandeja | null>;
  classe?: string;
  style?: CSSProperties;
}

export function BandejaDados({ controle, classe, style }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const pronta = import('./bandeja.ts').then(({ Bandeja }) => new Bandeja(canvas.current!));
    controle.current = {
      rolar: async (dados, duracaoMs, origem) => (await pronta).rolar(dados, duracaoMs, origem),
      segurar: (dados) => { pronta.then((b) => b.segurar(dados)); },
      arremessar: async () => (await pronta).arremessar(),
      limpar: () => { pronta.then((b) => b.limpar()); },
    };
    return () => {
      controle.current = null;
      pronta.then((b) => b.destruir());
    };
  }, [controle]);

  return (
    <div className={classe} style={classe ? style : { position: 'relative', ...style }}>
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}
