import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Guards the shared look and feel (docs/ui-guidelines.md): pages and tools must use the
 * semantic color tokens (bg-surface, text-muted, text-gain…), never raw Tailwind palette
 * colors, so themes and new tools stay consistent.
 */

const SRC = join(import.meta.dirname, '..');
const RAW_COLOR =
  /\b(?:bg|text|border|fill|stroke|ring|outline|divide|from|to|via|shadow|accent|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('UI conventions', () => {
  it('uses semantic color tokens instead of raw palette colors', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RAW_COLOR)].map(
        (m) => `${relative(SRC, file)}: ${m[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
