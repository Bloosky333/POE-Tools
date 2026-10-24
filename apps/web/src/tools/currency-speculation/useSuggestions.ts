import {
  engineSettingsFor,
  marketFactor,
  suggest,
  type SellMode,
  type Suggestion,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { useLeagueData } from '../../lib/useLeagueData.ts';

/** Loads the selected league's data and computes a suggestion for every item. */
export function useSuggestions(mode: SellMode, minVolume: number) {
  const { game, league, reference, today, data, unit } = useLeagueData();
  const settings = useMemo(() => ({ ...engineSettingsFor(game), minVolume }), [game, minVolume]);

  const modeKey = JSON.stringify(mode);
  const market = useMemo(
    () =>
      data.status === 'ready'
        ? marketFactor(data.data.current.items, data.data.referenceHistory, today, settings)
        : null,
    [data, today, settings],
  );

  const suggestions = useMemo((): Suggestion[] => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    const sellMode = JSON.parse(modeKey) as SellMode;
    return current.items
      .filter((item) => item.id !== settings.unit)
      .map((item) =>
        suggest({
          item,
          reference: referenceHistory[item.id],
          current: currentHistory[item.id],
          today,
          mode: sellMode,
          marketFactor: market,
          settings,
        }),
      );
  }, [data, today, modeKey, settings, market]);

  return { game, league, reference, today, data, suggestions, unit, marketFactor: market };
}
