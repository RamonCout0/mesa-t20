// App do jogador no celular: entra pelo QR code (ou importando a ficha do Nimb) e joga.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ficha } from '../../shared/ficha.ts';
import { Entrada } from './Entrada.tsx';
import { Jogo } from './Jogo.tsx';
import { Aviso, type Avisar } from './Aviso.tsx';

const CHAVE = 'mesa-codigo';

function lerCodigo() {
  // QR code do mestre: /jogador?c=ABC123 guarda o codigo e limpa o endereco.
  const daUrl = new URLSearchParams(location.search).get('c');
  if (daUrl) {
    try { localStorage.setItem(CHAVE, daUrl.toUpperCase()); } catch { /* sem armazenamento: so nesta aba */ }
    history.replaceState(null, '', location.pathname);
    return daUrl.toUpperCase();
  }
  try {
    return localStorage.getItem(CHAVE) ?? '';
  } catch {
    return '';
  }
}

export function App() {
  const [codigo, setCodigo] = useState(lerCodigo);
  const [inicial, setInicial] = useState<Ficha | null>(null);
  const [verificado, setVerificado] = useState(false);
  const avisoRef = useRef<Avisar>(() => {});
  const avisar: Avisar = useCallback((t, tipo) => avisoRef.current(t, tipo), []);

  // Confere o codigo guardado antes de abrir o fluxo em tempo real.
  useEffect(() => {
    if (!codigo) { setVerificado(true); return; }
    let vivo = true;
    fetch(`/api/jogador/ficha?codigo=${encodeURIComponent(codigo)}`)
      .then((r) => r.json())
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setInicial(r.ficha);
        else {
          avisar('Esse código não vale mais. Peça um QR code novo ao mestre.');
          sair();
        }
        setVerificado(true);
      })
      .catch(() => { if (vivo) setVerificado(true); });
    return () => { vivo = false; };
  }, [codigo, avisar]);

  const entrar = (novo: string) => {
    try { localStorage.setItem(CHAVE, novo); } catch { /* sem armazenamento: so nesta aba */ }
    setVerificado(false);
    setCodigo(novo);
  };
  function sair() {
    try { localStorage.removeItem(CHAVE); } catch { /* nada a limpar */ }
    setInicial(null);
    setCodigo('');
  }

  return (
    <div className="j-app">
      {!verificado ? null : codigo && inicial ? (
        <Jogo codigo={codigo} inicial={inicial} sair={sair} avisar={avisar} />
      ) : (
        <Entrada entrar={entrar} avisar={avisar} />
      )}
      <Aviso registrar={(f) => { avisoRef.current = f; }} />
    </div>
  );
}
