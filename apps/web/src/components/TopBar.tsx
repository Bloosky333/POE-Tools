import { ENABLED_GAMES, GAMES, LEAGUES, getLeague, leagueDay, type Game } from '@poe-tools/shared';
import { Link } from 'react-router';
import type { Theme } from '../lib/settings.ts';
import { useNow } from '../lib/useNow.ts';
import { useSettings } from '../lib/useSettings.ts';
import { DataFreshness } from './DataFreshness.tsx';
import { LogoMark, MenuIcon } from './icons.tsx';

const GAME_SHORT: Record<Game, string> = { poe2: 'PoE 2', poe1: 'PoE 1' };
const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

export const selectClass =
  'h-8 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg outline-none hover:border-subtle focus-visible:border-accent';

export function TopBar({ onToggleNav }: { onToggleNav: () => void }) {
  const { settings, update } = useSettings();
  const now = useNow();
  const leagues = LEAGUES.filter((l) => l.game === settings.game && l.selectable);
  const league = getLeague(settings.leagueId);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
      <button
        type="button"
        className="rounded-md p-1.5 text-muted hover:bg-surface-2 md:hidden"
        aria-label="Toggle navigation"
        onClick={onToggleNav}
      >
        <MenuIcon />
      </button>
      <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <LogoMark />
        <span>
          POE <span className="text-accent">Tools</span>
        </span>
      </Link>

      <div
        role="radiogroup"
        aria-label="Game"
        className="ml-4 hidden rounded-md border border-line bg-surface-2 p-0.5 sm:flex"
      >
        {GAMES.map((game) => {
          const enabled = ENABLED_GAMES.includes(game);
          const active = settings.game === game;
          return (
            <button
              key={game}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!enabled}
              title={enabled ? undefined : 'Coming soon'}
              onClick={() => update({ game })}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                active ? 'bg-surface text-fg shadow-sm' : 'text-subtle'
              } ${enabled ? 'hover:text-fg' : 'cursor-not-allowed opacity-60'}`}
            >
              {GAME_SHORT[game]}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <DataFreshness />
        <label className="sr-only" htmlFor="league">
          League
        </label>
        <div className="flex items-center gap-2">
          <select
            id="league"
            className={selectClass}
            value={settings.leagueId}
            onChange={(e) => update({ leagueId: e.target.value })}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {league && (
            <span className="hidden rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent lg:inline">
              Day {leagueDay(league.startsAt, new Date(now))}
            </span>
          )}
        </div>
        <label className="sr-only" htmlFor="theme">
          Theme
        </label>
        <select
          id="theme"
          className={`${selectClass} hidden sm:block`}
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value as Theme })}
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
