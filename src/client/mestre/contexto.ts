// Acesso compartilhado do painel do mestre: enviar acoes e avisar na tela.
import { createContext, useContext } from 'react';
import { pinGuardado, postar } from '../comum/conexao.ts';

export const pin = pinGuardado();

export type Avisar = (texto: string, tipo?: 'erro' | 'info') => void;

export interface PainelCtx {
  enviar: (acao: Record<string, unknown>) => Promise<boolean>;
  avisar: Avisar;
}

export const Painel = createContext<PainelCtx>({ enviar: async () => false, avisar: () => {} });

/** Pedido ao bestiario do mestre; mostra o erro e devolve null se falhar. */
export async function pedirBestiario(avisar: Avisar, corpo: Record<string, unknown>) {
  const r = await postar('/api/mestre/bestiario', corpo, { 'x-pin': pin });
  if (!r.ok) {
    avisar(r.erro ?? 'Algo deu errado.');
    return null;
  }
  return r;
}
export const usePainel = () => useContext(Painel);

export function criarEnviar(avisar: Avisar) {
  return async (acao: Record<string, unknown>) => {
    const r = await postar('/api/acao', acao, { 'x-pin': pin });
    if (!r.ok) avisar(r.erro ?? 'Algo deu errado.');
    return r.ok;
  };
}

/** Encontros e cenas salvos (preparo do mestre). */
export async function pedirSalvos(avisar: Avisar, corpo: Record<string, unknown>) {
  const r = await postar('/api/mestre/salvos', corpo, { 'x-pin': pin });
  if (!r.ok) {
    avisar(r.erro ?? 'Algo deu errado.');
    return null;
  }
  return r;
}

export interface ItemEncontro { ameacaId: string; quantidade: number; chefeFinal?: boolean }
export interface Encontro { id: string; nome: string; itens: ItemEncontro[]; criadoEm: number }
export interface CenaSalva { id: string; nome: string; palco: import('../comum/tipos-cliente.ts').Palco; criadoEm: number }
export interface SalvosMestre { encontros: Encontro[]; cenas: CenaSalva[] }
