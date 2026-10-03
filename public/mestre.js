import {
  h, sincronizar, conectar, criarBarra, atualizarBarra, iconesDeCondicoes, atualizarRetrato, icone,
} from './comum.js';
import { CONDICOES, EFEITOS, TEMAS, TIERS, REVELAR } from './condicoes.js';

const $ = (id) => document.getElementById(id);
const NOME_REVELAR = { oculto: '🙈 PV oculto', estado: '💬 Só o estado', barra: '▮ Só a barra', numero: '🔢 Número exato' };
const NOME_TIER = { comum: 'Comum', elite: 'Elite', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico' };
const NOME_TEMA = { fogo: '🔥 Fogo', gelo: '❄️ Gelo', trevas: '🌑 Trevas', arcano: '🔮 Arcano', luz: '☀️ Luz', veneno: '☠️ Veneno', sangue: '🩸 Sangue' };

let estado = null;
let imagens = [];
let enderecoTelao = '';
const pin = sessionStorage.getItem('pin') ?? '';
const selecionados = new Set();
const abertos = new Set(); // cartoes com o "⋯" expandido

// Icones dos elementos fixos do HTML.
document.querySelectorAll('[data-icone]').forEach((el) => el.prepend(icone(el.dataset.icone)));

// Botao com icone e texto opcionais.
const botao = (classe, nomeIcone, texto, attrs = {}) =>
  h('button', { type: 'button', class: `btn ${classe}`.trim(), ...attrs }, nomeIcone ? icone(nomeIcone) : null, texto ? h('span', {}, texto) : null);

// ---------------- comunicacao ----------------

function aviso(texto, tipo = 'erro') {
  const t = $('toast');
  t.textContent = texto;
  t.className = `toast ${tipo} visivel`;
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => t.classList.remove('visivel'), 2800);
}

async function enviar(acao) {
  try {
    const resp = await fetch('/api/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pin': pin },
      body: JSON.stringify(acao),
    });
    const dados = await resp.json();
    if (!dados.ok) aviso(dados.erro ?? 'Algo deu errado.');
    return dados.ok;
  } catch {
    aviso('Sem conexão com o servidor.');
    return false;
  }
}

// ---------------- cartao de combatente ----------------

const lerValor = (campo) => Number.parseInt(campo.value, 10) || 0;

function criarCard(lado) {
  const heroi = lado === 'aliados';
  const id = () => card.dataset.id;
  const campoValor = h('input', { type: 'number', min: '1', class: 'valor', placeholder: 'Valor', title: 'Enter = dano · Shift+Enter = cura' });
  const aplicar = (modo, v) => enviar({ tipo: 'dano', ids: [id()], modo, valor: v ?? lerValor(campoValor) });
  const aplicarCampo = async (modo) => { if (await aplicar(modo)) campoValor.value = ''; };
  campoValor.addEventListener('keydown', (e) => { if (e.key === 'Enter') aplicarCampo(e.shiftKey ? 'cura' : 'dano'); });

  const rapido = (n) => h('button', { type: 'button', class: `btn pequeno rapido ${n < 0 ? 'neg' : 'pos'}`, onclick: () => aplicar(n < 0 ? 'dano' : 'cura', Math.abs(n)) }, n > 0 ? `+${n}` : `−${-n}`);
  const grade = h('div', { class: 'cond-grid' }, CONDICOES.map((c) => h('button', {
    type: 'button',
    'data-cond': c.id,
    onclick: (e) => enviar({ tipo: 'condicao', id: id(), condicao: c.id, ligado: !e.currentTarget.classList.contains('on') }),
  }, h('span', { class: 'emoji' }, c.icone), c.nome)));

  const mais = h('div', { class: 'mais' },
    h('div', { class: 'grupo-m' }, h('span', { class: 'rotulo' }, 'Rápido'), [-10, -5, -1, 1, 5, 10].map(rapido),
      botao('pequeno', 'escudo', 'PV temp', { title: 'Dá PV temporários (usa o valor digitado)', onclick: () => aplicar('temp') })),
    heroi ? h('div', { class: 'grupo-m' }, h('span', { class: 'rotulo' }, 'PM'),
      h('button', { type: 'button', class: 'btn pequeno', onclick: () => aplicar('pmGasta', 1) }, '−1'),
      h('button', { type: 'button', class: 'btn pequeno', onclick: () => aplicar('pmGasta', 3) }, '−3'),
      h('button', { type: 'button', class: 'btn pequeno', onclick: () => aplicar('pmRecupera', 1) }, '+1'),
      botao('pequeno', 'gota', '− valor', { title: 'Gasta o valor digitado', onclick: () => aplicar('pmGasta') }),
      botao('pequeno', 'gota', '+ valor', { title: 'Recupera o valor digitado', onclick: () => aplicar('pmRecupera') })) : null,
    h('div', { class: 'grupo-m alto' }, h('span', { class: 'rotulo' }, 'Condições'), grade),
    heroi ? null : h('div', { class: 'notas', hidden: true }, icone('cadeado'), h('span', { class: 'texto-notas' })));

  const card = h('div', { class: `card ${heroi ? 'heroi' : 'inimigo'}` },
    h('div', { class: 'card-corpo' },
      h('div', {
        class: 'retrato c-retrato',
        title: 'Clique para selecionar (dano em vários de uma vez)',
        onclick: () => {
          selecionados.has(id()) ? selecionados.delete(id()) : selecionados.add(id());
          atualizarSelecao();
        },
      }),
      h('div', { class: 'c-titulo' },
        h('div', { class: 'linha-nome' }, h('b', { class: 'nome' }), h('span', { class: 'tags' })),
        h('small', { class: 'sub' }),
        h('div', { class: 'conds' })),
      h('div', { class: 'c-barras' }, criarBarra('pv'), heroi ? criarBarra('pm') : null),
      h('label', { class: 'c-ini', title: 'Iniciativa' }, h('span', {}, 'Ini'),
        h('input', {
          type: 'number', class: 'ini', placeholder: '–',
          onchange: (e) => enviar({ tipo: 'iniciativa', id: id(), valor: e.target.value === '' ? null : e.target.value }),
        })),
      h('div', { class: 'c-acoes' },
        campoValor,
        botao('dano', 'espada', 'Dano', { onclick: () => aplicarCampo('dano') }),
        botao('cura', 'coracao', 'Cura', { onclick: () => aplicarCampo('cura') }),
        botao('icone btn-mais', 'reticencias', '', {
          title: 'Mais opções: botões rápidos, PM e condições',
          onclick: () => {
            abertos.has(id()) ? abertos.delete(id()) : abertos.add(id());
            mais.classList.toggle('aberto', abertos.has(id()));
            card.querySelector('.btn-mais').classList.toggle('ativo', abertos.has(id()));
          },
        }),
        botao('icone fantasma', 'editar', '', { title: 'Editar', onclick: () => abrirEditor(lado, estado[lado].find((x) => x.id === id())) })),
      heroi ? null : h('div', { class: 'c-controle' },
        h('select', {
          class: 'revelar', title: 'O que os jogadores veem do PV deste inimigo',
          onchange: (e) => enviar({ tipo: 'definir', id: id(), patch: { revelar: e.target.value } }),
        }, REVELAR.map((r) => h('option', { value: r }, NOME_REVELAR[r]))),
        h('button', { type: 'button', class: 'btn icone btn-tela', onclick: (e) => enviar({ tipo: 'definir', id: id(), patch: { naTela: !e.currentTarget.classList.contains('on') } }) }),
        h('button', { type: 'button', class: 'btn btn-boss', onclick: (e) => enviar(e.currentTarget.dataset.ativo === '1' ? { tipo: 'cena', acao: 'retirar' } : { tipo: 'cena', acao: 'invocar', id: id() }) }),
        h('div', { class: 'habs' })),
      mais));
  return card;
}

const tag = (classe, texto) => h('span', { class: `tag-m ${classe}` }, texto);

function atualizarCard(card, ent, lado) {
  const heroi = lado === 'aliados';
  const vez = estado.turnos.ativo && estado.turnos.atual === ent.id;
  const noBoss = !heroi && estado.cena.bossId === ent.id;
  card.style.setProperty('--cor', heroi ? ent.cor : 'var(--inimigo)');
  card.classList.toggle('selecionado', selecionados.has(ent.id));
  card.classList.toggle('caido', ent.pv <= 0);
  card.classList.toggle('atual', vez);
  atualizarRetrato(card.querySelector('.retrato'), ent);
  card.querySelector('.nome').textContent = ent.nome;
  card.querySelector('.sub').textContent = heroi
    ? [ent.classe, ent.nivel && `Nível ${ent.nivel}`, ent.jogador].filter(Boolean).join(' · ')
    : [ent.subtitulo, ent.nd, `Def ${ent.defesa}`].filter(Boolean).join(' · ');
  card.querySelector('.tags').replaceChildren(...[
    vez ? tag('vez', 'Na vez') : null,
    noBoss ? tag('boss', 'Boss') : null,
    !heroi && !ent.naTela && !noBoss ? tag('oculto', 'Oculto') : null,
    ent.pv <= 0 ? tag('caido', heroi ? 'Caído' : 'Derrotado') : null,
  ].filter(Boolean));
  const ini = card.querySelector('.ini');
  if (document.activeElement !== ini) ini.value = ent.iniciativa ?? '';
  atualizarBarra(card.querySelector('.barra.pv'), ent.pv, ent.pvMax, ent.pvTemp);
  if (heroi) {
    const pm = card.querySelector('.barra.pm');
    atualizarBarra(pm, ent.pm, ent.pmMax);
    pm.style.display = ent.pmMax ? '' : 'none';
  }
  card.querySelector('.conds').replaceChildren(...iconesDeCondicoes(ent.condicoes));
  card.querySelectorAll('.cond-grid button').forEach((b) => b.classList.toggle('on', ent.condicoes.includes(b.dataset.cond)));
  card.querySelector('.mais').classList.toggle('aberto', abertos.has(ent.id));
  card.querySelector('.btn-mais').classList.toggle('ativo', abertos.has(ent.id));
  if (heroi) return;

  const sel = card.querySelector('.revelar');
  if (document.activeElement !== sel) sel.value = ent.revelar;
  const tela = card.querySelector('.btn-tela');
  tela.classList.toggle('on', ent.naTela);
  tela.title = ent.naTela ? 'Aparece no telão — clique para esconder' : 'Escondido dos jogadores — clique para mostrar no telão';
  tela.replaceChildren(icone(ent.naTela ? 'olho' : 'olhoFechado'));
  card.classList.toggle('no-boss', noBoss);
  const btn = card.querySelector('.btn-boss');
  btn.dataset.ativo = noBoss ? '1' : '0';
  btn.classList.toggle('ouro', !noBoss);
  btn.classList.toggle('perigo', noBoss);
  btn.replaceChildren(icone(noBoss ? 'ejetar' : 'coroa'), h('span', {}, noBoss ? 'Retirar' : 'Invocar'));
  btn.title = noBoss ? 'Tirar do centro do telão' : 'Invocar no centro do telão';

  card.querySelector('.habs').replaceChildren(...ent.habilidades.map((hab, i) => h('button', {
    type: 'button',
    class: `hab ${hab.ativa ? 'on' : ''}`,
    title: hab.ativa ? 'Aparece no telão — clique para esconder' : 'Escondida — clique para mostrar no telão',
    onclick: () => enviar({ tipo: 'definir', id: ent.id, patch: { habilidades: ent.habilidades.map((x, j) => (j === i ? { ...x, ativa: !x.ativa } : x)) } }),
  }, hab.ativa ? icone('raio') : null, hab.nome)));

  const notas = card.querySelector('.notas');
  notas.hidden = !ent.notas;
  notas.querySelector('.texto-notas').textContent = ent.notas ?? '';
}

// ---------------- turnos ----------------

function atualizarTurnos() {
  const t = estado.turnos;
  $('turnoBarra').replaceChildren(...(t.ativo
    ? [botao('icone', 'anterior', '', { title: 'Turno anterior', onclick: () => enviar({ tipo: 'turno', acao: 'anterior' }) }),
      h('span', { class: 'rodada-m' }, 'Rodada', h('b', {}, t.rodada)),
      botao('ouro proximo', '', 'Próximo', { title: 'Próximo turno (N)', onclick: () => enviar({ tipo: 'turno', acao: 'proximo' }) }),
      botao('icone perigo', 'parar', '', { title: 'Encerrar combate', onclick: () => enviar({ tipo: 'turno', acao: 'encerrar' }) })]
    : [botao('', 'd20', 'Rolar iniciativa', { title: 'd20 + bônus de cada um', onclick: () => enviar({ tipo: 'rolarIniciativa' }) }),
      botao('ouro', 'play', 'Iniciar combate', { onclick: () => enviar({ tipo: 'turno', acao: 'iniciar' }) })]));
  $('turnoBarra').querySelector('.proximo')?.append(icone('proximo'));

  const todos = [
    ...estado.aliados.map((e) => ({ e, lado: 'aliados' })),
    ...estado.inimigos.map((e) => ({ e, lado: 'inimigos' })),
  ].filter(({ e }) => e.iniciativa !== null && e.iniciativa !== undefined).sort((a, b) => b.e.iniciativa - a.e.iniciativa);

  const ordem = $('ordemM');
  ordem.hidden = !todos.length;
  ordem.replaceChildren(h('span', { class: 'faixa-rotulo' }, 'Iniciativa'), ...todos.map(({ e, lado }) => {
    const retrato = h('div', { class: 'retrato' });
    atualizarRetrato(retrato, e);
    const escondido = lado === 'inimigos' && !e.naTela && estado.cena.bossId !== e.id;
    return h('button', {
      type: 'button',
      class: `chip-ordem ${lado === 'inimigos' ? 'inimigo' : ''} ${t.ativo && t.atual === e.id ? 'atual' : ''} ${escondido ? 'oculto' : ''} ${e.pv <= 0 ? 'caido' : ''}`,
      style: { '--cor': lado === 'aliados' ? e.cor : 'var(--inimigo)' },
      title: escondido ? 'Escondido dos jogadores. Clique para dar a vez.' : 'Clique para dar a vez',
      onclick: () => enviar({ tipo: 'turno', acao: 'definir', id: e.id }),
    }, retrato, h('span', { class: 'nome-chip' }, e.nome), h('b', {}, e.iniciativa));
  }));
}

// ---------------- selecao em area ----------------

function atualizarSelecao() {
  const n = selecionados.size;
  $('selecao').hidden = n === 0;
  $('contaSelecao').textContent = `${n} selecionado${n > 1 ? 's' : ''}`;
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('selecionado', selecionados.has(c.dataset.id)));
}

document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', async () => {
  if (await enviar({ tipo: 'dano', ids: [...selecionados], modo: b.dataset.modo, valor: lerValor($('valorSelecao')) })) $('valorSelecao').value = '';
}));
$('selLimpar').onclick = () => { selecionados.clear(); atualizarSelecao(); };

// ---------------- editor ----------------

function campo(rotulo, nome, valor, tipo = 'text', extra = {}) {
  return h('label', {}, rotulo, h('input', { type: tipo, name: nome, value: valor ?? '', ...extra }));
}
function seletor(rotulo, nome, opcoes, atual) {
  return h('label', {}, rotulo, h('select', { name: nome }, opcoes.map(([v, t]) => h('option', { value: v, selected: v === atual }, t))));
}

function abrirEditor(lado, ent) {
  const novo = !ent;
  const heroi = lado === 'aliados';
  const dados = ent ?? (heroi
    ? { nome: '', pvMax: 30, pmMax: 10, defesa: 15, nivel: 1, cor: '#e9c46a', bonusIni: 0 }
    : { nome: '', pvMax: 30, defesa: 12, bonusIni: 0, tema: 'trevas', tier: 'comum', revelar: 'oculto', naTela: true, habilidades: [] });
  const opcoesImagem = [['', '(sem imagem)'], ...imagens.map((i) => [i.url, `${{ bosses: '🐉', galeria: '🖼' }[i.pasta] ?? '🧙'} ${i.nome}`])];
  const form = $('formEditor');
  const previa = h('div', { class: 'retrato previa' });
  const secao = (titulo) => h('div', { class: 'secao-form' }, titulo);

  form.replaceChildren(...[
    h('div', { class: 'cabeca-form' },
      previa,
      h('div', {},
        h('small', {}, novo ? 'Criar' : 'Editar', ' · ', heroi ? 'Herói' : 'Inimigo'),
        h('h3', {}, novo ? (heroi ? 'Novo herói' : 'Novo inimigo') : dados.nome))),
    secao('Identidade'),
    h('div', { class: 'grade' }, campo('Nome', 'nome', dados.nome, 'text', { required: true, maxlength: 40 }),
      heroi ? campo('Classe', 'classe', dados.classe) : campo('Subtítulo', 'subtitulo', dados.subtitulo),
      heroi ? campo('Jogador', 'jogador', dados.jogador) : campo('ND', 'nd', dados.nd)),
    secao('Atributos'),
    h('div', { class: 'grade' }, heroi ? campo('Nível', 'nivel', dados.nivel, 'number', { min: 1, max: 20 }) : null,
      campo('PV máximo', 'pvMax', dados.pvMax, 'number', { min: 1 }),
      novo ? null : campo('PV atual', 'pv', dados.pv, 'number', { min: 0 }),
      heroi ? campo('PM máximo', 'pmMax', dados.pmMax, 'number', { min: 0 }) : null,
      novo || !heroi ? null : campo('PM atual', 'pm', dados.pm, 'number', { min: 0 }),
      campo('Defesa', 'defesa', dados.defesa, 'number', { min: 0 }),
      campo('Bônus de iniciativa', 'bonusIni', dados.bonusIni, 'number')),
    secao('Aparência'),
    seletor('Imagem (arquivos nas pastas personagens/ e bosses/)', 'imagem', opcoesImagem, dados.imagem ?? ''),
    heroi ? campo('Cor do herói', 'cor', dados.cor, 'color') : h('div', { class: 'grade' },
      seletor('Tema do efeito', 'tema', TEMAS.map((t) => [t, NOME_TEMA[t]]), dados.tema),
      seletor('Ameaça (estrela)', 'tier', TIERS.map((t) => [t, NOME_TIER[t]]), dados.tier),
      seletor('Jogadores veem o PV', 'revelar', REVELAR.map((r) => [r, NOME_REVELAR[r]]), dados.revelar)),
    heroi ? null : secao('Mestre'),
    heroi ? null : h('label', {}, 'Efeitos / habilidades do boss (um por linha)', h('textarea', { name: 'habilidades' }, (dados.habilidades ?? []).map((x) => x.nome).join('\n'))),
    heroi ? null : h('label', {}, 'Notas secretas (só você vê)', h('textarea', { name: 'notas' }, dados.notas ?? '')),
    heroi ? null : h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'naTela', checked: Boolean(dados.naTela) }), 'Aparece no telão'),
    h('div', { class: 'rodape' },
      novo ? null : h('div', { class: 'esq' },
        heroi ? null : botao('', 'duplicar', 'Duplicar', { onclick: () => { enviar({ tipo: 'duplicar', id: ent.id }); $('editor').close(); } }),
        botao('perigo', 'lixo', 'Remover', { onclick: () => { if (confirm(`Remover ${ent.nome}?`)) { selecionados.delete(ent.id); enviar({ tipo: 'remover', id: ent.id }); $('editor').close(); } } })),
      botao('fantasma', '', 'Cancelar', { onclick: () => $('editor').close() }),
      h('button', { type: 'submit', class: 'btn ouro' }, icone('check'), h('span', {}, 'Salvar'))),
  ].filter(Boolean));

  const atualizarPrevia = () => {
    atualizarRetrato(previa, { imagem: form.elements.imagem.value, nome: form.elements.nome.value || '?' });
    previa.style.setProperty('--cor', heroi ? form.elements.cor.value : 'var(--inimigo)');
  };
  form.oninput = atualizarPrevia;
  atualizarPrevia();

  form.onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    if (!heroi) {
      d.naTela = form.elements.naTela.checked;
      const antigas = new Map((dados.habilidades ?? []).map((x) => [x.nome, x.ativa]));
      d.habilidades = String(d.habilidades ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((nome) => ({ nome, ativa: antigas.get(nome) ?? false }));
    }
    enviar(novo ? { tipo: 'criar', lado, dados: d } : { tipo: 'definir', id: ent.id, patch: d });
    $('editor').close();
  };
  $('editor').showModal();
}

$('novoAliado').onclick = () => abrirEditor('aliados', null);
$('novoInimigo').onclick = () => abrirEditor('inimigos', null);

// ---------------- topo ----------------

$('fxPainel').replaceChildren(h('span', { class: 'faixa-rotulo' }, 'Efeitos no telão'),
  ...EFEITOS.map((e) => h('button', { type: 'button', class: 'btn efeito', onclick: () => enviar({ tipo: 'fx', efeito: e.id }) }, h('span', { class: 'emoji' }, e.icone), e.nome)));
$('btnFx').onclick = () => { $('fxPainel').hidden = !$('fxPainel').hidden; $('btnFx').classList.toggle('ativo', !$('fxPainel').hidden); };
$('btnDesfazer').onclick = () => enviar({ tipo: 'desfazer' });
$('btnDescanso').onclick = () => { document.querySelector('.menu').open = false; if (confirm('Curar todos os heróis, restaurar PM e remover condições?')) enviar({ tipo: 'descanso' }); };
$('btnReiniciar').onclick = () => { document.querySelector('.menu').open = false; if (confirm('Voltar ao grupo de exemplo? (dá para desfazer)')) enviar({ tipo: 'reiniciar' }); };
$('btnTelao').onclick = () => {
  document.querySelector('.menu').open = false;
  navigator.clipboard?.writeText(enderecoTelao);
  aviso(`Abra no outro aparelho: ${enderecoTelao}`, 'info');
};
addEventListener('click', (e) => {
  const menu = document.querySelector('.menu');
  if (menu.open && !menu.contains(e.target)) menu.open = false;
});

addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'n' || e.key === 'ArrowRight') enviar({ tipo: 'turno', acao: 'proximo' });
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) enviar({ tipo: 'desfazer' });
});

// ---------------- abas ----------------

function abrirAba(aba) {
  document.body.dataset.aba = aba;
  $('abaCombate').hidden = aba !== 'combate';
  $('abaGaleria').hidden = aba !== 'galeria';
  document.querySelectorAll('.aba').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === aba);
    b.setAttribute('aria-selected', String(b.dataset.aba === aba));
  });
  try { localStorage.setItem('mesa-aba', aba); } catch { /* sem armazenamento: so nao lembra a aba */ }
  if (aba === 'galeria') carregarImagens(); // pega tambem o que foi copiado direto para as pastas
}
document.querySelectorAll('.aba').forEach((b) => { b.onclick = () => abrirAba(b.dataset.aba); });

// ---------------- galeria: mostrar imagens aos jogadores ----------------

const NOME_PASTA = { galeria: 'Galeria', personagens: 'Herói', bosses: 'Inimigo' };
const FILTROS = [['tudo', 'Tudo'], ['galeria', 'Galeria'], ['personagens', 'Heróis'], ['bosses', 'Inimigos']];
let filtro = 'tudo';
const novas = new Set(); // recem-enviadas, para destacar

// A pasta de destino acompanha o filtro: no filtro "Heróis" o envio vira token de heroi, etc.
const destino = () => (filtro === 'personagens' || filtro === 'bosses' ? filtro : 'galeria');

// "mapa-da-cidade.jpg" -> "Mapa da cidade". Nome de camera/colado (muitos digitos) fica sem titulo.
function tituloDoArquivo(nome) {
  const base = nome.replace(/\.[^.]+$/, '');
  if (/\d{4,}/.test(base) || base.startsWith('colad')) return '';
  const texto = base.replace(/[-_]+/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const mostrarImagem = (img) => enviar({ tipo: 'mostrar', imagem: img.url, titulo: tituloDoArquivo(img.nome) });
const esconderImagem = () => enviar({ tipo: 'mostrar', acao: 'esconder' });

async function carregarImagens() {
  try {
    imagens = await (await fetch('/api/imagens')).json();
  } catch {
    return;
  }
  desenharGaleria();
}

function criarItem() {
  const item = h('div', { class: 'item-galeria' },
    h('div', { class: 'miniatura' },
      h('span', { class: 'selo-no-ar' }, h('i'), 'No telão'),
      h('button', {
        type: 'button',
        class: 'btn btn-mostrar',
        onclick: () => {
          const img = imagens.find((x) => x.url === item.dataset.id);
          if (estado?.cena.mostrar?.imagem === item.dataset.id) esconderImagem();
          else if (img) mostrarImagem(img);
        },
      })),
    h('div', { class: 'item-rodape' },
      h('span', { class: 'item-nome' }),
      h('span', { class: 'item-pasta' }),
      botao('icone pequeno fantasma btn-remover', 'lixo', '', {
        title: 'Remover (vai para a pasta lixeira/)',
        onclick: async () => {
          const img = imagens.find((x) => x.url === item.dataset.id);
          if (!img || !confirm(`Remover "${img.nome}"?\nO arquivo vai para a pasta lixeira/ e pode ser recuperado.`)) return;
          const resp = await fetch('/api/remover-imagem', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pin': pin }, body: JSON.stringify({ url: img.url }) });
          const dados = await resp.json().catch(() => ({ ok: false, erro: 'Sem resposta do servidor.' }));
          if (!dados.ok) return aviso(dados.erro);
          aviso(`"${img.nome}" foi para a lixeira.`, 'info');
          carregarImagens();
        },
      })));
  return item;
}

function atualizarItem(item, img) {
  const noAr = estado?.cena.mostrar?.imagem === img.url;
  const mini = item.querySelector('.miniatura');
  if (mini.dataset.src !== img.url) {
    mini.style.backgroundImage = `url("${img.url}")`;
    mini.dataset.src = img.url;
  }
  item.querySelector('.item-nome').textContent = img.nome.replace(/\.[^.]+$/, '');
  item.title = img.nome;
  item.querySelector('.item-pasta').textContent = NOME_PASTA[img.pasta] ?? img.pasta;
  item.classList.toggle('no-ar', noAr);
  item.classList.toggle('nova', novas.has(img.url));
  const btn = item.querySelector('.btn-mostrar');
  btn.className = `btn btn-mostrar ${noAr ? 'perigo' : 'ouro'}`;
  btn.replaceChildren(icone(noAr ? 'olhoFechado' : 'tela'), h('span', {}, noAr ? 'Esconder' : 'Mostrar aos jogadores'));
}

function desenharGaleria() {
  const conta = (f) => imagens.filter((i) => f === 'tudo' || i.pasta === f).length;
  $('filtros').replaceChildren(...FILTROS.map(([f, nome]) => h('button', {
    type: 'button',
    class: `filtro ${filtro === f ? 'ativo' : ''}`,
    onclick: () => { filtro = f; desenharGaleria(); },
  }, nome, h('b', {}, conta(f)))));
  $('contaGaleria').textContent = imagens.length;
  $('destinoEnvio').textContent = `Vai para: ${{ galeria: 'Galeria', personagens: 'Heróis (tokens)', bosses: 'Inimigos (tokens)' }[destino()]}`;
  $('soltarDestino').textContent = $('destinoEnvio').textContent;
  const lista = imagens
    .filter((i) => filtro === 'tudo' || i.pasta === filtro)
    .sort((a, b) => b.data - a.data)
    .map((i) => ({ ...i, id: i.url }));
  sincronizar($('itensGaleria'), lista, criarItem, atualizarItem);
}

// Painel "No telão agora" (na galeria) e o atalho no topo, visivel nas duas abas.
function atualizarExibicao() {
  const m = estado.cena.mostrar;
  $('exibindo').hidden = !m;
  $('noTelao').hidden = !m;
  document.querySelector('.ponto-ar').hidden = !m;
  if (!m) return;
  for (const alvo of [$('exibindoImg'), $('noTelaoImg')]) alvo.style.backgroundImage = `url("${m.imagem}")`;
  $('noTelaoTitulo').textContent = m.titulo || m.imagem.split('/').pop().replace(/\.[^.]+$/, '');
  const campo = $('tituloExibindo');
  if (document.activeElement !== campo) campo.value = m.titulo;
}

const salvarTitulo = () => {
  const m = estado?.cena.mostrar;
  if (m && $('tituloExibindo').value.trim() !== m.titulo) enviar({ tipo: 'mostrar', imagem: m.imagem, titulo: $('tituloExibindo').value });
};
$('tituloExibindo').addEventListener('change', salvarTitulo);
$('tituloExibindo').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.currentTarget.blur(); });
$('btnEsconder').onclick = esconderImagem;
$('noTelaoEsconder').onclick = esconderImagem;
$('noTelaoIr').onclick = () => abrirAba('galeria');

// ---------------- envio de imagens ----------------

const EH_IMAGEM = /\.(png|jpe?g|webp|gif|svg)$/i;

async function enviarArquivos(arquivos) {
  const lista = [...arquivos].filter((f) => f.type.startsWith('image/') || EH_IMAGEM.test(f.name));
  if (!lista.length) return aviso('Nenhuma imagem encontrada. Use PNG, JPG, WEBP, GIF ou SVG.');
  if (document.body.dataset.aba !== 'galeria') abrirAba('galeria');
  const pasta = destino();
  aviso(lista.length > 1 ? `Enviando ${lista.length} imagens…` : 'Enviando imagem…', 'info');
  let certas = 0;
  for (const f of lista) {
    // Imagem colada (print, copiar imagem) chega sem nome de verdade.
    const colada = !f.name || /^image\.\w+$/i.test(f.name);
    const nome = colada ? `colada-${Date.now()}.${(f.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')}` : f.name;
    try {
      const resp = await fetch(`/api/enviar-imagem?pasta=${pasta}`, {
        method: 'POST',
        headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-nome': encodeURIComponent(nome), 'x-pin': pin },
        body: f,
      });
      const dados = await resp.json();
      if (!dados.ok) { aviso(dados.erro); continue; }
      certas += 1;
      novas.add(dados.url);
      setTimeout(() => { novas.delete(dados.url); desenharGaleria(); }, 2500);
    } catch {
      aviso('Sem conexão com o servidor.');
    }
  }
  await carregarImagens();
  if (certas) aviso(certas > 1 ? `${certas} imagens enviadas.` : 'Imagem enviada.', 'info');
}

$('btnEnviar').onclick = () => $('arquivos').click();
$('arquivos').onchange = (e) => { enviarArquivos(e.target.files); e.target.value = ''; };

// Arrastar arquivos para qualquer lugar do painel.
let profundidade = 0;
const temArquivos = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
addEventListener('dragenter', (e) => { if (temArquivos(e)) { profundidade += 1; document.body.classList.add('arrastando'); } });
addEventListener('dragleave', (e) => { if (temArquivos(e) && --profundidade <= 0) { profundidade = 0; document.body.classList.remove('arrastando'); } });
addEventListener('dragover', (e) => { if (temArquivos(e)) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!temArquivos(e)) return;
  e.preventDefault();
  profundidade = 0;
  document.body.classList.remove('arrastando');
  enviarArquivos(e.dataTransfer.files);
});

// Ctrl+V com uma imagem copiada (print, "copiar imagem" do navegador).
addEventListener('paste', (e) => {
  const arquivos = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (!arquivos.length) return;
  e.preventDefault();
  enviarArquivos(arquivos);
});

// ---------------- estado ----------------

function aoEstado(novo) {
  estado = novo;
  const ids = new Set([...novo.aliados, ...novo.inimigos].map((x) => x.id));
  for (const id of [...selecionados]) if (!ids.has(id)) selecionados.delete(id);
  sincronizar($('listaAliados'), novo.aliados, () => criarCard('aliados'), (el, e) => atualizarCard(el, e, 'aliados'));
  sincronizar($('listaInimigos'), novo.inimigos, () => criarCard('inimigos'), (el, e) => atualizarCard(el, e, 'inimigos'));
  $('contaAliados').textContent = novo.aliados.length;
  $('contaInimigos').textContent = novo.inimigos.length;
  atualizarTurnos();
  atualizarSelecao();
  atualizarExibicao();
  desenharGaleria();
}

function aoStatus(ok) {
  $('status').classList.toggle('on', ok);
  $('status').querySelector('span').textContent = ok ? 'Ao vivo' : 'Sem conexão';
}

async function iniciar() {
  const info = await (await fetch('/api/info', { headers: { 'x-pin': pin } })).json();
  if (!info.mestre) {
    const bloqueio = $('bloqueio');
    bloqueio.hidden = false;
    bloqueio.replaceChildren(h('div', { class: 'cartao-bloqueio' },
      h('span', { class: 'emblema' }, icone('cadeado')),
      h('h2', {}, 'Painel do mestre'),
      info.precisaPin
        ? [h('p', {}, 'Digite o PIN do mestre para entrar.'),
          h('form', {
            class: 'linha-pin',
            onsubmit: (e) => { e.preventDefault(); sessionStorage.setItem('pin', $('campoPin').value); location.reload(); },
          }, h('input', { type: 'password', id: 'campoPin', placeholder: 'PIN', autofocus: true }), h('button', { class: 'btn ouro' }, 'Entrar'))]
        : h('p', {}, 'O painel do mestre só abre no computador onde o programa está rodando (endereço localhost). A outra tela deve abrir /telao.')));
    return;
  }

  imagens = await (await fetch('/api/imagens')).json();
  let aba = 'combate';
  try { aba = localStorage.getItem('mesa-aba') === 'galeria' ? 'galeria' : 'combate'; } catch { /* sem armazenamento */ }
  abrirAba(aba);
  enderecoTelao = `${info.enderecos[0] ?? location.origin}/telao?fundo=1`;
  conectar('mestre', { pin, aoEstado, aoStatus });
}

iniciar();
