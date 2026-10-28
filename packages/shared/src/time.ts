export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * League day of an instant: its UTC calendar date's `leagueDayOfDate`, the index price
 * histories are stored under (the start date is day 0, whatever the start hour).
 */
export function leagueDay(startsAt: string, now: Date = new Date()): number {
  return leagueDayOfDate(startsAt, utcDate(now));
}

/** UTC calendar date `YYYY-MM-DD` of an instant. */
export function utcDate(instant: Date | number): string {
  return new Date(instant).toISOString().slice(0, 10);
}

/**
 * League day of a UTC calendar date (`YYYY-MM-DD`): the league's start date is day 0,
 * whatever the start hour. Used to align daily price points across leagues.
 */
export function leagueDayOfDate(startsAt: string, date: string): number {
  const start = Date.parse(`${startsAt.slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - start) / DAY_MS);
}
