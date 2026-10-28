import { ECONOMY, type ExchangeType, type Game } from '@poe-tools/shared';
import { exchangeTypeField, urlField, useUrlParams } from '../../lib/urlParams.ts';
import { useSettings } from '../../lib/useSettings.ts';

/** Which verdicts are listed: flagged = SELL NOW + SELL SOON. */
export type VerdictFilter = 'flagged' | 'sell-now' | 'sell-soon' | 'all';

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  verdict: VerdictFilter;
  minVolume: number;
  minPrice: number;
  type: ExchangeType | 'all';
  q: string;
  sort: SortKey;
  desc: boolean;
  item: string | null;
}

const SORT_KEYS = [
  'score',
  'name',
  'price',
  'change1d',
  'change3d',
  'change7d',
  'fromHigh',
  'loss',
  'sellDay',
  'confidence',
  'volume',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const VERDICTS: readonly VerdictFilter[] = ['flagged', 'sell-now', 'sell-soon', 'all'];

/** Defaults of a game: liquidity filters carry the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  verdict: 'flagged',
  minVolume: ECONOMY[game].minVolume,
  minPrice: ECONOMY[game].minPrice,
  type: 'all',
  q: '',
  sort: 'score',
  desc: true,
  item: null,
});

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const { game } = useSettings().settings;
  return useUrlParams(defaultsFor(game), {
    verdict: urlField.oneOf(VERDICTS),
    minVolume: urlField.number(),
    minPrice: urlField.number(),
    type: exchangeTypeField(game),
    q: urlField.text(),
    sort: urlField.oneOf(SORT_KEYS),
    desc: urlField.descending(),
    item: urlField.selection(),
  });
}
