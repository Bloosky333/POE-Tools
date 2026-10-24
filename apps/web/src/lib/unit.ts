import {
  CURRENCY_SHORT,
  ECONOMY,
  type CoreCurrency,
  type CurrentFile,
  type Game,
} from '@poe-tools/shared';

/** A currency as displayed: id, short label and icon (when the item list has it). */
export interface CurrencyView {
  id: CoreCurrency;
  short: string;
  icon: string | undefined;
}

/**
 * The unit prices of the selected game are in (PoE 2: divine, PoE 1: chaos) and, for PoE 1,
 * the secondary currency shown next to them (divine) with its rate.
 */
export interface UnitInfo extends CurrencyView {
  secondary: (CurrencyView & { /** Units of the secondary per 1 unit. */ perUnit: number }) | null;
}

export function currencyView(id: CoreCurrency, current?: CurrentFile | null): CurrencyView {
  return {
    id,
    short: CURRENCY_SHORT[id],
    icon: current?.items.find((item) => item.id === id)?.icon || undefined,
  };
}

export function unitInfo(game: Game, current?: CurrentFile | null): UnitInfo {
  const { unit, secondary } = ECONOMY[game];
  const perUnit = secondary ? current?.rates[secondary] : undefined;
  return {
    ...currencyView(unit, current),
    secondary: secondary && perUnit ? { ...currencyView(secondary, current), perUnit } : null,
  };
}
