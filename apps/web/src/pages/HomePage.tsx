import { Link } from 'react-router';
import { ActionBadge } from '../tools/currency-speculation/ActionBadge.tsx';
import { useSuggestions } from '../tools/currency-speculation/useSuggestions.ts';
import { Div } from '../components/Div.tsx';
import { formatMultiplier } from '../lib/format.ts';
import { TOOLS } from '../tools/registry.ts';
import type { ToolStatus } from '../tools/types.ts';

const STATUS_LABELS: Record<ToolStatus, string> = {
  stable: 'Stable',
  beta: 'Beta',
  'coming-soon': 'Coming soon',
};

const MODE = { kind: 'horizon', days: 14 } as const;

export function HomePage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-1 text-sm text-muted">Decision tools for the Path of Exile economy.</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const available = tool.status !== 'coming-soon';
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${available ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle'}`}
                >
                  <Icon width={20} height={20} />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${available ? 'bg-gain-soft text-gain' : 'bg-surface-2 text-subtle'}`}
                >
                  {STATUS_LABELS[tool.status]}
                </span>
              </div>
              <h2 className="mt-3 font-medium">{tool.name}</h2>
              <p className="mt-1 text-sm text-muted">{tool.description}</p>
            </>
          );
          const cardClass = 'block h-full rounded-lg border border-line bg-surface p-4';
          return (
            <li key={tool.id}>
              {available ? (
                <Link
                  to={tool.path}
                  className={`${cardClass} transition-colors hover:border-accent`}
                >
                  {body}
                </Link>
              ) : (
                <div className={`${cardClass} opacity-70`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <TopOpportunities />
    </section>
  );
}

function TopOpportunities() {
  const { data, suggestions, divineIcon, reference } = useSuggestions(MODE, 5);
  if (data.status !== 'ready') return null;
  const top = suggestions
    .filter((s) => (s.action === 'buy' || s.action === 'wait') && s.item.price >= 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (!top.length) return null;

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="font-medium">Top opportunities</h2>
          <p className="text-xs text-muted">Hold 14 days · based on {reference?.name}</p>
        </div>
        <Link to="tools/currency-speculation" className="text-sm text-accent hover:underline">
          See all →
        </Link>
      </header>
      <ul className="divide-y divide-line">
        {top.map((s) => (
          <li key={s.item.id}>
            <Link
              to={`tools/currency-speculation?item=${encodeURIComponent(s.item.id)}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
                {s.item.icon && <img src={s.item.icon} alt="" className="h-7 w-7" />}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.item.name}</span>
              <ActionBadge
                action={s.action}
                detail={
                  s.action === 'wait' && s.reference ? `day ${s.reference.buyDay}` : undefined
                }
              />
              <Div value={s.item.price} icon={divineIcon} className="w-20 text-sm" />
              <span className="w-14 text-right font-semibold text-gain">
                {formatMultiplier(s.reference?.multiplierFromBuy)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
