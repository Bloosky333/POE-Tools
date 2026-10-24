import {
  ECONOMY,
  marketChanges,
  sellSettingsFor,
  sellSignal,
  type SellSignal,
} from '@poe-tools/shared';
import { useMemo } from 'react';
import { useLeagueData } from '../../lib/useLeagueData.ts';

/** Loads the selected league's data and computes a sell signal for every item. */
export function useSellSignals() {
  const { game, league, reference, today, data, unit } = useLeagueData();

  const signals = useMemo((): SellSignal[] => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    const economy = ECONOMY[game];
    const settings = sellSettingsFor(game);
    const market = marketChanges(current.items, currentHistory, today, economy);
    return current.items
      .filter((item) => item.id !== economy.unit)
      .map((item) =>
        sellSignal({
          item,
          reference: referenceHistory[item.id],
          current: currentHistory[item.id],
          today,
          market,
          settings,
        }),
      );
  }, [data, today, game]);

  return { game, league, reference, today, data, signals, unit };
}
