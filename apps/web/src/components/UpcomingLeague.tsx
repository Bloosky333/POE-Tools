import { GAME_LABELS, getLeague, getReferenceLeague, hasStarted } from '@poe-tools/shared';
import { useNow } from '../lib/useNow.ts';
import { useSettings } from '../lib/useSettings.ts';
import { Notice } from '../ui/index.ts';

/**
 * Shown instead of a tool while the selected league has not started (e.g. PoE 1 between two
 * leagues): tools need the new league's prices, compared with its reference league.
 */
export function UpcomingLeague() {
  const { settings } = useSettings();
  const now = useNow();
  const league = getLeague(settings.leagueId);
  if (!league || hasStarted(league, new Date(now))) return null;
  const reference = getReferenceLeague(league);
  const start = new Date(league.startsAt);
  const days = Math.ceil((start.getTime() - now) / 86_400_000);
  return (
    <Notice>
      <strong>
        {GAME_LABELS[league.game]} {league.name} starts on{' '}
        {start.toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        })}{' '}
        UTC
      </strong>{' '}
      (in {days} day{days === 1 ? '' : 's'}). Prices appear here from launch
      {reference ? `, compared with ${reference.name}` : ''}.
    </Notice>
  );
}

/** Whether the selected league has started (tools have data to show). */
export function useLeagueStarted(): boolean {
  const { settings } = useSettings();
  const now = useNow();
  const league = getLeague(settings.leagueId);
  return !league || hasStarted(league, new Date(now));
}
