import {
  CURRENCY_NAMES,
  CURRENCY_SHORT,
  ECONOMY,
  bestPair,
  bestPairSettingsFor,
  getLeague,
  type BestPairResult,
  type CurrentItem,
  type PairOption,
  type PairSide,
} from '@poe-tools/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { fetchCurrent, fetchPairs, useAsync } from '../../lib/data.ts';
import { formatAge, formatAmount } from '../../lib/format.ts';
import { currencyView, unitInfo, type UnitInfo } from '../../lib/unit.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';
import {
  Amount,
  Badge,
  Card,
  DataTable,
  FilterBar,
  InlineField,
  Input,
  ItemCell,
  LoadStatus,
  PageHeader,
  Pill,
  SearchInput,
  Sheet,
  TypeChips,
  type Column,
} from '../../ui/index.ts';
import {
  addRecent,
  loadSaved,
  searchItems,
  storeSaved,
  toggleFavourite,
  useViewParams,
  type Saved,
} from './logic.ts';

/** A daily quote older than this is flagged as stale. */
const STALE_MS = 2 * 86_400_000;

/** Wording of each side; the two tools differ only in it. */
const SIDES: Record<
  PairSide,
  {
    tool: string;
    title: string;
    description: string;
    /** "Pay with Exalted Orb" / "Sell for Exalted Orb". */
    verb: string;
    currencyLabel: string;
    amountLabel: string;
    amountTitle: string;
    valueLabel: string;
    valueTitle: string;
    roundingTitle: string;
    /** Saving / extra proceeds vs the next and the worst option. */
    edge: (next: number, worst: number) => string;
  }
> = {
  buy: {
    tool: 'buy-with',
    title: 'Buy With',
    description: 'Which currency to pay with for an item on the exchange',
    verb: 'Pay with',
    currencyLabel: 'Pay with',
    amountLabel: 'Hand over',
    amountTitle: 'Whole units of the currency to pay',
    valueLabel: 'Cost',
    valueTitle: "Real cost of what you hand over, at today's rate",
    roundingTitle: 'Paid beyond the exact price because the exchange trades whole units',
    edge: (next, worst) =>
      `${next} % cheaper than the next option, ${worst} % than the most expensive.`,
  },
  sell: {
    tool: 'sell-for',
    title: 'Sell For',
    description: 'Which currency to ask for when selling an item on the exchange',
    verb: 'Sell for',
    currencyLabel: 'Sell for',
    amountLabel: 'Receive',
    amountTitle: 'Whole units of the currency to ask for',
    valueLabel: 'Worth',
    valueTitle: "Real value of what you receive, at today's rate",
    roundingTitle: 'Not received because the exchange trades whole units',
    // 100 % less = not even one whole unit at this quantity.
    edge: (next, worst) =>
      next === 100
        ? 'The other currencies pay less than one whole unit for this quantity.'
        : `The next option pays ${next} % less, the worst ${
            worst === 100 ? 'less than one whole unit' : `${worst} % less`
          }.`,
  },
};

export function ExchangePairPage({ side }: { side: PairSide }) {
  const text = SIDES[side];
  const [params, update] = useViewParams();
  const { settings } = useSettings();
  const { game } = settings;
  const league = getLeague(settings.leagueId);
  const economy = ECONOMY[game];

  // Shared by both sides: the same files, loaded once.
  const data = useAsync(`exchange-pair:${game}:${settings.leagueId}`, async () => {
    if (!league) throw new Error('No league selected');
    const [current, pairs] = await Promise.all([
      fetchCurrent(game, league.id),
      fetchPairs(game, league.id),
    ]);
    return { current, pairs };
  });
  const current = data.status === 'ready' ? data.data.current : null;
  const unit = unitInfo(game, current);

  // Recent lookups and favourites of the selected game.
  const [stored, setStored] = useState(() => ({
    key: `${side}:${game}`,
    saved: loadSaved(text.tool, game),
  }));
  const saved = stored.key === `${side}:${game}` ? stored.saved : loadSaved(text.tool, game);
  const save = (next: Saved) => {
    setStored({ key: `${side}:${game}`, saved: next });
    storeSaved(text.tool, game, next);
  };

  const items = useMemo(
    () => new Map<string, CurrentItem>(current?.items.map((i) => [i.id, i]) ?? []),
    [current],
  );
  const item = params.item ? items.get(params.item) : undefined;
  // Every match of the search (for the category counts), then the shown ones.
  const allMatches = useMemo(
    () => (current ? searchItems(current.items, params.q, economy.unit, 'all', Infinity) : []),
    [current, params.q, economy.unit],
  );
  const matches = useMemo(
    () => searchItems(allMatches, '', economy.unit, params.type),
    [allMatches, params.type, economy.unit],
  );
  const compare = (id: string): BestPairResult | null =>
    data.status === 'ready'
      ? bestPair({
          side,
          quotes: data.data.pairs.items[id] ?? {},
          quantity: params.quantity,
          unit: economy.unit,
          rates: data.data.current.rates,
          currencies: economy.hubs,
          settings: bestPairSettingsFor(game),
        })
      : null;
  const result = item ? compare(item.id) : null;

  const select = (id: string) => {
    update({ item: id });
    save(addRecent(saved, id));
  };

  if (!league) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <PageHeader
        title={text.title}
        description={`${text.description}: ${economy.hubs
          .map((h) => CURRENCY_NAMES[h])
          .join(', ')}, compared in whole units at today's rates.`}
      />

      <LoadStatus state={data} what="exchange rates" rows={4} />
      {data.status === 'ready' && (
        <>
          <Card className="space-y-3">
            <FilterBar>
              <SearchInput
                placeholder="Search an item"
                value={params.q}
                onChange={(q) => update({ q })}
              />
              <InlineField label="Quantity">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={params.quantity}
                  onChange={(e) =>
                    update({ quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })
                  }
                />
              </InlineField>
            </FilterBar>
            <TypeChips
              types={allMatches.map((i) => i.type)}
              value={params.type}
              onChange={(type) => update({ type })}
            />
            <ItemPicker
              items={matches}
              unit={unit}
              side={side}
              compare={compare}
              current={data.data.current}
              onSelect={select}
            />
            <p className="text-xs text-subtle">
              <span className="text-gain">✓</span> recommended currency and the whole units to{' '}
              {side === 'buy' ? 'pay' : 'ask'} for the quantity; plain amounts: no currency is
              meaningfully better ({side === 'buy' ? 'cheapest' : 'best paying'} shown).
            </p>
            <SavedItems saved={saved} items={items} onSelect={select} />
          </Card>

          {item && result && (
            <Result
              item={item}
              quantity={params.quantity}
              result={result}
              unit={unit}
              minPairVolume={economy.pairMinVolume}
              favourite={saved.favourites.includes(item.id)}
              onToggleFavourite={() => save(toggleFavourite(saved, item.id))}
              current={data.data.current}
              onClose={() => update({ item: null })}
            />
          )}
        </>
      )}
    </section>
  );
}

function ItemPicker({
  items,
  unit,
  side,
  compare,
  current,
  onSelect,
}: {
  items: readonly CurrentItem[];
  unit: UnitInfo;
  side: PairSide;
  compare: (id: string) => BestPairResult | null;
  current: Parameters<typeof currencyView>[1];
  onSelect: (id: string) => void;
}) {
  if (!items.length) return <p className="text-sm text-muted">No matching item.</p>;
  return (
    <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <ItemCell icon={item.icon} name={item.name} size="sm" />
            </div>
            <BestChoice result={compare(item.id)} side={side} current={current}>
              <Amount value={item.price} unit={unit} secondary={false} className="text-muted" />
            </BestChoice>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The recommended currency of a list row, with the whole units it takes; the market price
 * (`children`) when no currency is meaningfully better.
 */
function BestChoice({
  result,
  side,
  current,
  children,
}: {
  result: BestPairResult | null;
  side: PairSide;
  current: Parameters<typeof currencyView>[1];
  children: ReactNode;
}) {
  const best = result?.options[0];
  if (!result || !best || best.amount === 0)
    return (
      <span title={result?.reason ? REASONS[result.reason] : 'No rate known for this item.'}>
        {children}
      </span>
    );
  const name = CURRENCY_NAMES[best.currency] ?? best.currency;
  const amount = <Amount value={best.amount} unit={currencyView(best.currency, current)} whole />;
  return result.verdict ? (
    <span title={`${SIDES[side].verb} ${name}`}>
      <Badge tone="gain" icon="✓">
        {amount}
      </Badge>
    </span>
  ) : (
    <span
      className="text-muted"
      title={`${SIDES[side].verb} ${name}${result.reason ? ` · ${REASONS[result.reason]}` : ''}`}
    >
      {amount}
    </span>
  );
}

function SavedItems({
  saved,
  items,
  onSelect,
}: {
  saved: Saved;
  items: ReadonlyMap<string, CurrentItem>;
  onSelect: (id: string) => void;
}) {
  const groups = [
    { label: 'Favourites', ids: saved.favourites },
    { label: 'Recent', ids: saved.recent.filter((id) => !saved.favourites.includes(id)) },
  ].filter((g) => g.ids.some((id) => items.has(id)));
  if (!groups.length) return null;
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{group.label}</span>
          {group.ids.flatMap((id) => {
            const item = items.get(id);
            return item
              ? [
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs hover:border-accent"
                  >
                    {item.icon && <img src={item.icon} alt="" className="h-4 w-4" />}
                    {item.name}
                  </button>,
                ]
              : [];
          })}
        </div>
      ))}
    </div>
  );
}

const REASONS: Record<NonNullable<BestPairResult['reason']>, string> = {
  'single-pair': 'Only one currency has a rate for this item: nothing to compare.',
  'small-difference': 'No meaningful difference: use whichever currency suits you.',
  'low-volume': 'The best pair barely trades: its rate may not be available.',
  'unknown-volume': 'The best pair has no daily volume yet: its rate may not be available.',
  'too-few': 'Worth less than one whole unit of every currency: sell more at once.',
};

function Result(props: {
  item: CurrentItem;
  quantity: number;
  result: BestPairResult;
  unit: UnitInfo;
  minPairVolume: number;
  favourite: boolean;
  onToggleFavourite: () => void;
  current: Parameters<typeof currencyView>[1];
  onClose: () => void;
}) {
  const { item, quantity, result, unit } = props;
  const text = SIDES[result.side];
  const now = useNow();
  const { verdict } = result;
  const partial = result.options.every((o) => o.quote.source === 'hourly');
  const oldest = result.options.reduce<string | null>(
    (min, o) => (min === null || o.quote.asOf < min ? o.quote.asOf : min),
    null,
  );

  const columns: Column<PairOption, string>[] = [
    {
      id: 'currency',
      label: text.currencyLabel,
      render: (o) => (
        <span className="inline-flex items-center gap-2">
          <ItemCell
            icon={currencyView(o.currency, props.current).icon}
            name={CURRENCY_NAMES[o.currency] ?? o.currency}
            size="sm"
          />
          {o.currency === verdict?.currency ? (
            <Badge tone="gain" icon="✓">
              Best
            </Badge>
          ) : (
            !verdict &&
            o === result.options[0] &&
            result.options.length > 1 &&
            o.amount > 0 && (
              <Badge tone="neutral" icon="≈">
                {result.side === 'buy' ? 'Cheapest' : 'Pays most'}
              </Badge>
            )
          )}
        </span>
      ),
    },
    {
      id: 'amount',
      label: text.amountLabel,
      align: 'right',
      title: text.amountTitle,
      render: (o) => (
        <Amount
          value={o.amount}
          unit={currencyView(o.currency, props.current)}
          secondary={false}
          whole
        />
      ),
    },
    {
      id: 'value',
      label: text.valueLabel,
      align: 'right',
      title: `${text.valueTitle}, in ${unit.id}`,
      render: (o) => <Amount value={o.value} unit={unit} />,
    },
    {
      id: 'diff',
      label: 'vs best',
      align: 'right',
      title:
        result.side === 'buy'
          ? 'How much more this option costs than the cheapest'
          : 'How much less this option pays than the best',
      render: (o) => <VsBest option={o} best={result.options[0]} side={result.side} />,
    },
    ...(quantity > 1
      ? [
          {
            id: 'each',
            label: 'Per item',
            align: 'right' as const,
            render: (o: PairOption) => <Amount value={o.unitValue} unit={unit} secondary={false} />,
          },
        ]
      : []),
    {
      id: 'rounding',
      label: 'Rounding',
      align: 'right',
      title: text.roundingTitle,
      render: (o) => <Rounding option={o} side={result.side} quantity={quantity} />,
    },
    {
      id: 'volume',
      label: 'Traded / day',
      align: 'right',
      render: (o) =>
        o.quote.volume === null ? (
          <span className="text-xs text-subtle">unknown</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            {o.quote.volume < props.minPairVolume && (
              <span className="text-warn" title="Thin pair: the rate may not be available">
                ⚠
              </span>
            )}
            <Amount value={o.quote.volume} unit={unit} secondary={false} />
          </span>
        ),
    },
    {
      id: 'age',
      label: 'Rate as of',
      align: 'right',
      render: (o) => {
        const stale = now - Date.parse(o.quote.asOf) > STALE_MS;
        return (
          <span className={`text-xs ${stale ? 'text-warn' : 'text-muted'}`}>
            {stale && '⚠ '}
            {formatAge(o.quote.asOf, now)} · {o.quote.source}
          </span>
        );
      },
    },
  ];

  return (
    <Sheet
      label={`${text.title}: ${item.name}`}
      onClose={props.onClose}
      wide
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ItemCell
            icon={item.icon}
            name={`${quantity} × ${item.name}`}
            subtitle={`Market price ${formatAmount(item.price, unit.id)} ${unit.short} each${
              unit.secondary
                ? ` (${formatAmount(item.price * unit.secondary.perUnit, unit.secondary.id)} ${unit.secondary.short})`
                : ''
            }`}
            size="lg"
          />
          <button
            type="button"
            onClick={props.onToggleFavourite}
            aria-pressed={props.favourite}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-accent"
            title={props.favourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {props.favourite ? '★ Favourite' : '☆ Favourite'}
          </button>
        </div>
      }
    >
      <p className="text-sm">
        {verdict ? (
          <Badge tone="gain" icon="✓">
            {text.verb} {CURRENCY_NAMES[verdict.currency]}
          </Badge>
        ) : (
          <Badge tone="neutral" icon="=">
            No recommendation
          </Badge>
        )}{' '}
        <span className="text-muted">
          {verdict
            ? text.edge(Math.round(verdict.edgeVsNext * 100), Math.round(verdict.edgeVsWorst * 100))
            : result.reason
              ? REASONS[result.reason]
              : 'No rate known for this item.'}
        </span>
      </p>
      {partial && result.options.length > 0 && (
        <Pill tone="warn">Other pairs unknown: low liquidity</Pill>
      )}
      {result.options.length > 0 && (
        <DataTable
          rows={result.options}
          columns={columns}
          rowKey={(o) => o.currency}
          minWidth="50rem"
        />
      )}
      {oldest && (
        <p className="text-xs text-subtle">
          Rates as of {new Date(oldest).toLocaleString()} (oldest leg) · daily rates come from the
          previous day&apos;s trades, the busiest pair is refreshed hourly.
        </p>
      )}
    </Sheet>
  );
}

/** How much worse an option is than the best one (buying: costs more; selling: pays less). */
function VsBest({
  option: o,
  best,
  side,
}: {
  option: PairOption;
  best: PairOption | undefined;
  side: PairSide;
}) {
  if (!best || o === best) return <span className="text-xs text-subtle">—</span>;
  if (!(best.value > 0)) return <span className="text-xs text-subtle">—</span>;
  const pct = Math.round((Math.abs(o.value - best.value) / best.value) * 100);
  if (pct === 0) return <span className="text-xs text-subtle">same</span>;
  return (
    <span className="text-xs text-loss">
      {side === 'buy' ? '+' : '−'}
      {pct} %
    </span>
  );
}

/** Whole-unit rounding of an option: a cleaner quantity when there is one, else the loss. */
function Rounding({
  option: o,
  side,
  quantity,
}: {
  option: PairOption;
  side: PairSide;
  quantity: number;
}) {
  if (side === 'sell' && o.amount === 0)
    return (
      <span className="text-xs text-muted">
        sell at least <span className="font-medium text-fg">{o.cleanQuantity}</span>
      </span>
    );
  if (o.cleanQuantity !== quantity)
    return (
      <span className="text-xs text-muted">
        {side === 'buy' ? 'same price buys' : 'same amount for'}{' '}
        <span className="font-medium text-fg">{o.cleanQuantity}</span>
      </span>
    );
  if (o.rounding > 0.005)
    return (
      <span className="text-xs text-muted">
        {side === 'buy' ? '+' : '−'}
        {formatAmount(o.rounding, o.currency)} {CURRENCY_SHORT[o.currency]}
      </span>
    );
  return <span className="text-xs text-subtle">exact</span>;
}
