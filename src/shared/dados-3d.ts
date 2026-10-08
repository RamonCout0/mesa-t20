// Os 14 modelos de dado que o jogador escolhe. O desenho em 3D fica no cliente (Three.js);
// aqui so a descricao, para o servidor validar a escolha.

export type Padrao = 'liso' | 'veios' | 'estrelas' | 'madeira' | 'nevoa' | 'arcoiris' | 'brasa' | 'cristal';

export interface ModeloDado {
  id: string;
  nome: string;
  /** Cor do corpo do dado. */
  base: string;
  /** Segunda cor do padrao (veios, nevoa, estrelas...). */
  detalhe: string;
  /** Cor dos numeros. */
  numero: string;
  metal: number;
  aspereza: number;
  /** 1 = opaco; menos que isso, gema translucida. */
  opacidade: number;
  /** Brilho proprio (brasa, Tormenta). */
  emissivo: string;
  padrao: Padrao;
}

export const DADOS_3D: ModeloDado[] = [
  { id: 'ouro', nome: 'Ouro Real', base: '#d9a441', detalhe: '#fff1b8', numero: '#3a2408', metal: 1, aspereza: 0.28, opacidade: 1, emissivo: '#000000', padrao: 'liso' },
  { id: 'obsidiana', nome: 'Obsidiana', base: '#15121b', detalhe: '#3d3450', numero: '#f2c66d', metal: 0.2, aspereza: 0.08, opacidade: 1, emissivo: '#000000', padrao: 'veios' },
  { id: 'rubi', nome: 'Rubi', base: '#c3122f', detalhe: '#ff7d93', numero: '#fff6e8', metal: 0, aspereza: 0.05, opacidade: 0.82, emissivo: '#300008', padrao: 'cristal' },
  { id: 'esmeralda', nome: 'Esmeralda', base: '#0f9b58', detalhe: '#8af7c0', numero: '#fffbe6', metal: 0, aspereza: 0.05, opacidade: 0.82, emissivo: '#00200f', padrao: 'cristal' },
  { id: 'safira', nome: 'Safira', base: '#1e4fd8', detalhe: '#9cc2ff', numero: '#fffbe6', metal: 0, aspereza: 0.05, opacidade: 0.82, emissivo: '#000a30', padrao: 'cristal' },
  { id: 'ametista', nome: 'Ametista', base: '#7b2fd0', detalhe: '#d9b2ff', numero: '#fffbe6', metal: 0, aspereza: 0.06, opacidade: 0.84, emissivo: '#14002a', padrao: 'cristal' },
  { id: 'osso', nome: 'Osso Antigo', base: '#e8dcc2', detalhe: '#a8926a', numero: '#4a2c14', metal: 0, aspereza: 0.75, opacidade: 1, emissivo: '#000000', padrao: 'veios' },
  { id: 'gelo', nome: 'Gelo Eterno', base: '#a9ecff', detalhe: '#ffffff', numero: '#0b3b5c', metal: 0.1, aspereza: 0.12, opacidade: 0.72, emissivo: '#05202c', padrao: 'nevoa' },
  { id: 'brasa', nome: 'Brasa', base: '#2a0d06', detalhe: '#ff6a1a', numero: '#ffd27a', metal: 0.1, aspereza: 0.6, opacidade: 1, emissivo: '#ff4a0a', padrao: 'brasa' },
  { id: 'galaxia', nome: 'Noite Estrelada', base: '#0d1240', detalhe: '#c9b8ff', numero: '#ffffff', metal: 0.15, aspereza: 0.25, opacidade: 1, emissivo: '#0a0620', padrao: 'estrelas' },
  { id: 'madeira', nome: 'Carvalho', base: '#7a4a24', detalhe: '#4a2a12', numero: '#f6e2b6', metal: 0, aspereza: 0.8, opacidade: 1, emissivo: '#000000', padrao: 'madeira' },
  { id: 'marmore', nome: 'Mármore', base: '#f1eee8', detalhe: '#7d7a86', numero: '#1c1a22', metal: 0, aspereza: 0.2, opacidade: 1, emissivo: '#000000', padrao: 'veios' },
  { id: 'tormenta', nome: 'Tormenta', base: '#4a0612', detalhe: '#ff2a4a', numero: '#ffe1e6', metal: 0.3, aspereza: 0.35, opacidade: 1, emissivo: '#5c0010', padrao: 'nevoa' },
  { id: 'nimb', nome: 'Caos de Nimb', base: '#ffffff', detalhe: '#000000', numero: '#1a1024', metal: 0.6, aspereza: 0.2, opacidade: 1, emissivo: '#000000', padrao: 'arcoiris' },
];

export const MODELO_POR_ID = Object.fromEntries(DADOS_3D.map((d) => [d.id, d]));
