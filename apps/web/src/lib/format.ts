/** Divine (or exalted) amount with precision adapted to its magnitude. */
export function formatDiv(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  if (value >= 1000) return Math.round(value).toLocaleString('en-US');
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(2);
}

/** Chaos amount: whole chaos from 10 c, one decimal below, two digits under 1 c. */
export function formatChaos(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  if (value >= 10) return Math.round(value).toLocaleString('en-US');
  if (value >= 1) return value.toFixed(1);
  return value.toPrecision(2);
}

/** An amount of `currency`, formatted for that currency. */
export function formatAmount(value: number | null | undefined, currency: string): string {
  return currency === 'chaos' ? formatChaos(value) : formatDiv(value);
}

export function formatMultiplier(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return `×${value >= 10 ? value.toFixed(0) : value.toFixed(2)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return `${value > 0 ? '+' : ''}${value.toFixed(0)}%`;
}

/** "23 min ago", "3 h ago", "2 d ago". */
export function formatAge(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
