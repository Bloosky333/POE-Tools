import { ECONOMY, type ExchangeType, type Game, type SellMode } from '@poe-tools/shared';
import { exchangeTypeField, urlField, useUrlParams } from '../../lib/urlParams.ts';
import { useSettings } from '../../lib/useSettings.ts';

const ACTIONS = ['all', 'buy', 'wait', 'avoid', 'neutral'] as const;

/** Filters and view state, kept in the URL so views can be bookmarked. */
export interface ViewParams {
  mode: string;
  minVolume: number;
  minPrice: number;
  type: ExchangeType | 'all';
  action: (typeof ACTIONS)[number];
  q: string;
  sort: SortKey;
  desc: boolean;
  item: string | null;
}

const SORT_KEYS = [
  'score',
  'name',
  'price',
  'multiplier',
  'confidence',
  'volume',
  'change7d',
  'sellDay',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const MODES: { value: string; label: string; short: string; mode: SellMode }[] = [
  { value: 'h7', short: '7 days', label: 'Hold 7 days', mode: { kind: 'horizon', days: 7 } },
  { value: 'h14', short: '14 days', label: 'Hold 14 days', mode: { kind: 'horizon', days: 14 } },
  { value: 'h30', short: '30 days', label: 'Hold 30 days', mode: { kind: 'horizon', days: 30 } },
  { value: 'peak', short: 'Peak', label: 'Sell at peak', mode: { kind: 'peak' } },
  { value: 'end', short: 'League end', label: 'Hold to league end', mode: { kind: 'end' } },
];

/** Defaults of a game: liquidity filters carry the game's unit. */
export const defaultsFor = (game: Game): ViewParams => ({
  mode: 'h14',
  minVolume: ECONOMY[game].minVolume,
  minPrice: ECONOMY[game].minPrice,
  type: 'all',
  action: 'all',
  q: '',
  sort: 'score',
  desc: true,
  item: null,
});

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const { game } = useSettings().settings;
  return useUrlParams(defaultsFor(game), {
    mode: urlField.oneOf(MODES.map((m) => m.value)),
    minVolume: urlField.number(),
    minPrice: urlField.number(),
    type: exchangeTypeField(game),
    action: urlField.oneOf(ACTIONS),
    q: urlField.text(),
    sort: urlField.oneOf(SORT_KEYS),
    desc: urlField.descending(),
    item: urlField.selection(),
  });
}
