// Aba Galeria: imagens para mostrar aos jogadores, tokens e cenarios.
import { useEffect, useRef, useState } from 'react';
import type { Estado, ImagemGaleria } from '../comum/tipos-cliente.ts';
import { postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import { pin, usePainel } from './contexto.ts';
import { Botao } from './Botao.tsx';

const NOME_PASTA: Record<string, string> = { galeria: 'Galeria', personagens: 'Herói', bosses: 'Inimigo', cenarios: 'Cenário' };
const FILTROS: [string, string][] = [['tudo', 'Tudo'], ['galeria', 'Galeria'], ['personagens', 'Heróis'], ['bosses', 'Inimigos'], ['cenarios', 'Cenários']];
const DESTINO: Record<string, string> = { galeria: 'Galeria', personagens: 'Heróis (tokens)', bosses: 'Inimigos (tokens)', cenarios: 'Cenários (fundos das cenas)' };
const EH_IMAGEM = /\.(png|jpe?g|webp|gif|svg)$/i;

// "mapa-da-cidade.jpg" -> "Mapa da cidade". Nome de camera/colado (muitos digitos) fica sem titulo.
function tituloDoArquivo(nome: string) {
  const base = nome.replace(/\.[^.]+$/, '');
  if (/\d{4,}/.test(base) || base.startsWith('colad')) return '';
  const texto = base.replace(/[-_]+/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

interface Props {
  visivel: boolean;
  estado: Estado;
  imagens: ImagemGaleria[];
  recarregar: () => Promise<void>;
  /** Registra quem recebe arquivos arrastados/colados em qualquer lugar do painel. */
  registrarEnvio: (f: (arquivos: FileList | File[]) => void) => void;
  abrirGaleria: () => void;
}

export function Galeria({ visivel, estado, imagens, recarregar, registrarEnvio, abrirGaleria }: Props) {
  const { enviar, avisar } = usePainel();
  const [filtro, setFiltro] = useState('tudo');
  const [novas, setNovas] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState<string | null>(null);
  const campoArquivos = useRef<HTMLInputElement>(null);
  const m = estado.cena.mostrar;

  // A pasta de destino acompanha o filtro: no filtro "Heróis" o envio vira token de heroi, etc.
  const destino = filtro === 'tudo' ? 'galeria' : filtro;

  const enviarArquivos = async (arquivos: FileList | File[]) => {
    const lista = [...arquivos].filter((f) => f.type.startsWith('image/') || EH_IMAGEM.test(f.name));
    if (!lista.length) return avisar('Nenhuma imagem encontrada. Use PNG, JPG, WEBP, GIF ou SVG.');
    abrirGaleria();
    avisar(lista.length > 1 ? `Enviando ${lista.length} imagens…` : 'Enviando imagem…', 'info');
    let certas = 0;
    for (const f of lista) {
      // Imagem colada (print, copiar imagem) chega sem nome de verdade.
      const colada = !f.name || /^image\.\w+$/i.test(f.name);
      const nome = colada ? `colada-${Date.now()}.${(f.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')}` : f.name;
      try {
        const resp = await fetch(`/api/enviar-imagem?pasta=${destino}`, {
          method: 'POST',
          headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-nome': encodeURIComponent(nome), 'x-pin': pin },
          body: f,
        });
        const dados = await resp.json();
        if (!dados.ok) { avisar(dados.erro); continue; }
        certas += 1;
        setNovas((s) => new Set(s).add(dados.url));
        setTimeout(() => setNovas((s) => { const n = new Set(s); n.delete(dados.url); return n; }), 2500);
      } catch {
        avisar('Sem conexão com o servidor.');
      }
    }
    await recarregar();
    if (certas) avisar(certas > 1 ? `${certas} imagens enviadas.` : 'Imagem enviada.', 'info');
  };

  const envioRef = useRef(enviarArquivos);
  envioRef.current = enviarArquivos;
  useEffect(() => registrarEnvio((a) => envioRef.current(a)), [registrarEnvio]);

  const mostrar = (img: ImagemGaleria) => enviar({ tipo: 'mostrar', imagem: img.url, titulo: tituloDoArquivo(img.nome) });
  const esconder = () => enviar({ tipo: 'mostrar', acao: 'esconder' });
  const remover = async (img: ImagemGaleria) => {
    if (!confirm(`Remover "${img.nome}"?\nO arquivo vai para a pasta lixeira/ e pode ser recuperado.`)) return;
    const r = await postar('/api/remover-imagem', { url: img.url }, { 'x-pin': pin });
    if (!r.ok) return avisar(r.erro ?? 'Erro ao remover.');
    avisar(`"${img.nome}" foi para a lixeira.`, 'info');
    recarregar();
  };

  const salvarTitulo = () => {
    if (m && titulo !== null && titulo.trim() !== m.titulo) enviar({ tipo: 'mostrar', imagem: m.imagem, titulo });
    setTitulo(null);
  };

  const conta = (f: string) => imagens.filter((i) => f === 'tudo' || i.pasta === f).length;
  const lista = imagens.filter((i) => filtro === 'tudo' || i.pasta === filtro).sort((a, b) => b.data - a.data);

  return (
    <section className="galeria" id="abaGaleria" hidden={!visivel}>
      {m ? (
        <div className="exibindo" id="exibindo">
          <div className="exibindo-img" style={{ backgroundImage: `url("${m.imagem}")` }} />
          <div className="exibindo-info">
            <span className="ao-vivo"><i />No telão agora</span>
            <input
              type="text"
              maxLength={80}
              placeholder="Título para os jogadores (opcional)"
              title="Enter salva o título"
              value={titulo ?? m.titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={salvarTitulo}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          </div>
          <Botao classe="perigo" icone="olhoFechado" texto="Esconder" onClick={esconder} />
        </div>
      ) : null}

      <header className="secao-topo">
        <h2>Galeria</h2>
        <span className="conta">{imagens.length}</span>
        <div className="filtros">
          {FILTROS.map(([f, nome]) => (
            <button key={f} type="button" className={`filtro ${filtro === f ? 'ativo' : ''}`} onClick={() => setFiltro(f)}>
              {nome}<b>{conta(f)}</b>
            </button>
          ))}
        </div>
        <span className="deco" />
      </header>

      <div className="grade-galeria">
        <button className="tile-enviar" type="button" onClick={() => campoArquivos.current?.click()}>
          <span className="icone-grande"><Icone nome="enviar" /></span>
          <b>Enviar imagens</b>
          <small>Clique, arraste arquivos aqui<br />ou cole com Ctrl+V</small>
          <span className="destino">Vai para: {DESTINO[destino]}</span>
        </button>
        <div className="itens-galeria">
          {lista.map((img) => {
            const noAr = m?.imagem === img.url;
            return (
              <div key={img.url} className={`item-galeria ${noAr ? 'no-ar' : ''} ${novas.has(img.url) ? 'nova' : ''}`} title={img.nome}>
                <div className="miniatura" style={{ backgroundImage: `url("${img.url}")` }}>
                  <span className="selo-no-ar"><i />No telão</span>
                  <button type="button" className={`btn btn-mostrar ${noAr ? 'perigo' : 'ouro'}`} onClick={() => (noAr ? esconder() : mostrar(img))}>
                    <Icone nome={noAr ? 'olhoFechado' : 'tela'} />
                    <span>{noAr ? 'Esconder' : 'Mostrar aos jogadores'}</span>
                  </button>
                </div>
                <div className="item-rodape">
                  <span className="item-nome">{img.nome.replace(/\.[^.]+$/, '')}</span>
                  <span className="item-pasta">{NOME_PASTA[img.pasta] ?? img.pasta}</span>
                  <Botao classe="icone pequeno fantasma btn-remover" icone="lixo" title="Remover (vai para a pasta lixeira/)" onClick={() => remover(img)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <input
        type="file"
        ref={campoArquivos}
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        multiple
        hidden
        onChange={(e) => { if (e.target.files) enviarArquivos(e.target.files); e.target.value = ''; }}
      />
    </section>
  );
}
