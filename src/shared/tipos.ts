// Tipos do estado da mesa, compartilhados entre servidor e telas.
import type { Revelar, Tema, Tier } from './condicoes.ts';
import type { EfeitoAtivo, Temporizador } from './acoes.ts';
import type { Gasto } from './execucao.ts';

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

/** Quem uma habilidade de inimigo afeta quando o mestre usa. */
export type AlvoHabilidade = 'inimigos' | 'um' | 'si' | 'aliados' | 'nenhum';

export interface Habilidade {
  nome: string;
  /** Aparece no telão (chip do boss). */
  ativa: boolean;
  /** Descrição completa (só o mestre vê). */
  texto?: string;
  /** Padrão, movimento, completa, livre ou reação. */
  execucao?: string;
  /** PM que o inimigo gasta ao usar. */
  pm?: number;
  /** Botão de usar na carta: em quem acerta ('nenhum' = só anuncia no telão). */
  alvo?: AlvoHabilidade;
  dano?: string;
  tipoDano?: TipoDano | '';
  cura?: string;
  res?: 'fort' | 'ref' | 'von' | '';
  cd?: number;
  sucesso?: 'metade' | 'anula';
  /** Condições se o alvo falhar ("cego:2" = por 2 rodadas). */
  condicoes?: string[];
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
  /** Virou chefe final (Ameaças de Arton, p. 370): PV dobrado, RD pelo patamar, Maior que a Morte. */
  chefeFinal?: boolean;
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
  /** 3 = habilidades completas (texto, execucao, dano, teste). Fichas sem isto sao relidas do texto. */
  versao?: number;
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
  /** Onde ficam os pes: 0 (fundo, longe e menor) a 100 (frente, perto e maior). */
  y: number;
  espelhar: boolean;
  /** Expressao: outra imagem so para a cena (vazio = a imagem normal). */
  expressao: string;
}

export interface Palco {
  fundo: string;
  atores: Ator[];
  /** Quem esta falando agora (fica em destaque, os outros escurecem). */
  destaque: string | null;
}

/** Mensagem secreta revelada a todos no telao. */
export interface Revelacao {
  id: string;
  texto: string;
  imagem: string;
  /** Para quem a mensagem tinha sido enviada (nomes dos herois). */
  para: string[];
}

export interface Cena {
  modo: 'combate' | 'roleplay';
  bossId: string | null;
  idInvocacao: string;
  mostrar: Mostrar | null;
  palco: Palco;
  revelacao: Revelacao | null;
}

export interface Turnos {
  ativo: boolean;
  rodada: number;
  atual: string | null;
  /** Acoes ja gastas por quem esta na vez (padrao / movimento). */
  gasto: Gasto;
}

export interface Opcoes {
  /** Celulares podem criar personagens importando o PDF do Nimb. */
  importarPeloCelular: boolean;
  /** Com combate em andamento: o jogador só age na própria vez (fora dela, só reações) e conta padrão + movimento. */
  acaoSoNaVez: boolean;
  /** Jogador edita a própria ficha toda pelo celular (atributos, ataques, magias...). */
  fichaLivre: boolean;
  /** Regra da casa: o golpe que derruba o herói para no 0; só os danos seguintes descem para a morte. */
  zerarAntes: boolean;
  /** Regra do livro: um teste de Iniciativa só para todos os inimigos, com o menor bônus entre eles. */
  iniciativaUnica: boolean;
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

/** Mensagem (texto e/ou imagem) que o mestre manda em segredo para um ou mais jogadores. */
export interface Segredo {
  id: string;
  /** Fichas (jogadores) que recebem. */
  para: string[];
  texto: string;
  /** Imagem: da galeria (/galeria/...) ou enviada so para este segredo (fica em data/segredos/). */
  imagem: string;
  criadoEm: number;
  /** Quem ja abriu (ficha -> quando). */
  lidas: Record<string, number>;
  respostas: { fichaId: string; nome: string; texto: string; em: number }[];
  revelado: boolean;
}
