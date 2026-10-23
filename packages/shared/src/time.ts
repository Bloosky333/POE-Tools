export const DAY_MS = 24 * 60 * 60 * 1000;

/** Fractional days elapsed since `startsAt` (ISO string) at instant `now`. */
export function daysSince(startsAt: string, now: Date = new Date()): number {
  return (now.getTime() - Date.parse(startsAt)) / DAY_MS;
}

/** Whole league day index (day 0 = first 24 h of the league). */
export function leagueDay(startsAt: string, now: Date = new Date()): number {
  return Math.floor(daysSince(startsAt, now));
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
