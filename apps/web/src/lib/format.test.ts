import { describe, expect, it } from 'vitest';
import { formatAge, formatDiv, formatMultiplier, formatPercent } from './format.ts';

describe('format', () => {
  it('formats divine amounts by magnitude', () => {
    expect(formatDiv(5925)).toBe('5,925');
    expect(formatDiv(12.34)).toBe('12.3');
    expect(formatDiv(1.234)).toBe('1.23');
    expect(formatDiv(0.004664)).toBe('0.0047');
    expect(formatDiv(null)).toBe('–');
  });

  it('formats multipliers, percents and ages', () => {
    expect(formatMultiplier(1.5)).toBe('×1.50');
    expect(formatPercent(12.4)).toBe('+12%');
    expect(formatAge('2026-10-24T10:00:00Z', Date.parse('2026-10-24T10:23:00Z'))).toBe(
      '23 min ago',
    );
    expect(formatAge('2026-10-24T05:00:00Z', Date.parse('2026-10-24T10:00:00Z'))).toBe('5 h ago');
  });
});

describe('iconUrl', () => {
  it('resolves self-hosted icons and drops remote URLs', async () => {
    const { iconUrl } = await import('./data.ts');
    expect(iconUrl('icons/abc-Orb.png')).toBe(`${import.meta.env.BASE_URL}data/icons/abc-Orb.png`);
    expect(iconUrl('https://poe.ninja/gen/image/x.png')).toBe('');
  });
});
