import type { ReactNode } from 'react';
import { Icone } from '../comum/Icone.tsx';

interface Props {
  classe?: string;
  icone?: string;
  texto?: ReactNode;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  tipo?: 'button' | 'submit';
}

/** Botao com icone e texto opcionais. */
export function Botao({ classe = '', icone, texto, title, onClick, disabled, tipo = 'button' }: Props) {
  return (
    <button type={tipo} className={`btn ${classe}`.trim()} title={title} onClick={onClick} disabled={disabled}>
      {icone ? <Icone nome={icone} /> : null}
      {texto ? <span>{texto}</span> : null}
    </button>
  );
}
