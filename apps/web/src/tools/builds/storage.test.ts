import { beforeEach, describe, expect, it } from 'vitest';
import { loadBuilds, newBuild, storeBuilds } from './storage.ts';

describe('builds storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the builds of a game', () => {
    const build = {
      ...newBuild('poe2'),
      name: 'Lightning Spear',
      ascendancy: 'Amazon',
      links: [{ url: 'https://www.youtube.com/watch?v=abc' }],
    };
    storeBuilds('poe2', [build]);
    expect(loadBuilds('poe2')).toEqual([build]);
    expect(loadBuilds('poe1')).toEqual([]);
  });

  it('drops invalid entries', () => {
    const good = { ...newBuild('poe1'), name: 'RF' };
    localStorage.setItem(
      'poe-tools:builds:poe1',
      JSON.stringify([good, { ...good, id: 'x', links: [{ url: 'javascript:alert(1)' }] }, 1]),
    );
    expect(loadBuilds('poe1')).toEqual([good]);
  });
});
