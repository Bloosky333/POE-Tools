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
    return <Status tone="bad" label="No price data" />;
  }
  const stale = now - Date.parse(state.data.fetchedAt) > 3 * 60 * 60 * 1000;
  return (
    <Status
      tone={stale ? 'bad' : 'good'}
      label={`Prices ${formatAge(state.data.fetchedAt, now)}`}
      title={`Prices fetched ${new Date(state.data.fetchedAt).toLocaleString()}`}
    />
  );
}

function Status({ tone, label, title }: { tone: 'good' | 'bad'; label: string; title?: string }) {
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted md:flex" title={title}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone === 'good' ? 'bg-gain' : 'bg-warn'}`}
        aria-hidden
      />
      {tone === 'bad' && <span className="sr-only">Warning:</span>}
      {label}
    </span>
  );
}
