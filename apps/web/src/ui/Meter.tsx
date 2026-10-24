/** 0–100 score as a short bar plus the number. Tone follows the value. */
export function ScoreMeter({ value }: { value: number }) {
  const tone = value >= 70 ? 'bg-gain' : value >= 40 ? 'bg-warn' : 'bg-loss';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-muted">{value}</span>
    </div>
  );
}

/** Labelled 0–1 ratio bar, used for breakdowns. */
export function RatioBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[1fr_8rem_2.5rem] items-center gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right text-xs text-muted">{pct}%</span>
    </div>
  );
}
