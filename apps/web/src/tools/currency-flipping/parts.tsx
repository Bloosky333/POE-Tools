import type { CurrentItem, Flip, Hub } from '@poe-tools/shared';
import { Badge } from '../../ui/index.ts';
import { toRatio } from './logic.ts';

export const HUB_NAMES: Record<Hub, string> = {
  divine: 'Divine Orb',
  exalted: 'Exalted Orb',
  chaos: 'Chaos Orb',
};

export const HUB_SHORT: Record<Hub, string> = { divine: 'div', exalted: 'ex', chaos: 'c' };

/** Buy / sell prices (hub per item) used for the margin: averages, or the range for spreads. */
export function quotePrices(flip: Flip): { buy: number; sell: number } {
  return flip.kind === 'spread'
    ? { buy: flip.buy.low, sell: flip.sell.high }
    : { buy: flip.buy.avg, sell: flip.sell.avg };
}

export function formatMargin(value: number): string {
  const pct = value * 100;
  return `${pct > 0 ? '+' : ''}${pct >= 100 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

/** Flip type with its currencies: "Cross-pair ex → div", "Spread c". */
export function KindBadge({ flip }: { flip: Flip }) {
  return flip.kind === 'cross' ? (
    <Badge
      tone="accent"
      icon="⇄"
      detail={`${HUB_SHORT[flip.buy.hub]} → ${HUB_SHORT[flip.sell.hub]}`}
    >
      Cross-pair
    </Badge>
  ) : (
    <Badge tone="neutral" icon="↕" detail={HUB_SHORT[flip.buy.hub]}>
      Spread
    </Badge>
  );
}

function Icon({ src, alt }: { src: string | undefined; alt: string }) {
  return src ? (
    <img src={src} alt={alt} width={16} height={16} className="h-4 w-4 shrink-0" />
  ) : (
    <span className="text-xs text-subtle">{alt}</span>
  );
}

/**
 * An exchange order as typed in-game: `pay` units of one side for `get` units of the other.
 * `price` is in hub units per 1 item.
 */
export function OrderRatio({
  side,
  price,
  hub,
  item,
  hubIcons,
}: {
  side: 'buy' | 'sell';
  price: number;
  hub: Hub;
  item: CurrentItem | undefined;
  hubIcons: Partial<Record<Hub, string>>;
}) {
  const [hubQty, itemQty] = toRatio(price);
  const hubPart = (
    <span className="inline-flex items-center gap-1">
      {hubQty}
      <Icon src={hubIcons[hub]} alt={HUB_SHORT[hub]} />
    </span>
  );
  const itemPart = (
    <span className="inline-flex items-center gap-1">
      {itemQty}
      <Icon src={item?.icon} alt={item?.name ?? 'item'} />
    </span>
  );
  return (
    <span
      className="relative inline-flex items-center gap-1.5 whitespace-nowrap"
      title={
        side === 'buy'
          ? `Pay ${hubQty} ${HUB_NAMES[hub]} for ${itemQty} ${item?.name ?? 'items'}`
          : `Pay ${itemQty} ${item?.name ?? 'items'} for ${hubQty} ${HUB_NAMES[hub]}`
      }
    >
      {side === 'buy' ? hubPart : itemPart}
      <span aria-hidden className="text-subtle">
        →
      </span>
      <span className="sr-only">for</span>
      {side === 'buy' ? itemPart : hubPart}
    </span>
  );
}
