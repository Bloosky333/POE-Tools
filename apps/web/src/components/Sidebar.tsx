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
      className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-gray-200 px-3 py-4 md:block md:w-56 md:border-r dark:border-gray-800`}
    >
      {categories.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        if (!tools.length) return null;
        return (
          <div key={category} className="mb-4">
            <h2 className="mb-1 px-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul>
              {tools.map((tool) => {
                const available =
                  tool.status !== 'coming-soon' && tool.games.includes(settings.game);
                return (
                  <li key={tool.id}>
                    {available ? (
                      <NavLink
                        to={tool.path}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `block rounded px-2 py-1 text-sm ${isActive ? 'bg-gray-100 font-medium dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`
                        }
                      >
                        {tool.name}
                      </NavLink>
                    ) : (
                      <span className="block px-2 py-1 text-sm text-gray-400 dark:text-gray-600">
                        {tool.name}
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
