// Habilidades do inimigo: o texto do livro e o que o botao de usar faz (dano, teste, condicao, PM).
// Fica dentro do editor de inimigo/ameaca; o mestre ajusta o que o leitor do livro nao entendeu.
import { useState } from 'react';
import type { AlvoHabilidade, Habilidade, TipoDano } from '../../shared/tipos.ts';
import { NOME_DANO, TIPOS_DANO } from '../../shared/tipos.ts';
import { CONDICOES } from '../../shared/condicoes.ts';
import { expressaoValida } from '../../shared/rolagem.ts';
import { mecanicaDoTexto } from '../../shared/bloco-ameaca.ts';
import { Icone } from '../comum/Icone.tsx';

export const NOME_ALVO_HAB: Record<AlvoHabilidade, string> = {
  inimigos: 'Vários heróis', um: 'Um herói', si: 'Ele mesmo', aliados: 'Aliados dele', nenhum: 'Só anunciar',
};
const EXECUCOES = ['', 'Padrão', 'Movimento', 'Completa', 'Livre', 'Reação'];

/** Resumo de uma linha: "Padrão · 3 PM · 6d6 fogo · Ref CD 18". */
export function resumoHabilidade(h: Habilidade) {
  return [
    h.execucao, h.pm ? `${h.pm} PM` : '', h.dano ? `${h.dano}${h.tipoDano ? ` ${NOME_DANO[h.tipoDano]}` : ''}` : '',
    h.cura ? `cura ${h.cura}` : '', h.res ? `${{ fort: 'Fort', ref: 'Ref', von: 'Von' }[h.res]} CD ${h.cd ?? 15}` : '',
    h.condicoes?.length ? h.condicoes.map((c) => CONDICOES.find((x) => x.id === c.split(':')[0])?.nome.toLowerCase()).join(', ') : '',
  ].filter(Boolean).join(' · ');
}

const vazia = (): Habilidade => ({ nome: '', ativa: false, texto: '', execucao: 'Padrão', alvo: 'inimigos' });

export function HabilidadesEditor({ lista, mudar }: { lista: Habilidade[]; mudar: (l: Habilidade[]) => void }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const mudarH = (i: number, patch: Partial<Habilidade>) => mudar(lista.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    mudar(nova);
    setAberta(j);
  };

  return (
    <div className="habs-ed">
      {lista.length ? null : <p className="vazio-m">Nenhuma habilidade. Cole o bloco do livro acima ou crie uma.</p>}
      {lista.map((h, i) => {
        const on = aberta === i;
        const danoRuim = Boolean(h.dano && !expressaoValida(h.dano));
        const curaRuim = Boolean(h.cura && !expressaoValida(h.cura));
        return (
          <div key={i} className={`hab-ed ${on ? 'aberta' : ''}`}>
            <div className="hab-linha">
              <button type="button" className="hab-titulo" onClick={() => setAberta(on ? null : i)}>
                <b>{h.nome || 'Sem nome'}</b>
                <small>{resumoHabilidade(h) || (h.texto ?? '').slice(0, 80) || 'só texto'}</small>
              </button>
              <label className="hab-chip" title="Mostrar o nome desta habilidade no telão (chip do boss)">
                <input type="checkbox" checked={h.ativa} onChange={(e) => mudarH(i, { ativa: e.target.checked })} />Telão
              </label>
              <button type="button" className="btn icone pequeno" title="Subir" onClick={() => mover(i, -1)}><Icone nome="anterior" /></button>
              <button type="button" className="btn icone pequeno perigo" title="Remover" onClick={() => { mudar(lista.filter((_, j) => j !== i)); setAberta(null); }}><Icone nome="lixo" /></button>
            </div>
            {on ? (
              <div className="hab-corpo">
                <div className="grade">
                  <label>Nome<input value={h.nome} maxLength={60} onChange={(e) => mudarH(i, { nome: e.target.value })} /></label>
                  <label>Execução
                    <select value={h.execucao ?? ''} onChange={(e) => mudarH(i, { execucao: e.target.value || undefined })}>
                      {EXECUCOES.map((x) => <option key={x} value={x}>{x || '—'}</option>)}
                    </select>
                  </label>
                  <label>Custo (PM)<input type="number" min={0} value={h.pm ?? 0} onChange={(e) => mudarH(i, { pm: Number(e.target.value) || undefined })} /></label>
                  <label>Ao usar, afeta
                    <select value={h.alvo ?? 'nenhum'} onChange={(e) => mudarH(i, { alvo: e.target.value as AlvoHabilidade })}>
                      {Object.entries(NOME_ALVO_HAB).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  </label>
                </div>
                <label>Descrição (o que o livro diz — só você vê)
                  <textarea value={h.texto ?? ''} maxLength={3000} onChange={(e) => mudarH(i, { texto: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="btn pequeno"
                  title="Lê dano, teste, CD, condições e PM a partir da descrição"
                  onClick={() => mudarH(i, { ...mecanicaDoTexto(h.texto ?? '') })}
                >
                  <Icone nome="varinha" /><span>Ler mecânica da descrição</span>
                </button>
                {h.alvo && h.alvo !== 'nenhum' ? (
                  <div className="grade">
                    <label>Dano<input className={danoRuim ? 'invalido' : ''} placeholder="Ex.: 6d6+5" value={h.dano ?? ''} onChange={(e) => mudarH(i, { dano: e.target.value || undefined })} /></label>
                    <label>Tipo de dano
                      <select value={h.tipoDano ?? ''} onChange={(e) => mudarH(i, { tipoDano: e.target.value as TipoDano | '' })}>
                        <option value="">—</option>
                        {TIPOS_DANO.map((t) => <option key={t} value={t}>{NOME_DANO[t]}</option>)}
                      </select>
                    </label>
                    <label>Cura<input className={curaRuim ? 'invalido' : ''} placeholder="Ex.: 2d8+4" value={h.cura ?? ''} onChange={(e) => mudarH(i, { cura: e.target.value || undefined })} /></label>
                    <label>Teste
                      <select value={h.res ?? ''} onChange={(e) => mudarH(i, { res: (e.target.value || undefined) as Habilidade['res'], cd: h.cd ?? 15 })}>
                        <option value="">Sem teste</option><option value="fort">Fortitude</option><option value="ref">Reflexos</option><option value="von">Vontade</option>
                      </select>
                    </label>
                    {h.res ? <label>CD<input type="number" min={1} value={h.cd ?? 15} onChange={(e) => mudarH(i, { cd: Number(e.target.value) || 15 })} /></label> : null}
                    {h.res ? (
                      <label>Se passar
                        <select value={h.sucesso ?? 'metade'} onChange={(e) => mudarH(i, { sucesso: e.target.value as 'metade' | 'anula' })}>
                          <option value="metade">Metade do dano</option><option value="anula">Evita tudo</option>
                        </select>
                      </label>
                    ) : null}
                    <label>Condição se falhar
                      <select value={h.condicoes?.[0]?.split(':')[0] ?? ''} onChange={(e) => {
                        const rod = h.condicoes?.[0]?.split(':')[1];
                        mudarH(i, { condicoes: e.target.value ? [rod ? `${e.target.value}:${rod}` : e.target.value] : undefined });
                      }}>
                        <option value="">Nenhuma</option>
                        {CONDICOES.filter((c) => !c.extra).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                      </select>
                    </label>
                    {h.condicoes?.length ? (
                      <label>Por quantas rodadas (0 = até tirar)
                        <input type="number" min={0} max={20} value={Number(h.condicoes[0].split(':')[1] ?? 0)} onChange={(e) => {
                          const id = h.condicoes![0].split(':')[0];
                          const n = Number(e.target.value) || 0;
                          mudarH(i, { condicoes: [n ? `${id}:${n}` : id, ...h.condicoes!.slice(1)] });
                        }} />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="btn pequeno" onClick={() => { mudar([...lista, vazia()]); setAberta(lista.length); }}>
        <Icone nome="mais" /><span>Nova habilidade</span>
      </button>
    </div>
  );
}
