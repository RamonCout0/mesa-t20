// Editor completo da ficha, dentro da mesa: regra da casa, item magico, magia propria (homebrew),
// subir de nivel... sem precisar voltar ao Nimb. Usado no painel do mestre e no celular.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../estilos/editor-ficha.css';
import { PERICIAS, type Ficha, type MagiaPropria, type Poder } from '../../shared/ficha.ts';
import { ATRIBUTOS, NOME_ATRIBUTO, NOME_DANO, TIPOS_DANO, type Ataque, type Atributo, type TipoDano } from '../../shared/tipos.ts';
import { MAGIAS, buscarMagia } from '../../shared/magias.ts';
import { CONDICOES } from '../../shared/condicoes.ts';
import { expressaoValida } from '../../shared/rolagem.ts';
import { Icone } from './Icone.tsx';
import { EXECUCOES, NOME_EXECUCAO, execucaoDoTexto, type Execucao } from '../../shared/execucao.ts';
import { CLASSES, acharClasse, calcular, equipamentoVazio, type Equipamento } from '../../shared/regras-ficha.ts';

type Aba = 'identidade' | 'atributos' | 'pericias' | 'ataques' | 'magias' | 'poderes' | 'notas';
const ABAS: [Aba, string][] = [
  ['identidade', 'Identidade'], ['atributos', 'Atributos'], ['pericias', 'Perícias'], ['ataques', 'Ataques'],
  ['magias', 'Magias'], ['poderes', 'Poderes e itens'], ['notas', 'Notas'],
];

const ARQUETIPOS: [Ataque['arquetipo'], string][] = [
  ['corte', 'Corte (espada)'], ['perfuracao', 'Perfuração (lança, adaga)'], ['impacto', 'Impacto (maça, martelo)'], ['flecha', 'Flecha (arco)'],
  ['virote', 'Virote (besta)'], ['tiro', 'Tiro (arma de fogo)'], ['arremesso', 'Arremesso'], ['natural', 'Natural (garras, mordida)'],
];
const ANIMS: [string, string][] = [
  ['projetil', 'Projétil'], ['raio', 'Raio'], ['explosao', 'Explosão'], ['cone', 'Cone'], ['toque', 'Toque'], ['queda', 'Cai do céu'],
  ['chao', 'Sai do chão'], ['aura', 'Aura'], ['cura', 'Cura'], ['mental', 'Mental'], ['ilusao', 'Ilusão'], ['dreno', 'Dreno'],
  ['escudo', 'Escudo'], ['campo', 'Campo / névoa'], ['onda', 'Onda'], ['sopro', 'Sopro'], ['palavra', 'Palavra de poder'],
];
const ELEMENTOS: [string, string][] = [
  ['arcano', 'Arcano'], ['fogo', 'Fogo'], ['frio', 'Frio'], ['eletricidade', 'Eletricidade'], ['acido', 'Ácido'], ['luz', 'Luz'],
  ['trevas', 'Trevas'], ['psiquico', 'Psíquico'], ['natureza', 'Natureza'], ['terra', 'Terra'], ['agua', 'Água'], ['ar', 'Ar'],
  ['som', 'Som'], ['veneno', 'Veneno'], ['sangue', 'Sangue'], ['tormenta', 'Tormenta'], ['espirito', 'Espírito'], ['tempo', 'Tempo'],
];
const ALVOS: [MagiaPropria['efeito']['alvo'], string][] = [
  ['inimigo', '1 inimigo'], ['inimigos', 'Vários inimigos / área'], ['aliado', '1 aliado (ou você)'], ['aliados', 'Vários aliados'],
  ['si', 'Só você'], ['qualquer', '1 criatura qualquer'], ['nenhum', 'Sem alvo (ambiente)'],
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** RD da ficha em texto ("5, fogo 10") e de volta. */
function rdParaTexto(rd: Ficha['rd']) {
  return Object.entries(rd).map(([t, n]) => (t === 'geral' ? String(n) : `${NOME_DANO[t as TipoDano]} ${n}`)).join(', ');
}
function textoParaRd(texto: string): Ficha['rd'] {
  const rd: Ficha['rd'] = {};
  for (const parte of texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(?:([a-zà-ú]+)\s+)?(\d+)$/i.exec(parte);
    if (!m) continue;
    const tipo = m[1] ? TIPOS_DANO.find((t) => semAcento(NOME_DANO[t]) === semAcento(m[1])) : 'geral';
    if (tipo) rd[tipo] = Number(m[2]);
  }
  return rd;
}

const novoAtaque = (): Ataque => ({
  id: `novo${Date.now()}`, nome: 'Novo ataque', bonus: 0, dano: '1d6', tipoDano: 'corte', margem: 20, mult: 2, alcance: '', distancia: false, arquetipo: 'corte',
});
const novaMagia = (): MagiaPropria => ({
  id: `propria-${Math.random().toString(36).slice(2, 9)}`, nome: 'Nova magia', circulo: 1, execucao: 'padrão', alcance: 'curto', duracao: 'instantânea',
  descricao: '', efeito: { alvo: 'inimigo', maxAlvos: 1, dano: '2d6', tipoDano: 'fogo', anim: { tipo: 'projetil', elemento: 'fogo' } },
});

interface Props {
  ficha: Ficha;
  /** Pode mexer nas regras (numeros, ataques, magias). Sem isso, so aparencia e notas. */
  completo: boolean;
  salvar: (patch: Record<string, unknown>) => Promise<boolean>;
  fechar: () => void;
  /** Acesso a biblioteca da casa (x-codigo do jogador ou x-pin do mestre). */
  cabecalhos?: Record<string, string>;
  /** O mestre pode guardar itens, poderes e magias na biblioteca da casa. */
  mestre?: boolean;
}

interface BibliotecaCasa { itens: Poder[]; poderes: Poder[]; magias: MagiaPropria[] }
type TipoCasa = keyof BibliotecaCasa;

export function EditorFicha({ ficha, completo, salvar, fechar, cabecalhos = {}, mestre = false }: Props) {
  const [f, setF] = useState<Ficha>(() => structuredClone(ficha));
  const [aba, setAba] = useState<Aba>('identidade');
  const [rdTexto, setRdTexto] = useState(() => rdParaTexto(ficha.rd));
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null); // magia propria aberta para editar

  const mudar = (patch: Partial<Ficha>) => setF((x) => ({ ...x, ...patch }));

  // Biblioteca da casa: itens, poderes e magias do grupo para pôr em qualquer ficha.
  const [casa, setCasa] = useState<BibliotecaCasa | null>(null);
  const [msgCasa, setMsgCasa] = useState('');
  useEffect(() => {
    fetch('/api/casa', { headers: cabecalhos }).then((r) => r.json()).then((r) => { if (r.ok) setCasa(r.casa); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = mestre ? async (tipo: TipoCasa, item: Poder | MagiaPropria) => {
    try {
      const resp = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify({ acao: 'guardar', tipo, item }) });
      const r = await resp.json();
      if (!r.ok) throw new Error(r.erro);
      setCasa(r.casa);
      setMsgCasa(`“${item.nome}” ${r.resultado === 'atualizado' ? 'atualizado' : 'guardado'} na biblioteca da casa: agora dá para pôr em qualquer ficha.`);
    } catch (e) {
      setMsgCasa((e as Error).message || 'Não consegui guardar.');
    }
  } : undefined;
  const sujo = JSON.stringify(f) !== JSON.stringify(ficha) || rdTexto !== rdParaTexto(ficha.rd);

  const enviar = async () => {
    setSalvando(true);
    const patch: Record<string, unknown> = completo
      ? {
        nome: f.nome, jogador: f.jogador, raca: f.raca, origem: f.origem, classe: f.classe, nivel: f.nivel, divindade: f.divindade,
        atributos: f.atributos, pvMax: f.pvMax, pmMax: f.pmMax, defesa: f.defesa, deslocamento: f.deslocamento, rd: textoParaRd(rdTexto),
        pericias: f.pericias, ataques: f.ataques, magias: f.magias, magiasProprias: f.magiasProprias, atributoChave: f.atributoChave,
        bonusCd: f.bonusCd, poderes: f.poderes, itens: f.itens, proficiencias: f.proficiencias, equipamento: f.equipamento, notas: f.notas,
      }
      : { jogador: f.jogador, notas: f.notas };
    const ok = await salvar(patch);
    setSalvando(false);
    if (ok) fechar();
  };

  const sair = () => { if (!sujo || confirm('Sair sem salvar as mudanças?')) fechar(); };

  return (
    <div className="ed-fundo" onClick={sair}>
      <div className="ed-ficha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Editar ficha de ${ficha.nome}`}>
        <header className="ed-topo">
          <div>
            <small>Editar ficha</small>
            <h2>{f.nome || 'Sem nome'}</h2>
          </div>
          <button type="button" className="ed-x" onClick={sair} aria-label="Fechar"><Icone nome="fechar" /></button>
        </header>
        {msgCasa ? <p className="ed-aviso" onClick={() => setMsgCasa('')}>{msgCasa}</p> : null}
        {!completo ? <p className="ed-aviso">O mestre deixou só as anotações livres. Para mudar números, ataques ou magias, peça ao mestre.</p> : null}
        <nav className="ed-abas">
          {ABAS.map(([id, nome]) => (
            <button key={id} type="button" className={aba === id ? 'on' : ''} disabled={!completo && id !== 'notas' && id !== 'identidade'} onClick={() => setAba(id)}>{nome}</button>
          ))}
        </nav>

        <div className="ed-corpo">
          {aba === 'identidade' ? (
            <div className="ed-grade">
              <Campo rotulo="Nome"><input value={f.nome} maxLength={40} disabled={!completo} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
              <Campo rotulo="Jogador"><input value={f.jogador} maxLength={30} onChange={(e) => mudar({ jogador: e.target.value })} /></Campo>
              <Campo rotulo="Raça"><input value={f.raca} maxLength={30} disabled={!completo} onChange={(e) => mudar({ raca: e.target.value })} /></Campo>
              <Campo rotulo="Origem"><input value={f.origem} maxLength={40} disabled={!completo} onChange={(e) => mudar({ origem: e.target.value })} /></Campo>
              <Campo rotulo="Classe"><input value={f.classe} maxLength={40} disabled={!completo} onChange={(e) => mudar({ classe: e.target.value })} /></Campo>
              <Campo rotulo="Nível"><input type="number" min={1} max={20} value={f.nivel} disabled={!completo} onChange={(e) => mudar({ nivel: Number(e.target.value) || 1 })} /></Campo>
              <Campo rotulo="Divindade"><input value={f.divindade} maxLength={30} disabled={!completo} onChange={(e) => mudar({ divindade: e.target.value })} /></Campo>
            </div>
          ) : null}

          {aba === 'atributos' ? (
            <>
              <CalculoPelaRegra f={f} mudar={mudar} />
              <div className="ed-atributos">
                {ATRIBUTOS.map((a) => (
                  <label key={a}>
                    <span>{a.toUpperCase()}</span>
                    <input type="number" min={-5} max={20} value={f.atributos[a]} onChange={(e) => mudar({ atributos: { ...f.atributos, [a]: Number(e.target.value) || 0 } })} />
                  </label>
                ))}
              </div>
              <div className="ed-grade">
                <Campo rotulo="PV máximo"><input type="number" min={1} value={f.pvMax} onChange={(e) => mudar({ pvMax: Number(e.target.value) || 1 })} /></Campo>
                <Campo rotulo="PM máximo"><input type="number" min={0} value={f.pmMax} onChange={(e) => mudar({ pmMax: Number(e.target.value) || 0 })} /></Campo>
                <Campo rotulo="Defesa"><input type="number" min={0} value={f.defesa} onChange={(e) => mudar({ defesa: Number(e.target.value) || 0 })} /></Campo>
                <Campo rotulo="Deslocamento (m)"><input type="number" min={0} value={f.deslocamento} onChange={(e) => mudar({ deslocamento: Number(e.target.value) || 0 })} /></Campo>
                <Campo rotulo="Redução de dano (ex.: 5, fogo 10)"><input value={rdTexto} placeholder="nenhuma" onChange={(e) => setRdTexto(e.target.value)} /></Campo>
                <Campo rotulo="Atributo-chave das magias">
                  <select value={f.atributoChave ?? ''} onChange={(e) => mudar({ atributoChave: (e.target.value || null) as Atributo | null })}>
                    <option value="">Não lança magias</option>
                    {ATRIBUTOS.map((a) => <option key={a} value={a}>{NOME_ATRIBUTO[a]}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Bônus extra na CD"><input type="number" value={f.bonusCd} onChange={(e) => mudar({ bonusCd: Number(e.target.value) || 0 })} /></Campo>
              </div>
            </>
          ) : null}

          {aba === 'pericias' ? (
            <div className="ed-pericias">
              {PERICIAS.map((p) => {
                const x = f.pericias[p] ?? { total: 0, treinada: false, atributo: 'des' as Atributo };
                const mudarP = (patch: Partial<typeof x>) => mudar({ pericias: { ...f.pericias, [p]: { ...x, ...patch } } });
                return (
                  <div key={p} className={`ed-pericia ${x.treinada ? 'treinada' : ''}`}>
                    <label className="ed-check" title="Treinada"><input type="checkbox" checked={x.treinada} onChange={(e) => mudarP({ treinada: e.target.checked })} /></label>
                    <span>{x.rotulo ?? p}</span>
                    <input type="number" value={x.total} onChange={(e) => mudarP({ total: Number(e.target.value) || 0 })} aria-label={`Total de ${p}`} />
                  </div>
                );
              })}
            </div>
          ) : null}

          {aba === 'ataques' ? (
            <div className="ed-lista">
              {f.ataques.map((a, i) => {
                const mudarA = (patch: Partial<Ataque>) => mudar({ ataques: f.ataques.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={a.id} className="ed-item">
                    <div className="ed-grade">
                      <Campo rotulo="Nome"><input value={a.nome} maxLength={40} onChange={(e) => mudarA({ nome: e.target.value })} /></Campo>
                      <Campo rotulo="Bônus de ataque"><input type="number" value={a.bonus} onChange={(e) => mudarA({ bonus: Number(e.target.value) || 0 })} /></Campo>
                      <Campo rotulo="Dano"><input value={a.dano} className={expressaoValida(a.dano) ? '' : 'invalido'} placeholder="1d8+3" onChange={(e) => mudarA({ dano: e.target.value })} /></Campo>
                      <Campo rotulo="Tipo de dano">
                        <select value={a.tipoDano} onChange={(e) => mudarA({ tipoDano: e.target.value as TipoDano })}>
                          <option value="">—</option>
                          {TIPOS_DANO.map((t) => <option key={t} value={t}>{NOME_DANO[t]}</option>)}
                        </select>
                      </Campo>
                      <Campo rotulo="Crítico (margem / multiplicador)">
                        <div className="ed-par">
                          <input type="number" min={2} max={20} value={a.margem} onChange={(e) => mudarA({ margem: Number(e.target.value) || 20 })} />
                          <select value={a.mult} onChange={(e) => mudarA({ mult: Number(e.target.value) })}>
                            {[2, 3, 4, 5].map((m) => <option key={m} value={m}>×{m}</option>)}
                          </select>
                        </div>
                      </Campo>
                      <Campo rotulo="Animação">
                        <select value={a.arquetipo} onChange={(e) => mudarA({ arquetipo: e.target.value as Ataque['arquetipo'] })}>
                          {ARQUETIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                      </Campo>
                    </div>
                    <div className="ed-linha">
                      <label className="ed-check"><input type="checkbox" checked={a.distancia} onChange={(e) => mudarA({ distancia: e.target.checked })} />À distância</label>
                      <label className="ed-check"><input type="checkbox" checked={Boolean(a.arremessavel)} onChange={(e) => mudarA({ arremessavel: e.target.checked })} />Pode arremessar</label>
                      <span className="ed-deco" />
                      <button type="button" className="ed-remover" onClick={() => mudar({ ataques: f.ataques.filter((_, j) => j !== i) })}><Icone nome="lixo" />Remover</button>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="ed-mais" onClick={() => mudar({ ataques: [...f.ataques, novoAtaque()] })}><Icone nome="mais" />Novo ataque (arma, item mágico…)</button>
            </div>
          ) : null}

          {aba === 'magias' ? (
            <Magias f={f} mudar={mudar} busca={busca} setBusca={setBusca} aberta={aberta} setAberta={setAberta} daCasa={casa?.magias} guardar={guardar && ((m) => guardar('magias', m))} />
          ) : null}

          {aba === 'poderes' ? (
            <>
              <ListaTextos titulo="Itens mágicos e equipamentos especiais" vazio="Ex.: Anel do Protetor — +2 na Defesa (já some na Defesa da ficha)." itens={f.itens} mudar={(itens) => mudar({ itens })} novo="Novo item" daCasa={casa?.itens} guardar={guardar && ((p) => guardar('itens', p))} />
              <ListaTextos titulo="Poderes e regras da casa" vazio="Habilidades de classe, poderes gerais ou uma regra combinada na mesa." itens={f.poderes} mudar={(poderes) => mudar({ poderes })} novo="Novo poder / regra" daCasa={casa?.poderes} guardar={guardar && ((p) => guardar('poderes', p))} />
              <div className="ed-grade">
                <Campo rotulo="Proficiências"><input value={f.proficiencias} maxLength={600} onChange={(e) => mudar({ proficiencias: e.target.value })} /></Campo>
              </div>
              <Campo rotulo="Equipamento"><textarea value={f.equipamento} maxLength={3000} onChange={(e) => mudar({ equipamento: e.target.value })} /></Campo>
            </>
          ) : null}

          {aba === 'notas' ? (
            <Campo rotulo="Anotações"><textarea className="ed-notas" value={f.notas} maxLength={4000} placeholder="Coisas para lembrar durante a sessão" onChange={(e) => mudar({ notas: e.target.value })} /></Campo>
          ) : null}
        </div>

        <footer className="ed-rodape">
          <span className="ed-dica">{sujo ? 'Mudanças não salvas' : 'Nada mudou ainda'}</span>
          <button type="button" className="ed-btn" onClick={sair}>Cancelar</button>
          <button type="button" className="ed-btn ouro" disabled={!sujo || salvando} onClick={enviar}><Icone nome="check" />{salvando ? 'Salvando…' : 'Salvar ficha'}</button>
        </footer>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="ed-campo"><span>{rotulo}</span>{children}</label>;
}

/** Campos do efeito na mesa (alvo, dano, cura, teste, condicao, duracao, animacao). */
function CamposEfeito({ e, mudarE }: { e: MagiaPropria['efeito']; mudarE: (patch: Partial<MagiaPropria['efeito']>) => void }) {
  const condicao = e.falhou?.[0]?.split(':') ?? [];
  return (
    <div className="ed-grade">
      <Campo rotulo="Alvo">
        <select value={e.alvo} onChange={(ev) => mudarE({ alvo: ev.target.value as MagiaPropria['efeito']['alvo'] })}>
          {ALVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Máximo de alvos (0 = área)"><input type="number" min={0} max={20} value={e.maxAlvos} onChange={(ev) => mudarE({ maxAlvos: Number(ev.target.value) || 0 })} /></Campo>
      <Campo rotulo="Dano"><input value={e.dano ?? ''} placeholder="ex.: 3d6 (vazio = sem dano)" className={e.dano && !expressaoValida(e.dano) ? 'invalido' : ''} onChange={(ev) => mudarE({ dano: ev.target.value || undefined })} /></Campo>
      <Campo rotulo="Tipo de dano">
        <select value={e.tipoDano ?? ''} onChange={(ev) => mudarE({ tipoDano: (ev.target.value || undefined) as TipoDano | undefined })}>
          <option value="">—</option>
          {TIPOS_DANO.map((t) => <option key={t} value={t}>{NOME_DANO[t]}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Cura"><input value={e.cura ?? ''} placeholder="ex.: 2d8+2" className={e.cura && !expressaoValida(e.cura) ? 'invalido' : ''} onChange={(ev) => mudarE({ cura: ev.target.value || undefined })} /></Campo>
      <Campo rotulo="Teste de resistência">
        <div className="ed-par">
          <select value={e.res ?? ''} onChange={(ev) => mudarE({ res: (ev.target.value || undefined) as MagiaPropria['efeito']['res'] })}>
            <option value="">Sem teste</option><option value="fort">Fortitude</option><option value="ref">Reflexos</option><option value="von">Vontade</option>
          </select>
          <select value={e.sucesso ?? 'metade'} disabled={!e.res} onChange={(ev) => mudarE({ sucesso: ev.target.value as MagiaPropria['efeito']['sucesso'] })}>
            <option value="metade">passou: metade</option><option value="anula">passou: anula</option>
          </select>
        </div>
      </Campo>
      <Campo rotulo="Condição (se falhar)">
        <div className="ed-par">
          <select value={condicao[0] ?? ''} onChange={(ev) => mudarE({ falhou: ev.target.value ? [`${ev.target.value}${condicao[1] ? `:${condicao[1]}` : ''}`] : undefined })}>
            <option value="">Nenhuma</option>
            {CONDICOES.filter((c) => !c.extra).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
          </select>
          <input type="number" min={0} max={10} placeholder="rod." title="Rodadas (vazio = até o fim da cena)" value={condicao[1] ?? ''} disabled={!condicao[0]}
            onChange={(ev) => mudarE({ falhou: [`${condicao[0]}${ev.target.value && ev.target.value !== '0' ? `:${ev.target.value}` : ''}`] })} />
        </div>
      </Campo>
      <Campo rotulo="Fica na mesa">
        <select value={e.persistente ?? ''} onChange={(ev) => mudarE({ persistente: (ev.target.value || undefined) as MagiaPropria['efeito']['persistente'] })}>
          <option value="">Não (instantânea)</option><option value="cena">Até o fim da cena</option><option value="sustentada">Sustentada</option><option value="rodadas">Por rodadas (da duração)</option>
        </select>
      </Campo>
      <Campo rotulo="Animação no telão">
        <div className="ed-par">
          <select value={e.anim.tipo} onChange={(ev) => mudarE({ anim: { ...e.anim, tipo: ev.target.value as MagiaPropria['efeito']['anim']['tipo'] } })}>
            {ANIMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <select value={e.anim.elemento} onChange={(ev) => mudarE({ anim: { ...e.anim, elemento: ev.target.value as MagiaPropria['efeito']['anim']['elemento'] } })}>
            {ELEMENTOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      </Campo>
    </div>
  );
}

function ListaTextos({ titulo, vazio, itens, mudar, novo, daCasa, guardar }: {
  titulo: string; vazio: string; itens: Poder[]; mudar: (x: Poder[]) => void; novo: string;
  daCasa?: Poder[]; guardar?: (p: Poder) => void;
}) {
  const mudarI = (i: number, patch: Partial<Poder>) => mudar(itens.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <section className="ed-secao">
      <h3>{titulo}</h3>
      {itens.length ? null : <p className="ed-vazio">{vazio}</p>}
      {itens.map((p, i) => {
        const usavel = Boolean(p.pm || p.efeito || p.bonus);
        return (
          <div key={i} className="ed-item">
            <div className="ed-linha">
              <input className="ed-nome" value={p.nome} placeholder="Nome" maxLength={60} onChange={(e) => mudarI(i, { nome: e.target.value })} />
              {guardar ? <button type="button" className="ed-casa" title="Guardar na biblioteca da casa (usar em outras fichas)" onClick={() => guardar(p)}><Icone nome="livro" /></button> : null}
              <button type="button" className="ed-remover" onClick={() => mudar(itens.filter((_, j) => j !== i))} aria-label="Remover"><Icone nome="lixo" /></button>
            </div>
            <textarea value={p.texto} placeholder="O que faz" maxLength={2000} onChange={(e) => mudarI(i, { texto: e.target.value })} />
            <label className="ed-check" title="Aparece na aba Ações do celular para usar: gasta PM, aplica o efeito e/ou fica ativo com bônus">
              <input
                type="checkbox"
                checked={usavel}
                onChange={(e) => mudarI(i, e.target.checked
                  ? { pm: 1, efeito: { alvo: 'si', maxAlvos: 1, persistente: 'cena', anim: { tipo: 'aura', elemento: 'ouro' } } }
                  : { pm: undefined, efeito: undefined, bonus: undefined })}
              />
              Usar na mesa (custo em PM, efeito, bônus enquanto ativo)
            </label>
            {usavel ? (
              <>
                <div className="ed-grade">
                  <Campo rotulo="Custo (PM)"><input type="number" min={0} max={30} value={p.pm ?? 0} onChange={(e) => mudarI(i, { pm: Number(e.target.value) || 0 })} /></Campo>
                  <Campo rotulo="Execução (reação vale fora da vez)">
                    <select value={p.execucao ?? ''} onChange={(e) => mudarI(i, { execucao: (e.target.value || undefined) as Execucao | undefined })}>
                      <option value="">Pelo texto ({NOME_EXECUCAO[execucaoDoTexto(p.texto)]})</option>
                      {EXECUCOES.map((x) => <option key={x} value={x}>{NOME_EXECUCAO[x]}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Bônus de ataque enquanto ativo"><input type="number" value={p.bonus?.ataque ?? 0} onChange={(e) => mudarI(i, { bonus: { ...p.bonus, ataque: Number(e.target.value) || 0 } })} /></Campo>
                  <Campo rotulo="Bônus de dano enquanto ativo"><input type="number" value={p.bonus?.dano ?? 0} onChange={(e) => mudarI(i, { bonus: { ...p.bonus, dano: Number(e.target.value) || 0 } })} /></Campo>
                  <Campo rotulo="Bônus de Defesa enquanto ativo"><input type="number" value={p.bonus?.defesa ?? 0} onChange={(e) => mudarI(i, { bonus: { ...p.bonus, defesa: Number(e.target.value) || 0 } })} /></Campo>
                </div>
                <details className="ed-mais-efeito">
                  <summary>Efeito ao usar (alvo, dano, cura, teste, condição, animação)</summary>
                  <CamposEfeito
                    e={p.efeito ?? { alvo: 'si', maxAlvos: 1, persistente: 'cena', anim: { tipo: 'aura', elemento: 'ouro' } }}
                    mudarE={(patch) => mudarI(i, { efeito: { ...(p.efeito ?? { alvo: 'si', maxAlvos: 1, persistente: 'cena', anim: { tipo: 'aura', elemento: 'ouro' } }), ...patch } })}
                  />
                </details>
              </>
            ) : null}
          </div>
        );
      })}
      <div className="ed-linha">
        <button type="button" className="ed-mais" onClick={() => mudar([...itens, { nome: '', texto: '' }])}><Icone nome="mais" />{novo}</button>
        <DaCasa lista={daCasa} jaTem={itens.map((x) => x.nome)} pegar={(p) => mudar([...itens, structuredClone(p)])} />
      </div>
    </section>
  );
}

function Magias({ f, mudar, busca, setBusca, aberta, setAberta, daCasa, guardar }: {
  f: Ficha; mudar: (p: Partial<Ficha>) => void; busca: string; setBusca: (s: string) => void; aberta: string | null; setAberta: (s: string | null) => void;
  daCasa?: MagiaPropria[]; guardar?: (m: MagiaPropria) => void;
}) {
  const conhecidas = f.magias.map((id) => buscarMagia(id)).filter((m) => m !== undefined);
  const resultados = useMemo(() => {
    const b = semAcento(busca.trim());
    if (b.length < 2) return [];
    return MAGIAS.filter((m) => !f.magias.includes(m.id) && semAcento(m.nome).includes(b)).slice(0, 12);
  }, [busca, f.magias]);
  const mudarPropria = (i: number, patch: Partial<MagiaPropria>) => mudar({ magiasProprias: f.magiasProprias.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <>
      <section className="ed-secao">
        <h3>Do grimório <small>{conhecidas.length}</small></h3>
        <div className="ed-chips">
          {conhecidas.map((m) => (
            <span key={m.id} className="ed-chip">{m.nome} <i>{m.circulo}º</i>
              <button type="button" aria-label={`Tirar ${m.nome}`} onClick={() => mudar({ magias: f.magias.filter((x) => x !== m.id) })}><Icone nome="fechar" /></button>
            </span>
          ))}
        </div>
        <div className="ed-busca">
          <Icone nome="busca" />
          <input value={busca} placeholder="Aprender magia do livro (digite o nome)…" onChange={(e) => setBusca(e.target.value)} />
        </div>
        {resultados.length ? (
          <ul className="ed-resultados">
            {resultados.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { mudar({ magias: [...f.magias, m.id] }); setBusca(''); }}>
                  <Icone nome="mais" /><b>{m.nome}</b><span>{m.circulo}º · {m.tipo} · {m.fonte}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="ed-secao">
        <h3>Magias próprias (homebrew) <small>{f.magiasProprias.length}</small></h3>
        <p className="ed-vazio">Funcionam na mesa como as do livro: custo pelo círculo, teste de resistência, dano, condição e animação no telão.</p>
        {f.magiasProprias.map((m, i) => {
          const e = m.efeito;
          const mudarE = (patch: Partial<MagiaPropria['efeito']>) => mudarPropria(i, { efeito: { ...e, ...patch } });
          return (
            <div key={m.id} className={`ed-item ed-magia ${aberta === m.id ? 'aberta' : ''}`}>
              <button type="button" className="ed-magia-topo" onClick={() => setAberta(aberta === m.id ? null : m.id)}>
                <b>{m.nome || 'Sem nome'}</b><span>{m.circulo}º círculo{e.dano ? ` · ${e.dano}${e.tipoDano ? ` ${NOME_DANO[e.tipoDano]}` : ''}` : ''}{e.cura ? ` · cura ${e.cura}` : ''}</span>
                <Icone nome={aberta === m.id ? 'anterior' : 'proximo'} />
              </button>
              {aberta === m.id ? (
                <>
                  <div className="ed-grade">
                    <Campo rotulo="Nome"><input value={m.nome} maxLength={50} onChange={(ev) => mudarPropria(i, { nome: ev.target.value })} /></Campo>
                    <Campo rotulo="Círculo">
                      <select value={m.circulo} onChange={(ev) => mudarPropria(i, { circulo: Number(ev.target.value) })}>
                        {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}º ({[0, 1, 3, 6, 10, 15][c]} PM)</option>)}
                      </select>
                    </Campo>
                    <Campo rotulo="Execução"><input value={m.execucao} maxLength={30} onChange={(ev) => mudarPropria(i, { execucao: ev.target.value })} /></Campo>
                    <Campo rotulo="Alcance"><input value={m.alcance} maxLength={30} onChange={(ev) => mudarPropria(i, { alcance: ev.target.value })} /></Campo>
                    <Campo rotulo="Duração"><input value={m.duracao} maxLength={30} onChange={(ev) => mudarPropria(i, { duracao: ev.target.value })} /></Campo>
                  </div>
                  <Campo rotulo="Descrição"><textarea value={m.descricao} maxLength={3000} onChange={(ev) => mudarPropria(i, { descricao: ev.target.value })} /></Campo>
                  <h4>Na mesa</h4>
                  <CamposEfeito e={e} mudarE={mudarE} />
                  <h4>Aprimoramentos</h4>
                  {(m.aprimoramentos ?? []).map((ap, k) => {
                    const mudarAp = (patch: Partial<NonNullable<MagiaPropria['aprimoramentos']>[number]>) =>
                      mudarPropria(i, { aprimoramentos: (m.aprimoramentos ?? []).map((x, n) => (n === k ? { ...x, ...patch } : x)) });
                    return (
                      <div key={k} className="ed-aprim">
                        <input type="number" min={1} max={20} value={ap.pm} title="+PM" onChange={(ev) => mudarAp({ pm: Number(ev.target.value) || 1 })} />
                        <input value={ap.texto} placeholder="O que muda (ex.: mais longe, mais forte)" maxLength={200} onChange={(ev) => mudarAp({ texto: ev.target.value })} />
                        <input value={ap.dano ?? ''} placeholder="+dano (1d6)" className={ap.dano && !expressaoValida(ap.dano) ? 'invalido' : ''} onChange={(ev) => mudarAp({ dano: ev.target.value || undefined })} />
                        <input type="number" min={0} max={10} value={ap.alvos ?? 0} title="+alvos" onChange={(ev) => mudarAp({ alvos: Number(ev.target.value) || undefined })} />
                        <button type="button" className="ed-remover" aria-label="Remover" onClick={() => mudarPropria(i, { aprimoramentos: (m.aprimoramentos ?? []).filter((_, n) => n !== k) })}><Icone nome="lixo" /></button>
                      </div>
                    );
                  })}
                  {(m.aprimoramentos ?? []).length < 6 ? (
                    <button type="button" className="ed-mais pequeno" onClick={() => mudarPropria(i, { aprimoramentos: [...(m.aprimoramentos ?? []), { pm: 1, texto: '', dano: '1d6' }] })}>
                      <Icone nome="mais" />Aprimoramento (+PM: mais dano ou mais alvos)
                    </button>
                  ) : null}
                  <label className="ed-check" title="Enquanto a magia está ativa, o conjurador repete este efeito sem gastar PM (aparece em “Ativas” no celular)">
                    <input
                      type="checkbox"
                      checked={Boolean(m.uso)}
                      onChange={(ev) => mudarPropria(i, { uso: ev.target.checked ? { nome: 'Usar de novo', alvo: e.alvo, maxAlvos: e.maxAlvos, dano: e.dano, tipoDano: e.tipoDano, anim: e.anim } : undefined })}
                    />
                    Efeito repetível enquanto estiver ativa (sem gastar PM)
                  </label>
                  {m.uso ? (
                    <div className="ed-uso">
                      <Campo rotulo="Nome do efeito repetido"><input value={m.uso.nome} maxLength={40} onChange={(ev) => mudarPropria(i, { uso: { ...m.uso!, nome: ev.target.value } })} /></Campo>
                      <CamposEfeito e={m.uso} mudarE={(patch) => mudarPropria(i, { uso: { ...m.uso!, ...patch } })} />
                    </div>
                  ) : null}
                  <div className="ed-linha">
                    <span className="ed-dica">Custo: {[0, 1, 3, 6, 10, 15][m.circulo]} PM{e.res ? ` · CD da ficha` : ''}</span>
                    <span className="ed-deco" />
                    {guardar ? <button type="button" className="ed-casa" onClick={() => guardar(m)}><Icone nome="livro" />Guardar na casa</button> : null}
                    <button type="button" className="ed-remover" onClick={() => mudar({ magiasProprias: f.magiasProprias.filter((_, j) => j !== i) })}><Icone nome="lixo" />Apagar magia</button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
        <div className="ed-linha">
          <button type="button" className="ed-mais" onClick={() => { const m = novaMagia(); mudar({ magiasProprias: [...f.magiasProprias, m] }); setAberta(m.id); }}>
            <Icone nome="mais" />Criar magia própria
          </button>
          <DaCasa
            lista={daCasa}
            jaTem={f.magiasProprias.map((x) => x.nome)}
            pegar={(m) => mudar({ magiasProprias: [...f.magiasProprias, { ...structuredClone(m), id: `propria-${Math.random().toString(36).slice(2, 9)}` }] })}
          />
        </div>
      </section>
    </>
  );
}


/**
 * Monta os numeros pela regra do livro: escolhe a classe, o nivel e o equipamento e a ficha recebe
 * PV, PM, Defesa e (se quiser) os totais das pericias. Bom para ficha do zero ou para subir de nivel.
 */
function CalculoPelaRegra({ f, mudar }: { f: Ficha; mudar: (patch: Partial<Ficha>) => void }) {
  const [classe, setClasse] = useState(() => acharClasse(f.classe)?.nome ?? '');
  const [eq, setEq] = useState<Equipamento>(() => ({ ...equipamentoVazio(), outros: Math.max(0, f.defesa - 10 - f.atributos.des) }));
  const [comPericias, setComPericias] = useState(f.fonte === 'manual');
  const dados = CLASSES.find((c) => c.nome === classe);
  const r = dados ? calcular(dados, f.nivel, f.atributos, f.pericias, eq) : null;
  const n = (k: keyof Equipamento) => (
    <input type="number" value={Number(eq[k])} onChange={(e) => setEq({ ...eq, [k]: Number(e.target.value) || 0 })} />
  );
  return (
    <details className="ed-regra" open={f.fonte === 'manual' && f.pvMax <= 1}>
      <summary><Icone nome="livro" />Calcular pela regra do livro (PV, PM, Defesa, perícias)</summary>
      <div className="ed-grade">
        <Campo rotulo="Classe">
          <select value={classe} onChange={(e) => { setClasse(e.target.value); if (!f.classe) mudar({ classe: e.target.value }); }}>
            <option value="">Escolha…</option>
            {CLASSES.map((c) => <option key={c.nome} value={c.nome}>{c.nome} ({c.pvInicial}+{c.pvNivel}/nível, {c.pmNivel} PM)</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nível"><input type="number" min={1} max={20} value={f.nivel} onChange={(e) => mudar({ nivel: Number(e.target.value) || 1 })} /></Campo>
        <Campo rotulo="Armadura (+Defesa)">{n('armadura')}</Campo>
        <Campo rotulo="Escudo (+Defesa)">{n('escudo')}</Campo>
        <Campo rotulo="Outros na Defesa">{n('outros')}</Campo>
        <Campo rotulo="PV extra (raça, poderes)">{n('pvExtra')}</Campo>
        <Campo rotulo="PM extra (raça, poderes)">{n('pmExtra')}</Campo>
      </div>
      <label className="ed-check"><input type="checkbox" checked={eq.pesada} onChange={(e) => setEq({ ...eq, pesada: e.target.checked })} />Armadura pesada (não soma Destreza)</label>
      <label className="ed-check" title="Total = metade do nível + atributo + treino (+2 até o 6º, +4 até o 14º, +6 depois). Bônus de poderes e itens precisam ser somados à mão.">
        <input type="checkbox" checked={comPericias} onChange={(e) => setComPericias(e.target.checked)} />
        Recalcular os totais das perícias (marque as treinadas na aba Perícias)
      </label>
      {r ? (
        <div className="ed-regra-res">
          <span>PV <b>{r.pvMax}</b></span><span>PM <b>{r.pmMax}</b></span><span>Defesa <b>{r.defesa}</b></span>
          {r.chave ? <span>Magias: <b>{NOME_ATRIBUTO[r.chave]}</b></span> : null}
          <button
            type="button"
            className="ed-btn ouro"
            onClick={() => mudar({
              pvMax: r.pvMax, pmMax: r.pmMax, defesa: r.defesa, classe: f.classe || classe,
              ...(comPericias ? { pericias: r.pericias } : {}),
              ...(r.chave && !f.atributoChave ? { atributoChave: r.chave } : {}),
            })}
          >
            <Icone nome="check" />Aplicar na ficha
          </button>
        </div>
      ) : <p className="ed-dica">Escolha a classe para ver o cálculo.</p>}
    </details>
  );
}

/** Escolher um item, poder ou magia da biblioteca da casa para pôr nesta ficha. */
function DaCasa<T extends { nome: string }>({ lista, jaTem, pegar }: { lista?: T[]; jaTem: string[]; pegar: (x: T) => void }) {
  const disponiveis = (lista ?? []).filter((x) => !jaTem.some((n) => n.toLowerCase() === x.nome.toLowerCase()));
  if (!lista?.length) return null;
  return (
    <select className="ed-da-casa" value="" disabled={!disponiveis.length} onChange={(e) => { const x = disponiveis[Number(e.target.value)]; if (x) pegar(x); }}>
      <option value="">{disponiveis.length ? `📚 Da biblioteca da casa (${disponiveis.length})…` : '📚 Biblioteca: já tem tudo'}</option>
      {disponiveis.map((x, i) => <option key={x.nome} value={i}>{x.nome}</option>)}
    </select>
  );
}
