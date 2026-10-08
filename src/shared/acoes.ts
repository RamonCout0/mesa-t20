// Resultado de uma acao resolvida pelo servidor (ataque, magia, rolagem livre).
// O telao e os celulares animam a partir disto: dados, projeteis, numeros de dano.
import type { DadoRolado } from './rolagem.ts';
import type { Anim, Elemento, Resistencia } from './magias-efeitos.ts';
import type { ArquetipoArma, Lado, TipoDano } from './tipos.ts';

export type Desfecho =
  | 'acerto' // ataque acertou / alvo falhou na resistencia
  | 'critico' // acerto critico
  | 'erro' // ataque errou
  | 'resistiu' // passou na resistencia (efeito reduzido)
  | 'anulado' // passou e a magia nao teve efeito
  | 'imune' // imune ao tipo de dano / efeito
  | 'cura' // recebeu cura ou PV temporarios
  | 'efeito'; // efeito sem rolagem (buff, utilidade)

export interface Salvamento {
  teste: Resistencia;
  dado: number;
  /** Total do teste. Vai como null para quem nao pode ver o bonus do inimigo. */
  total: number | null;
  cd: number;
  passou: boolean;
}

export interface TesteAtaque {
  dado: number;
  total: number;
  /** Defesa do alvo (null na visao publica de inimigos). */
  defesa: number | null;
  margem: number;
}

export interface ParteDano {
  valor: number;
  tipo: TipoDano | 'perda' | '';
}

export interface AlvoResultado {
  id: string;
  nome: string;
  lado: Lado;
  desfecho: Desfecho;
  dano?: number;
  partes?: ParteDano[];
  /** Quanto a RD (ou imunidade) segurou. */
  reduzido?: number;
  cura?: number;
  temp?: number;
  condicoes?: string[];
  removidas?: string[];
  salvamento?: Salvamento;
  ataque?: TesteAtaque;
  caiu?: boolean;
  morreu?: boolean;
  pvAntes?: number;
  pvDepois?: number;
  /** Texto do carimbo no telao quando o desfecho padrao nao serve (ex.: "Estabilizou"). */
  carimbo?: string;
}

export interface RolagemExibida {
  rotulo: string;
  expressao: string;
  dados: DadoRolado[];
  bonus: number;
  total: number;
  /** Rolagem feita por um alvo (teste de resistencia), mostrada perto dele. */
  alvoId?: string;
}

export interface Autor {
  id: string;
  nome: string;
  lado: Lado;
  cor: string;
  imagem: string;
}

export interface ResultadoAcao {
  id: string;
  criadoEm: number;
  tipo: 'ataque' | 'magia' | 'uso' | 'rolagem';
  autor: Autor;
  titulo: string;
  subtitulo: string;
  /** Modelo do dado de quem rolou. */
  dado: string;
  rolagens: RolagemExibida[];
  alvos: AlvoResultado[];
  anim: { arma?: ArquetipoArma; magia?: Anim; distancia?: boolean; tipoDano?: TipoDano | '' };
  pmGasto?: number;
  /** O autor recuperou PV (dreno). */
  autoCura?: number;
  texto: string;
  nota?: string;
  /** Efeito que ficou ativo na mesa por causa desta acao. */
  efeitoId?: string;
  /** Rolagem secreta: so o mestre e o autor veem. */
  secreta?: boolean;
  /** O mestre desfez esta acao (so aparece riscada no registro). */
  desfeita?: boolean;
}

/** Magia ou efeito que continua valendo na mesa (sustentada, cena...). */
export interface EfeitoAtivo {
  id: string;
  magiaId: string;
  nome: string;
  conjuradorId: string;
  alvos: string[];
  persistente: 'sustentada' | 'cena' | 'rodadas' | 'longa';
  /** Rodadas restantes, contadas no inicio do turno do conjurador. */
  rodadas?: number;
  criadoEm: number;
  /** Cor/icone do efeito no telao (vem da animacao da magia). */
  elemento?: Elemento;
  /** Condicoes que o efeito impos em cada alvo; saem quando ele acaba. */
  impostas?: Record<string, string[]>;
}

/** Condicao que acaba sozinha depois de algumas rodadas. */
export interface Temporizador {
  id: string;
  alvoId: string;
  condicao: string;
  /** Conta no inicio do turno de quem causou. */
  donoId: string;
  restantes: number;
}
