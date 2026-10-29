import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from '../components/icons.tsx';

/**
 * Right-side detail panel over a dimmed page (modal dialog). Closes on Escape or backdrop
 * click; focus moves into the panel and back to where it was on close.
 */
export function Sheet({
  label,
  header,
  onClose,
  wide = false,
  children,
}: {
  label: string;
  header: ReactNode;
  onClose: () => void;
  /** Room for a full-width table. */
  wide?: boolean;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`fixed inset-y-0 right-0 z-50 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} overflow-y-auto border-l border-line bg-surface shadow-2xl`}
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            ref={closeRef}
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
