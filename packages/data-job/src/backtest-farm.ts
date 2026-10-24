/**
 * Replays the What to Farm engine over the stored current-league history, as if run on each
 * past day, and checks how each mechanic's loot moved 7 / 14 days later vs the market, per
 * verdict. Used to tune the What to Farm thresholds per league (spec 09 §6). No network.
 *   pnpm --filter @poe-tools/data-job backtest-farm --data-dir <data branch checkout>
 *     [--game poe1] [--league <id>]
 */
import { parseArgs } from 'node:util';
import {
  ECONOMY,
  EXCHANGE_TYPES,
  FARM_START_DAY,
  GAMES,
  Series,
  farmSettingsFor,
  farmSignals,
  getDefaultLeague,
  getLeague,
  getReferenceLeague,
  hasStarted,
  type CurrentItem,
  type FarmSettings,
  type FarmSignal,
  type Game,
  type HistoryFile,
  type League,
} from '@poe-tools/shared';
import { toSeries } from './site.ts';
import { createStore } from './store.ts';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    game: { type: 'string', default: 'poe2' },
    league: { type: 'string' },
    'from-day': { type: 'string', default: String(FARM_START_DAY) },
  },
});
const dataDir = values['data-dir'];
if (!dataDir) {
  console.error(
    'Usage: backtest-farm --data-dir <dir> [--from-day 7] [--game poe2|poe1] [--league <id>]',
  );
  process.exit(2);
}
const fromDay = Number(values['from-day']);
const LATER = [7, 14] as const;

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

/** Stored ids are slugs; the mapping's name overrides need names ("victorious-fate" → "Victorious Fate"). */
const nameOf = (id: string) =>
  id
    .split('-')
    .map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ');

/** Settings variants compared; the first is the default. */
const BASE = farmSettingsFor(game);
const VARIANTS: [string, FarmSettings][] = [
  ['default', BASE],
  ['hold rise 10%', { ...BASE, holdRise: 0.1 }],
  ['hold rise 25%', { ...BASE, holdRise: 0.25 }],
  ['avoid drop 10%', { ...BASE, avoidDrop: 0.1, fallDrop: 0.1 }],
  ['avoid drop 25%', { ...BASE, avoidDrop: 0.25, fallDrop: 0.25 }],
  ['no weight cap', { ...BASE, weightCap: 1 }],
  ['weight cap 25%', { ...BASE, weightCap: 0.25 }],
  ['horizon 7 days', { ...BASE, horizon: 7 }],
  ['falling rule 15%', { ...BASE, fallDrop: 0.15 }],
];

interface Outcome {
  /** Mechanic index k days later (same weights) / today, divided by the market's median move. */
  relative: Record<(typeof LATER)[number], number | null>;
  signal: FarmSignal;
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
      name: nameOf(id),
      icon: '',
      type: current.types.get(id) ?? 'Currency',
      price: point[1],
      volume: point[2],
      change7d: null,
    });
  }
  const past = Object.fromEntries(
    Object.entries(current.items).map(([id, p]) => [id, p.filter((x) => x[0] < d)]),
  );
  const later = (id: string, k: number, price: number) => {
    const p = new Series(current.items[id] ?? []).priceAt(d + k);
    return p ? p / price : null;
  };
  const liquid = items.filter(
    (i) => i.id !== economy.unit && i.price >= economy.minPrice && i.volume >= economy.minVolume,
  );
  const marketLater = Object.fromEntries(
    LATER.map((k) => {
      const ratios = liquid
        .map((i) => later(i.id, k, i.price))
        .filter((x): x is number => x !== null);
      return [k, ratios.length ? median(ratios) : null];
    }),
  ) as Outcome['relative'];

  for (const [name, settings] of VARIANTS) {
    const signals = farmSignals({
      game,
      items,
      currentHistory: past,
      referenceHistory,
      today: d,
      settings,
    });
    for (const signal of signals) {
      if (signal.verdict === null) continue;
      const relative = Object.fromEntries(
        LATER.map((k) => {
          let sum = 0;
          let w = 0;
          for (const f of signal.items) {
            const r = later(f.item.id, k, f.item.price);
            if (r === null) continue;
            sum += f.share * r;
            w += f.share;
          }
          const m = marketLater[k];
          return [k, w && m ? sum / w / m : null];
        }),
      ) as Outcome['relative'];
      outcomes.get(name)?.push({ relative, signal });
    }
  }
}

function row(label: string, set: readonly Outcome[]) {
  const cell = (k: (typeof LATER)[number]) => {
    const xs = set.map((o) => o.relative[k]).filter((x): x is number => x !== null);
    if (!xs.length) return '–'.padStart(11);
    const beat = xs.filter((x) => x > 1).length / xs.length;
    return `${median(xs).toFixed(2)} ${(beat * 100).toFixed(0).padStart(3)}%`.padStart(11);
  };
  console.log(`${label.padEnd(24)} ${String(set.length).padStart(6)} ${LATER.map(cell).join(' ')}`);
}

console.log(`${league.name} vs ${reference.name}, days ${fromDay}–${lastDay - 1}`);
console.log(
  'Per mechanic-day: median index k days later vs the market, and share that beat the market.',
);
console.log(
  `${'calls'.padEnd(24)} ${'n'.padStart(6)} ${LATER.map((k) => `${k}d vs mkt`.padStart(11)).join(' ')}`,
);
for (const [name] of VARIANTS) {
  const set = outcomes.get(name) ?? [];
  console.log(`— ${name}`);
  row('  all mechanics', set);
  for (const verdict of ['farm-hold', 'farm-sell', 'thin', 'avoid'] as const)
    row(
      `  ${verdict}`,
      set.filter((o) => o.signal.verdict === verdict),
    );
  row(
    '  avoid · falling',
    set.filter((o) => o.signal.verdict === 'avoid' && o.signal.reasons[0]?.startsWith('Falling')),
  );
}

// Per mechanic under the default settings: how often it got each verdict.
console.log('— default, per mechanic (calls: hold / sell / thin / avoid; 14d vs mkt)');
const base = outcomes.get('default') ?? [];
const mechanics = [...new Set(base.map((o) => o.signal.mechanic ?? ''))].sort();
for (const mechanic of mechanics) {
  const set = base.filter((o) => o.signal.mechanic === mechanic);
  const count = (v: string) => set.filter((o) => o.signal.verdict === v).length;
  const xs = set.map((o) => o.relative[14]).filter((x): x is number => x !== null);
  console.log(
    `  ${mechanic.padEnd(22)} ${[
      count('farm-hold'),
      count('farm-sell'),
      count('thin'),
      count('avoid'),
    ]
      .map((n) => String(n).padStart(3))
      .join(' / ')}   ${xs.length ? median(xs).toFixed(2) : '–'}`,
  );
}
