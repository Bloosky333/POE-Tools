import { describe, expect, it } from 'vitest';
import { formatDays, leagueDay, leagueDayOfDate, relativeDay, utcDate } from './time.ts';

describe('time', () => {
  const start = '2026-09-04T20:00:00Z';

  it('computes the league day index of an instant on the history calendar', () => {
    expect(leagueDay(start, new Date('2026-09-04T20:00:00Z'))).toBe(0);
    expect(leagueDay(start, new Date('2026-09-05T08:00:00Z'))).toBe(1);
    // Before the start hour of a later day, still that calendar day (history is keyed so).
    expect(leagueDay(start, new Date('2026-10-23T12:00:00Z'))).toBe(
      leagueDayOfDate(start, '2026-10-23'),
    );
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

  it('describes a league day relative to today', () => {
    expect(relativeDay(12, 12)).toBe('today');
    expect(relativeDay(13, 12)).toBe('tomorrow');
    expect(relativeDay(17, 12.6)).toBe('in 5 days');
    expect(relativeDay(11, 12)).toBe('yesterday');
    expect(relativeDay(9, 12)).toBe('3 days ago');
    expect(formatDays(1)).toBe('1 day');
  });
});
