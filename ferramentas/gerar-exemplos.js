// Gera as imagens SVG de exemplo (herois e inimigos). Rode: node ferramentas/gerar-exemplos.js
// Depois troque por fotos/arte suas, com o mesmo nome ou escolhendo no painel.
// Cada imagem e um brasao vetorial sobre um fundo de luz, runas e grao (300x400).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONTORNO = '#24150a';
const OURO_LINHA = '#efcf8a';

// Traco duplo (contorno escuro + ouro): da o aspecto de gravura nas pecas feitas de linha.
const linha = (d, largura = 9) =>
  `<path d="${d}" fill="none" stroke="${CONTORNO}" stroke-width="${largura + 4}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${OURO_LINHA}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round"/>`;

const anel = (externo, interno) =>
  `<path fill-rule="evenodd" d="M${externo} 0A${externo} ${externo} 0 1 1-${externo} 0A${externo} ${externo} 0 1 1 ${externo} 0ZM${interno} 0A${interno} ${interno} 0 1 1-${interno} 0A${interno} ${interno} 0 1 1 ${interno} 0Z"/>`;

const raios = (n, rBase, rLongo, rCurto, meia) => Array.from({ length: n }, (_, k) => {
  const r = k % 2 ? rCurto : rLongo;
  return `<path transform="rotate(${(360 / n) * k})" d="M0-${r}L${meia}-${rBase}H-${meia}Z"/>`;
}).join('');

const espada = '<path d="M-7 34V-66L0-88 7-66V34Z"/><path d="M0-78V28" fill="none" stroke-width="1.6"/>' +
  '<path d="M-31 34h62l-5 9h-52z"/><circle cx="-31" cy="38.5" r="5.5"/><circle cx="31" cy="38.5" r="5.5"/>' +
  '<rect x="-4.5" y="43" width="9" height="27" rx="2"/><path d="M-4.5 50h9M-4.5 57h9M-4.5 64h9" fill="none" stroke-width="1.4"/>' +
  '<path d="m0 68 8 8-8 8-8-8z"/>';

const laminaMachado = 'M6-66Q42-70 74-98Q60-42 76 16Q42-8 6-14Z';

const EMBLEMAS = {
  guerreiro: `<g transform="rotate(38)">${espada}</g><g transform="rotate(-38)">${espada}</g>`,

  arcanista: `${anel(80, 73)}
    <path transform="rotate(45)" d="M0-62 10-10 62 0 10 10 0 62-10 10-62 0-10-10Z"/>
    <path d="M0-96 16-16 96 0 16 16 0 96-16 16-96 0-16-16Z"/>
    <circle cx="54" cy="-54" r="6"/><circle cx="-54" cy="-54" r="6"/><circle cx="54" cy="54" r="6"/><circle cx="-54" cy="54" r="6"/>
    <circle r="13" fill="#1b0f30"/><circle r="5.5" fill="#f3e6ff" stroke="none"/>`,

  cacador: `<g transform="rotate(-45)">
    <path d="M-20-88Q-96 0-20 88L-12 84Q-72 0-12-84Z"/>
    <rect x="-64" y="-13" width="13" height="26" rx="3"/>
    <path d="M-16-86V86" fill="none" stroke="${OURO_LINHA}" stroke-width="1.8"/>
    <circle cx="-16" cy="-87" r="4.5"/><circle cx="-16" cy="87" r="4.5"/>
    <rect x="-82" y="-2.8" width="160" height="5.6" rx="2"/>
    <path d="M98 0 70-14 76 0 70 14Z"/>
    <path d="M-80-2.5-98-16h26l12 13.5ZM-80 2.5-98 16h26l12-13.5Z"/>
  </g>`,

  cleriga: `${raios(16, 50, 96, 74, 9)}
    ${anel(52, 45)}
    <circle r="39"/>
    <circle r="30" fill="#2b1d05"/>
    <path d="M-5-22h10v12h12v10H5v22H-5V0h-12v-10h12z"/>`,

  barbaro: `<g transform="rotate(-28)">
    <rect x="-5" y="-96" width="10" height="190" rx="4"/>
    <path d="M-5-96 0-114 5-96Z"/>
    <path d="${laminaMachado}"/><path transform="scale(-1 1)" d="${laminaMachado}"/>
    <path d="M10-60Q40-64 64-84M10-22Q40-14 66 6" fill="none" stroke-width="1.4"/>
    <path transform="scale(-1 1)" d="M10-60Q40-64 64-84M10-22Q40-14 66 6" fill="none" stroke-width="1.4"/>
    <rect x="-8" y="-12" width="16" height="9" rx="2"/><rect x="-8" y="58" width="16" height="9" rx="2"/>
    <path d="M-8 94h16l-8 14z"/>
  </g>`,

  bardo: `${[-15, -5, 5, 15].map((x) => `<path d="M${x}-40V58" fill="none" stroke="${OURO_LINHA}" stroke-width="2.2"/>`).join('')}
    ${linha('M-12 60C-58 48-68 8-50-30C-42-50-52-72-72-66')}
    ${linha('M12 60C58 48 68 8 50-30C42-50 52-72 72-66')}
    ${linha('M-50-40H50', 8)}
    ${linha('M-30 58Q0 76 30 58', 10)}
    <circle cx="-30" cy="-40" r="5"/><circle cx="-10" cy="-40" r="5"/><circle cx="10" cy="-40" r="5"/><circle cx="30" cy="-40" r="5"/>
    <circle cx="-72" cy="-66" r="7"/><circle cx="72" cy="-66" r="7"/>`,

  dragao: `<path fill="#3d0a04" stroke="#ff8a3d" stroke-opacity="0.5" stroke-width="2" d="M-104 8-80-34-66-14-46-58-30-26-6-70 8-32 34-62 42-26 66-48 68-14 104 6Q0-36-104 8Z"/>
    <path d="M-96 6Q0-74 96 6Q0 74-96 6Z" fill="url(#iris)" stroke="#260500" stroke-width="5"/>
    <g clip-path="url(#olho)" fill="none" stroke="#6b1503" stroke-opacity="0.55">
      <circle r="46" stroke-width="2.5"/><circle r="30" stroke-width="1.5"/>
      ${Array.from({ length: 24 }, (_, k) => `<path transform="rotate(${k * 15})" d="M0-18V-50" stroke-width="1.2"/>`).join('')}
    </g>
    <path d="M0-54Q17 6 0 62Q-17 6 0-54Z" fill="#0a0201"/>
    <ellipse cx="-26" cy="-16" rx="11" ry="5" transform="rotate(-22 -26 -16)" fill="#fff" opacity="0.8" stroke="none"/>`,

  cultista: `<path fill="url(#manto)" stroke="#ff9a5c" stroke-opacity="0.55" stroke-width="2.5" d="M0-94C54-94 78-42 76 8C74 60 70 120 96 210H-96C-70 120-74 60-76 8-78-42-54-94 0-94Z"/>
    <path d="M0-94C24-62 26-30 22 2M0-94C-24-62-26-30-22 2" fill="none" stroke="#ff9a5c" stroke-opacity="0.22" stroke-width="2"/>
    <path fill="#040102" d="M0-58C32-58 42-26 40 6 38 36 20 54 0 56-20 54-38 36-40 6-42-26-32-58 0-58Z"/>
    <ellipse cx="-14" cy="2" rx="7.5" ry="3.4" fill="#ffc48a"/><ellipse cx="14" cy="2" rx="7.5" ry="3.4" fill="#ffc48a"/>
    <path d="M-34 74Q0 98 34 74" fill="none" stroke="${OURO_LINHA}" stroke-width="2.5"/>
    <path d="M0 92 14 116H-14Z" fill="url(#ouro)" stroke="${CONTORNO}" stroke-width="2"/>`,

  golem: `<path fill="url(#pedra)" stroke="#070a14" stroke-width="3.5" d="M0-98 70-58V58L0 98-70 58V-58Z"/>
    <path d="M0-82 56-48V48L0 82-56 48V-48Z" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>
    <path d="M-44-34-26-10-34 14M38 30 24 44 30 62M-10-80-4-64" fill="none" stroke="#070a14" stroke-width="2"/>
    <g fill="none" stroke="#bfe0ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0-58V58M0-20-26-44M0-20 26-44M0 18-26 42M0 18 26 42"/><circle r="13"/>
    </g>`,
};

// Pecas com cor propria (nao recebem o ouro por cima).
const COR_PROPRIA = new Set(['dragao', 'cultista', 'golem']);

function svg({ a, b, brilho, emblema, escala = 0.82, cy = 140 }) {
  const desenho = EMBLEMAS[emblema];
  const proprio = COR_PROPRIA.has(emblema);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
  <defs>
    <radialGradient id="fundo" cx="50%" cy="34%" r="82%">
      <stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="#040205"/>
    </radialGradient>
    <radialGradient id="luz" cx="50%" cy="35%" r="42%">
      <stop offset="0" stop-color="${brilho}" stop-opacity="0.7"/><stop offset="0.6" stop-color="${brilho}" stop-opacity="0.12"/><stop offset="1" stop-color="${brilho}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vinheta" cx="50%" cy="38%" r="78%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.78"/>
    </radialGradient>
    <linearGradient id="ouro" x1="0" y1="-100" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff7dc"/><stop offset="0.42" stop-color="#f1cf88"/><stop offset="0.56" stop-color="#bf8d3c"/><stop offset="1" stop-color="#f6dea0"/>
    </linearGradient>
    <radialGradient id="iris" cx="0" cy="0" r="80" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6b0"/><stop offset="0.3" stop-color="#ffbd3a"/><stop offset="0.65" stop-color="#e8500e"/><stop offset="1" stop-color="#5c0e02"/>
    </radialGradient>
    <linearGradient id="manto" x1="0" y1="-94" x2="0" y2="210" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5a1c14"/><stop offset="0.5" stop-color="#2a0c09"/><stop offset="1" stop-color="#120405"/>
    </linearGradient>
    <linearGradient id="pedra" x1="-70" y1="-98" x2="70" y2="98" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8a96b4"/><stop offset="0.5" stop-color="#46506c"/><stop offset="1" stop-color="#1f2638"/>
    </linearGradient>
    <clipPath id="olho"><path d="M-96 6Q0-74 96 6Q0 74-96 6Z"/></clipPath>
    <filter id="aura" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="11"/></filter>
    <filter id="grao" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>
    </filter>
    <g id="emblema" stroke-linejoin="round">${desenho}</g>
  </defs>
  <rect width="300" height="400" fill="url(#fundo)"/>
  <g transform="translate(150 ${cy})" stroke="${brilho}" stroke-opacity="0.07" stroke-width="12">
    ${Array.from({ length: 18 }, (_, k) => `<path transform="rotate(${k * 20})" d="M0 0V-300"/>`).join('')}
  </g>
  <rect width="300" height="400" fill="url(#luz)"/>
  <g transform="translate(150 ${cy})" fill="none" stroke="${brilho}">
    <circle r="120" stroke-opacity="0.2" stroke-width="1"/>
    <circle r="112" stroke-opacity="0.42" stroke-width="5" stroke-dasharray="1.2 10.5"/>
    <circle r="104" stroke-opacity="0.22" stroke-width="1"/>
    <path d="M0-104 90 52H-90ZM0 104-90-52H90Z" stroke-opacity="0.1" stroke-width="1"/>
  </g>
  <g transform="translate(150 ${cy}) scale(${escala})">
    <use href="#emblema" fill="${brilho}" stroke="${brilho}" filter="url(#aura)" opacity="0.85"/>
    <use href="#emblema" ${proprio ? 'fill="#1a0f0a" stroke="#1a0f0a"' : `fill="url(#ouro)" stroke="${CONTORNO}" stroke-width="2.5"`}/>
  </g>
  <rect width="300" height="400" filter="url(#grao)"/>
  <rect width="300" height="400" fill="url(#vinheta)"/>
</svg>
`;
}

const itens = {
  personagens: {
    'aldric.svg': { a: '#7a1f27', b: '#2a0a10', brilho: '#ff7a6b', emblema: 'guerreiro', escala: 1.02 },
    'lyra.svg': { a: '#4d2c92', b: '#150a2e', brilho: '#c7a6ff', emblema: 'arcanista' },
    'thorn.svg': { a: '#1f6a3e', b: '#08190f', brilho: '#7ff0a8', emblema: 'cacador', escala: 0.92 },
    'mirela.svg': { a: '#8a6a1c', b: '#251905', brilho: '#ffe48a', emblema: 'cleriga' },
    'brom.svg': { a: '#8a3e14', b: '#220c03', brilho: '#ffad66', emblema: 'barbaro' },
    'seren.svg': { a: '#136b66', b: '#04201e', brilho: '#6ff5ea', emblema: 'bardo', escala: 0.92 },
  },
  bosses: {
    'dragao.svg': { a: '#8a1e06', b: '#1c0402', brilho: '#ff7a2e', emblema: 'dragao', escala: 1.12, cy: 150 },
    'cultista.svg': { a: '#5a2414', b: '#140705', brilho: '#ff9a5c', emblema: 'cultista', escala: 0.8, cy: 132 },
    'golem.svg': { a: '#2c3a5e', b: '#0a0e1a', brilho: '#8fb8ff', emblema: 'golem', escala: 0.92, cy: 145 },
  },
};

for (const [pasta, arquivos] of Object.entries(itens)) {
  fs.mkdirSync(path.join(RAIZ, pasta), { recursive: true });
  for (const [nome, opcoes] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(RAIZ, pasta, nome), svg(opcoes));
  }
}
console.log('Imagens de exemplo geradas.');
