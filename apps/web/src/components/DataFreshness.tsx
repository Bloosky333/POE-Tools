import { getLeague } from '@poe-tools/shared';
import { fetchCurrent, useAsync } from '../lib/data.ts';
import { formatAge } from '../lib/format.ts';
import { useNow } from '../lib/useNow.ts';
import { useSettings } from '../lib/useSettings.ts';

/** "Prices 23 min ago" for the selected league; flagged when older than 3 hours. */
export function DataFreshness() {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const now = useNow();
  const state = useAsync(`current:${settings.leagueId}`, () =>
    fetchCurrent(settings.game, settings.leagueId),
  );
  if (!league || state.status === 'loading') return null;
  if (state.status === 'error') {
    return <span className="text-xs text-amber-700 dark:text-amber-400">⚠ No price data</span>;
  }
  const stale = now - Date.parse(state.data.fetchedAt) > 3 * 60 * 60 * 1000;
  return (
    <span
      className={`text-xs ${stale ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500'}`}
      title={`Prices fetched ${new Date(state.data.fetchedAt).toLocaleString()}`}
    >
      {stale && '⚠ '}Prices {formatAge(state.data.fetchedAt, now)}
    </span>
  );
}
