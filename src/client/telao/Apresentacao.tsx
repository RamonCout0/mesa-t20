// Apresentacao das acoes no telao: o dado cai saindo da carta de quem rolou, aparece o total,
// a animacao vai ate o alvo e, no impacto, a barra de PV desce e o numero de dano sobe.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ResultadoAcao, AlvoResultado } from '../../shared/acoes.ts';
import { BandejaDados, type ControleBandeja } from '../dados3d/BandejaDados.tsx';
import { MotorFx, type Ponto } from '../fx/motor.ts';
import { tocarArma, tocarMagia, type AlvoFx } from '../fx/arquetipos.ts';
import { ELEMENTO_DO_DANO } from '../fx/paletas.ts';
import { elementoDe, flutuante, pulsar } from './efeitos.ts';
import { somAcerto, somCritico, somCura, somDados, somErro, somMagia } from './sons.ts';

const NOME_DESFECHO: Record<string, string> = {
  acerto: 'Acertou', critico: 'Crítico!', erro: 'Errou', resistiu: 'Resistiu', anulado: 'Anulou', imune: 'Imune', cura: '', efeito: '',
};
const TESTE: Record<string, string> = { fort: 'Fortitude', ref: 'Reflexos', von: 'Vontade' };
const MAX_DADOS = 12;

/** Avisa o servidor que o telao ja mostrou o resultado (o celular de quem agiu mostra o resumo). */
function avisarApresentado(id: string) {
  fetch('/api/apresentado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
}

interface Faixa {
  autor: string;
  cor: string;
  titulo: string;
  totais: { rotulo: string; total: number }[];
}

function centroDe(el: Element | null): (Ponto & { raio: number }) | null {
  if (!el) return null;
  const alvo = el.id === 'boss' ? document.getElementById('molduraBoss') ?? el : el.querySelector('.retrato, .vn-sprite') ?? el;
  const r = alvo.getBoundingClientRect();
  if (!r.width) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, raio: Math.max(40, Math.min(r.width, r.height) / 2) };
}

/** Carimbo do desfecho sobre o alvo (ACERTOU, CRITICO, ERROU...). */
function carimbo(el: Element, a: AlvoResultado) {
  const txt = a.carimbo ?? NOME_DESFECHO[a.desfecho];
  const s = a.salvamento;
  const linhas = [txt, s ? `${TESTE[s.teste]} ${s.dado}${s.passou ? ' ✓' : ' ✗'}` : ''].filter(Boolean);
  if (!linhas.length) return;
  const caixa = el.id === 'boss' ? document.getElementById('molduraBoss') ?? el : el;
  const d = document.createElement('div');
  d.className = `carimbo-acao ${a.desfecho} lado-${a.lado}`;
  d.innerHTML = linhas.map((l, i) => `<${i ? 'small' : 'b'}></${i ? 'small' : 'b'}>`).join('');
  [...d.children].forEach((c, i) => { c.textContent = linhas[i]; });
  caixa.append(d);
  setTimeout(() => d.remove(), 1900);
}

interface Props {
  /** Registra a funcao que recebe as acoes do servidor. */
  registrar: (f: (r: ResultadoAcao) => void) => void;
  /** Segura a imagem antiga de um combatente (PV de antes) ate o impacto. */
  segurar: (ids: string[]) => void;
  soltar: (id: string) => void;
  /** A apresentacao desta acao acabou. */
  terminou: (r: ResultadoAcao) => void;
}

export function Apresentacao({ registrar, segurar, soltar, terminou }: Props) {
  const bandeja = useRef<ControleBandeja>(null);
  const canvasFx = useRef<HTMLCanvasElement>(null);
  const motor = useRef<MotorFx | null>(null);
  const fila = useRef<ResultadoAcao[]>([]);
  const ocupado = useRef(false);
  const [faixa, setFaixa] = useState<Faixa | null>(null);
  const [mostrarTotais, setMostrarTotais] = useState(false);

  useEffect(() => {
    const m = new MotorFx(canvasFx.current!);
    m.aoTremer = () => pulsar(document.getElementById('raiz'), 'tremendo');
    motor.current = m;
  }, []);

  useEffect(() => {
    const apresentar = async (r: ResultadoAcao) => {
      const m = motor.current!;
      setMostrarTotais(false);
      setFaixa({
        autor: r.autor.nome, cor: r.autor.cor, titulo: r.titulo,
        totais: r.rolagens.filter((x) => !x.alvoId).map((x) => ({ rotulo: x.rotulo, total: x.total })),
      });

      // 1) Dados: saem da carta de quem rolou.
      const elAutor = elementoDe(r.autor.id);
      const pAutor = centroDe(elAutor) ?? { x: innerWidth / 2, y: innerHeight * 0.85, raio: 60 };
      const dados = r.rolagens.filter((x) => !x.alvoId).flatMap((x) => x.dados).slice(0, MAX_DADOS);
      if (dados.length) {
        if (elAutor) pulsar(elAutor, 'lancando', 900);
        const origem = (pAutor.x / innerWidth) * 2 - 1;
        somDados(dados.length);
        await bandeja.current?.rolar(dados.map((d) => ({ faces: d.faces, valor: Math.abs(d.valor), modelo: r.dado })), 1600, origem, 'queda');
        setMostrarTotais(true);
        await m.esperar(r.tipo === 'rolagem' ? 1600 : 650);
        bandeja.current?.limpar();
      }
      if (r.tipo === 'rolagem') {
        avisarApresentado(r.id);
        setFaixa(null);
        return;
      }

      // 2) Efeito do autor ate os alvos.
      const alvosEl = r.alvos.map((a) => elementoDe(a.id));
      const alvosFx: AlvoFx[] = r.alvos.map((a, i) => {
        const c = centroDe(alvosEl[i]) ?? { x: innerWidth / 2, y: innerHeight * 0.4, raio: 80 };
        return { p: c, raio: c.raio, desfecho: a.desfecho };
      });
      const impactou = new Set<number>();
      const aoImpacto = (i: number) => {
        if (impactou.has(i)) return;
        impactou.add(i);
        if (impactou.size === 1) avisarApresentado(r.id);
        const a = r.alvos[i];
        // Som do golpe: so nos dois primeiros alvos, para area nao virar barulho.
        if (impactou.size <= 2) {
          if (a.desfecho === 'critico') somCritico();
          else if (a.dano) somAcerto(a.dano >= 20);
          else if (a.cura || a.temp) somCura();
          else if (a.desfecho === 'erro' || a.desfecho === 'anulado' || a.desfecho === 'imune') somErro();
        }
        const el = alvosEl[i];
        soltar(a.id);
        if (!el) return;
        if (a.dano) {
          pulsar(el, 'tomou-dano', 600);
          flutuante(el.id === 'boss' ? document.getElementById('molduraBoss')! : el, `dano${a.desfecho === 'critico' || a.dano >= 20 ? ' forte' : ''}`, `−${a.dano}`);
        }
        if (a.cura) flutuante(el, 'cura', `+${a.cura}`);
        if (a.temp) flutuante(el, 'temp', `+${a.temp}`);
        carimbo(el, a);
      };
      const cena = { motor: m, de: pAutor, raioAutor: pAutor.raio, aoImpacto };
      try {
        if (r.anim.arma && alvosFx[0]) {
          await tocarArma({ ...cena, alvo: alvosFx[0], tipo: r.anim.arma, elemento: ELEMENTO_DO_DANO[r.anim.tipoDano ?? ''] });
        } else if (r.anim.magia) {
          somMagia(r.anim.magia.elemento);
          await tocarMagia({ ...cena, alvos: alvosFx }, r.anim.magia);
        }
      } finally {
        r.alvos.forEach((_, i) => aoImpacto(i));
      }
      if (!r.alvos.length) avisarApresentado(r.id);
      if (r.autoCura && elAutor) flutuante(elAutor, 'cura', `+${r.autoCura}`);
      await m.esperar(900);
      setFaixa(null);
    };

    const proximo = async () => {
      if (ocupado.current) return;
      const r = fila.current.shift();
      if (!r) return;
      ocupado.current = true;
      try {
        await apresentar(r);
      } catch (erro) {
        console.warn('Falha ao apresentar acao', erro);
      }
      terminou(r);
      ocupado.current = false;
      proximo();
    };

    registrar((r) => {
      segurar(r.alvos.map((a) => a.id));
      fila.current.push(r);
      proximo();
    });
  }, [registrar, segurar, soltar, terminou]);

  return (
    <>
      <BandejaDados controle={bandeja} classe="dados-telao" />
      <canvas ref={canvasFx} className="fx-canvas" />
      {faixa ? (
        <div className="faixa-acao" style={{ '--cor': faixa.cor } as CSSProperties}>
          <small>{faixa.autor}</small>
          <b>{faixa.titulo}</b>
          {mostrarTotais && faixa.totais.length ? (
            <div className="faixa-totais">
              {faixa.totais.map((t, i) => <span key={i}><i>{t.rotulo}</i>{t.total}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
