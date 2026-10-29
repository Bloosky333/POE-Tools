import { relativeDay, type HistoryPoint } from '@poe-tools/shared';
import { useId, useState, type PointerEvent } from 'react';
import { formatAmount, formatDiv } from '../lib/format.ts';

interface Props {
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceLabel: string;
  currentLabel: string;
  today: number;
  /** Shaded day range, e.g. the suggested buy → sell window. */
  windowFrom?: number | undefined;
  windowTo?: number | undefined;
  /** Draws the reference scaled to the current market level (market factor). */
  referenceScale?: number | null | undefined;
  /** Price unit: currency id and short label (default divine). */
  unit?: { id: string; short: string } | undefined;
}

const W = 640;
const H = 260;
const M = { top: 12, right: 16, bottom: 28, left: 52 };

/**
 * Prices of both leagues (in the game's unit) by days since league start, with today's marker and
 * a shaded day window, and optionally the reference scaled to this league's
 * market level. Hover shows the values for a day.
 */
export function PriceChart(props: Props) {
  const { reference, current, today } = props;
  const unit = props.unit ?? { id: 'divine', short: 'div' };
  const fmt = (value: number) => formatAmount(value, unit.id);
  const clipId = useId();
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const scale = props.referenceScale ?? null;
  const scaled: HistoryPoint[] = scale ? reference.map(([d, p, v]) => [d, p * scale, v]) : [];
  const all = [...reference, ...current, ...scaled];
  if (!all.length) return <p className="text-sm text-muted">No price history.</p>;
  // At least one day and a positive price range, so a day-0-only or all-zero series still
  // gets finite coordinates.
  const maxDay = Math.max(...all.map((p) => p[0]), today, 1);
  const maxPrice = Math.max(...all.map((p) => p[1])) * 1.08 || 1;

  const x = (day: number) => M.left + (day / maxDay) * (W - M.left - M.right);
  const y = (price: number) => H - M.bottom - (price / maxPrice) * (H - M.top - M.bottom);
  const path = (points: readonly HistoryPoint[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');

  const yTicks = niceTicks(maxPrice, 4);
  const xTicks = niceTicks(maxDay, 6);
  const at = (points: readonly HistoryPoint[], day: number) => points.find((p) => p[0] === day);

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const day = Math.round(((px - M.left) / (W - M.left - M.right)) * maxDay);
    setHoverDay(day >= 0 && day <= maxDay ? day : null);
  }

  const hoverRef = hoverDay === null ? undefined : at(reference, hoverDay);
  const hoverCur = hoverDay === null ? undefined : at(current, hoverDay);

  return (
    <figure className="viz-root">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        <Legend color="var(--series-1)" label={props.referenceLabel} />
        <Legend color="var(--series-2)" label={props.currentLabel} />
        {scale && (
          <Legend
            color="var(--series-1)"
            dashed
            label={`${props.referenceLabel} × ${formatDiv(scale)} (market level)`}
          />
        )}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y select-none"
          role="img"
          aria-label={`Price in ${unit.id} by league day: ${props.referenceLabel} and ${props.currentLabel}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverDay(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={M.left}
                y={M.top}
                width={W - M.left - M.right}
                height={H - M.top - M.bottom}
              />
            </clipPath>
          </defs>
          {props.windowFrom !== undefined && props.windowTo !== undefined && (
            <rect
              x={x(props.windowFrom)}
              y={M.top}
              width={Math.max(0, x(props.windowTo) - x(props.windowFrom))}
              height={H - M.top - M.bottom}
              className="fill-accent-soft"
            />
          )}
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-line"
              />
              <text
                x={M.left - 6}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-subtle text-[11px]"
              >
                {fmt(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={`x${tick}`}
              x={x(tick)}
              y={H - 8}
              textAnchor="middle"
              className="fill-subtle text-[11px]"
            >
              {tick === 0 ? 'day 0' : tick}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={2} strokeLinejoin="round">
            <path d={path(reference)} stroke="var(--series-1)" />
            {scale && (
              <path d={path(scaled)} stroke="var(--series-1)" strokeDasharray="5 4" opacity={0.7} />
            )}
            <path d={path(current)} stroke="var(--series-2)" />
          </g>
          {/* A one-point series draws no line: mark it (e.g. day 0 of the current league). */}
          {reference.length === 1 && reference[0] && (
            <Dot cx={x(reference[0][0])} cy={y(reference[0][1])} color="var(--series-1)" />
          )}
          {current.length === 1 && current[0] && (
            <Dot cx={x(current[0][0])} cy={y(current[0][1])} color="var(--series-2)" />
          )}
          <line
            x1={x(today)}
            x2={x(today)}
            y1={M.top}
            y2={H - M.bottom}
            strokeDasharray="3 3"
            className="stroke-subtle"
          />
          <text x={x(today) + 4} y={M.top + 10} className="fill-subtle text-[11px]">
            today
          </text>
          {hoverDay !== null && (
            <g>
              <line
                x1={x(hoverDay)}
                x2={x(hoverDay)}
                y1={M.top}
                y2={H - M.bottom}
                className="stroke-muted"
              />
              {hoverRef && <Dot cx={x(hoverDay)} cy={y(hoverRef[1])} color="var(--series-1)" />}
              {hoverCur && <Dot cx={x(hoverDay)} cy={y(hoverCur[1])} color="var(--series-2)" />}
            </g>
          )}
        </svg>
        {hoverDay !== null && (hoverRef || hoverCur) && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(x(hoverDay) / W) * 100}%`,
              transform: x(hoverDay) > W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <div className="font-medium">
              Day {hoverDay}
              <span className="font-normal text-muted"> · {relativeDay(hoverDay, today)}</span>
            </div>
            {hoverRef && (
              <div>
                {props.referenceLabel}: {fmt(hoverRef[1])} {unit.short}
              </div>
            )}
            {hoverRef && scale && (
              <div className="text-muted">
                at market level: {fmt(hoverRef[1] * scale)} {unit.short}
              </div>
            )}
            {hoverCur && (
              <div>
                {props.currentLabel}: {fmt(hoverCur[1])} {unit.short}
              </div>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-4 rounded"
        style={
          dashed
            ? {
                background: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)`,
              }
            : { background: color }
        }
      />
      {label}
    </span>
  );
}

function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <circle cx={cx} cy={cy} r={4} fill={color} className="stroke-surface" strokeWidth={2} />;
}

/** Round tick values from 0 to `max`. */
function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(Number(t.toPrecision(6)));
  return ticks;
}
