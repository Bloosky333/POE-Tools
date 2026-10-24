import { ECONOMY, farmSettingsFor, farmSignals, type FarmSignal } from '@poe-tools/shared';
import { useMemo } from 'react';
import { useLeagueData } from '../../lib/useLeagueData.ts';

/** Loads the selected league's data and computes one signal per mechanic (+ the baseline). */
export function useFarmSignals(filters: { minVolume: number; minPrice: number }) {
  const { game, league, reference, today, data, unit } = useLeagueData();
  const { minVolume, minPrice } = filters;

  const signals = useMemo((): FarmSignal[] => {
    if (data.status !== 'ready') return [];
    const { current, currentHistory, referenceHistory } = data.data;
    return farmSignals({
      game,
      items: current.items,
      currentHistory,
      referenceHistory,
      today,
      scope: { unit: ECONOMY[game].unit, minVolume, minPrice },
      settings: farmSettingsFor(game),
    });
  }, [data, today, game, minVolume, minPrice]);

  return { game, league, reference, today, data, signals, unit };
}
