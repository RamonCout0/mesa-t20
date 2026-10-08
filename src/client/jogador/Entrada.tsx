// Primeira tela do celular: importar a ficha do Nimb ou entrar com o codigo do mestre.
import { useRef, useState } from 'react';
import { enviarArquivo, postar } from '../comum/conexao.ts';
import { Icone } from '../comum/Icone.tsx';
import type { Avisar } from './Aviso.tsx';

export function Entrada({ entrar, avisar }: { entrar: (codigo: string) => void; avisar: Avisar }) {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const criarDoZero = async () => {
    const nome = prompt('Nome do personagem:');
    if (!nome?.trim()) return;
    setEnviando(true);
    const r = await postar('/api/jogador/nova', { nome });
    setEnviando(false);
    if (!r.ok) return avisar(r.erro ?? 'Não consegui criar.');
    avisar('Personagem criado! Preencha a ficha em “Mais” → “Editar ficha”.', 'info');
    entrar(String(r.codigo));
  };

  const importar = async (f: File) => {
    setEnviando(true);
    const r = await enviarArquivo('/api/importar-ficha', f);
    setEnviando(false);
    if (!r.ok) return avisar(r.erro ?? 'Não consegui importar.');
    const avisos = (r.avisos as string[] | undefined) ?? [];
    if (avisos.length) avisar(avisos.join(' '), 'info');
    entrar(String(r.codigo));
  };

  return (
    <main className="j-entrada">
      <div className="j-marca">
        <span className="brasao"><Icone nome="d20" /></span>
        <h1>Mesa T20</h1>
        <p>Sua ficha na mão, seus dados no telão.</p>
      </div>

      <section className="j-cartao">
        <h2>Tenho a ficha no Fichas de Nimb</h2>
        <ol>
          <li>Abra sua ficha no <b>fichasdenimb.com.br</b>.</li>
          <li>Toque em <b>PDF</b> para baixar a ficha.</li>
          <li>Escolha o arquivo aqui embaixo.</li>
        </ol>
        <button type="button" className="j-btn ouro largo" disabled={enviando} onClick={() => arquivo.current?.click()}>
          <Icone nome="arquivo" />{enviando ? 'Lendo a ficha…' : 'Importar ficha (PDF)'}
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }}
        />
      </section>

      <section className="j-cartao">
        <h2>Não tenho ficha no Nimb</h2>
        <p>Crie o personagem aqui e preencha a ficha no próprio celular.</p>
        <button type="button" className="j-btn largo" disabled={enviando} onClick={criarDoZero}>
          <Icone nome="mais" />Criar personagem do zero
        </button>
      </section>

      <section className="j-cartao">
        <h2>Já estou na mesa</h2>
        <p>Escaneie o QR code que o mestre mostrar ou digite o código do seu personagem.</p>
        <form className="j-linha" onSubmit={(e) => { e.preventDefault(); if (codigo.trim().length >= 6) entrar(codigo.trim().toUpperCase()); }}>
          <input
            className="j-campo"
            value={codigo}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <button className="j-btn" disabled={codigo.length < 6}>Entrar</button>
        </form>
      </section>
    </main>
  );
}
