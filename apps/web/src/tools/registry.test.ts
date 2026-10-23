import { describe, expect, it } from 'vitest';
import { TOOLS } from './registry.ts';

describe('tool registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.path)).size).toBe(TOOLS.length);
  });

  it('gives every available tool a component', () => {
    for (const tool of TOOLS) {
      expect(tool.status === 'coming-soon' || tool.component !== undefined).toBe(true);
    }
  });
});
