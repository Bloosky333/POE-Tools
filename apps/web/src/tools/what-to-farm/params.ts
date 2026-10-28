import { ECONOMY, type Game } from '@poe-tools/shared';
import { urlField, useUrlParams } from '../../lib/urlParams.ts';
import { useSettings } from '../../lib/useSettings.ts';

/** Which mechanics are listed: all, or only the FARM verdicts. */
export type ShowFilter = 'all' | 'farm';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  show: ShowFilter;
  minVolume: number;
  minPrice: number;
  sort: SortKey;
  desc: boolean;
  /** Selected mechanic ('any' = the baseline row). */
  mechanic: string | null;
}

export type SortKey =
  'score' | 'mechanic' | 'value' | 'size' | 'items' | 'trend' | 'outlook' | 'confidence';

const SORT_KEYS: readonly SortKey[] = [
  'score',
  'mechanic',
  'value',
  'size',
  'items',
  'trend',
  'outlook',
  'confidence',
];

/** Defaults of a game: liquidity filters carry the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  show: 'all',
  minVolume: ECONOMY[game].minVolume,
  minPrice: ECONOMY[game].minPrice,
  sort: 'score',
  desc: true,
  mechanic: null,
});

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const { game } = useSettings().settings;
  return useUrlParams(defaultsFor(game), {
    show: urlField.oneOf(['all', 'farm'] as const),
    minVolume: urlField.number(),
    minPrice: urlField.number(),
    sort: urlField.oneOf(SORT_KEYS),
    desc: urlField.descending(),
    mechanic: urlField.selection(),
  });
}
