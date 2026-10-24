import { lazy } from 'react';
import { CoinsIcon, HammerIcon, SwapIcon, TrendIcon } from '../components/icons.tsx';
import type { ToolDefinition } from './types.ts';

/** Every tool of the app. Adding a tool = a folder under `tools/` + one entry here. */
export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'currency-speculation',
    icon: TrendIcon,
    name: 'Currency Speculation',
    description:
      'What to buy now and sell later, based on how prices moved in the previous league.',
    category: 'economy',
    games: ['poe2'],
    status: 'beta',
    path: 'tools/currency-speculation',
    component: lazy(() => import('./currency-speculation/CurrencySpeculationPage.tsx')),
  },
  {
    id: 'currency-flipping',
    icon: SwapIcon,
    name: 'Currency Flipping',
    description: 'Buy/sell margins on the currency exchange, ranked by profit and volume.',
    category: 'economy',
    games: ['poe2'],
    status: 'coming-soon',
    path: 'tools/currency-flipping',
  },
  {
    id: 'cheapest-currency',
    icon: CoinsIcon,
    name: 'Cheapest Currency',
    description: 'Whether an exchange item is cheaper paid in divine, chaos or exalted.',
    category: 'economy',
    games: ['poe2'],
    status: 'coming-soon',
    path: 'tools/cheapest-currency',
  },
  {
    id: 'crafting-recipes',
    icon: HammerIcon,
    name: 'Crafting Recipes',
    description: 'Crafting methods with live cost per attempt and expected total cost.',
    category: 'crafting',
    games: ['poe2'],
    status: 'coming-soon',
    path: 'tools/crafting-recipes',
  },
];
