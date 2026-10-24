import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from '../components/icons.tsx';

/** Right-side detail panel over a dimmed page. Closes on Escape or backdrop click. */
export function Sheet({
  label,
  header,
  onClose,
  children,
}: {
  label: string;
  header: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        aria-label={label}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="space-y-5 p-5">{children}</div>
      </aside>
    </>
  );
}
