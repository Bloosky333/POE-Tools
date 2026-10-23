import { describe, expect, it } from 'vitest';
import { daysSince, leagueDay } from './time.ts';

describe('time', () => {
  const start = '2026-09-04T20:00:00Z';

  it('computes fractional days since league start', () => {
    expect(daysSince(start, new Date('2026-09-05T08:00:00Z'))).toBeCloseTo(0.5);
  });

  it('computes the league day index', () => {
    expect(leagueDay(start, new Date('2026-09-04T20:00:00Z'))).toBe(0);
    expect(leagueDay(start, new Date('2026-10-23T12:00:00Z'))).toBe(48);
  });
});
