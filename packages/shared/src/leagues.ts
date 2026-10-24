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
});

export type League = z.infer<typeof leagueSchema>;

export const leaguesSchema = z.array(leagueSchema);

/**
 * Source of truth for league metadata. A new league is added here (one PR per league).
 * `ninjaName` = league id in poe.ninja's `/poe2/api/economy/leagues` (verified 2026-10-23).
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

/** Leagues the data job follows: selectable leagues and the leagues they reference. */
export function getTrackedLeagues(game: League['game']): League[] {
  const selectable = LEAGUES.filter((league) => league.game === game && league.selectable);
  const referenced = selectable.flatMap((league) => getReferenceLeague(league) ?? []);
  return [...new Set([...selectable, ...referenced])];
}
