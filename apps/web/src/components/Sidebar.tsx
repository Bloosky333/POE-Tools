import { NavLink } from 'react-router';
import { useSettings } from '../lib/useSettings.ts';
import { TOOLS } from '../tools/registry.ts';
import { CATEGORY_LABELS, type ToolCategory } from '../tools/types.ts';

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { settings } = useSettings();
  const categories = Object.keys(CATEGORY_LABELS) as ToolCategory[];

  return (
    <nav
      aria-label="Tools"
      className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-line bg-surface px-3 py-5 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:w-60 md:border-r`}
    >
      {categories.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (!tools.length) return null;
        return (
          <div key={category} className="mb-6">
            <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-subtle uppercase">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="space-y-0.5">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const available =
                  tool.status !== 'coming-soon' && tool.games.includes(settings.game);
                return (
                  <li key={tool.id}>
                    {available ? (
                      <NavLink
                        to={tool.path}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                            isActive
                              ? 'bg-accent-soft font-medium text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded before:bg-accent'
                              : 'text-muted hover:bg-surface-2 hover:text-fg'
                          }`
                        }
                      >
                        <Icon className="text-accent" />
                        {tool.name}
                      </NavLink>
                    ) : (
                      <span className="flex items-center gap-2.5 px-3 py-2 text-sm text-subtle">
                        <Icon className="opacity-60" />
                        {tool.name}
                        <span className="ml-auto text-[10px] tracking-wide uppercase opacity-70">
                          Soon
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
