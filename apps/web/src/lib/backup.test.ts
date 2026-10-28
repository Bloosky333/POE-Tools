// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, parseBackup, restoreBackup } from './backup.ts';

describe('backup', () => {
  beforeEach(() => localStorage.clear());

  it('carries every poe-tools entry to another browser', () => {
    localStorage.setItem('poe-tools:settings', '{"game":"poe1"}');
    localStorage.setItem('poe-tools:crafting-recipes:poe2', '[{"id":"r"}]');
    localStorage.setItem('other-app', '1');
    const text = JSON.stringify(createBackup(localStorage, new Date('2026-10-28T00:00:00Z')));

    localStorage.clear();
    localStorage.setItem('poe-tools:cheapest-currency:poe2', '{"recent":["x"]}');
    expect(restoreBackup(parseBackup(text))).toBe(2);
    expect(localStorage.getItem('poe-tools:settings')).toBe('{"game":"poe1"}');
    expect(localStorage.getItem('poe-tools:crafting-recipes:poe2')).toBe('[{"id":"r"}]');
    expect(localStorage.getItem('poe-tools:cheapest-currency:poe2')).toBe('{"recent":["x"]}');
    expect(localStorage.getItem('other-app')).toBeNull();
  });

  it('rejects files that are not a backup', () => {
    expect(() => parseBackup('nope')).toThrow('not JSON');
    expect(() =>
      parseBackup('{"app":"poe-tools","version":1,"exportedAt":"x","data":{"evil":1}}'),
    ).toThrow('not a POE Tools backup');
  });
});
