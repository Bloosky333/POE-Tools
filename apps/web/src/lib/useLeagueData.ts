import { getLeague, getReferenceLeague, leagueDay } from '@poe-tools/shared';
import { fetchCurrent, fetchLeagueHistory, useAsync, type AsyncState } from './data.ts';
import { useNow } from './useNow.ts';
import { useSettings } from './useSettings.ts';

export interface LeagueData {
  current: Awaited<ReturnType<typeof fetchCurrent>>;
  currentHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
  referenceHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
}

/**
 * The selected league, its reference league, today's league day and the data every
 * price tool needs: current prices and the daily history of both leagues.
 */
export function useLeagueData() {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const reference = league && getReferenceLeague(league);
  const now = useNow();
  const today = league ? leagueDay(league.startsAt, new Date(now)) : 0;

  const data: AsyncState<LeagueData> = useAsync(`league-data:${settings.leagueId}`, async () => {
    if (!league || !reference) throw new Error('No reference league configured');
    const [current, currentHistory, referenceHistory] = await Promise.all([
      fetchCurrent(settings.game, league.id),
      fetchLeagueHistory(settings.game, league.id),
      fetchLeagueHistory(settings.game, reference.id),
    ]);
    return { current, currentHistory, referenceHistory };
  });

  const divineIcon =
    data.status === 'ready'
      ? data.data.current.items.find((i) => i.id === 'divine')?.icon
      : undefined;

  return { league, reference, today, data, divineIcon };
}
