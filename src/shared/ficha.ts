// Ficha de personagem jogador: o que a mesa guarda de cada heroi (importado do Nimb ou feito a mao).
import type { Ataque, Atributo, TipoDano } from './tipos.ts';
import type { Anim, AlvoMagia, Resistencia, Sucesso } from './magias-efeitos.ts';
import { execucaoDoTexto, type Execucao } from './execucao.ts';

/** As 30 linhas de pericia da ficha (mesma ordem do PDF do Nimb). */
export const PERICIAS = [
  'Acrobacia', 'Adestramento', 'Atletismo', 'Atuação', 'Cavalgar', 'Conhecimento', 'Cura', 'Diplomacia', 'Enganação',
  'Fortitude', 'Furtividade', 'Guerra', 'Iniciativa', 'Intimidação', 'Intuição', 'Investigação', 'Jogatina', 'Ladinagem',
  'Luta', 'Misticismo', 'Nobreza', 'Ofício 1', 'Ofício 2', 'Percepção', 'Pilotagem', 'Pontaria', 'Reflexos', 'Religião',
  'Sobrevivência', 'Vontade',
] as const;

export interface Pericia {
  total: number;
  treinada: boolean;
  atributo: Atributo;
  /** Nome livre (ex.: Ofício (Ferreiro)). */
  rotulo?: string;
}

/** Bonus que um poder ativo (ou magia) da enquanto dura. */
export interface BonusAtivo {
  ataque?: number;
  dano?: number;
  defesa?: number;
}

export interface Poder {
  nome: string;
  texto: string;
  /** Custo em PM para usar pelo celular (0 ou vazio = passivo). */
  pm?: number;
  /** Acao que gasta (vazio = a citada no texto, ou padrao). Reacao pode ser usada fora da vez. */
  execucao?: Execucao;
  /** O que acontece na mesa ao usar (mesmo formato das magias proprias). */
  efeito?: MagiaPropria['efeito'];
  /** Enquanto ativo (ex.: Furia: +2 em ataque e dano). */
  bonus?: BonusAtivo;
}

/** Execucao de um poder ou item: a escolhida na ficha ou a citada no texto. */
export const execucaoDoPoder = (p: Poder): Execucao => p.execucao ?? execucaoDoTexto(p.texto);

/** Poder que aparece para usar no celular (tem custo, efeito ou bonus). */
export const poderUsavel = (p: Poder) => Boolean(p.pm || p.efeito || (p.bonus && (p.bonus.ataque || p.bonus.dano || p.bonus.defesa)));

/** Magia criada pelo grupo (homebrew): descricao para ler e o efeito que o motor de regras aplica. */
export interface MagiaPropria {
  /** Sempre comeca com "propria-". */
  id: string;
  nome: string;
  circulo: number;
  execucao: string;
  alcance: string;
  duracao: string;
  descricao: string;
  efeito: {
    alvo: AlvoMagia;
    /** 0 = sem limite. */
    maxAlvos: number;
    dano?: string;
    tipoDano?: TipoDano;
    cura?: string;
    res?: Resistencia;
    sucesso?: Sucesso;
    /** Condicao se o alvo falhar (ou sempre, sem teste). */
    falhou?: string[];
    persistente?: 'sustentada' | 'cena' | 'rodadas';
    anim: Anim;
  };
  /** Aprimoramentos: +PM para somar dano e/ou alvos (pode usar varias vezes, ate o limite de PM). */
  aprimoramentos?: { pm: number; texto: string; dano?: string; alvos?: number }[];
  /** Efeito que o conjurador repete enquanto a magia dura, sem gastar PM (o chicote, o enxame...). */
  uso?: MagiaPropria['efeito'] & { nome: string };
}

export interface Ficha {
  id: string;
  /** Credencial do celular do jogador (vai no QR code). Nunca sai para o telao. */
  codigo: string;
  fonte: 'nimb' | 'manual';
  criadaEm: number;
  atualizadaEm: number;

  nome: string;
  jogador: string;
  raca: string;
  origem: string;
  classe: string;
  nivel: number;
  divindade: string;

  atributos: Record<Atributo, number>;
  pvMax: number;
  pmMax: number;
  defesa: number;
  deslocamento: number;
  pericias: Record<string, Pericia>;
  ataques: Ataque[];
  /** Ids do grimorio (src/shared/dados/magias.json). */
  magias: string[];
  /** Magias da ficha que o grimorio nao conhece (so o nome, vindas do Nimb). */
  magiasExtras: string[];
  /** Magias criadas pelo grupo, que funcionam na mesa como as do livro. */
  magiasProprias: MagiaPropria[];
  /** Atributo-chave das magias; null para quem nao conjura. */
  atributoChave: Atributo | null;
  /** Soma na CD de todas as magias (ex.: Fortalecimento Arcano). */
  bonusCd: number;
  rd: Partial<Record<TipoDano | 'geral', number>>;
  poderes: Poder[];
  /** Itens magicos e equipamentos especiais (o nome e o que fazem). */
  itens: Poder[];
  proficiencias: string;
  equipamento: string;
  notas: string;

  imagem: string;
  cor: string;
  /** Modelo de dado escolhido pelo jogador (ver shared/dados-3d.ts). */
  dado: string;
}

/** CD para resistir as magias: 10 + metade do nivel + atributo-chave (Tormenta20, p. 172). */
export function cdMagia(f: Pick<Ficha, 'nivel' | 'atributos' | 'atributoChave' | 'bonusCd'>) {
  if (!f.atributoChave) return null;
  return 10 + Math.floor(f.nivel / 2) + f.atributos[f.atributoChave] + f.bonusCd;
}

/** Limite de PM por habilidade (inclusive magia com aprimoramentos) = nivel. */
export const limitePm = (f: Pick<Ficha, 'nivel'>) => f.nivel;

/** Custo base por circulo (Tormenta20, tabela 4-1). */
export const CUSTO_CIRCULO = [0, 1, 3, 6, 10, 15];

/** Atributo-chave padrao de cada classe conjuradora. */
export function atributoChavePadrao(classe: string, poderes: Poder[] = []): Atributo | null {
  const c = classe.toLowerCase();
  if (c.includes('arcanista')) {
    const caminho = poderes.find((p) => /caminho do arcanista/i.test(p.nome))?.texto.toLowerCase() ?? '';
    return caminho.includes('feiticeiro') ? 'car' : 'int';
  }
  if (c.includes('bardo')) return 'car';
  if (c.includes('clérigo') || c.includes('clerigo') || c.includes('druida') || c.includes('frade')) return 'sab';
  if (c.includes('inventor')) return 'int';
  if (c.includes('paladino')) return 'car';
  return null;
}
