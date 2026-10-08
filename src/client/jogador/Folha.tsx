import { useEffect, type ReactNode } from 'react';

/** Painel que sobe de baixo da tela (detalhe de magia, escolha de alvo...). */
export function Folha({ fechar, children }: { fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    addEventListener('keydown', tecla);
    return () => { document.body.style.overflow = antes; removeEventListener('keydown', tecla); };
  }, [fechar]);
  return (
    <>
      <div className="folha-fundo" onClick={fechar} />
      <section className="folha" role="dialog" aria-modal="true">{children}</section>
    </>
  );
}
