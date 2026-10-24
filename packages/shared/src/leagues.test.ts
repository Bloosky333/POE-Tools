import { describe, expect, it } from 'vitest';
import { LEAGUES, getDefaultLeague, getReferenceLeague } from './leagues.ts';

describe('leagues', () => {
  it('has unique ids', () => {
    const ids = LEAGUES.map((league) => league.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references existing leagues', () => {
    for (const league of LEAGUES) {
      if (league.referenceLeagueId) expect(getReferenceLeague(league)).toBeDefined();
    }
  });

  it('defaults to Forbidden Rites for PoE 2, referencing Runes of Aldur', () => {
    const league = getDefaultLeague('poe2');
    expect(league?.id).toBe('forbidden-rites');
    expect(league && getReferenceLeague(league)?.id).toBe('runes-of-aldur');
  });
});
