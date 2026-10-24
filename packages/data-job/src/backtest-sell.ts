/**
 * Replays the Sell Now engine over the stored current-league history, as if run on each
 * past day, and checks whether SELL NOW calls were cheaper 3 / 7 / 14 days later (lower
 * than holding). Used to tune the Sell Now thresholds per league. No network.
 *   pnpm --filter @poe-tools/data-job backtest-sell --data-dir <data branch checkout>
 */
import { parseArgs } from 'node:util';
import {
  DEFAULT_SELL_SETTINGS,
  POE2_EXCHANGE_TYPES,
  Series,
  getDefaultLeague,
  getReferenceLeague,
  marketChanges,
  sellSignal,
  type CurrentItem,
  type HistoryFile,
  type League,
  type SellSettings,
  type SellSignal,
} from '@poe-tools/shared';
import { toSeries } from './site.ts';
import { createStore } from './store.ts';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    'from-day': { type: 'string', default: '7' },
    'min-volume': { type: 'string', default: '5' },
  },
});
const dataDir = values['data-dir'];
if (!dataDir) {
  console.error('Usage: backtest-sell --data-dir <dir> [--from-day 7] [--min-volume 5]');
  process.exit(2);
}
const fromDay = Number(values['from-day']);
const minVolume = Number(values['min-volume']);
const LATER = [3, 7, 14] as const;

const league = getDefaultLeague('poe2');
const reference = league && getReferenceLeague(league);
if (!league || !reference) throw new Error('No current/reference league configured');

const store = createStore(dataDir);
async function load(l: League) {
  const items: HistoryFile['items'] = {};
  const types = new Map<string, CurrentItem['type']>();
  const history = await store.readHistory(l.id);
  for (const type of POE2_EXCHANGE_TYPES) {
    for (const [id, points] of Object.entries(toSeries(l, history.get(type) ?? []))) {
      items[id] = points;
      types.set(id, type);
    }
  }
  return { items, types };
}
const current = await load(league);
const referenceHistory = (await load(reference)).items;
const lastDay = Math.max(...Object.values(current.items).flatMap((p) => p.map((x) => x[0])));

/** Settings variants compared; the first is the default. */
const VARIANTS: [string, SellSettings][] = [
  ['default', DEFAULT_SELL_SETTINGS],
  ['falling vs market', { ...DEFAULT_SELL_SETTINGS, marketAdjustFalling: true }],
  ['fall drop 10%', { ...DEFAULT_SELL_SETTINGS, fallDrop: 0.1 }],
  ['fall drop 25%', { ...DEFAULT_SELL_SETTINGS, fallDrop: 0.25 }],
  ['peak drop 10%', { ...DEFAULT_SELL_SETTINGS, peakDrop: 0.1 }],
  ['peak drop 25%', { ...DEFAULT_SELL_SETTINGS, peakDrop: 0.25 }],
  ['horizon 7 days', { ...DEFAULT_SELL_SETTINGS, horizon: 7 }],
  ['soon window 3 days', { ...DEFAULT_SELL_SETTINGS, soonWindow: 3 }],
];

interface Outcome {
  /** Actual price k days later / price on the call day. */
  later: Record<(typeof LATER)[number], number | null>;
  /** The same, divided by the market's median move over those days. */
  relative: Record<(typeof LATER)[number], number | null>;
  signal: SellSignal;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1] ?? NaN;
};
const outcomes = new Map(VARIANTS.map(([name]) => [name, [] as Outcome[]]));

for (let d = fromDay; d < lastDay; d++) {
  const items: CurrentItem[] = [];
  for (const [id, points] of Object.entries(current.items)) {
    const point = points.find((p) => p[0] === d);
    if (!point) continue;
    items.push({
      id,
      detailsId: id,
      name: id,
      icon: '',
      type: current.types.get(id) ?? 'Currency',
      price: point[1],
      volume: point[2],
      change7d: null,
    });
  }
  const past = Object.fromEntries(
    Object.entries(current.items).map(([id, p]) => [id, p.filter((x) => x[0] <= d)]),
  );
  const market = marketChanges(items, past, d);
  const liquid = items.filter((i) => i.id !== 'divine' && i.price >= 0.05 && i.volume >= minVolume);
  const marketLater = Object.fromEntries(
    LATER.map((k) => {
      const ratios = liquid
        .map((i) => {
          const p = new Series(current.items[i.id] ?? []).priceAt(d + k);
          return p ? p / i.price : null;
        })
        .filter((x): x is number => x !== null);
      return [k, ratios.length ? median(ratios) : null];
    }),
  ) as Outcome['later'];
  for (const item of items) {
    if (item.id === 'divine' || item.price < 0.05 || item.volume < minVolume) continue;
    const series = new Series(current.items[item.id] ?? []);
    const later = Object.fromEntries(
      LATER.map((k) => {
        const p = series.priceAt(d + k);
        return [k, p ? p / item.price : null];
      }),
    ) as Outcome['later'];
    const relative = Object.fromEntries(
      LATER.map((k) => {
        const own = later[k];
        const m = marketLater[k];
        return [k, own !== null && m ? own / m : null];
      }),
    ) as Outcome['relative'];
    for (const [name, settings] of VARIANTS) {
      const signal = sellSignal({
        item,
        reference: referenceHistory[item.id],
        current: past[item.id],
        today: d,
        market,
        settings,
      });
      outcomes.get(name)?.push({ later, relative, signal });
    }
  }
}

function row(label: string, set: readonly Outcome[]) {
  const cell = (pick: (o: Outcome) => number | null) => {
    const xs = set.map(pick).filter((x): x is number => x !== null);
    if (!xs.length) return '–'.padStart(11);
    const fell = xs.filter((x) => x < 1).length / xs.length;
    return `${median(xs).toFixed(2)} ${(fell * 100).toFixed(0).padStart(3)}%`.padStart(11);
  };
  const cells = [
    ...LATER.map((k) => cell((o) => o.later[k])),
    ...LATER.map((k) => cell((o) => o.relative[k])),
  ];
  console.log(`${label.padEnd(24)} ${String(set.length).padStart(6)} ${cells.join(' ')}`);
}

console.log(
  `${league.name} vs ${reference.name}, days ${fromDay}–${lastDay - 1}, volume ≥ ${minVolume}`,
);
console.log(
  'Median later price / call price and share of calls cheaper later; then the same vs the market.',
);
console.log(
  `${'calls'.padEnd(24)} ${'n'.padStart(6)} ${[
    ...LATER.map((k) => `${k}d`),
    ...LATER.map((k) => `${k}d vs mkt`),
  ]
    .map((h) => h.padStart(11))
    .join(' ')}`,
);
const base = outcomes.get('default') ?? [];
row('all items (baseline)', base);
row(
  'hold',
  base.filter((o) => o.signal.verdict === 'hold'),
);
for (const [name] of VARIANTS) {
  const set = outcomes.get(name) ?? [];
  const now = set.filter((o) => o.signal.verdict === 'sell-now');
  console.log(`— ${name}`);
  row('  sell now', now);
  row(
    '  sell now · peak',
    now.filter((o) => o.signal.signals.includes('peak')),
  );
  row(
    '  sell now · falling',
    now.filter((o) => o.signal.signals.includes('falling')),
  );
  row(
    '  sell soon',
    set.filter((o) => o.signal.verdict === 'sell-soon'),
  );
}
