import { exchangeTypeField, urlField, useUrlParams } from '../../lib/urlParams.ts';
import { useSettings } from '../../lib/useSettings.ts';
import { defaultsFor, type SortKey, type ViewParams } from './logic.ts';

const SORT_KEYS: readonly SortKey[] = ['margin', 'name', 'recurrence', 'units', 'value'];

export function useViewParams(): [ViewParams, (patch: Partial<ViewParams>) => void] {
  const { game } = useSettings().settings;
  return useUrlParams(defaultsFor(game), {
    kind: urlField.oneOf(['all', 'spread', 'cross'] as const),
    minUnits: urlField.number(),
    minValue: urlField.number(),
    minMargin: urlField.number(),
    minRecurrence: urlField.number(),
    type: exchangeTypeField(game),
    q: urlField.text(),
    sort: urlField.oneOf(SORT_KEYS),
    desc: urlField.descending(),
    flip: urlField.selection(),
  });
}
