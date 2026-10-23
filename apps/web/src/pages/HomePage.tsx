import { Link } from 'react-router';
import { TOOLS } from '../tools/registry.ts';
import type { ToolStatus } from '../tools/types.ts';

const STATUS_LABELS: Record<ToolStatus, string> = {
  stable: 'Stable',
  beta: 'Beta',
  'coming-soon': 'Coming soon',
};

export function HomePage() {
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Tools</h1>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => {
          const available = tool.status !== 'coming-soon';
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-medium">{tool.name}</h2>
                <span className="text-xs text-gray-500">{STATUS_LABELS[tool.status]}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
            </>
          );
          const cardClass = 'block h-full rounded border border-gray-200 p-4 dark:border-gray-800';
          return (
            <li key={tool.id}>
              {available ? (
                <Link
                  to={tool.path}
                  className={`${cardClass} hover:border-accent dark:hover:border-accent`}
                >
                  {body}
                </Link>
              ) : (
                <div className={`${cardClass} opacity-60`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
