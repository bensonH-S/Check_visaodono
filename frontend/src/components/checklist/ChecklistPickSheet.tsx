import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type ChecklistPickOption = {
  id: string | number;
  label: string;
  meta?: string;
};

type Props = {
  open: boolean;
  title: string;
  options: ChecklistPickOption[];
  selectedId?: string | number | null;
  onSelect: (id: string | number) => void;
  onClose: () => void;
};

/** Bottom sheet mobile — portal no body, largura = viewport do aparelho. */
export default function ChecklistPickSheet({
  open,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="ck-pick" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ck-pick__backdrop" aria-label="Fechar" onClick={onClose} />
      <div className="ck-pick__sheet">
        <div className="ck-pick__handle" aria-hidden />
        <header className="ck-pick__head">
          <h2>{title}</h2>
          <span>{options.length} opções</span>
        </header>
        <ul className="ck-pick__list">
          {options.map((opt) => {
            const on = selectedId != null && String(selectedId) === String(opt.id);
            return (
              <li key={String(opt.id)}>
                <button
                  type="button"
                  className={`ck-pick__item${on ? ' is-on' : ''}`}
                  onClick={() => {
                    onSelect(opt.id);
                    onClose();
                  }}
                >
                  <span className="ck-pick__item-text">
                    <strong>{opt.label}</strong>
                    {opt.meta ? <small>{opt.meta}</small> : null}
                  </span>
                  <span className={`ck-pick__tick${on ? ' is-on' : ''}`} aria-hidden>
                    {on ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="ck-pick__foot">
          <button type="button" className="ck-pick__cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
