import type { PayCurrency } from '@poe-tools/shared';
import type { DailyPoint, FxPoint } from './convert.ts';
import type { PairPoint } from './pairs.ts';

/*
 * History is stored as append-friendly CSV sorted by date, so the daily commit on the
 * `data` branch is a small diff.
 */

const HISTORY_HEADER = 'date,item,price_div,volume_div,source';
const FX_HEADER = 'date,exalted_per_div,chaos_per_div';
const PAIRS_HEADER = 'date,item,pair,rate,volume_div';

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

export function formatHistoryCsv(points: readonly DailyPoint[]): string {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date) || a.item.localeCompare(b.item))
    .map((p) => `${p.date},${p.item},${p.price},${p.volume},${p.source}`);
  return [HISTORY_HEADER, ...rows].join('\n') + '\n';
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

export function parseFxCsv(text: string): FxPoint[] {
  return dataLines(text).map((line) => {
    const [date = '', exalted = '', chaos = ''] = line.split(',');
    return { date, exalted: exalted ? Number(exalted) : null, chaos: chaos ? Number(chaos) : null };
  });
}

export function formatFxCsv(points: readonly FxPoint[]): string {
  const rows = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => `${p.date},${p.exalted ?? ''},${p.chaos ?? ''}`);
  return [FX_HEADER, ...rows].join('\n') + '\n';
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

export function formatPairsCsv(points: readonly PairPoint[]): string {
  const rows = [...points]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.item.localeCompare(b.item) ||
        a.pair.localeCompare(b.pair),
    )
    .map((p) => `${p.date},${p.item},${p.pair},${p.rate},${p.volume}`);
  return [PAIRS_HEADER, ...rows].join('\n') + '\n';
}

function dataLines(text: string): string[] {
  return text
    .split('\n')
    .slice(1)
    .filter((line) => line.trim() !== '');
}
