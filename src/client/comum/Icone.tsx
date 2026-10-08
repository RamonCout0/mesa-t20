import { ICONES } from './icones-dados.ts';

export function Icone({ nome, classe = '' }: { nome: string; classe?: string }) {
  return (
    <svg
      className={`ico ${classe}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONES[nome] ?? '' }}
    />
  );
}
