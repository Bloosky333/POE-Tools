import type { Game } from '@poe-tools/shared';
import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolCategory = 'economy' | 'crafting' | 'misc';
export type ToolStatus = 'stable' | 'beta' | 'coming-soon';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  games: readonly Game[];
  status: ToolStatus;
  /** Route path relative to the app root, e.g. "tools/currency-speculation". */
  path: string;
  /** Lazy-loaded page; absent for tools that are not implemented yet. */
  component?: LazyExoticComponent<ComponentType>;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  economy: 'Economy',
  crafting: 'Crafting',
  misc: 'Misc',
};
