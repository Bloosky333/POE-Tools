/** Divine amount with precision adapted to its magnitude. */
export function formatDiv(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  if (value >= 1000) return Math.round(value).toLocaleString('en-US');
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(2);
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
