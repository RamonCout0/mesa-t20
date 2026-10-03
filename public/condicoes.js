// Condicoes de Tormenta 20. Usado pelo servidor (validacao) e pelas paginas (icones).
// Importado nos dois lados, entao so pode ter JavaScript puro.

export const CONDICOES = [
  { id: 'abalado', nome: 'Abalado', icone: '😨' },
  { id: 'agarrado', nome: 'Agarrado', icone: '🤝' },
  { id: 'alquebrado', nome: 'Alquebrado', icone: '💔' },
  { id: 'apavorado', nome: 'Apavorado', icone: '😱' },
  { id: 'atordoado', nome: 'Atordoado', icone: '💫' },
  { id: 'caido', nome: 'Caído', icone: '🛌' },
  { id: 'cego', nome: 'Cego', icone: '🙈' },
  { id: 'confuso', nome: 'Confuso', icone: '🌀' },
  { id: 'debilitado', nome: 'Debilitado', icone: '🥀' },
  { id: 'desprevenido', nome: 'Desprevenido', icone: '❗' },
  { id: 'doente', nome: 'Doente', icone: '🤢' },
  { id: 'em-chamas', nome: 'Em chamas', icone: '🔥' },
  { id: 'enjoado', nome: 'Enjoado', icone: '🤮' },
  { id: 'envenenado', nome: 'Envenenado', icone: '☠️' },
  { id: 'esmorecido', nome: 'Esmorecido', icone: '😞' },
  { id: 'exausto', nome: 'Exausto', icone: '😵' },
  { id: 'fascinado', nome: 'Fascinado', icone: '😍' },
  { id: 'fatigado', nome: 'Fatigado', icone: '😓' },
  { id: 'fraco', nome: 'Fraco', icone: '🫥' },
  { id: 'frustrado', nome: 'Frustrado', icone: '😤' },
  { id: 'imovel', nome: 'Imóvel', icone: '⛓️' },
  { id: 'inconsciente', nome: 'Inconsciente', icone: '💤' },
  { id: 'indefeso', nome: 'Indefeso', icone: '🏳️' },
  { id: 'lento', nome: 'Lento', icone: '🐌' },
  { id: 'morrendo', nome: 'Morrendo', icone: '⚰️' },
  { id: 'ofuscado', nome: 'Ofuscado', icone: '🌞' },
  { id: 'paralisado', nome: 'Paralisado', icone: '🧊' },
  { id: 'pasmo', nome: 'Pasmo', icone: '😮' },
  { id: 'petrificado', nome: 'Petrificado', icone: '🗿' },
  { id: 'sangrando', nome: 'Sangrando', icone: '🩸' },
  { id: 'sufocando', nome: 'Sufocando', icone: '🫁' },
  { id: 'surdo', nome: 'Surdo', icone: '🔇' },
  { id: 'vulneravel', nome: 'Vulnerável', icone: '🎯' },
];

export const CONDICAO_POR_ID = Object.fromEntries(CONDICOES.map((c) => [c.id, c]));

export const TEMAS = ['fogo', 'gelo', 'trevas', 'arcano', 'luz', 'veneno', 'sangue'];
export const TIERS = ['comum', 'elite', 'epico', 'lendario', 'mitico'];
export const REVELAR = ['oculto', 'estado', 'barra', 'numero'];
export const EFEITOS = [
  { id: 'tremor', nome: 'Tremor', icone: '🌋' },
  { id: 'clarao', nome: 'Clarão', icone: '⚡' },
  { id: 'raio', nome: 'Raio', icone: '🌩️' },
  { id: 'fogo', nome: 'Chamas', icone: '🔥' },
  { id: 'gelo', nome: 'Gelo', icone: '❄️' },
  { id: 'sangue', nome: 'Sangue', icone: '🩸' },
  { id: 'sombra', nome: 'Escuridão', icone: '🌑' },
  { id: 'cura', nome: 'Luz de cura', icone: '✨' },
];
