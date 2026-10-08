// Conexao em tempo real com o servidor (SSE). EventSource reconecta sozinho se a rede cair.
import { useEffect, useRef, useState } from 'react';

export const pinGuardado = () => {
  try {
    return sessionStorage.getItem('pin') ?? '';
  } catch {
    return '';
  }
};

interface Opcoes {
  pin?: string;
  codigo?: string;
  aoEvento?: (ev: unknown) => void;
  /** Outros eventos do fluxo (ex.: 'ficha', 'fichas', 'acao'). */
  ouvintes?: Record<string, (dados: unknown) => void>;
  ligado?: boolean;
}

export function useMesa<T>(visao: 'mestre' | 'publico' | 'jogador', { pin, codigo, aoEvento, ouvintes, ligado = true }: Opcoes = {}) {
  const [estado, setEstado] = useState<T | null>(null);
  const [online, setOnline] = useState(false);
  const aoEventoRef = useRef(aoEvento);
  aoEventoRef.current = aoEvento;
  const ouvintesRef = useRef(ouvintes);
  ouvintesRef.current = ouvintes;
  const nomesOuvintes = Object.keys(ouvintes ?? {}).sort().join(',');

  useEffect(() => {
    if (!ligado) return undefined;
    const params = new URLSearchParams({ visao });
    if (pin) params.set('pin', pin);
    if (codigo) params.set('codigo', codigo);
    const fonte = new EventSource(`/eventos?${params}`);
    fonte.addEventListener('estado', (e) => setEstado(JSON.parse((e as MessageEvent).data)));
    fonte.addEventListener('evento', (e) => aoEventoRef.current?.(JSON.parse((e as MessageEvent).data)));
    for (const nome of nomesOuvintes ? nomesOuvintes.split(',') : []) {
      fonte.addEventListener(nome, (e) => ouvintesRef.current?.[nome]?.(JSON.parse((e as MessageEvent).data)));
    }
    fonte.onopen = () => setOnline(true);
    fonte.onerror = () => setOnline(false);
    return () => fonte.close();
  }, [visao, pin, codigo, ligado, nomesOuvintes]);

  return { estado, online };
}

export interface Resposta {
  ok: boolean;
  erro?: string;
  [chave: string]: unknown;
}

export async function postar(url: string, corpo: unknown, cabecalhos: Record<string, string> = {}): Promise<Resposta> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cabecalhos },
      body: JSON.stringify(corpo),
    });
    return (await resp.json()) as Resposta;
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' };
  }
}

/** Envia um arquivo cru (PDF, foto) e devolve a resposta JSON. */
export async function enviarArquivo(url: string, arquivo: Blob, cabecalhos: Record<string, string> = {}): Promise<Resposta> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': arquivo.type || 'application/octet-stream', ...cabecalhos },
      body: arquivo,
    });
    return (await resp.json()) as Resposta;
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' };
  }
}
