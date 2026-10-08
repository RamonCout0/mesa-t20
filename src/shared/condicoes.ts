// Condicoes de Tormenta 20 (Tormenta20 JdA, p. 394-395) e listas fixas da mesa.
// Usado pelo servidor (validacao, regras) e pelas telas (icones). Sem dependencias.

export interface Condicao {
  id: string;
  nome: string;
  icone: string;
  resumo: string;
  /** Nao esta na lista oficial; mantida por compatibilidade com mesas antigas. */
  extra?: boolean;
}

export const CONDICOES: Condicao[] = [
  { id: 'abalado', nome: 'Abalado', icone: '😨', resumo: '–2 em testes de perícia. Abalado de novo: apavorado.' },
  { id: 'agarrado', nome: 'Agarrado', icone: '🤝', resumo: 'Desprevenido e imóvel, –2 em ataques, só armas leves.' },
  { id: 'alquebrado', nome: 'Alquebrado', icone: '💔', resumo: 'Habilidades custam +1 PM.' },
  { id: 'apavorado', nome: 'Apavorado', icone: '😱', resumo: '–5 em perícias e não se aproxima da fonte do medo.' },
  { id: 'atordoado', nome: 'Atordoado', icone: '💫', resumo: 'Desprevenido e sem ações.' },
  { id: 'caido', nome: 'Caído', icone: '🛌', resumo: '–5 na Defesa contra corpo a corpo, +5 contra distância, –5 em ataques corpo a corpo.' },
  { id: 'cego', nome: 'Cego', icone: '🙈', resumo: 'Desprevenido e lento; alvos têm camuflagem total.' },
  { id: 'confuso', nome: 'Confuso', icone: '🌀', resumo: 'Age ao acaso (1d6 no início do turno).' },
  { id: 'debilitado', nome: 'Debilitado', icone: '🥀', resumo: '–5 em For, Des, Con e perícias desses atributos.' },
  { id: 'desprevenido', nome: 'Desprevenido', icone: '❗', resumo: '–5 na Defesa e em Reflexos.' },
  { id: 'doente', nome: 'Doente', icone: '🤢', resumo: 'Sob efeito de uma doença.' },
  { id: 'em-chamas', nome: 'Em chamas', icone: '🔥', resumo: '1d6 de fogo no início do turno; ação padrão apaga.' },
  { id: 'enfeiticado', nome: 'Enfeitiçado', icone: '💞', resumo: 'Prestativo com a fonte; ela recebe +10 em Diplomacia.' },
  { id: 'enjoado', nome: 'Enjoado', icone: '🤮', resumo: 'Só uma ação padrão ou de movimento por rodada.' },
  { id: 'enredado', nome: 'Enredado', icone: '🕸️', resumo: 'Lento, vulnerável e –2 em ataques.' },
  { id: 'envenenado', nome: 'Envenenado', icone: '☠️', resumo: 'Efeito conforme o veneno.' },
  { id: 'esmorecido', nome: 'Esmorecido', icone: '😞', resumo: '–5 em Int, Sab, Car e perícias desses atributos.' },
  { id: 'exausto', nome: 'Exausto', icone: '😵', resumo: 'Debilitado, lento e vulnerável.' },
  { id: 'fascinado', nome: 'Fascinado', icone: '😍', resumo: '–5 em Percepção e sem ações; ações hostis anulam.' },
  { id: 'fatigado', nome: 'Fatigado', icone: '😓', resumo: 'Fraco e vulnerável.' },
  { id: 'fraco', nome: 'Fraco', icone: '🫥', resumo: '–2 em For, Des, Con e perícias desses atributos.' },
  { id: 'frustrado', nome: 'Frustrado', icone: '😤', resumo: '–2 em Int, Sab, Car e perícias desses atributos.' },
  { id: 'imovel', nome: 'Imóvel', icone: '⛓️', resumo: 'Deslocamento 0.' },
  { id: 'inconsciente', nome: 'Inconsciente', icone: '💤', resumo: 'Indefeso e sem ações.' },
  { id: 'indefeso', nome: 'Indefeso', icone: '🏳️', resumo: 'Desprevenido, –10 na Defesa, falha em Reflexos.' },
  { id: 'lento', nome: 'Lento', icone: '🐌', resumo: 'Deslocamento pela metade; sem correr ou investir.' },
  { id: 'ofuscado', nome: 'Ofuscado', icone: '🌞', resumo: '–2 em ataques e Percepção.' },
  { id: 'paralisado', nome: 'Paralisado', icone: '🧊', resumo: 'Imóvel e indefeso; só ações mentais.' },
  { id: 'pasmo', nome: 'Pasmo', icone: '😮', resumo: 'Sem ações.' },
  { id: 'petrificado', nome: 'Petrificado', icone: '🗿', resumo: 'Inconsciente e RD 8.' },
  { id: 'sangrando', nome: 'Sangrando', icone: '🩸', resumo: 'Con CD 15 no início do turno ou perde 1d6 PV.' },
  { id: 'sobrecarregado', nome: 'Sobrecarregado', icone: '🎒', resumo: 'Penalidade de armadura –5 e deslocamento –3m.' },
  { id: 'surdo', nome: 'Surdo', icone: '🔇', resumo: '–5 em Iniciativa; condição ruim para magias.' },
  { id: 'surpreendido', nome: 'Surpreendido', icone: '⁉️', resumo: 'Desprevenido e sem ações.' },
  { id: 'vulneravel', nome: 'Vulnerável', icone: '🎯', resumo: '–2 na Defesa.' },
  { id: 'morrendo', nome: 'Morrendo', icone: '⚰️', resumo: 'Com 0 PV ou menos, sangrando.', extra: true },
  { id: 'sufocando', nome: 'Sufocando', icone: '🫁', resumo: 'Sem ar.', extra: true },
];

export const CONDICAO_POR_ID: Record<string, Condicao> = Object.fromEntries(CONDICOES.map((c) => [c.id, c]));

export const TEMAS = ['fogo', 'gelo', 'trevas', 'arcano', 'luz', 'veneno', 'sangue'] as const;
export type Tema = (typeof TEMAS)[number];

export const TIERS = ['comum', 'elite', 'epico', 'lendario', 'mitico'] as const;
export type Tier = (typeof TIERS)[number];

export const REVELAR = ['oculto', 'estado', 'barra', 'numero'] as const;
export type Revelar = (typeof REVELAR)[number];

export const EFEITOS = [
  { id: 'tremor', nome: 'Tremor', icone: '🌋' },
  { id: 'clarao', nome: 'Clarão', icone: '⚡' },
  { id: 'raio', nome: 'Raio', icone: '🌩️' },
  { id: 'fogo', nome: 'Chamas', icone: '🔥' },
  { id: 'gelo', nome: 'Gelo', icone: '❄️' },
  { id: 'sangue', nome: 'Sangue', icone: '🩸' },
  { id: 'sombra', nome: 'Escuridão', icone: '🌑' },
  { id: 'cura', nome: 'Luz de cura', icone: '✨' },
] as const;
export type EfeitoTela = (typeof EFEITOS)[number]['id'];
