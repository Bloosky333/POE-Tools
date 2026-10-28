/**
 * Replays the suggestion engine over the stored current-league history, as if run on each
 * past day, and compares its calls with what actually happened `--horizon` days later:
 * BUY NOW per `premiumDamping`, then every action under each AVOID rule (spec 01 §4.3).
 * Used to tune engine settings per league. No network.
 *   pnpm --filter @poe-tools/data-job backtest --data-dir <data branch checkout> [--horizon 14]
 *     [--game poe1] [--league <id>]
 */
import { parseArgs } from 'node:util';
import {
  engineSettingsFor,
  ECONOMY,
  EXCHANGE_TYPES,
  GAMES,
  Series,
  getDefaultLeague,
  getLeague,
  hasStarted,
  getReferenceLeague,
  marketFactor,
  median,
  suggest,
  type Action,
  type CurrentItem,
  type HistoryFile,
  type Game,
  type League,
  type Suggestion,
} from '@poe-tools/shared';
import { toSeries } from './site.ts';
import { createStore } from './store.ts';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    game: { type: 'string', default: 'poe2' },
    league: { type: 'string' },
    horizon: { type: 'string', default: '14' },
    'from-day': { type: 'string', default: '7' },
  },
});
const dataDir = values['data-dir'];
if (!dataDir) {
  console.error(
    'Usage: backtest --data-dir <dir> [--horizon 14] [--from-day 7] [--game poe2|poe1] [--league <id>]',
  );
  process.exit(2);
}
const horizon = Number(values.horizon);
const fromDay = Number(values['from-day']);

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

const betas = [0, 0.5, 1, 1.5];
const results = new Map(betas.map((b) => [b, [] as number[]]));

const settings = engineSettingsFor(game);
/** AVOID bands compared (`avoidDrop`), and the rule used before 2026-10 for reference. */
const BANDS = [0, 0.05, 0.1];
const BEFORE = 'before: dip entry loses';
const ruleName = (band: number) => `holding loses > ${band * 100}%`;
/** The pre-2026-10 action: AVOID only when even the dip entry lost. */
function actionBefore(s: Suggestion, d: number): Action {
  const r = s.reference;
  if (!r) return 'neutral';
  const dip = r.buyDay !== d;
  if (r.multiplierFromBuy < 1 || (!dip && r.multiplier < 1)) return 'avoid';
  if (r.expectedMultiplier < settings.buyMultiplier) return 'neutral';
  return dip ? 'wait' : s.action;
}
/** Per rule: calls that were NEUTRAL under the old rule and are AVOID under it. */
const moved = new Map<string, { actual: number; vsMarket: number }[]>();
/** Per rule and action: each call's actual change and its change relative to the market. */
const calls = new Map(
  [BEFORE, ...BANDS.map(ruleName)].map((name) => [
    name,
    new Map<Action, { actual: number; vsMarket: number }[]>(),
  ]),
);
for (let d = fromDay; d + horizon <= lastDay; d++) {
  // The item list as the engine would have seen it on day d.
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
  const factor = marketFactor(items, referenceHistory, d, engineSettingsFor(game));
  const liquidLater = items.flatMap((item) => {
    if (item.id === economy.unit || item.price < economy.minPrice) return [];
    if (item.volume < economy.minVolume) return [];
    const later = new Series(current.items[item.id] ?? []).priceAt(d + horizon);
    return later ? [later / item.price] : [];
  });
  const market = median(liquidLater, 10);
  for (const item of items) {
    if (item.id === economy.unit || item.price < economy.minPrice) continue;
    const later = new Series(current.items[item.id] ?? []).priceAt(d + horizon);
    if (!later) continue;
    for (const premiumDamping of betas) {
      const s = suggest({
        item,
        reference: referenceHistory[item.id],
        current: current.items[item.id]?.filter((p) => p[0] <= d),
        today: d,
        mode: { kind: 'horizon', days: horizon },
        marketFactor: factor,
        settings: { ...engineSettingsFor(game), premiumDamping },
      });
      if (s.action === 'buy') results.get(premiumDamping)?.push(later / item.price);
      if (premiumDamping !== settings.premiumDamping || !s.reference || market === null) continue;
      if (item.volume < economy.minVolume) continue;
      const outcome = { actual: later / item.price, vsMarket: later / item.price / market };
      const before = actionBefore(s, d);
      const record = (name: string, action: Action) => {
        const byAction = calls.get(name);
        byAction?.set(action, [...(byAction.get(action) ?? []), outcome]);
        if (before === 'neutral' && action === 'avoid')
          moved.set(name, [...(moved.get(name) ?? []), outcome]);
      };
      record(BEFORE, before);
      for (const avoidDrop of BANDS) {
        const variant = suggest({
          item,
          reference: referenceHistory[item.id],
          current: current.items[item.id]?.filter((p) => p[0] <= d),
          today: d,
          mode: { kind: 'horizon', days: horizon },
          marketFactor: factor,
          settings: { ...settings, avoidDrop },
        });
        record(ruleName(avoidDrop), variant.action);
      }
    }
  }
}

console.log(
  `${league.name} vs ${reference.name}, days ${fromDay}–${lastDay - horizon}, BUY NOW held ${horizon} days`,
);
console.log('premiumDamping  calls  median actual ×  rose');
for (const [beta, actual] of results) {
  const sorted = [...actual].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] ?? NaN;
  const rose = actual.filter((a) => a >= 1).length / (actual.length || 1);
  console.log(
    `${String(beta).padStart(14)}  ${String(actual.length).padStart(5)}  ${median.toFixed(2).padStart(15)}  ${(rose * 100).toFixed(0).padStart(3)}%`,
  );
}

console.log(
  `\nActions of liquid items, held ${horizon} days (vs market = ÷ median of liquid items)`,
);
console.log('rule                   action    calls  median ×  vs market  under market');
for (const [name, byAction] of calls) {
  for (const action of ['buy', 'wait', 'neutral', 'avoid'] as const) {
    const list = byAction.get(action) ?? [];
    const actual = median(
      list.map((c) => c.actual),
      1,
    );
    const vs = median(
      list.map((c) => c.vsMarket),
      1,
    );
    const under = list.filter((c) => c.vsMarket < 1).length / (list.length || 1);
    console.log(
      `${name.padEnd(22)} ${action.padEnd(8)} ${String(list.length).padStart(6)}  ${(actual ?? NaN).toFixed(2).padStart(8)}  ${(vs ?? NaN).toFixed(2).padStart(9)}  ${(under * 100).toFixed(0).padStart(11)}%`,
    );
  }
}
for (const [name, list] of moved) {
  const vs = median(
    list.map((c) => c.vsMarket),
    1,
  );
  const under = list.filter((c) => c.vsMarket < 1).length / (list.length || 1);
  console.log(
    `NEUTRAL → AVOID under "${name}": ${list.length} calls, median ${(vs ?? NaN).toFixed(2)} vs market, ${(under * 100).toFixed(0)}% under it`,
  );
}
