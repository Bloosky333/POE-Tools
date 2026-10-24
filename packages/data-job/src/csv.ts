import { CURRENCY_SHORT, type CoreCurrency, type PayCurrency } from '@poe-tools/shared';
import type { DailyPoint, FxPoint } from './convert.ts';
import type { PairPoint } from './pairs.ts';

/*
 * History is stored as append-friendly CSV sorted by date, so the daily commit on the
 * `data` branch is a small diff.
 */

/*
 * Headers name the unit (`price_div` for PoE 2, `price_c` for PoE 1); columns are read by
 * position.
 */
const historyHeader = (unit: CoreCurrency) =>
  `date,item,price_${CURRENCY_SHORT[unit]},volume_${CURRENCY_SHORT[unit]},source`;
const fxHeader = (unit: CoreCurrency, currencies: readonly CoreCurrency[]) =>
  ['date', ...currencies.map((c) => `${c}_per_${CURRENCY_SHORT[unit]}`)].join(',');
const pairsHeader = (unit: CoreCurrency) => `date,item,pair,rate,volume_${CURRENCY_SHORT[unit]}`;

export function parseHistoryCsv(text: string): DailyPoint[] {
  return dataLines(text).map((line) => {
    const [date = '', item = '', price = '', volume = '', source = ''] = line.split(',');
    return {
      date,
      item,
      price: Number(price),
      volume: Number(volume),
      source: source === 'snapshot' ? 'snapshot' : 'details',
    };
  });
}

export function formatHistoryCsv(
  points: readonly DailyPoint[],
  unit: CoreCurrency = 'divine',
): string {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.localeCompare(b.item))
    .map((p) => `${p.date},${p.item},${p.price},${p.volume},${p.source}`);
  return [historyHeader(unit), ...rows].join('\n') + '\n';
}

/** Merges points by (date, item); `incoming` wins over `existing`. */
export function mergeHistory(
  existing: readonly DailyPoint[],
  incoming: readonly DailyPoint[],
): DailyPoint[] {
  const merged = new Map<string, DailyPoint>();
  for (const point of [...existing, ...incoming]) merged.set(`${point.date}|${point.item}`, point);
  return [...merged.values()];
}

/** One column per currency of `currencies`, in that order. */
export function parseFxCsv(text: string, currencies: readonly CoreCurrency[]): FxPoint[] {
  return dataLines(text).map((line) => {
    const [date = '', ...values] = line.split(',');
    const rates: FxPoint['rates'] = {};
    currencies.forEach((currency, i) => {
      const value = values[i];
      if (value) rates[currency] = Number(value);
    });
    return { date, rates };
  });
}

export function formatFxCsv(
  points: readonly FxPoint[],
  unit: CoreCurrency,
  currencies: readonly CoreCurrency[],
): string {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => [p.date, ...currencies.map((c) => p.rates[c] ?? '')].join(','));
  return [fxHeader(unit, currencies), ...rows].join('\n') + '\n';
}

export function mergeFx(existing: readonly FxPoint[], incoming: readonly FxPoint[]): FxPoint[] {
  const merged = new Map<string, FxPoint>();
  for (const point of [...existing, ...incoming]) merged.set(point.date, point);
  return [...merged.values()];
}

export function parsePairsCsv(text: string): PairPoint[] {
  return dataLines(text).map((line) => {
    const [date = '', item = '', pair = '', rate = '', volume = ''] = line.split(',');
    return { date, item, pair: pair as PayCurrency, rate: Number(rate), volume: Number(volume) };
  });
}

export function formatPairsCsv(
  points: readonly PairPoint[],
  unit: CoreCurrency = 'divine',
): string {
  const rows = [...points]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.item.localeCompare(b.item) ||
        a.pair.localeCompare(b.pair),
    )
    .map((p) => `${p.date},${p.item},${p.pair},${p.rate},${p.volume}`);
  return [pairsHeader(unit), ...rows].join('\n') + '\n';
}

function dataLines(text: string): string[] {
  return text
    .split('\n')
    .slice(1)
    .filter((line) => line.trim() !== '');
}
