import {
  DEFAULT_ENGINE_SETTINGS,
  getLeague,
  getReferenceLeague,
  leagueDay,
  suggest,
  type SellMode,
  type Suggestion,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { fetchCurrent, fetchLeagueHistory, useAsync, type AsyncState } from '../../lib/data.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';

export interface SpeculationData {
  current: Awaited<ReturnType<typeof fetchCurrent>>;
  currentHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
  referenceHistory: Awaited<ReturnType<typeof fetchLeagueHistory>>;
}

/** Loads the selected league's data and computes a suggestion for every item. */
export function useSuggestions(mode: SellMode, minVolume: number) {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const reference = league && getReferenceLeague(league);
  const now = useNow();
  const today = league ? leagueDay(league.startsAt, new Date(now)) : 0;

  const data: AsyncState<SpeculationData> = useAsync(
    `speculation:${settings.leagueId}`,
    async () => {
      if (!league || !reference) throw new Error('No reference league configured');
      const [current, currentHistory, referenceHistory] = await Promise.all([
        fetchCurrent(settings.game, league.id),
        fetchLeagueHistory(settings.game, league.id),
        fetchLeagueHistory(settings.game, reference.id),
      ]);
      return { current, currentHistory, referenceHistory };
    },
  );

  const modeKey = JSON.stringify(mode);
  const suggestions = useMemo((): Suggestion[] => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    const sellMode = JSON.parse(modeKey) as SellMode;
    return current.items
      .filter((item) => item.id !== 'divine')
      .map((item) =>
        suggest({
          item,
          reference: referenceHistory[item.id],
          current: currentHistory[item.id],
          today,
          mode: sellMode,
          settings: { ...DEFAULT_ENGINE_SETTINGS, minVolume },
        }),
      );
  }, [data, today, modeKey, minVolume]);

  const divineIcon =
    data.status === 'ready'
      ? data.data.current.items.find((i) => i.id === 'divine')?.icon
      : undefined;

  return { league, reference, today, data, suggestions, divineIcon };
}
