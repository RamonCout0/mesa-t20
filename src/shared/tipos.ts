// Tipos do estado da mesa, compartilhados entre servidor e telas.
import type { Revelar, Tema, Tier } from './condicoes.ts';
import type { EfeitoAtivo, Temporizador } from './acoes.ts';

export type Lado = 'aliados' | 'inimigos';
export type Atributo = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car';
export const ATRIBUTOS: Atributo[] = ['for', 'des', 'con', 'int', 'sab', 'car'];
export const NOME_ATRIBUTO: Record<Atributo, string> = {
  for: 'Força', des: 'Destreza', con: 'Constituição', int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma',
};

export const TIPOS_DANO = [
  'acido', 'corte', 'eletricidade', 'essencia', 'fogo', 'frio', 'impacto', 'luz', 'perfuracao', 'psiquico', 'trevas',
] as const;
export type TipoDano = (typeof TIPOS_DANO)[number];
export const NOME_DANO: Record<TipoDano, string> = {
  acido: 'ácido', corte: 'corte', eletricidade: 'eletricidade', essencia: 'essência', fogo: 'fogo', frio: 'frio',
  impacto: 'impacto', luz: 'luz', perfuracao: 'perfuração', psiquico: 'psíquico', trevas: 'trevas',
};

/** Como a animação de um ataque com arma é desenhada no telão. */
export type ArquetipoArma = 'corte' | 'perfuracao' | 'impacto' | 'flecha' | 'virote' | 'tiro' | 'arremesso' | 'natural';

export interface Ataque {
  id: string;
  nome: string;
  bonus: number;
  /** Notação de dados, ex.: "1d8+3" ou "2d6+1d6". */
  dano: string;
  tipoDano: TipoDano | '';
  /** Margem de ameaça (20 = só no 20 natural). */
  margem: number;
  mult: number;
  alcance: string;
  distancia: boolean;
  /** Arma corpo a corpo que tambem pode ser arremessada (adaga, lanca...). */
  arremessavel?: boolean;
  arquetipo: ArquetipoArma;
}

export interface Habilidade {
  nome: string;
  /** Aparece no telão (chip do boss). */
  ativa: boolean;
}

export interface Combatente {
  id: string;
  nome: string;
  imagem: string;
  pv: number;
  pvMax: number;
  pvTemp: number;
  pm: number;
  pmMax: number;
  defesa: number;
  bonusIni: number;
  iniciativa: number | null;
  condicoes: string[];
}

export interface Heroi extends Combatente {
  jogador: string;
  classe: string;
  nivel: number;
  cor: string;
  /** Ficha completa (data/fichas/<id>.json), quando o herói veio de uma ficha. */
  fichaId: string | null;
}

export interface Inimigo extends Combatente {
  subtitulo: string;
  nd: string;
  naTela: boolean;
  revelar: Revelar;
  tema: Tema;
  tier: Tier;
  notas: string;
  habilidades: Habilidade[];
  fort: number;
  ref: number;
  von: number;
  rd: Partial<Record<TipoDano | 'geral', number>>;
  imunidades: string[];
  vulnerabilidades: string[];
  ataques: Ataque[];
  /** Ficha de ameaça do bestiário de onde a carta saiu. */
  ameacaId: string | null;
}

export type Entidade = Heroi | Inimigo;

/** Ficha de ameaça guardada no bestiário (data/bestiario/<id>.json). Vira carta na mesa quando o mestre quiser. */
export type CamposAmeaca =
  | 'nome' | 'subtitulo' | 'nd' | 'imagem' | 'pvMax' | 'pmMax' | 'defesa' | 'bonusIni' | 'fort' | 'ref' | 'von'
  | 'rd' | 'imunidades' | 'vulnerabilidades' | 'ataques' | 'habilidades' | 'notas' | 'tema' | 'tier' | 'revelar';
export const CAMPOS_AMEACA: CamposAmeaca[] = [
  'nome', 'subtitulo', 'nd', 'imagem', 'pvMax', 'pmMax', 'defesa', 'bonusIni', 'fort', 'ref', 'von',
  'rd', 'imunidades', 'vulnerabilidades', 'ataques', 'habilidades', 'notas', 'tema', 'tier', 'revelar',
];
export type Ameaca = Pick<Inimigo, CamposAmeaca> & {
  id: string;
  /** Texto do bloco original (habilidades completas), para o mestre consultar. */
  texto: string;
  criadaEm: number;
  atualizadaEm: number;
};

export interface Mostrar {
  imagem: string;
  titulo: string;
  id: string;
}

/** Personagem no palco do modo cena (visual novel). */
export interface Ator {
  id: string;
  /** Combatente da mesa que este ator representa; null = NPC avulso da galeria. */
  refId: string | null;
  nome: string;
  imagem: string;
  cor: string;
  /** Posicao horizontal no palco: 0 (esquerda) a 100 (direita). */
  x: number;
  espelhar: boolean;
}

export interface Fala {
  id: string;
  /** null = narrador. */
  atorId: string | null;
  nome: string;
  cor: string;
  texto: string;
  /** Veio do celular do jogador. */
  jogador?: boolean;
  em: number;
}

export interface Palco {
  fundo: string;
  atores: Ator[];
  /** Fala na caixa de dialogo agora. */
  fala: Fala | null;
  /** Ultimas falas, para quem quiser reler. */
  falas: Fala[];
}

export interface Cena {
  modo: 'combate' | 'roleplay';
  bossId: string | null;
  idInvocacao: string;
  mostrar: Mostrar | null;
  palco: Palco;
}

export interface Turnos {
  ativo: boolean;
  rodada: number;
  atual: string | null;
}

export interface Opcoes {
  /** Celulares podem criar personagens importando o PDF do Nimb. */
  importarPeloCelular: boolean;
  /** Jogador só age na própria vez quando há combate em andamento. */
  acaoSoNaVez: boolean;
  /** No modo cena, jogadores falam pelo celular. */
  falasPeloCelular: boolean;
}

export interface Estado {
  versao: 3;
  aliados: Heroi[];
  inimigos: Inimigo[];
  cena: Cena;
  turnos: Turnos;
  opcoes: Opcoes;
  /** Magias que continuam valendo (sustentadas, de cena...). */
  efeitos: EfeitoAtivo[];
  /** Condicoes que acabam sozinhas depois de algumas rodadas. */
  temporizadores: Temporizador[];
  /** Testes que o mestre pediu aos celulares. */
  pedidos: PedidoTeste[];
}

/** Resposta de um heroi a um teste pedido. Na visao publica de teste secreto vai sem numeros. */
export interface RespostaTeste {
  total: number | null;
  passou: boolean | null;
}

/** Teste pedido pelo mestre (pericia, resistencia ou iniciativa); cada celular rola o seu. */
export interface PedidoTeste {
  id: string;
  /** Nome da pericia como na ficha (ex.: "Percepção", "Reflexos", "Iniciativa"). */
  pericia: string;
  cd: number | null;
  /** So o mestre (e quem rolou) ve o resultado. */
  secreto: boolean;
  alvos: string[];
  respostas: Record<string, RespostaTeste>;
  criadoEm: number;
}

/** Evento passageiro (números flutuantes, efeitos de tela). Não fica no estado. */
export interface EventoValor {
  tipo: 'dano' | 'cura' | 'temp' | 'pmGasta' | 'pmRecupera';
  alvo: string;
  lado: Lado;
  nome: string;
  valor: number | null;
  caiu?: boolean;
}
export interface EventoFx {
  tipo: 'fx';
  efeito: string;
}
export type Evento = EventoValor | EventoFx;

// ---------------- visao publica (telao e celulares) ----------------

export interface InimigoPublico {
  id: string;
  nome: string;
  subtitulo: string;
  nd: string;
  imagem: string;
  condicoes: string[];
  revelar: Revelar;
  tema: Tema;
  tier: Tier;
  caido: boolean;
  iniciativa: number | null;
  habilidades: string[];
  rotulo?: string;
  pct?: number;
  pv?: number;
  pvMax?: number;
  pvTemp?: number;
}

export interface FichaOrdem {
  id: string;
  lado: Lado;
  nome: string;
  imagem: string;
  iniciativa: number;
  cor: string | null;
}

export interface EstadoPublico {
  aliados: Heroi[];
  inimigos: InimigoPublico[];
  cena: Cena;
  turnos: Turnos & { ordem: FichaOrdem[] };
  opcoes: Opcoes;
  efeitos: EfeitoAtivo[];
  pedidos: PedidoTeste[];
}

export interface InfoServidor {
  mestre: boolean;
  precisaPin: boolean;
  enderecos: string[];
  podeDesfazer: boolean;
}

export interface ImagemGaleria {
  url: string;
  nome: string;
  pasta: 'personagens' | 'bosses' | 'galeria' | 'cenarios';
  data: number;
}
