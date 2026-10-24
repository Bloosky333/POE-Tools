/**
 * Replays the Sell Now engine over the stored current-league history, as if run on each
 * past day, and checks whether SELL NOW calls were cheaper 3 / 7 / 14 days later (lower
 * than holding). Used to tune the Sell Now thresholds per league. No network.
 *   pnpm --filter @poe-tools/data-job backtest-sell --data-dir <data branch checkout>
 *     [--game poe1] [--league <id>]
 */
import { parseArgs } from 'node:util';
import {
  sellSettingsFor,
  ECONOMY,
  EXCHANGE_TYPES,
  GAMES,
  Series,
  getDefaultLeague,
  getLeague,
  hasStarted,
  getReferenceLeague,
  marketChanges,
  sellSignal,
  type CurrentItem,
  type HistoryFile,
  type Game,
  type League,
  type SellSettings,
  type SellSignal,
} from '@poe-tools/shared';
import { toSeries } from './site.ts';
import { createStore } from './store.ts';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    game: { type: 'string', default: 'poe2' },
    league: { type: 'string' },
    'from-day': { type: 'string', default: '7' },
    'min-volume': { type: 'string' },
  },
});
const dataDir = values['data-dir'];
if (!dataDir) {
  console.error(
    'Usage: backtest-sell --data-dir <dir> [--from-day 7] [--min-volume <unit/day>] [--game poe2|poe1] [--league <id>]',
  );
  process.exit(2);
}
const fromDay = Number(values['from-day']);
const LATER = [3, 7, 14] as const;

const game: Game = GAMES.find((g) => g === values.game) ?? 'poe2';
const economy = ECONOMY[game];
// Default: the game's current league, or its reference while it has not started.
const selected = values.league ? getLeague(values.league) : getDefaultLeague(game);
const league =
  selected && !values.league && !hasStarted(selected, new Date())
    ? getReferenceLeague(selected)
    : selected;
const reference = league && getReferenceLeague(league);
if (!league || !reference) throw new Error('No current/reference league configured');

const minVolume = Number(values['min-volume'] ?? economy.minVolume);
const store = createStore(dataDir, game);
async function load(l: League) {
  const items: HistoryFile['items'] = {};
  const types = new Map<string, CurrentItem['type']>();
  const history = await store.readHistory(l.id);
  for (const type of EXCHANGE_TYPES[game]) {
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
const BASE = sellSettingsFor(game);
const VARIANTS: [string, SellSettings][] = [
  ['default', BASE],
  ['falling vs market', { ...BASE, marketAdjustFalling: true }],
  ['fall drop 10%', { ...BASE, fallDrop: 0.1 }],
  ['fall drop 25%', { ...BASE, fallDrop: 0.25 }],
  ['peak drop 10%', { ...BASE, peakDrop: 0.1 }],
  ['peak drop 25%', { ...BASE, peakDrop: 0.25 }],
  ['horizon 7 days', { ...BASE, horizon: 7 }],
  ['soon window 3 days', { ...BASE, soonWindow: 3 }],
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
  const market = marketChanges(items, past, d, { ...economy, minVolume });
  const liquid = items.filter(
    (i) => i.id !== economy.unit && i.price >= economy.minPrice && i.volume >= minVolume,
  );
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
    if (item.id === economy.unit || item.price < economy.minPrice || item.volume < minVolume)
      continue;
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
