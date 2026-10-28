import { useState } from 'react';
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

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />
      <div className="flex flex-1">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
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
