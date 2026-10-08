// Acoes resolvidas pelo motor de regras, a partir do painel do mestre:
// o inimigo ataca/usa habilidade, ou o mestre age por um heroi que nao esta no celular.
import { useState } from 'react';
import type { Ataque, Entidade, Estado, Inimigo, Lado, TipoDano } from '../comum/tipos-cliente.ts';
import { TIPOS_DANO, NOME_DANO } from '../../shared/tipos.ts';
import { CONDICOES } from '../../shared/condicoes.ts';
import type { Ficha } from '../../shared/ficha.ts';
import { buscarMagia } from '../../shared/magias.ts';
import { efeitoDaMagia } from '../../shared/magias-efeitos.ts';
import { expressaoValida } from '../../shared/rolagem.ts';
import { Retrato } from '../comum/pecas.tsx';
import { usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

type Modo =
  | { tipo: 'ataque'; ataque: Ataque }
  | { tipo: 'habilidade' }
  | { tipo: 'magia'; magiaId: string };

interface Props {
  ent: Entidade;
  lado: Lado;
  estado: Estado;
  ficha?: Ficha;
}

const ICONE: Record<string, string> = { corte: '⚔️', perfuracao: '🗡️', impacto: '🔨', flecha: '🏹', virote: '🎯', tiro: '🔫', arremesso: '🪃', natural: '🐾' };

export function AcoesCard({ ent, lado, estado, ficha }: Props) {
  const { enviar } = usePainel();
  const [modo, setModo] = useState<Modo | null>(null);
  const [alvos, setAlvos] = useState<string[]>([]);
  const [bonus, setBonus] = useState(0);
  const [hab, setHab] = useState({ nome: '', dano: '', tipoDano: '' as TipoDano | '', res: 'ref', cd: 15, sucesso: 'metade', condicao: '' });
  const heroi = lado === 'aliados';
  const ataques = heroi ? ficha?.ataques ?? [] : (ent as Inimigo).ataques;
  const magias = heroi ? (ficha?.magias ?? []).map((id) => buscarMagia(id)).filter(Boolean) : [];

  if (!ataques.length && !magias.length && heroi) return null;

  // Alvos sugeridos: o lado oposto primeiro.
  const oposto = (heroi ? estado.inimigos : estado.aliados) as Entidade[];
  const mesmo = (heroi ? estado.aliados : estado.inimigos) as Entidade[];
  const multiplos = modo?.tipo === 'habilidade' || (modo?.tipo === 'magia' && (() => {
    const m = buscarMagia(modo.magiaId);
    return m ? efeitoDaMagia(m).maxAlvos !== 1 : false;
  })());

  const escolher = (id: string) => {
    if (!multiplos) return executar([id]);
    setAlvos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  async function executar(ids: string[]) {
    if (!modo) return;
    let ok = false;
    if (modo.tipo === 'ataque') ok = await enviar({ tipo: 'atacarComo', autorId: ent.id, ataqueId: modo.ataque.id, alvoId: ids[0], extras: { bonus } });
    else if (modo.tipo === 'magia') ok = await enviar({ tipo: 'magiaComo', autorId: ent.id, magiaId: modo.magiaId, alvos: ids });
    else {
      ok = await enviar({
        tipo: 'habilidade', autorId: ent.id, alvos: ids,
        habilidade: { nome: hab.nome || 'Habilidade', dano: hab.dano || undefined, tipoDano: hab.tipoDano, res: hab.res || undefined, cd: hab.cd, sucesso: hab.sucesso, condicoes: hab.condicao ? [hab.condicao] : [] },
      });
    }
    if (ok) { setModo(null); setAlvos([]); setBonus(0); }
  }

  const precisaAlvo = modo?.tipo !== 'magia' || (() => {
    const m = buscarMagia(modo.magiaId);
    return m ? !['si', 'nenhum'].includes(efeitoDaMagia(m).alvo) : true;
  })();

  return (
    <div className="acoes-regra">
      <span className="rotulo">{heroi ? 'Agir por' : 'Ações'}</span>
      <div className="chips-acao">
        {ataques.map((a) => (
          <button key={a.id} type="button" className={`chip-acao ${modo?.tipo === 'ataque' && modo.ataque.id === a.id ? 'on' : ''}`}
            title={`${a.nome} ${a.bonus >= 0 ? '+' : ''}${a.bonus} (${a.dano}${a.tipoDano ? ` ${NOME_DANO[a.tipoDano]}` : ''})`}
            onClick={() => { setModo(modo?.tipo === 'ataque' && modo.ataque.id === a.id ? null : { tipo: 'ataque', ataque: a }); setAlvos([]); }}>
            <span>{ICONE[a.arquetipo] ?? '⚔️'}</span>{a.nome} <b>{a.bonus >= 0 ? '+' : ''}{a.bonus}</b>
          </button>
        ))}
        {magias.length ? (
          <select className="chip-select" value={modo?.tipo === 'magia' ? modo.magiaId : ''} onChange={(e) => { setModo(e.target.value ? { tipo: 'magia', magiaId: e.target.value } : null); setAlvos([]); }}>
            <option value="">✨ Magia…</option>
            {magias.map((m) => <option key={m!.id} value={m!.id}>{m!.nome} ({m!.circulo}º)</option>)}
          </select>
        ) : null}
        {!heroi ? (
          <button type="button" className={`chip-acao ${modo?.tipo === 'habilidade' ? 'on' : ''}`} onClick={() => { setModo(modo?.tipo === 'habilidade' ? null : { tipo: 'habilidade' }); setAlvos([]); }}>
            <span>💥</span>Habilidade
          </button>
        ) : null}
      </div>

      {modo?.tipo === 'habilidade' ? (
        <div className="form-hab">
          <input placeholder="Nome (ex.: Sopro de fogo)" value={hab.nome} onChange={(e) => setHab({ ...hab, nome: e.target.value })} />
          <input placeholder="Dano (ex.: 6d6)" className={hab.dano && !expressaoValida(hab.dano) ? 'invalido' : ''} value={hab.dano} onChange={(e) => setHab({ ...hab, dano: e.target.value })} />
          <select value={hab.tipoDano} onChange={(e) => setHab({ ...hab, tipoDano: e.target.value as TipoDano })}>
            <option value="">Tipo de dano</option>
            {TIPOS_DANO.map((t) => <option key={t} value={t}>{NOME_DANO[t]}</option>)}
          </select>
          <select value={hab.res} onChange={(e) => setHab({ ...hab, res: e.target.value })}>
            <option value="">Sem teste</option><option value="fort">Fortitude</option><option value="ref">Reflexos</option><option value="von">Vontade</option>
          </select>
          <label>CD <input type="number" value={hab.cd} onChange={(e) => setHab({ ...hab, cd: Number(e.target.value) || 10 })} /></label>
          <select value={hab.sucesso} onChange={(e) => setHab({ ...hab, sucesso: e.target.value })}>
            <option value="metade">Passou: metade</option><option value="anula">Passou: anula</option>
          </select>
          <select value={hab.condicao} onChange={(e) => setHab({ ...hab, condicao: e.target.value })}>
            <option value="">Sem condição</option>
            {CONDICOES.filter((c) => !c.extra).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
          </select>
        </div>
      ) : null}

      {modo?.tipo === 'ataque' ? (
        <div className="linha-bonus">
          <span>Bônus da situação</span>
          {[-5, -2, 0, 2, 5].map((v) => (
            <button key={v} type="button" className={`btn pequeno ${bonus === v ? 'ativo' : ''}`} onClick={() => setBonus(v)}>{v > 0 ? `+${v}` : v}</button>
          ))}
        </div>
      ) : null}

      {modo && precisaAlvo ? (
        <div className="alvos-mestre">
          <span className="dica">{multiplos ? 'Escolha os alvos e confirme' : 'Clique no alvo'}</span>
          {[...oposto, ...mesmo.filter((x) => x.id !== ent.id)].map((x) => (
            <button key={x.id} type="button" className={`alvo-m ${alvos.includes(x.id) ? 'on' : ''} ${x.pv <= 0 ? 'caido' : ''}`} onClick={() => escolher(x.id)} title={`${x.nome} — Def ${x.defesa}`}>
              <Retrato ent={x} />
              <span>{x.nome}</span>
            </button>
          ))}
          {multiplos ? <Botao classe="ouro pequeno" icone="check" texto={`Usar em ${alvos.length}`} disabled={!alvos.length} onClick={() => executar(alvos)} /> : null}
        </div>
      ) : null}
      {modo && !precisaAlvo ? <Botao classe="ouro pequeno" icone="varinha" texto="Lançar" onClick={() => executar([])} /> : null}
    </div>
  );
}
