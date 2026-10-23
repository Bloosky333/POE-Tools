import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <TopBar onToggleNav={() => setNavOpen((open) => !open)} />
      <div className="flex flex-1">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
      <footer className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 md:px-8 dark:border-gray-800">
        Price data from{' '}
        <a className="underline" href="https://poe.ninja">
          poe.ninja
        </a>
        . Not affiliated with Grinding Gear Games. <Link to="/">POE Tools</Link> ·{' '}
        <a className="underline" href="https://github.com/Bloosky333/POE-Tools">
          source
        </a>
      </footer>
    </div>
  );
}
