import {
  CURRENCY_NAMES,
  CURRENCY_SHORT,
  ECONOMY,
  cheapest,
  cheapestSettingsFor,
  getLeague,
  type CheapestResult,
  type CurrentItem,
  type PayOption,
} from '@poe-tools/shared';
import { useMemo, useState } from 'react';
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
  Panel,
  Pill,
  SearchInput,
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

export default function CheapestCurrencyPage() {
  const [params, update] = useViewParams();
  const { settings } = useSettings();
  const { game } = settings;
  const league = getLeague(settings.leagueId);
  const economy = ECONOMY[game];

  const data = useAsync(`cheapest:${game}:${settings.leagueId}`, async () => {
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
  const [stored, setStored] = useState(() => ({ game, saved: loadSaved(game) }));
  const saved = stored.game === game ? stored.saved : loadSaved(game);
  const save = (next: Saved) => {
    setStored({ game, saved: next });
    storeSaved(game, next);
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
  const result: CheapestResult | null =
    item && data.status === 'ready'
      ? cheapest({
          quotes: data.data.pairs.items[item.id] ?? {},
          quantity: params.quantity,
          unit: economy.unit,
          rates: data.data.current.rates,
          currencies: economy.hubs,
          settings: cheapestSettingsFor(game),
        })
      : null;

  const select = (id: string) => {
    update({ item: id, q: '' });
    save(addRecent(saved, id));
  };

  if (!league) return <p>No league selected.</p>;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Cheapest Currency"
        description={`Which currency to pay with on the exchange: ${economy.hubs
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
            {(params.q || !item) && (
              <>
                <TypeChips
                  types={allMatches.map((i) => i.type)}
                  value={params.type}
                  onChange={(type) => update({ type })}
                />
                <ItemPicker items={matches} unit={unit} onSelect={select} />
              </>
            )}
            <SavedItems saved={saved} items={items} onSelect={select} />
          </Card>

          {item && result && (
            <Result
              item={item}
              quantity={params.quantity}
              result={result}
              unit={unit}
              minPairVolume={economy.payMinVolume}
              favourite={saved.favourites.includes(item.id)}
              onToggleFavourite={() => save(toggleFavourite(saved, item.id))}
              current={data.data.current}
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
  onSelect,
}: {
  items: readonly CurrentItem[];
  unit: UnitInfo;
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
            <Amount value={item.price} unit={unit} secondary={false} className="text-muted" />
          </button>
        </li>
      ))}
    </ul>
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

const REASONS: Record<NonNullable<CheapestResult['reason']>, string> = {
  'single-pair': 'Only one currency has a rate for this item: nothing to compare.',
  'small-difference': 'No meaningful difference: pay with whatever you have.',
  'low-volume': 'The cheapest pair barely trades: its rate may not be available.',
  'unknown-volume': 'The cheapest pair has no daily volume yet: its rate may not be available.',
};

function Result(props: {
  item: CurrentItem;
  quantity: number;
  result: CheapestResult;
  unit: UnitInfo;
  minPairVolume: number;
  favourite: boolean;
  onToggleFavourite: () => void;
  current: Parameters<typeof currencyView>[1];
}) {
  const { item, quantity, result, unit } = props;
  const now = useNow();
  const { verdict } = result;
  const partial = result.options.every((o) => o.quote.source === 'hourly');
  const oldest = result.options.reduce<string | null>(
    (min, o) => (min === null || o.quote.asOf < min ? o.quote.asOf : min),
    null,
  );

  const columns: Column<PayOption, string>[] = [
    {
      id: 'currency',
      label: 'Pay with',
      render: (o) => (
        <ItemCell
          icon={currencyView(o.currency, props.current).icon}
          name={CURRENCY_NAMES[o.currency] ?? o.currency}
          size="sm"
        />
      ),
    },
    {
      id: 'pay',
      label: 'Hand over',
      align: 'right',
      title: 'Whole units of the currency to pay',
      render: (o) => (
        <Amount
          value={o.pay}
          unit={currencyView(o.currency, props.current)}
          secondary={false}
          whole
        />
      ),
    },
    {
      id: 'cost',
      label: 'Cost',
      align: 'right',
      title: `Real cost of what you hand over, in ${unit.id} at today's rate`,
      render: (o) => <Amount value={o.cost} unit={unit} />,
    },
    {
      id: 'each',
      label: 'Per item',
      align: 'right',
      render: (o) => <Amount value={o.unitPrice} unit={unit} secondary={false} />,
    },
    {
      id: 'waste',
      label: 'Rounding',
      align: 'right',
      title: 'Paid beyond the exact price because the exchange trades whole units',
      render: (o) =>
        o.cleanQuantity > quantity ? (
          <span className="text-xs text-muted">
            same price buys <span className="font-medium text-fg">{o.cleanQuantity}</span>
          </span>
        ) : o.waste > 0.005 ? (
          <span className="text-xs text-muted">
            +{formatAmount(o.waste, o.currency)} {CURRENCY_SHORT[o.currency]}
          </span>
        ) : (
          <span className="text-xs text-subtle">exact</span>
        ),
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
    <Panel
      title={
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
      }
      action={
        <button
          type="button"
          onClick={props.onToggleFavourite}
          aria-pressed={props.favourite}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-accent"
          title={props.favourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          {props.favourite ? '★ Favourite' : '☆ Favourite'}
        </button>
      }
    >
      <div className="space-y-3 p-4">
        <p className="text-sm">
          {verdict ? (
            <Badge tone="gain" icon="✓">
              Pay with {CURRENCY_NAMES[verdict.currency]}
            </Badge>
          ) : (
            <Badge tone="neutral" icon="=">
              No recommendation
            </Badge>
          )}{' '}
          <span className="text-muted">
            {verdict
              ? `${Math.round(verdict.savingVsNext * 100)} % cheaper than the next option, ${Math.round(
                  verdict.savingVsWorst * 100,
                )} % than the most expensive.`
              : result.reason
                ? REASONS[result.reason]
                : 'No rate known for this item.'}
          </span>
        </p>
        {partial && result.options.length > 0 && (
          <Pill tone="warn">Other pairs unknown: low liquidity</Pill>
        )}
      </div>
      {result.options.length > 0 && (
        <DataTable
          rows={result.options}
          columns={columns}
          rowKey={(o) => o.currency}
          minWidth="48rem"
        />
      )}
      {oldest && (
        <p className="border-t border-line px-4 py-2 text-xs text-subtle">
          Rates as of {new Date(oldest).toLocaleString()} (oldest leg) · daily rates come from the
          previous day&apos;s trades, the busiest pair is refreshed hourly.
        </p>
      )}
    </Panel>
  );
}
