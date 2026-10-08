// Aba Bestiario: fichas de ameaca guardadas pelo mestre. Cada uma vira carta na mesa com um clique.
import { useMemo, useRef, useState } from 'react';
import { enviarArquivo } from '../comum/conexao.ts';
import type { Ameaca, Estado } from '../comum/tipos-cliente.ts';
import { NOME_DANO } from '../../shared/tipos.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { pedirBestiario, pedirSalvos, pin, usePainel, type Encontro } from './contexto.ts';
import { Botao } from './Botao.tsx';
import { NOME_TIER } from './Editor.tsx';

const sinal = (n: number) => (n >= 0 ? `+${n}` : String(n));
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  visivel: boolean;
  estado: Estado;
  bestiario: Ameaca[];
  encontros: Encontro[];
  editar: (a: Ameaca | null) => void;
  irParaCombate: () => void;
}

export function Bestiario({ visivel, estado, bestiario, encontros, editar, irParaCombate }: Props) {
  const { avisar, enviar: enviarMesa } = usePainel();
  const [busca, setBusca] = useState('');
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [naTela, setNaTela] = useState(true);
  const [chefe, setChefe] = useState<Record<string, boolean>>({});
  const [lendo, setLendo] = useState(false);
  const livro = useRef<HTMLInputElement>(null);

  const importarLivro = async (arquivo: File) => {
    setLendo(true);
    avisar(`Lendo ${arquivo.name}… livros grandes levam alguns segundos.`, 'info');
    const r = await enviarArquivo('/api/mestre/bestiario/livro', arquivo, { 'x-pin': pin });
    setLendo(false);
    if (!r.ok) return avisar(r.erro ?? 'Não consegui ler o livro.');
    const partes = [`${r.lidas} ameaças lidas`, `${r.novas} novas`];
    if (r.iguais) partes.push(`${r.iguais} já estavam no bestiário`);
    if (r.semNd) partes.push(`${r.semNd} sem ND (confira)`);
    avisar(`${partes.join(' · ')}.`, 'info');
  };

  const lista = useMemo(() => {
    const b = semAcento(busca.trim());
    if (!b) return bestiario;
    return bestiario.filter((a) => semAcento(`${a.nome} ${a.subtitulo} ${a.nd}`).includes(b));
  }, [bestiario, busca]);

  const naMesaAgora = (id: string) => estado.inimigos.filter((i) => i.ameacaId === id).length;

  const porNaMesa = async (a: Ameaca) => {
    const quantidade = qtd[a.id] ?? 1;
    const chefeFinal = Boolean(chefe[a.id]);
    if (await pedirBestiario(avisar, { acao: 'naMesa', id: a.id, quantidade, naTela, chefeFinal })) {
      avisar(`${quantidade > 1 ? `${quantidade}× ` : ''}${a.nome}${chefeFinal ? ' (chefe final)' : ''} na mesa${naTela ? ' e no telão' : ' (escondido)'}.`, 'info');
    }
  };

  return (
    <section className="bestiario" hidden={!visivel}>
      <header className="bestiario-topo">
        <div className="busca">
          <Icone nome="busca" />
          <input type="search" placeholder="Procurar ameaça…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <label className="check" title="As cartas já entram visíveis para os jogadores">
          <input type="checkbox" checked={naTela} onChange={(e) => setNaTela(e.target.checked)} />Entram visíveis no telão
        </label>
        <span className="deco" />
        <Botao icone="livro" texto={lendo ? 'Lendo o livro…' : 'Importar do livro (PDF)'} disabled={lendo} title="Lê os blocos de estatísticas de um livro de Tormenta20 (ex.: Ameaças de Arton). Fica só neste computador." onClick={() => livro.current?.click()} />
        <input ref={livro} type="file" accept="application/pdf,.pdf,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importarLivro(f); e.target.value = ''; }} />
        <Botao classe="ouro" icone="mais" texto="Nova ameaça" onClick={() => editar(null)} />
      </header>

      <section className="encontros">
        <header>
          <h3>Encontros prontos</h3>
          <span className="dica-cena">Monte o grupo de inimigos na mesa e salve; na sessão, é só carregar.</span>
          <span className="deco" />
          <Botao
            classe="pequeno"
            icone="mais"
            texto="Salvar inimigos da mesa"
            disabled={!estado.inimigos.length}
            onClick={async () => {
              const nome = prompt('Nome do encontro (ex.: Emboscada na estrada):');
              if (nome && await pedirSalvos(avisar, { tipo: 'encontro', acao: 'salvar', nome })) avisar(`Encontro “${nome}” salvo.`, 'info');
            }}
          />
          <Botao
            classe="pequeno fantasma"
            icone="lixo"
            texto="Tirar inimigos da mesa"
            disabled={!estado.inimigos.length}
            onClick={async () => {
              if (!confirm('Tirar todos os inimigos da mesa? (dá para desfazer)')) return;
              await enviarMesa({ tipo: 'limparInimigos' });
            }}
          />
        </header>
        {encontros.length ? (
          <div className="lista-encontros">
            {encontros.map((e) => (
              <article key={e.id} className="encontro">
                <b>{e.nome}</b>
                <small>{e.itens.map((it) => `${it.quantidade}× ${bestiario.find((a) => a.id === it.ameacaId)?.nome ?? '(apagada)'}${it.chefeFinal ? ' 👑' : ''}`).join(' · ')}</small>
                <div className="linha-botoes">
                  <Botao classe="pequeno ouro" icone="cartas" texto="Pôr na mesa" title="Acrescenta aos inimigos que já estão na mesa" onClick={async () => {
                    const r = await pedirSalvos(avisar, { tipo: 'encontro', acao: 'carregar', id: e.id, naTela });
                    if (r) avisar(`${e.nome} na mesa${r.faltando ? ` (${r.faltando} ficha(s) apagada(s) do bestiário ficaram de fora)` : ''}.`, 'info');
                  }} />
                  <Botao classe="pequeno" icone="reiniciar" texto="Trocar a mesa" title="Tira os inimigos atuais e põe este encontro" onClick={async () => {
                    if (confirm(`Tirar os inimigos atuais e pôr “${e.nome}”? (dá para desfazer)`)) await pedirSalvos(avisar, { tipo: 'encontro', acao: 'carregar', id: e.id, naTela, substituir: true });
                  }} />
                  <span className="deco" />
                  <Botao classe="icone pequeno fantasma" icone="lixo" title="Apagar encontro" onClick={async () => { if (confirm(`Apagar o encontro “${e.nome}”?`)) await pedirSalvos(avisar, { tipo: 'encontro', acao: 'remover', id: e.id }); }} />
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {lista.length ? (
        <div className="grade-ameacas">
          {lista.map((a) => {
            const n = qtd[a.id] ?? 1;
            const mesa = naMesaAgora(a.id);
            const especiais = [
              ...Object.entries(a.rd).map(([t, v]) => (t === 'geral' ? `RD ${v}` : `RD ${NOME_DANO[t as keyof typeof NOME_DANO]} ${v}`)),
              ...a.imunidades.map((x) => `imune a ${x}`),
              ...a.vulnerabilidades.map((x) => `vulnerável a ${x}`),
            ];
            return (
              <article key={a.id} className={`ameaca tier-${a.tier}`}>
                <div className="ameaca-cabeca" onClick={() => editar(a)} title="Editar ficha">
                  <Retrato ent={a} />
                  <div>
                    <b>{a.nome}</b>
                    <small>{[a.nd, a.subtitulo].filter(Boolean).join(' · ') || NOME_TIER[a.tier]}</small>
                  </div>
                  {mesa ? <span className="na-mesa-tag" title="Cartas desta ameaça na mesa agora">{mesa} na mesa</span> : null}
                </div>
                <div className="ameaca-numeros">
                  <span><i>PV</i>{a.pvMax}</span>
                  <span><i>Def</i>{a.defesa}</span>
                  <span><i>Fort</i>{sinal(a.fort)}</span>
                  <span><i>Ref</i>{sinal(a.ref)}</span>
                  <span><i>Von</i>{sinal(a.von)}</span>
                  {a.pmMax ? <span><i>PM</i>{a.pmMax}</span> : null}
                </div>
                {a.ataques.length ? (
                  <ul className="ameaca-ataques">
                    {a.ataques.map((at) => (
                      <li key={at.id}>
                        <b>{at.nome}</b> {sinal(at.bonus)} <span>({at.dano}{at.margem < 20 ? `, ${at.margem}` : ''}{at.mult > 2 ? `/x${at.mult}` : ''})</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="ameaca-vazia">Sem ataques cadastrados — use “Habilidade” no card da mesa.</p>}
                {especiais.length ? <p className="ameaca-especiais">{especiais.join(' · ')}</p> : null}
                <footer>
                  <div className="qtd" title="Quantas cartas pôr na mesa">
                    <button type="button" onClick={() => setQtd({ ...qtd, [a.id]: Math.max(1, n - 1) })} aria-label="Menos">−</button>
                    <b>{n}</b>
                    <button type="button" onClick={() => setQtd({ ...qtd, [a.id]: Math.min(20, n + 1) })} aria-label="Mais">+</button>
                  </div>
                  <button type="button" className={`chip-chefe ${chefe[a.id] ? 'on' : ''}`} title="Chefe final (Ameaças de Arton, p. 370): PV dobrado, +2 PM por ND, Maior que a Morte, RD pelo patamar e ND +2" onClick={() => setChefe({ ...chefe, [a.id]: !chefe[a.id] })}>
                    <Icone nome="coroa" />Chefe
                  </button>
                  <Botao classe="ouro pequeno" icone="cartas" texto="Pôr na mesa" onClick={() => porNaMesa(a)} />
                  <span className="deco" />
                  <Botao classe="icone pequeno fantasma" icone="editar" title="Editar ficha" onClick={() => editar(a)} />
                  <Botao
                    classe="icone pequeno fantasma"
                    icone="lixo"
                    title="Remover do bestiário"
                    onClick={async () => {
                      if (confirm(`Remover ${a.nome} do bestiário? (as cartas já na mesa continuam)`)) await pedirBestiario(avisar, { acao: 'remover', id: a.id });
                    }}
                  />
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bestiario-vazio">
          <span className="icone-grande"><Icone nome="caveira" /></span>
          {bestiario.length ? <p>Nenhuma ameaça com “{busca}”.</p> : (
            <>
              <h3>Seu bestiário está vazio</h3>
              <p>Importe o PDF do <b>Ameaças de Arton</b> (ou do livro básico) e todas as fichas entram de uma vez.
                Também dá para criar uma ameaça colando o bloco de estatísticas, ou abrir um inimigo da mesa e usar <b>Guardar no bestiário</b>.</p>
              <div className="linha-botoes">
                <Botao classe="ouro" icone="livro" texto="Importar do livro (PDF)" disabled={lendo} onClick={() => livro.current?.click()} />
                <Botao icone="mais" texto="Nova ameaça" onClick={() => editar(null)} />
                <Botao icone="espada" texto="Ir para o combate" onClick={irParaCombate} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
