// Aba "Magias": grimorio da ficha, lancamento com aprimoramentos e as magias ativas do jogador.
import { useMemo, useState } from 'react';
import { CUSTO_CIRCULO, cdMagia, limitePm } from '../../shared/ficha.ts';
import { NOME_ESCOLA, type Magia } from '../../shared/magias.ts';
import { FONTE_PROPRIA, acharMagia, efeitoNaFicha, magiasDaFicha } from '../../shared/magias-proprias.ts';
import type { AlvoMagia, Uso } from '../../shared/magias-efeitos.ts';
import type { EfeitoAtivo } from '../../shared/acoes.ts';
import { NOME_DANO } from '../../shared/tipos.ts';
import { Icone } from '../comum/Icone.tsx';
import type { PropsAba } from './Jogo.tsx';
import { Folha } from './Folha.tsx';
import { lerExpressao } from '../../shared/rolagem.ts';

/** Faces dos dados que o jogador segura (os do dano/cura da magia). */
export function dadosDaExpressao(...exprs: (string | undefined)[]) {
  const faces: number[] = [];
  for (const e of exprs) {
    if (!e) continue;
    try {
      for (const t of lerExpressao(e)) if (t.faces) for (let i = 0; i < t.qtd; i += 1) faces.push(t.faces);
    } catch { /* expressao estranha: sem dados na mao */ }
  }
  return faces.slice(0, 6);
}
import { SeletorAlvos, type QuemPode } from './Alvos.tsx';

export const ICONE_ESCOLA: Record<string, string> = {
  Abjur: '🛡️', Adiv: '👁️', Conv: '🌀', Encan: '💫', Evoc: '🔥', Ilusão: '🎭', Necro: '💀', Trans: '🧬',
};
const TESTE: Record<string, string> = { fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' };

const quemDoAlvo = (alvo: AlvoMagia): QuemPode | null =>
  alvo === 'inimigo' || alvo === 'inimigos' ? 'inimigos' : alvo === 'aliado' || alvo === 'aliados' ? 'aliados' : alvo === 'qualquer' ? 'todos' : null;

export function Grimorio(props: PropsAba) {
  const { ficha, heroi, estado } = props;
  const [circulo, setCirculo] = useState(0);
  const [aberta, setAberta] = useState<Magia | null>(null);
  const [usando, setUsando] = useState<{ efeito: EfeitoAtivo; indice: number; uso: Uso } | null>(null);
  const magias = useMemo(() => magiasDaFicha(ficha), [ficha]);
  const circulos = [...new Set(magias.map((m) => m.circulo))].sort();
  const lista = magias.filter((m) => !circulo || m.circulo === circulo);
  const pm = heroi?.pm ?? ficha.pmMax;
  const cd = cdMagia(ficha);
  const ativas = estado?.efeitos.filter((e) => e.conjuradorId === heroi?.id) ?? [];

  if (!magias.length && !ficha.magiasExtras.length) {
    return (
      <main>
        <div className="j-secao"><h3>Magias</h3><span className="deco" /></div>
        <div className="j-vazio"><b>Nenhuma magia na ficha</b>Aprendeu magias? Use “Editar ficha” na aba Mais (do livro ou criadas pelo grupo), ou atualize o PDF do Nimb.</div>
      </main>
    );
  }

  return (
    <main>
      {ativas.length ? (
        <>
          <div className="j-secao"><h3>Ativas</h3><span className="conta">{ativas.length}</span><span className="deco" /></div>
          <div className="j-lista">
            {ativas.map((e) => {
              const m = acharMagia(ficha, e.magiaId);
              const usos = m ? efeitoNaFicha(ficha, m).usos ?? [] : [];
              return (
                <div key={e.id} className="ativa">
                  <div className="ativa-topo">
                    <span className="icone-item">{m ? ICONE_ESCOLA[m.escola] : '✨'}</span>
                    <span><b>{e.nome}</b><small>{e.persistente === 'sustentada' ? 'Sustentada' : e.persistente === 'rodadas' ? `${e.rodadas ?? 1} rodada(s)` : 'Até o fim da cena'}</small></span>
                    <button type="button" className="j-btn pequeno perigo" onClick={() => props.agir({ tipo: 'encerrarEfeito', id: e.id })}>Encerrar</button>
                  </div>
                  {usos.length ? (
                    <div className="ativa-usos">
                      {usos.map((u, i) => (
                        <button key={u.nome} type="button" className="j-btn pequeno" onClick={() => setUsando({ efeito: e, indice: i, uso: u })}>
                          <Icone nome="raio" />{u.nome}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="j-secao"><h3>Grimório</h3><span className="conta">{magias.length}</span><span className="deco" />{cd ? <span className="conta">CD {cd}</span> : null}</div>
      {circulos.length > 1 ? (
        <div className="j-filtros">
          <button type="button" className={!circulo ? 'ativo' : ''} onClick={() => setCirculo(0)}>Todas</button>
          {circulos.map((c) => (
            <button key={c} type="button" className={circulo === c ? 'ativo' : ''} onClick={() => setCirculo(c)}>{c}º círculo</button>
          ))}
        </div>
      ) : null}
      <div className="j-lista">
        {lista.map((m) => {
          const custo = CUSTO_CIRCULO[m.circulo];
          const e = efeitoNaFicha(ficha, m);
          return (
            <button key={m.id} type="button" className={`j-item ${custo > pm ? 'sem-pm' : ''}`} onClick={() => setAberta(m)}>
              <span className="icone-item">{m.fonte === FONTE_PROPRIA ? '🌟' : ICONE_ESCOLA[m.escola] ?? '✨'}</span>
              <span style={{ minWidth: 0 }}>
                <b>{m.nome}</b>
                <small>{[`${m.circulo}º`, e.dano ? `${e.dano}${e.tipoDano ? ` ${NOME_DANO[e.tipoDano]}` : ''}` : e.cura ? `cura ${e.cura}` : NOME_ESCOLA[m.escola], e.res ? TESTE[e.res] : m.alcance].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="custo">{custo} PM</span>
            </button>
          );
        })}
        {ficha.magiasExtras.map((nome) => (
          <div key={nome} className="j-item" style={{ opacity: 0.7 }}>
            <span className="icone-item">📜</span>
            <span><b>{nome}</b><small>Fora do grimório da mesa: use com o mestre.</small></span>
            <span />
          </div>
        ))}
      </div>
      {aberta ? <LancarMagia {...props} magia={aberta} fechar={() => setAberta(null)} /> : null}
      {usando ? <UsarEfeito {...props} {...usando} fechar={() => setUsando(null)} /> : null}
    </main>
  );
}

function LancarMagia({ magia, fechar, ficha, heroi, estado, agir, bloqueio }: PropsAba & { magia: Magia; fechar: () => void }) {
  const efeito = efeitoNaFicha(ficha, magia);
  const [vezes, setVezes] = useState<Record<number, number>>({});
  const [alvos, setAlvos] = useState<string[]>([]);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const limite = limitePm(ficha);
  const truque = Object.entries(vezes).some(([i, v]) => v && magia.aprimoramentos[Number(i)]?.truque);
  const custo = truque ? 0 : CUSTO_CIRCULO[magia.circulo] + Object.entries(vezes).reduce((s, [i, v]) => s + (magia.aprimoramentos[Number(i)]?.pm ?? 0) * v, 0);
  const pm = heroi?.pm ?? ficha.pmMax;
  const extraAlvos = Object.entries(vezes).reduce((s, [i, v]) => {
    const m = /aumenta o n[úu]mero de alvos em \+(\d+)/i.exec(magia.aprimoramentos[Number(i)]?.texto ?? '');
    return s + (m ? Number(m[1]) * v : 0);
  }, 0);
  const max = efeito.maxAlvos ? efeito.maxAlvos + extraAlvos : 0;
  const quem = quemDoAlvo(efeito.alvo);
  const precisaAlvo = Boolean(quem);
  const cd = cdMagia(ficha);

  const mudar = (i: number, delta: number) => {
    const a = magia.aprimoramentos[i];
    const repetivel = /^\s*aumenta/i.test(a.texto);
    setVezes((v) => {
      const atual = v[i] ?? 0;
      const novo = Math.max(0, Math.min(repetivel ? 20 : 1, atual + delta));
      if (a.truque && novo) return { [i]: 1 }; // truque nao combina com nada
      const sem = Object.fromEntries(Object.entries(v).filter(([k]) => !magia.aprimoramentos[Number(k)]?.truque));
      return { ...sem, [i]: novo };
    });
  };

  const lancar = async () => {
    setEnviando(true);
    const ok = await agir(
      { tipo: 'magia', magiaId: magia.id, alvos, aprimoramentos: vezes },
      { dados: dadosDaExpressao(efeito.dano, efeito.dano2, efeito.cura, efeito.temp), titulo: magia.nome },
    );
    setEnviando(false);
    if (ok) fechar();
  };

  const excede = custo > limite;
  const falta = custo > pm;
  return (
    <Folha fechar={fechar}>
      <h2>{ICONE_ESCOLA[magia.escola]} {magia.nome}</h2>
      <div className="meta">
        <span className="destaque">{magia.tipo === 'universal' ? 'Universal' : magia.tipo === 'arcana' ? 'Arcana' : 'Divina'} {magia.circulo}</span>
        <span>{NOME_ESCOLA[magia.escola]}</span>
        <span>Execução: {magia.execucao}</span>
        <span>Alcance: {magia.alcance}</span>
        {magia.alvo ? <span>Alvo: {magia.alvo}</span> : null}
        {magia.area ? <span>Área: {magia.area}</span> : null}
        <span>Duração: {magia.duracao}</span>
        {magia.resistencia ? <span className="destaque">{magia.resistencia}{cd ? ` · CD ${cd}` : ''}</span> : null}
      </div>
      <p className="j-texto">{magia.descricao}</p>

      {magia.aprimoramentos.length ? <span className="j-rotulo">Aprimoramentos (até {limite} PM no total)</span> : null}
      <div className="j-lista">
        {magia.aprimoramentos.map((a, i) => {
          const v = vezes[i] ?? 0;
          const repetivel = /^\s*aumenta/i.test(a.texto);
          return (
            <div key={i} className={`aprim ${v ? 'on' : ''}`}>
              <span className="pm-aprim">{a.truque ? 'Truque' : `+${a.pm} PM`}</span>
              <span>{a.texto}</span>
              <span className="contador">
                {repetivel ? (
                  <>
                    <button type="button" onClick={() => mudar(i, -1)}>−</button>
                    <b>{v}</b>
                    <button type="button" onClick={() => mudar(i, 1)}>+</button>
                  </>
                ) : (
                  <button type="button" onClick={() => mudar(i, v ? -1 : 1)}>{v ? '✓' : '+'}</button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {precisaAlvo ? (
        <>
          <SeletorAlvos estado={estado} quem={mostrarTodos ? 'todos' : quem!} max={max} escolhidos={alvos} mudar={setAlvos} eu={heroi?.id} />
          {quem !== 'todos' ? <label className="check-j"><input type="checkbox" checked={mostrarTodos} onChange={(e) => setMostrarTodos(e.target.checked)} />Mostrar todos (aliados e inimigos)</label> : null}
        </>
      ) : (
        <p className="j-texto destaque-alvo">{efeito.alvo === 'si' ? 'Alvo: você mesmo.' : 'Sem alvo: o efeito aparece no telão.'}</p>
      )}
      {efeito.nota ? <p className="nota-resultado">{efeito.nota}</p> : null}

      <div className="acoes-folha">
        <div className="custo-total">
          <span>Custo <b className={excede || falta ? 'ruim' : ''}>{custo} PM</b></span>
          <span>Você tem <b>{pm}</b> PM</span>
        </div>
        {excede ? <p className="aviso-bloqueio">Passa do seu limite de {limite} PM por magia.</p> : falta ? <p className="aviso-bloqueio">PM insuficientes.</p> : bloqueio ? <p className="aviso-bloqueio">{bloqueio}</p> : null}
        <button type="button" className="j-btn ouro largo rolar-grande" disabled={enviando || excede || falta || (precisaAlvo && !alvos.length) || !heroi} onClick={lancar}>
          <Icone nome="varinha" />{enviando ? 'Conjurando…' : precisaAlvo && !alvos.length ? 'Escolha o alvo' : `Lançar (${custo} PM)`}
        </button>
      </div>
    </Folha>
  );
}

function UsarEfeito({ efeito, indice, uso, fechar, estado, heroi, agir }: PropsAba & { efeito: EfeitoAtivo; indice: number; uso: Uso; fechar: () => void }) {
  const [alvos, setAlvos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const quem = quemDoAlvo(uso.alvo);
  const usar = async () => {
    setEnviando(true);
    const ok = await agir({ tipo: 'usar', efeitoId: efeito.id, indice, alvos }, { dados: dadosDaExpressao(uso.dano, uso.dano2, uso.cura), titulo: uso.nome });
    setEnviando(false);
    if (ok) fechar();
  };
  return (
    <Folha fechar={fechar}>
      <h2>{efeito.nome}</h2>
      <div className="meta">
        <span className="destaque">{uso.nome}</span>
        {uso.dano ? <span>{uso.dano}{uso.tipoDano ? ` ${NOME_DANO[uso.tipoDano]}` : ''}</span> : null}
        {uso.cura ? <span>Cura {uso.cura}</span> : null}
        {uso.res ? <span>{TESTE[uso.res]} {uso.sucesso === 'metade' ? 'reduz à metade' : 'anula'}</span> : null}
      </div>
      {uso.nota ? <p className="nota-resultado">{uso.nota}</p> : null}
      {quem ? <SeletorAlvos estado={estado} quem={quem} max={uso.maxAlvos ?? (uso.alvo === 'inimigo' || uso.alvo === 'aliado' ? 1 : 0)} escolhidos={alvos} mudar={setAlvos} eu={heroi?.id} /> : null}
      <div className="acoes-folha">
        <button type="button" className="j-btn ouro largo rolar-grande" disabled={enviando || (Boolean(quem) && !alvos.length)} onClick={usar}>
          <Icone nome="raio" />{enviando ? 'Usando…' : 'Usar (sem PM)'}
        </button>
      </div>
    </Folha>
  );
}
