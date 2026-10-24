import { marketChanges, sellSignal, type SellSignal } from '@poe-tools/shared';
import { useMemo } from 'react';
import { useLeagueData } from '../../lib/useLeagueData.ts';

/** Loads the selected league's data and computes a sell signal for every item. */
export function useSellSignals() {
  const { league, reference, today, data, divineIcon } = useLeagueData();

  const signals = useMemo((): SellSignal[] => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    const market = marketChanges(current.items, currentHistory, today);
    return current.items
      .filter((item) => item.id !== 'divine')
      .map((item) =>
        sellSignal({
          item,
          reference: referenceHistory[item.id],
          current: currentHistory[item.id],
          today,
          market,
        }),
      );
  }, [data, today]);

  return { league, reference, today, data, signals, divineIcon };
}
