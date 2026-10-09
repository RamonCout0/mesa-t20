// Janela de criar/editar heroi ou inimigo.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { REVELAR, TEMAS, TIERS } from '../../shared/condicoes.ts';
import type { Ameaca, Entidade, Heroi, ImagemGaleria, Inimigo, Lado } from '../comum/tipos-cliente.ts';
import { Retrato } from '../comum/pecas.tsx';
import { Icone } from '../comum/Icone.tsx';
import { pedirBestiario, usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';
import { NOME_REVELAR } from './Card.tsx';
import { escreverAtaques, lerBlocoAmeaca, lerDefesas, lerLinhasDeAtaque } from '../../shared/bloco-ameaca.ts';
import { NOME_DANO, type Habilidade, type TipoDano } from '../../shared/tipos.ts';
import { HabilidadesEditor } from './HabilidadesEditor.tsx';

/** RD, imunidades e vulnerabilidades de volta para texto ("RD 5, redução de fogo 10, imunidade a veneno"). */
function escreverDefesas(i: Partial<Inimigo>) {
  const partes: string[] = [];
  for (const [tipo, n] of Object.entries(i.rd ?? {})) {
    partes.push(tipo === 'geral' ? `redução de dano ${n}` : `redução de ${NOME_DANO[tipo as TipoDano]} ${n}`);
  }
  if (i.imunidades?.length) partes.push(`imunidade a ${i.imunidades.join(' e ')}`);
  if (i.vulnerabilidades?.length) partes.push(`vulnerabilidade a ${i.vulnerabilidades.join(' e ')}`);
  return partes.join(', ');
}

export const NOME_TIER: Record<string, string> = { comum: 'Comum', elite: 'Elite', epico: 'Épico', lendario: 'Lendário', mitico: 'Mítico' };
export const NOME_TEMA: Record<string, string> = {
  fogo: '🔥 Fogo', gelo: '❄️ Gelo', trevas: '🌑 Trevas', arcano: '🔮 Arcano', luz: '☀️ Luz', veneno: '☠️ Veneno', sangue: '🩸 Sangue',
};

export interface AlvoEditor {
  lado: Lado;
  ent: Entidade | null;
  /** Editando uma ficha do bestiario (nao uma carta da mesa). */
  ameaca?: Ameaca | null;
}

interface Props {
  alvo: AlvoEditor | null;
  imagens: ImagemGaleria[];
  fechar: () => void;
  aoRemover: (id: string) => void;
}

const Campo = ({ rotulo, children }: { rotulo: string; children: ReactNode }) => <label>{rotulo}{children}</label>;
const Secao = ({ titulo }: { titulo: string }) => <div className="secao-form">{titulo}</div>;

const PADRAO_HEROI = { nome: '', pvMax: 30, pmMax: 10, defesa: 15, nivel: 1, cor: '#e9c46a', bonusIni: 0 };
const PADRAO_INIMIGO = { nome: '', pvMax: 30, defesa: 12, bonusIni: 0, fort: 0, ref: 0, von: 0, tema: 'trevas', tier: 'comum', revelar: 'oculto', naTela: true, habilidades: [] };

export function Editor({ alvo, imagens, fechar, aoRemover }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { enviar, avisar } = usePainel();
  const [previa, setPrevia] = useState({ imagem: '', nome: '', cor: '' });
  const [habs, setHabs] = useState<Habilidade[]>([]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (alvo && !d.open) d.showModal();
    if (!alvo && d.open) d.close();
  }, [alvo]);

  useEffect(() => {
    if (!alvo) return;
    const e = (alvo.ent ?? alvo.ameaca ?? {}) as Partial<Heroi>;
    setPrevia({ imagem: e.imagem ?? '', nome: e.nome ?? '', cor: e.cor ?? '#e9c46a' });
    setHabs(((alvo.ent ?? alvo.ameaca) as Partial<Inimigo> | null)?.habilidades ?? []);
  }, [alvo]);

  if (!alvo) return <dialog id="editor" ref={dialogo} onClose={fechar} />;

  const { lado, ent } = alvo;
  const doBestiario = alvo.ameaca !== undefined;
  const ameaca = alvo.ameaca ?? null;
  const novo = doBestiario ? !ameaca : !ent;
  const heroi = lado === 'aliados';
  const dados = (ent ?? ameaca ?? (heroi ? PADRAO_HEROI : PADRAO_INIMIGO)) as Partial<Heroi & Inimigo & Ameaca>;
  const opcoesImagem: [string, string][] = [
    ['', '(sem imagem)'],
    ...imagens.map((i): [string, string] => [i.url, `${{ bosses: '🐉', galeria: '🖼' }[i.pasta as string] ?? '🧙'} ${i.nome}`]),
  ];

  const salvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    if (!heroi) {
      d.ataques = lerLinhasDeAtaque(String(d.ataquesTexto ?? ''));
      Object.assign(d, lerDefesas(String(d.defesasTexto ?? '')));
      if (doBestiario) d.texto = d.bloco;
      delete d.ataquesTexto;
      delete d.defesasTexto;
      delete d.bloco;
      if (!doBestiario) d.naTela = (form.elements.namedItem('naTela') as HTMLInputElement).checked;
      d.habilidades = habs.filter((h) => h.nome.trim());
    }
    if (doBestiario) {
      if (await pedirBestiario(avisar, { acao: 'salvar', id: ameaca?.id, dados: d })) fechar();
      return;
    }
    enviar(novo ? { tipo: 'criar', lado, dados: d } : { tipo: 'definir', id: ent!.id, patch: d });
    fechar();
  };

  const num = (rotulo: string, nome: string, valor: unknown, extra: Record<string, unknown> = {}) => (
    <Campo rotulo={rotulo}><input type="number" name={nome} defaultValue={valor as number ?? ''} {...extra} /></Campo>
  );
  const texto = (rotulo: string, nome: string, valor: unknown, extra: Record<string, unknown> = {}) => (
    <Campo rotulo={rotulo}><input type="text" name={nome} defaultValue={(valor as string) ?? ''} {...extra} /></Campo>
  );
  const seletor = (rotulo: string, nome: string, opcoes: [string, string][], atual: unknown) => (
    <Campo rotulo={rotulo}>
      <select name={nome} defaultValue={String(atual ?? '')}>
        {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </Campo>
  );

  return (
    <dialog id="editor" ref={dialogo} onClose={fechar} className={heroi ? '' : 'largo'}>
      <form
        method="dialog"
        id="formEditor"
        key={ent?.id ?? ameaca?.id ?? `novo-${lado}${doBestiario ? '-b' : ''}`}
        onSubmit={salvar}
        onInput={(e) => {
          const f = e.currentTarget.elements;
          setPrevia({
            imagem: (f.namedItem('imagem') as HTMLSelectElement).value,
            nome: (f.namedItem('nome') as HTMLInputElement).value,
            cor: heroi ? (f.namedItem('cor') as HTMLInputElement).value : '',
          });
        }}
      >
        <div className="cabeca-form">
          <Retrato ent={{ imagem: previa.imagem, nome: previa.nome || '?' }} classe="previa" style={{ '--cor': heroi ? previa.cor : 'var(--inimigo)' } as CSSProperties} />
          <div>
            <small>{novo ? 'Criar' : 'Editar'} · {doBestiario ? 'Bestiário' : heroi ? 'Herói' : 'Inimigo'}</small>
            <h3>{novo ? (doBestiario ? 'Nova ameaça' : heroi ? 'Novo herói' : 'Novo inimigo') : dados.nome}</h3>
          </div>
        </div>
        <Secao titulo="Identidade" />
        <div className="grade">
          {texto('Nome', 'nome', dados.nome, { required: true, maxLength: 40 })}
          {heroi ? texto('Classe', 'classe', dados.classe) : texto('Subtítulo', 'subtitulo', dados.subtitulo)}
          {heroi ? texto('Jogador', 'jogador', dados.jogador) : texto('ND', 'nd', dados.nd)}
        </div>
        <Secao titulo="Atributos" />
        <div className="grade">
          {heroi ? num('Nível', 'nivel', dados.nivel, { min: 1, max: 20 }) : null}
          {num('PV máximo', 'pvMax', dados.pvMax, { min: 1 })}
          {novo || doBestiario ? null : num('PV atual', 'pv', dados.pv)}
          {num('PM máximo', 'pmMax', dados.pmMax ?? 0, { min: 0 })}
          {novo || doBestiario ? null : num('PM atual', 'pm', dados.pm, { min: 0 })}
          {num('Defesa', 'defesa', dados.defesa, { min: 0 })}
          {num('Bônus de iniciativa', 'bonusIni', dados.bonusIni)}
          {heroi ? null : num('Fortitude', 'fort', dados.fort)}
          {heroi ? null : num('Reflexos', 'ref', dados.ref)}
          {heroi ? null : num('Vontade', 'von', dados.von)}
        </div>
        <Secao titulo="Aparência" />
        {seletor('Imagem (arquivos nas pastas personagens/ e bosses/)', 'imagem', opcoesImagem, dados.imagem ?? '')}
        {heroi ? (
          <Campo rotulo="Cor do herói"><input type="color" name="cor" defaultValue={dados.cor ?? '#e9c46a'} /></Campo>
        ) : (
          <div className="grade">
            {seletor('Tema do efeito', 'tema', TEMAS.map((t): [string, string] => [t, NOME_TEMA[t]]), dados.tema)}
            {seletor('Ameaça (estrela)', 'tier', TIERS.map((t): [string, string] => [t, NOME_TIER[t]]), dados.tier)}
            {seletor('Jogadores veem o PV', 'revelar', REVELAR.map((r): [string, string] => [r, NOME_REVELAR[r]]), dados.revelar)}
          </div>
        )}
        {heroi ? null : <Secao titulo="Combate" />}
        {heroi ? null : (
          <details className="colar-bloco" open={doBestiario && novo}>
            <summary>📖 {doBestiario && !novo ? 'Bloco do livro (texto completo)' : 'Colar bloco de estatísticas do livro'}</summary>
            <textarea name="bloco" defaultValue={doBestiario ? dados.texto ?? '' : ''} placeholder={'Orc Chefe  ND 2\nIniciativa +5, Percepção +3\nDefesa 19, Fort +13, Ref +7, Von +2\nPontos de Vida 66\nCorpo a Corpo Machado de batalha +11 (1d8+12, x3).'} />
            <button
              type="button"
              className="btn pequeno ouro"
              onClick={(e) => {
                const f = e.currentTarget.form!;
                const campo = (n: string) => f.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
                const b = lerBlocoAmeaca(campo('bloco')!.value);
                if (!b) { alert('Não achei "Defesa ..., Fort ..., Ref ..., Von ..." e "Pontos de Vida" no texto colado.'); return; }
                const pares: [string, string | number][] = [
                  ['nome', b.nome], ['nd', b.nd ? `ND ${b.nd}` : ''], ['subtitulo', b.tipo], ['pvMax', b.pv], ['pmMax', b.pm], ['defesa', b.defesa],
                  ['fort', b.fort], ['ref', b.ref], ['von', b.von], ['bonusIni', b.iniciativa],
                  ['ataquesTexto', escreverAtaques(b.ataques)],
                  ['defesasTexto', escreverDefesas({ rd: b.defesas.rd, imunidades: b.defesas.imunidades, vulnerabilidades: b.defesas.vulnerabilidades })],
                  ['notas', [b.atributos, b.pericias && `Perícias: ${b.pericias}`, b.equipamento && `Equipamento: ${b.equipamento}`].filter(Boolean).join('\n')],
                ];
                for (const [n, v] of pares) { const c = campo(n); if (c && v !== '') c.value = String(v); }
                // Mantem o chip do telao das habilidades que ja existiam com o mesmo nome.
                const ativas = new Set(habs.filter((h) => h.ativa).map((h) => h.nome.toLowerCase()));
                setHabs(b.habilidades.map((h) => ({ ...h, ativa: ativas.has(h.nome.toLowerCase()) })));
                const pv = campo('pv');
                if (pv) pv.value = String(b.pv);
                f.dispatchEvent(new Event('input', { bubbles: true }));
              }}
            >Preencher a ficha</button>
          </details>
        )}
        {heroi ? null : (
          <Campo rotulo="Ataques (um por linha, como no livro: Mordida +7 (1d6+4, x3))">
            <textarea name="ataquesTexto" defaultValue={escreverAtaques(dados.ataques ?? [])} />
          </Campo>
        )}
        {heroi ? null : (
          <Campo rotulo="Defesas especiais (redução de dano 5, redução de fogo 10, imunidade a veneno, vulnerabilidade a frio)">
            <input type="text" name="defesasTexto" defaultValue={escreverDefesas(dados)} />
          </Campo>
        )}
        {heroi ? null : <Secao titulo="Mestre" />}
        {heroi ? null : (
          <div className="campo-habs">
            <span className="rotulo-habs">Habilidades e magias ({habs.length}) — viram botões na carta; “Telão” mostra o nome para os jogadores</span>
            <HabilidadesEditor lista={habs} mudar={setHabs} />
          </div>
        )}
        {heroi ? null : (
          <Campo rotulo="Notas secretas (só você vê)">
            <textarea name="notas" defaultValue={dados.notas ?? ''} />
          </Campo>
        )}
        {heroi || doBestiario ? null : (
          <label className="check"><input type="checkbox" name="naTela" defaultChecked={Boolean(dados.naTela)} />Aparece no telão</label>
        )}
        <div className="rodape">
          {doBestiario && ameaca ? (
            <div className="esq">
              <Botao
                classe="perigo"
                icone="lixo"
                texto="Remover"
                onClick={async () => {
                  if (!confirm(`Remover ${ameaca.nome} do bestiário? (as cartas já na mesa continuam)`)) return;
                  if (await pedirBestiario(avisar, { acao: 'remover', id: ameaca.id })) fechar();
                }}
              />
            </div>
          ) : null}
          {novo || doBestiario ? null : (
            <div className="esq">
              {heroi ? null : <Botao icone="duplicar" texto="Duplicar" onClick={() => { enviar({ tipo: 'duplicar', id: ent!.id }); fechar(); }} />}
              {heroi || (ent as Inimigo).chefeFinal ? null : (
                <Botao
                  icone="coroa"
                  texto="Tornar chefe final"
                  title="Ameaças de Arton, p. 370: dobra o PV, +2 PM por ND, Maior que a Morte, RD 5/10/20 pelo patamar e ND +2 (dá para desfazer)"
                  onClick={async () => {
                    if (!confirm(`Transformar ${ent!.nome} em chefe final?`)) return;
                    if (await enviar({ tipo: 'chefeFinal', id: ent!.id })) fechar();
                  }}
                />
              )}
              {heroi ? null : (
                <Botao
                  icone="caveira"
                  texto={(ent as Inimigo).ameacaId ? 'Atualizar no bestiário' : 'Guardar no bestiário'}
                  title="Guarda esta ficha (como está salva agora) para reusar em outras sessões"
                  onClick={async () => {
                    const r = await pedirBestiario(avisar, { acao: 'daMesa', inimigoId: ent!.id });
                    if (r) avisar(r.atualizada ? 'Ficha atualizada no bestiário.' : 'Guardado no bestiário.', 'info');
                  }}
                />
              )}
              <Botao
                classe="perigo"
                icone="lixo"
                texto="Remover"
                onClick={() => {
                  if (!confirm(`Remover ${ent!.nome}?`)) return;
                  aoRemover(ent!.id);
                  enviar({ tipo: 'remover', id: ent!.id });
                  fechar();
                }}
              />
            </div>
          )}
          <Botao classe="fantasma" texto="Cancelar" onClick={fechar} />
          <button type="submit" className="btn ouro"><Icone nome="check" /><span>Salvar</span></button>
        </div>
      </form>
    </dialog>
  );
}
