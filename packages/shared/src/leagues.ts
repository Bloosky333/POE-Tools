import { z } from 'zod';
import { GAMES } from './games.ts';

export const leagueSchema = z.object({
  /** Stable slug used in data paths, e.g. "forbidden-rites". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  game: z.enum(GAMES),
  /** Display name. */
  name: z.string(),
  /** League name as poe.ninja expects it in query parameters. */
  ninjaName: z.string(),
  version: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  /** Whether the league can be selected as the league the user is trading in. */
  selectable: z.boolean(),
  /** League whose price curves are used as reference for this one. */
  referenceLeagueId: z.string().nullable(),
  /**
   * The data job also follows this league though nothing selectable references it (its
   * history is kept for backtests). Selectable leagues and their references always are.
   */
  track: z.boolean().default(false),
  /**
   * Set while the league's name is not announced: the data job uses poe.ninja's current
   * challenge league once the league has started (spec 07 §2).
   */
  ninjaNameAuto: z.boolean().default(false),
});

export type League = z.infer<typeof leagueSchema>;

export const leaguesSchema = z.array(leagueSchema);

/**
 * Source of truth for league metadata. A new league is added here (one PR per league).
 * `ninjaName` = league id in poe.ninja's `/<game>/api/economy/leagues` (verified: PoE 2
 * 2026-10-23, PoE 1 2026-10-24).
 */
export const LEAGUES: readonly League[] = leaguesSchema.parse([
  {
    id: 'forbidden-rites',
    game: 'poe2',
    name: 'Forbidden Rites',
    ninjaName: 'Forbidden Rites',
    version: '0.5.5',
    startsAt: '2026-09-04T20:00:00Z',
    endsAt: null,
    selectable: true,
    referenceLeagueId: 'runes-of-aldur',
  },
  {
    id: 'runes-of-aldur',
    game: 'poe2',
    name: 'Runes of Aldur',
    ninjaName: 'Runes of Aldur',
    version: '0.5.0',
    startsAt: '2026-05-29T20:00:00Z',
    endsAt: null,
    selectable: false,
    referenceLeagueId: null,
  },
  {
    // Announced at ExileCon (early November): update name, ninjaName and start then.
    id: 'poe1-3-30',
    game: 'poe1',
    name: '3.30',
    ninjaName: '3.30',
    ninjaNameAuto: true,
    version: '3.30',
    startsAt: '2026-11-13T21:00:00Z',
    endsAt: null,
    selectable: true,
    referenceLeagueId: 'allflame',
  },
  {
    id: 'allflame',
    game: 'poe1',
    name: 'Allflame',
    ninjaName: 'Allflame',
    version: '3.29',
    startsAt: '2026-07-24T20:00:00Z',
    endsAt: '2026-11-09T21:00:00Z',
    selectable: false,
    referenceLeagueId: 'mirage',
  },
  {
    id: 'mirage',
    game: 'poe1',
    name: 'Mirage',
    ninjaName: 'Mirage',
    version: '3.28',
    startsAt: '2026-03-06T20:00:00Z',
    endsAt: '2026-07-20T21:00:00Z',
    selectable: false,
    referenceLeagueId: null,
    track: true,
  },
]);

export function getLeague(id: string): League | undefined {
  return LEAGUES.find((league) => league.id === id);
}

/** The newest selectable league of a game, used as default. */
export function getDefaultLeague(game: League['game']): League | undefined {
  return LEAGUES.filter((league) => league.game === game && league.selectable).sort(
    (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
  )[0];
}

export function getReferenceLeague(league: League): League | undefined {
  return league.referenceLeagueId ? getLeague(league.referenceLeagueId) : undefined;
}

/**
 * Leagues the data job follows: selectable leagues, the leagues they reference and leagues
 * marked `track` (with their own reference, for backtests).
 */
export function getTrackedLeagues(game: League['game']): League[] {
  const roots = LEAGUES.filter(
    (league) => league.game === game && (league.selectable || league.track),
  );
  const tracked = new Set([...roots, ...roots.flatMap((l) => getReferenceLeague(l) ?? [])]);
  return LEAGUES.filter((league) => tracked.has(league));
}

/** Whether the league has started at `now`. */
export function hasStarted(league: League, now: Date): boolean {
  return Date.parse(league.startsAt) <= now.getTime();
}
