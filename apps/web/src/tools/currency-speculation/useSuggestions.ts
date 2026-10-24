import {
  DEFAULT_ENGINE_SETTINGS,
  marketFactor,
  suggest,
  type SellMode,
  type Suggestion,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { useLeagueData } from '../../lib/useLeagueData.ts';

/** Loads the selected league's data and computes a suggestion for every item. */
export function useSuggestions(mode: SellMode, minVolume: number) {
  const { league, reference, today, data, divineIcon } = useLeagueData();

  const modeKey = JSON.stringify(mode);
  const market = useMemo(
    () =>
      data.status === 'ready'
        ? marketFactor(data.data.current.items, data.data.referenceHistory, today)
        : null,
    [data, today],
  );

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
          marketFactor: market,
          settings: { ...DEFAULT_ENGINE_SETTINGS, minVolume },
        }),
      );
  }, [data, today, modeKey, minVolume, market]);

  return { league, reference, today, data, suggestions, divineIcon, marketFactor: market };
}
