import { getLeague, getReferenceLeague, leagueDay } from '@poe-tools/shared';
import { fetchCurrent, fetchLeagueHistory, useAsync, type AsyncState } from './data.ts';
import { unitInfo } from './unit.ts';
import { useNow } from './useNow.ts';
import { useSettings } from './useSettings.ts';

export interface LeagueData {
  current: Awaited<ReturnType<typeof fetchCurrent>>;
  currentHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
  referenceHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
}

/**
 * The selected league, its reference league, today's league day and the data every
 * price tool needs: current prices and the daily history of both leagues. `unit` is the
 * game's price unit (with its icon once prices are loaded).
 */
export function useLeagueData() {
  const { settings } = useSettings();
  const { game } = settings;
  const league = getLeague(settings.leagueId);
  const reference = league && getReferenceLeague(league);
  const now = useNow();
  const today = league ? leagueDay(league.startsAt, new Date(now)) : 0;

  const data: AsyncState<LeagueData> = useAsync(
    `league-data:${game}:${settings.leagueId}`,
    async () => {
      if (!league || !reference) throw new Error('No reference league configured');
      const [current, currentHistory, referenceHistory] = await Promise.all([
        fetchCurrent(game, league.id),
        fetchLeagueHistory(game, league.id),
        fetchLeagueHistory(game, reference.id),
      ]);
      return { current, currentHistory, referenceHistory };
    },
  );

  const unit = unitInfo(game, data.status === 'ready' ? data.data.current : null);

  return { game, league, reference, today, data, unit };
}
