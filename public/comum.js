// Pecas compartilhadas pelas tres telas (telao, mestre, jogador).

import { CONDICAO_POR_ID } from './condicoes.js';

// Cria elementos sem innerHTML: h('div', { class: 'x', onclick }, 'texto', outroNo)
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs ?? {})) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (chave.startsWith('on')) el.addEventListener(chave.slice(2), valor);
    else if (chave === 'style' && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) {
        if (k.startsWith('--')) el.style.setProperty(k, v); // variaveis CSS nao passam por Object.assign
        else el.style[k] = v;
      }
    }
    else el.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

// Icones em traco (24x24), desenhados aqui para a mesa funcionar sem internet.
const ICONES = {
  d20: '<path d="M12 2.5 20.5 7.4v9.2L12 21.5l-8.5-4.9V7.4z"/><path d="M12 7.3 16.5 15h-9z"/><path d="M3.5 7.4 12 7.3l8.5.1M3.5 7.4 7.5 15M20.5 7.4 16.5 15M3.5 16.6l4-1.6M20.5 16.6l-4-1.6M7.5 15 12 21.5l4.5-6.5"/>',
  desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  reticencias: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  editar: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="m3 3 18 18"/><path d="M10.6 5.6c.46-.07.93-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16.5 16.5 0 0 1-2.6 3.4M6.6 6.6C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  coroa: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8z"/><path d="M5 21h14"/>',
  ejetar: '<path d="M12 5 4.5 14h15z"/><path d="M5 19h14"/>',
  play: '<path d="M7 4.8v14.4L19 12z" fill="currentColor"/>',
  anterior: '<path d="m15 18-6-6 6-6"/>',
  proximo: '<path d="m9 18 6-6-6-6"/>',
  parar: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
  faisca: '<path d="m10 3.5 1.8 5.2 5.2 1.8-5.2 1.8L10 17.5l-1.8-5.2L3 10.5l5.2-1.8z"/><path d="m18 14 .9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
  tela: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  lua: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z"/>',
  reiniciar: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  copiar: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  lixo: '<path d="M3 6h18M8 6V4h8v2M5.5 6l1 14h11l1-14M10 10.5v6M14 10.5v6"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  espada: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/>',
  coracao: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  escudo: '<path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 2.5 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5Z"/>',
  cadeado: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  raio: '<path d="M13 2 4 14h7.5l-1 8L20 10h-7.5z"/>',
  gota: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  enviar: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  duplicar: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3M14.5 11.5v6M11.5 14.5h6"/>',
};

export function icone(nome, classe = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ico ${classe}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONES[nome] ?? '';
  return svg;
}

// Mantem a lista de elementos de um container alinhada com `itens`, pela chave `id`.
// Reaproveitar o elemento e o que deixa a barra de vida animar em vez de piscar.
export function sincronizar(pai, itens, criar, atualizar) {
  const existentes = new Map([...pai.children].map((el) => [el.dataset.id, el]));
  itens.forEach((item, i) => {
    let el = existentes.get(item.id);
    if (!el) {
      el = criar(item);
      el.dataset.id = item.id;
    }
    existentes.delete(item.id);
    atualizar(el, item);
    if (pai.children[i] !== el) pai.insertBefore(el, pai.children[i] ?? null);
  });
  existentes.forEach((el) => el.remove());
}

// ---------------- conexao ----------------

// Abre o fluxo em tempo real. EventSource reconecta sozinho se a rede cair.
export function conectar(visao, { aoEstado, aoEvento, aoStatus, pin }) {
  const params = new URLSearchParams({ visao });
  if (pin) params.set('pin', pin);
  const fonte = new EventSource(`/eventos?${params}`);
  fonte.addEventListener('estado', (e) => aoEstado(JSON.parse(e.data)));
  fonte.addEventListener('evento', (e) => aoEvento?.(JSON.parse(e.data)));
  fonte.onopen = () => aoStatus?.(true);
  fonte.onerror = () => aoStatus?.(false);
  return fonte;
}

// ---------------- barras ----------------

export function criarBarra(tipo) {
  return h('div', { class: `barra ${tipo}` },
    h('div', { class: 'rastro' }),
    h('div', { class: 'enchimento' }),
    h('div', { class: 'temp' }),
    h('span', { class: 'valor' }));
}

// A faixa "rastro" desce mais devagar que o enchimento (CSS), mostrando o dano recebido.
export function atualizarBarra(el, atual, max, temp = 0, texto) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0;
  el.querySelector('.enchimento').style.width = `${pct}%`;
  el.querySelector('.rastro').style.width = `${pct}%`;
  el.querySelector('.temp').style.width = `${max > 0 ? Math.min(100, (temp / max) * 100) : 0}%`;
  el.querySelector('.valor').textContent = texto ?? `${atual}/${max}${temp ? ` +${temp}` : ''}`;
  el.classList.toggle('baixo', pct <= 50 && pct > 25);
  el.classList.toggle('critico', pct <= 25);
  el.classList.toggle('zerado', atual <= 0);
}

// Barra de um inimigo, respeitando o quanto o mestre deixou revelar.
export function atualizarBarraInimigo(el, ini) {
  el.dataset.revelar = ini.revelar;
  if (ini.revelar === 'numero') return atualizarBarra(el, ini.pv, ini.pvMax, ini.pvTemp);
  if (ini.revelar === 'barra') return atualizarBarra(el, ini.pct * 100, 100, 0, '');
  if (ini.revelar === 'estado') {
    atualizarBarra(el, ini.caido ? 0 : 0, 100, 0, ini.rotulo);
    el.querySelector('.enchimento').style.width = '0%';
    el.dataset.rotulo = ini.rotulo;
    return;
  }
  atualizarBarra(el, 0, 100, 0, ini.caido ? 'Derrotado' : '???');
}

export function iconesDeCondicoes(ids) {
  return ids.map((id) => {
    const c = CONDICAO_POR_ID[id];
    return c ? h('span', { class: 'cond', title: c.nome }, c.icone) : null;
  });
}

export const iniciais = (nome) => nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

// Retrato: imagem se houver, senao um brasao com as iniciais.
export function atualizarRetrato(el, ent) {
  if (ent.imagem) {
    if (el.dataset.src !== ent.imagem) {
      el.style.backgroundImage = `url("${ent.imagem}")`;
      el.dataset.src = ent.imagem;
    }
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.dataset.src = '';
    el.textContent = iniciais(ent.nome);
  }
}
