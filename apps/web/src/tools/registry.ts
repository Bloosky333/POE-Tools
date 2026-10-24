import { lazy } from 'react';
import { CoinsIcon, HammerIcon, SwapIcon, TrendDownIcon, TrendIcon } from '../components/icons.tsx';
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
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/currency-speculation',
    component: lazy(() => import('./currency-speculation/CurrencySpeculationPage.tsx')),
  },
  {
    id: 'sell-now',
    icon: TrendDownIcon,
    name: 'Sell Now',
    description: 'What to sell before it drops, from where prices peaked in the previous league.',
    category: 'economy',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/sell-now',
    component: lazy(() => import('./sell-now/SellNowPage.tsx')),
  },
  {
    id: 'currency-flipping',
    icon: SwapIcon,
    name: 'Currency Flipping',
    description: 'Buy/sell margins on the currency exchange, with the ratios to place in-game.',
    category: 'economy',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/currency-flipping',
    component: lazy(() => import('./currency-flipping/CurrencyFlippingPage.tsx')),
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
