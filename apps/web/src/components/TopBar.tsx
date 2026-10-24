import { ENABLED_GAMES, GAMES, GAME_LABELS, LEAGUES, type Game } from '@poe-tools/shared';
import { Link } from 'react-router';
import type { Theme } from '../lib/settings.ts';
import { DataFreshness } from './DataFreshness.tsx';
import { useSettings } from '../lib/useSettings.ts';

const THEMES: Theme[] = ['system', 'light', 'dark'];

const selectClass =
  'rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900';

export function TopBar({ onToggleNav }: { onToggleNav: () => void }) {
  const { settings, update } = useSettings();
  const leagues = LEAGUES.filter((l) => l.game === settings.game && l.selectable);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
      <button
        type="button"
        className="rounded px-2 py-1 text-lg md:hidden"
        aria-label="Toggle navigation"
        onClick={onToggleNav}
      >
        ☰
      </button>
      <Link to="/" className="font-semibold tracking-tight">
        POE Tools
      </Link>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DataFreshness />
        <label className="sr-only" htmlFor="game">
          Game
        </label>
        <select
          id="game"
          className={selectClass}
          value={settings.game}
          onChange={(e) => update({ game: e.target.value as Game })}
        >
          {GAMES.map((game) => (
            <option key={game} value={game} disabled={!ENABLED_GAMES.includes(game)}>
              {GAME_LABELS[game]}
              {ENABLED_GAMES.includes(game) ? '' : ' (coming soon)'}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="league">
          League
        </label>
        <select
          id="league"
          className={selectClass}
          value={settings.leagueId}
          onChange={(e) => update({ leagueId: e.target.value })}
        >
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="theme">
          Theme
        </label>
        <select
          id="theme"
          className={selectClass}
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value as Theme })}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {theme[0]?.toUpperCase() + theme.slice(1)} theme
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
