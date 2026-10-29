import { NavLink } from 'react-router';
import { useSettings } from '../lib/useSettings.ts';
import { TOOLS } from '../tools/registry.ts';
import { CATEGORY_LABELS, type ToolCategory } from '../tools/types.ts';
import { GameSwitch, ThemeSelect } from './TopBar.tsx';

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { settings } = useSettings();
  const categories = Object.keys(CATEGORY_LABELS) as ToolCategory[];

  return (
    <nav
      id="tools-nav"
      aria-label="Tools"
      // Phones: a drawer over the page below the top bar, with its own scroller.
      className={`${open ? 'block' : 'hidden'} fixed inset-x-0 top-14 bottom-0 z-20 w-full shrink-0 overflow-y-auto overscroll-contain border-line bg-surface px-3 py-5 md:sticky md:inset-x-auto md:bottom-auto md:z-auto md:block md:h-[calc(100vh-3.5rem)] md:w-60 md:border-r`}
    >
      {/* Phones: the top bar has no room for these. */}
      <div className="mb-6 flex items-center gap-3 px-3 sm:hidden">
        <GameSwitch className="flex" />
        <ThemeSelect id="theme-mobile" className="ml-auto" />
      </div>
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
