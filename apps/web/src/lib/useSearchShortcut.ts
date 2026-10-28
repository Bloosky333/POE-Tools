import { useEffect } from 'react';

/** `/` focuses the page's search box (`input[type=search]`), unless already typing. */
export function useSearchShortcut(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const search = document.querySelector<HTMLInputElement>('main input[type="search"]');
      if (!search) return;
      event.preventDefault();
      search.focus();
      search.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
