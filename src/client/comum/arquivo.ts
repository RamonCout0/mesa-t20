// Baixar dados como arquivo no aparelho (ficha, backup), sem passar pelo servidor.

/** Nome de arquivo seguro: "Lyra Andarilha" -> "lyra-andarilha". */
export const nomeArquivo = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ficha';

export function baixarJson(nome: string, dados: unknown) {
  const blob = new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
