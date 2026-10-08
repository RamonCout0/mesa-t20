import { useEffect, useRef, useState } from 'react';

export type Avisar = (texto: string, tipo?: 'erro' | 'info') => void;

/** Mensagem curta que sobe acima da barra de navegacao. */
export function Aviso({ registrar }: { registrar: (f: Avisar) => void }) {
  const [msg, setMsg] = useState({ texto: '', tipo: 'erro', visivel: false });
  const timer = useRef<number>(undefined);
  useEffect(() => {
    registrar((texto, tipo = 'erro') => {
      setMsg({ texto, tipo, visivel: true });
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMsg((m) => ({ ...m, visivel: false })), 3200);
    });
  }, [registrar]);
  return <div className={`j-aviso ${msg.tipo} ${msg.visivel ? 'visivel' : ''}`} role="status">{msg.texto}</div>;
}
