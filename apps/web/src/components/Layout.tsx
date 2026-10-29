import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSearchShortcut } from '../lib/useSearchShortcut.ts';
import { BackupControls } from './BackupControls.tsx';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { UpcomingLeague, useLeagueStarted } from './UpcomingLeague.tsx';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const started = useLeagueStarted();
  const onTool = useLocation().pathname.startsWith('/tools/');
  useSearchShortcut();
  const closeNav = useCallback(() => setNavOpen(false), []);
  useNavDrawer(navOpen, closeNav);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />
      <div className="flex flex-1">
        <Sidebar open={navOpen} onNavigate={closeNav} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[96rem] space-y-5">
            <UpcomingLeague />
            {(started || !onTool) && <Outlet />}
          </div>
        </main>
      </div>
      <footer className="border-t border-line px-4 py-3 text-xs text-subtle md:px-8">
        Price data from{' '}
        <a className="text-muted hover:text-accent" href="https://poe.ninja">
          poe.ninja
        </a>
        . Not affiliated with Grinding Gear Games ·{' '}
        <a className="text-muted hover:text-accent" href="https://github.com/Bloosky333/POE-Tools">
          Source
        </a>{' '}
        · <BackupControls />
      </footer>
    </div>
  );
}

/**
 * While the phone navigation drawer is open: the page behind it doesn't scroll, Escape closes
 * it, and so does widening the window past the drawer breakpoint (md).
 */
function useNavDrawer(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const desktop = window.matchMedia?.('(min-width: 48rem)');
    const onResize = () => desktop?.matches && close();
    window.addEventListener('keydown', onKey);
    desktop?.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      desktop?.removeEventListener('change', onResize);
    };
  }, [open, close]);
}
