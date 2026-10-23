const DAY_MS = 24 * 60 * 60 * 1000;

/** Fractional days elapsed since `startsAt` (ISO string) at instant `now`. */
export function daysSince(startsAt: string, now: Date = new Date()): number {
  return (now.getTime() - Date.parse(startsAt)) / DAY_MS;
}

/** Whole league day index (day 0 = first 24 h of the league). */
export function leagueDay(startsAt: string, now: Date = new Date()): number {
  return Math.floor(daysSince(startsAt, now));
}
