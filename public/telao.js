import {
  h, sincronizar, conectar, criarBarra, atualizarBarra, atualizarBarraInimigo,
  iconesDeCondicoes, atualizarRetrato,
} from './comum.js';

const $ = (id) => document.getElementById(id);
const raiz = $('raiz');
const params = new URLSearchParams(location.search);
const sorte = (min, max) => min + Math.random() * (max - min);
const NOME_TIER = { elite: 'Elite', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico' };

if (params.get('fundo') === '1') document.body.classList.add('com-fundo');
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'b') document.body.classList.toggle('com-fundo');
  if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});

// Brasas que sobem atras do boss e poeira dourada do ambiente.
for (let i = 0; i < 34; i += 1) {
  $('brasas').append(h('i', {
    class: `brasa${i % 4 === 0 ? ' quente' : ''}`,
    style: {
      left: `${sorte(4, 96)}%`,
      '--t': `${sorte(2, 6)}px`,
      '--d': `${sorte(4, 9)}s`,
      '--atraso': `${-sorte(0, 9)}s`,
      '--x': `${sorte(-12, 12)}vw`,
      '--y': `${-sorte(40, 75)}vh`,
    },
  }));
}
for (let i = 0; i < 24; i += 1) {
  $('poeira').append(h('i', {
    style: {
      left: `${sorte(0, 100)}%`,
      top: `${sorte(0, 100)}%`,
      '--t': `${sorte(1.5, 3.5)}px`,
      '--d': `${sorte(14, 30)}s`,
      '--atraso': `${-sorte(0, 30)}s`,
      '--x': `${sorte(-8, 8)}vw`,
      '--y': `${sorte(-14, -4)}vh`,
    },
  }));
}

let ultimaInvocacao = null;
let primeiraCarga = true;

// ---------------- herois ----------------

function criarHeroi() {
  return h('div', { class: 'heroi' },
    h('div', { class: 'carta' },
      h('div', { class: 'retrato' }),
      h('div', { class: 'alerta' }),
      h('div', { class: 'info' },
        h('div', { class: 'nome' }, h('span', { class: 'n' })),
        h('div', { class: 'classe' }),
        criarBarra('pv'),
        criarBarra('pm'))),
    h('div', { class: 'aro' }),
    h('div', { class: 'ini' }),
    h('div', { class: 'conds' }),
    h('div', { class: 'na-vez' }, 'Na vez'),
    h('div', { class: 'tag' }, 'Caído'));
}

function atualizarHeroi(el, heroi, indice, atual) {
  el.style.setProperty('--cor', heroi.cor);
  el.style.setProperty('--i', indice);
  atualizarRetrato(el.querySelector('.retrato'), heroi);
  el.querySelector('.n').textContent = heroi.nome;
  el.querySelector('.classe').textContent = [heroi.classe, heroi.nivel ? `Nível ${heroi.nivel}` : ''].filter(Boolean).join(' · ');
  atualizarBarra(el.querySelector('.barra.pv'), heroi.pv, heroi.pvMax, heroi.pvTemp);
  const pm = el.querySelector('.barra.pm');
  pm.style.display = heroi.pmMax ? '' : 'none';
  atualizarBarra(pm, heroi.pm, heroi.pmMax);
  const ini = el.querySelector('.ini');
  ini.textContent = heroi.iniciativa ?? '';
  ini.classList.toggle('visivel', heroi.iniciativa !== null && heroi.iniciativa !== undefined);
  el.querySelector('.conds').replaceChildren(...iconesDeCondicoes(heroi.condicoes));
  el.classList.toggle('caido', heroi.pv <= 0);
  el.classList.toggle('baixo-pv', heroi.pv > 0 && heroi.pv / heroi.pvMax <= 0.25);
  el.classList.toggle('atual', atual === heroi.id);
}

// ---------------- inimigos ----------------

function criarCapanga() {
  return h('div', { class: 'capanga' },
    h('div', { class: 'ini' }),
    h('div', { class: 'retrato' }),
    h('div', { class: 'nome' }),
    criarBarra('pv'),
    h('div', { class: 'conds' }),
    h('div', { class: 'na-vez' }, 'Na vez'));
}

function atualizarCapanga(el, ini, atual) {
  atualizarRetrato(el.querySelector('.retrato'), ini);
  el.querySelector('.nome').textContent = ini.nome;
  atualizarBarraInimigo(el.querySelector('.barra'), ini);
  el.querySelector('.conds').replaceChildren(...iconesDeCondicoes(ini.condicoes));
  const n = el.querySelector('.ini');
  n.textContent = ini.iniciativa ?? '';
  n.classList.toggle('visivel', ini.iniciativa !== null && ini.iniciativa !== undefined);
  el.classList.toggle('caido', ini.caido);
  el.classList.toggle('atual', atual === ini.id);
}

// Com boss, os capangas se dividem nos dois flancos; sem boss, ficam todos no centro.
function atualizarCapangas(capangas, boss, atual) {
  const esq = boss ? capangas.filter((_, i) => i % 2 === 0) : capangas;
  const dir = boss ? capangas.filter((_, i) => i % 2 === 1) : [];
  for (const [flanco, lista] of [[$('flancoEsq'), esq], [$('flancoDir'), dir]]) {
    const n = lista.length;
    flanco.dataset.tam = boss ? (n <= 2 ? 'g' : n <= 4 ? 'm' : 'p') : (n <= 4 ? 'gg' : n <= 6 ? 'g' : n <= 10 ? 'm' : 'p');
    sincronizar(flanco, lista, criarCapanga, (el, ini) => atualizarCapanga(el, ini, atual));
  }
}

// ---------------- boss ----------------

function atualizarBoss(boss, atual) {
  const caixa = $('boss');
  $('campo').classList.toggle('sem-boss', !boss);
  raiz.classList.toggle('boss-ativo', Boolean(boss));
  if (!boss) {
    if (caixa.classList.contains('ativa')) {
      caixa.classList.remove('ativa');
      caixa.classList.add('saindo');
    }
    return;
  }

  caixa.dataset.id = boss.id;
  raiz.dataset.tema = boss.tema;
  for (const t of ['comum', 'elite', 'epico', 'lendario', 'mitico']) raiz.classList.toggle(`tier-${t}`, boss.tier === t);

  $('bossNome').textContent = boss.nome;
  $('bossSub').replaceChildren(...[
    boss.subtitulo ? h('span', {}, boss.subtitulo) : null,
    boss.nd ? h('span', { class: 'nd' }, boss.nd) : null,
  ].filter(Boolean));
  const arte = $('arteBoss');
  if (arte.dataset.src !== boss.imagem) {
    arte.style.backgroundImage = boss.imagem ? `url("${boss.imagem}")` : '';
    arte.dataset.src = boss.imagem;
  }
  $('avisoAmeaca').textContent = NOME_TIER[boss.tier] ?? '';

  const barra = $('bossBarra');
  if (!barra.firstChild) barra.replaceWith(Object.assign(criarBarra('pv'), { id: 'bossBarra' }));
  atualizarBarraInimigo($('bossBarra'), boss);
  $('bossConds').replaceChildren(...iconesDeCondicoes(boss.condicoes));
  caixa.classList.toggle('caido', boss.caido);
  caixa.classList.toggle('atual', atual === boss.id);

  const ini = $('iniBoss');
  ini.textContent = boss.iniciativa ?? '';
  ini.classList.toggle('visivel', boss.iniciativa !== null && boss.iniciativa !== undefined);

  const habs = $('bossHabs');
  const atuais = [...habs.children].map((c) => c.textContent).join('|');
  if (atuais !== boss.habilidades.join('|')) {
    habs.replaceChildren(...boss.habilidades.map((n, i) => h('div', { class: 'habilidade', style: { animationDelay: `${i * 70}ms` } }, n)));
  }
}

function dispararInvocacao() {
  const caixa = $('boss');
  caixa.classList.remove('ativa', 'saindo');
  void caixa.offsetWidth; // reinicia a animacao
  caixa.classList.add('ativa');
  if (!primeiraCarga) {
    efeito('tremor');
    const clarao = $('clarao');
    clarao.classList.remove('dispara');
    void clarao.offsetWidth;
    clarao.classList.add('dispara');
  }
}

// ---------------- ordem de turno ----------------

function atualizarOrdem(turnos) {
  $('ordem').classList.toggle('ativa', turnos.ativo && turnos.ordem.length > 0);
  $('rodada').replaceChildren(h('small', {}, 'Rodada'), h('b', {}, turnos.rodada));
  const pos = turnos.ordem.findIndex((o) => o.id === turnos.atual);
  sincronizar($('fila'), turnos.ordem,
    () => h('div', { class: 'ficha' }, h('div', { class: 'retrato' }), h('span', { class: 'ini' }), h('span', { class: 'nome-ficha' })),
    (el, o) => {
      atualizarRetrato(el.querySelector('.retrato'), o);
      el.style.setProperty('--cor', o.cor ?? 'var(--inimigo)');
      el.classList.toggle('inimiga', o.lado === 'inimigos');
      el.classList.toggle('atual', o.id === turnos.atual);
      el.classList.toggle('passou', pos >= 0 && turnos.ordem.indexOf(o) < pos);
      el.querySelector('.ini').textContent = o.iniciativa;
      el.querySelector('.nome-ficha').textContent = o.nome;
      el.title = o.nome;
    });
}

// ---------------- vitrine (imagem mostrada aos jogadores) ----------------

let vitrineId = null;
let vitrineTam = null;

// Ocupa o maximo da tela sem distorcer; foto pequena cresce no maximo 2,5x (SVG cresce a vontade).
function ajustarVitrine() {
  if (!vitrineTam) return;
  const { w, h: alt, vetor } = vitrineTam;
  const titulo = $('vitrineTitulo');
  const espacoAlt = innerHeight * 0.86 - (titulo.hidden ? 0 : titulo.offsetHeight + innerHeight * 0.026);
  const s = Math.min((innerWidth * 0.84) / w, espacoAlt / alt, vetor ? Infinity : 2.5);
  Object.assign($('vitrineImg').style, { width: `${Math.round(w * s)}px`, height: `${Math.round(alt * s)}px` });
}
addEventListener('resize', ajustarVitrine);

function atualizarVitrine(mostrar) {
  const vitrine = $('vitrine');
  if (!mostrar) {
    vitrine.classList.remove('aberta');
    vitrineId = null;
    return;
  }
  const titulo = $('vitrineTitulo');
  titulo.hidden = !mostrar.titulo;
  titulo.firstElementChild.textContent = mostrar.titulo;
  if (mostrar.id === vitrineId) return ajustarVitrine(); // so mudou o titulo
  vitrineId = mostrar.id;

  // Carrega antes de abrir, para a moldura ja surgir no tamanho certo.
  const previa = new Image();
  previa.onload = () => {
    if (vitrineId !== mostrar.id) return; // o mestre ja trocou de imagem
    vitrineTam = { w: previa.naturalWidth || 800, h: previa.naturalHeight || 600, vetor: /\.svg$/i.test(mostrar.imagem) };
    $('vitrineImg').src = previa.src;
    ajustarVitrine();
    vitrine.classList.remove('aberta');
    void vitrine.offsetWidth; // reinicia a animacao de entrada
    vitrine.classList.add('aberta');
  };
  previa.src = mostrar.imagem;
}

// ---------------- estado ----------------

function aoEstado(estado) {
  const atual = estado.turnos.ativo ? estado.turnos.atual : null;
  const boss = estado.inimigos.find((i) => i.id === estado.cena.bossId) ?? null;
  const capangas = estado.inimigos.filter((i) => i.id !== estado.cena.bossId);

  sincronizar($('grupo'), estado.aliados, criarHeroi, (el, hr) => atualizarHeroi(el, hr, estado.aliados.indexOf(hr), atual));
  atualizarCapangas(capangas, boss, atual);
  atualizarBoss(boss, atual);
  atualizarOrdem(estado.turnos);
  atualizarVitrine(estado.cena.mostrar);

  if (boss && estado.cena.idInvocacao !== ultimaInvocacao) dispararInvocacao();
  ultimaInvocacao = boss ? estado.cena.idInvocacao : null;
  primeiraCarga = false;
}

// ---------------- efeitos ----------------

const SVG = 'http://www.w3.org/2000/svg';

// Linha quebrada de (x0,y0) ate (x1,y1), em coordenadas 0..100 da tela.
function trilha(x0, y0, x1, y1, passos, desvio) {
  return Array.from({ length: passos + 1 }, (_, i) => {
    const t = i / passos;
    const solto = i === 0 || i === passos ? 0 : (Math.random() - 0.5) * desvio;
    return [x0 + (x1 - x0) * t + solto, y0 + (y1 - y0) * t];
  });
}

function desenharRaio() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('raio-svg');
  const tronco = trilha(sorte(35, 65), -2, sorte(40, 60), sorte(58, 78), 16, 9);
  const ramos = [tronco];
  for (let r = 0; r < 3; r += 1) {
    const [x, y] = tronco[Math.floor(sorte(3, tronco.length - 4))];
    ramos.push(trilha(x, y, x + sorte(-24, 24), y + sorte(12, 26), 7, 6));
  }
  ramos.forEach((pontos, i) => {
    const d = `M${pontos.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
    for (const camada of ['halo', 'nucleo']) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `${camada}${i ? ' ramo' : ''}`);
      svg.append(path);
    }
  });
  return svg;
}

function particulas(n) {
  return Array.from({ length: n }, () => h('i', {
    class: 'particula',
    style: {
      left: `${sorte(0, 100)}%`,
      '--t': `${sorte(3, 8)}px`,
      '--d': `${sorte(1.4, 2.4)}s`,
      '--atraso': `${sorte(0, 0.7)}s`,
      '--x': `${sorte(-6, 6)}vw`,
    },
  }));
}

function efeito(nome) {
  if (nome === 'tremor') {
    raiz.classList.remove('tremendo');
    void raiz.offsetWidth;
    raiz.classList.add('tremendo');
    return;
  }
  const camada = h('div', { class: `fx-camada fx-${nome}` });
  if (nome === 'raio') camada.append(desenharRaio());
  if (nome === 'cura' || nome === 'fogo') camada.append(...particulas(nome === 'cura' ? 36 : 44));
  $('fx').append(camada);
  if (nome === 'raio') efeito('tremor');
  setTimeout(() => camada.remove(), 3000);
}

// Quem cai ganha o carimbo "Caido"/"Derrotado" pelo proprio estado; aqui so os numeros.
function flutuante(caixa, classe, texto) {
  const el = h('div', { class: `flutuante ${classe}` }, texto);
  caixa.append(el);
  setTimeout(() => el.remove(), 1700);
}

function aoEvento(ev) {
  if (ev.tipo === 'fx') return efeito(ev.efeito);
  const elemento = document.querySelector(`#grupo > [data-id="${ev.alvo}"], .flanco > [data-id="${ev.alvo}"], #boss[data-id="${ev.alvo}"]`);
  if (!elemento) return;
  const caixa = elemento.id === 'boss' ? $('molduraBoss') : elemento;

  if (ev.tipo === 'dano') {
    elemento.classList.remove('tomou-dano');
    void elemento.offsetWidth;
    elemento.classList.add('tomou-dano');
    setTimeout(() => elemento.classList.remove('tomou-dano'), 600);
  }
  if (ev.valor !== null && ev.valor !== undefined) {
    const pm = ev.tipo === 'pmGasta' || ev.tipo === 'pmRecupera';
    const sinal = ev.tipo === 'dano' || ev.tipo === 'pmGasta' ? '−' : '+';
    flutuante(caixa, `${pm ? 'pm' : ev.tipo}${ev.tipo === 'dano' && ev.valor >= 20 ? ' forte' : ''}`, `${sinal}${ev.valor}`);
  }
}

conectar('telao', {
  aoEstado,
  aoEvento,
  aoStatus: (ok) => $('conexao').classList.toggle('visivel', !ok),
});
