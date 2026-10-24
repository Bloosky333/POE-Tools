import type { HistoryPoint } from '@poe-tools/shared';
import { useId, useState, type PointerEvent } from 'react';
import { formatDiv } from '../../lib/format.ts';

interface Props {
  reference: readonly HistoryPoint[];
  current: readonly HistoryPoint[];
  referenceLabel: string;
  currentLabel: string;
  today: number;
  buyDay?: number | undefined;
  sellDay?: number | undefined;
}

const W = 640;
const H = 260;
const M = { top: 12, right: 16, bottom: 28, left: 52 };

/**
 * Prices of both leagues (divine) by days since league start, with today's marker and
 * the suggested buy → sell window. Hover shows both values for a day.
 */
export function PriceChart(props: Props) {
  const { reference, current, today } = props;
  const clipId = useId();
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const all = [...reference, ...current];
  if (!all.length) return <p className="text-sm text-gray-500">No price history.</p>;
  const maxDay = Math.max(...all.map((p) => p[0]), today);
  const maxPrice = Math.max(...all.map((p) => p[1])) * 1.08;

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
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
        <Legend color="var(--series-1)" label={props.referenceLabel} />
        <Legend color="var(--series-2)" label={props.currentLabel} />
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={`Price in divine by league day: ${props.referenceLabel} and ${props.currentLabel}`}
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
          {props.buyDay !== undefined && props.sellDay !== undefined && (
            <rect
              x={x(props.buyDay)}
              y={M.top}
              width={Math.max(0, x(props.sellDay) - x(props.buyDay))}
              height={H - M.top - M.bottom}
              className="fill-gray-100 dark:fill-gray-800"
            />
          )}
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-gray-200 dark:stroke-gray-800"
              />
              <text
                x={M.left - 6}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-gray-500 text-[11px]"
              >
                {formatDiv(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={`x${tick}`}
              x={x(tick)}
              y={H - 8}
              textAnchor="middle"
              className="fill-gray-500 text-[11px]"
            >
              {tick === 0 ? 'day 0' : tick}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={2} strokeLinejoin="round">
            <path d={path(reference)} stroke="var(--series-1)" />
            <path d={path(current)} stroke="var(--series-2)" />
          </g>
          <line
            x1={x(today)}
            x2={x(today)}
            y1={M.top}
            y2={H - M.bottom}
            strokeDasharray="3 3"
            className="stroke-gray-500"
          />
          <text x={x(today) + 4} y={M.top + 10} className="fill-gray-500 text-[11px]">
            today
          </text>
          {hoverDay !== null && (
            <g>
              <line
                x1={x(hoverDay)}
                x2={x(hoverDay)}
                y1={M.top}
                y2={H - M.bottom}
                className="stroke-gray-400"
              />
              {hoverRef && <Dot cx={x(hoverDay)} cy={y(hoverRef[1])} color="var(--series-1)" />}
              {hoverCur && <Dot cx={x(hoverDay)} cy={y(hoverCur[1])} color="var(--series-2)" />}
            </g>
          )}
        </svg>
        {hoverDay !== null && (hoverRef || hoverCur) && (
          <div
            className="pointer-events-none absolute top-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-900"
            style={{
              left: `${(x(hoverDay) / W) * 100}%`,
              transform: x(hoverDay) > W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <div className="font-medium">Day {hoverDay}</div>
            {hoverRef && (
              <div>
                {props.referenceLabel}: {formatDiv(hoverRef[1])} div
              </div>
            )}
            {hoverCur && (
              <div>
                {props.currentLabel}: {formatDiv(hoverCur[1])} div
              </div>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      className="stroke-white dark:stroke-gray-950"
      strokeWidth={2}
    />
  );
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
