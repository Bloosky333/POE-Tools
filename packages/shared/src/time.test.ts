import { describe, expect, it } from 'vitest';
import { daysSince, leagueDay, leagueDayOfDate, utcDate } from './time.ts';

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

describe('calendar dates', () => {
  it('formats UTC dates', () => {
    expect(utcDate(new Date('2026-10-23T23:59:59Z'))).toBe('2026-10-23');
  });

  it('counts the league start date as day 0 whatever the start hour', () => {
    const start = '2026-09-04T20:00:00Z';
    expect(leagueDayOfDate(start, '2026-09-04')).toBe(0);
    expect(leagueDayOfDate(start, '2026-09-05')).toBe(1);
    expect(leagueDayOfDate(start, '2026-10-23')).toBe(49);
    expect(leagueDayOfDate(start, '2026-09-03')).toBe(-1);
  });
});
