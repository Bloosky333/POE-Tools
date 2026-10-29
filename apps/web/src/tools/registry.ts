import { lazy } from 'react';
import {
  CoinsIcon,
  HammerIcon,
  PickaxeIcon,
  SwapIcon,
  TagIcon,
  TrendDownIcon,
  TrendIcon,
} from '../components/icons.tsx';
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
    id: 'buy-with',
    icon: CoinsIcon,
    name: 'Buy With',
    description: 'Which currency to pay with for an exchange item, in whole units.',
    category: 'economy',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/buy-with',
    component: lazy(() => import('./buy-with/BuyWithPage.tsx')),
  },
  {
    id: 'sell-for',
    icon: TagIcon,
    name: 'Sell For',
    description: 'Which currency to ask for when selling an exchange item, in whole units.',
    category: 'economy',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/sell-for',
    component: lazy(() => import('./sell-for/SellForPage.tsx')),
  },
  {
    id: 'what-to-farm',
    icon: PickaxeIcon,
    name: 'What to Farm',
    description: 'Which league mechanics drop the most valuable, easiest-to-sell loot right now.',
    category: 'economy',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/what-to-farm',
    component: lazy(() => import('./what-to-farm/WhatToFarmPage.tsx')),
  },
  {
    id: 'crafting-recipes',
    icon: HammerIcon,
    name: 'Crafting Recipes',
    description: 'Your crafting methods step by step, with live currency cost and expected total.',
    category: 'crafting',
    games: ['poe2', 'poe1'],
    status: 'beta',
    path: 'tools/crafting-recipes',
    component: lazy(() => import('./crafting-recipes/CraftingRecipesPage.tsx')),
  },
];

/** Old tool paths still reachable from bookmarks: old path → current path (query kept). */
export const REDIRECTS: Readonly<Record<string, string>> = {
  'tools/cheapest-currency': 'tools/buy-with',
};
