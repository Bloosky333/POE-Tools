import { z } from 'zod';
import { GAMES, type Game } from '../games.ts';

/*
 * Saved builds (spec 10): a name, an ascendancy and links to guides, videos or planners.
 * Stored in the browser; this schema validates them on load.
 */

/** Only web links: anything else (javascript:, data:…) is refused. */
export const buildLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  label: z.string().optional(),
});
export type BuildLink = z.infer<typeof buildLinkSchema>;

export const buildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  game: z.enum(GAMES),
  ascendancy: z.string(),
  links: z.array(buildLinkSchema),
  updatedAt: z.string(),
});
export type Build = z.infer<typeof buildSchema>;

/**
 * Ascendancies offered as suggestions (the field stays free text: new ones arrive with
 * leagues and patches).
 */
export const ASCENDANCIES: Record<Game, readonly string[]> = {
  poe2: [
    'Titan',
    'Warbringer',
    'Smith of Kitava',
    'Witchhunter',
    'Gemling Legionnaire',
    'Tactician',
    'Deadeye',
    'Pathfinder',
    'Amazon',
    'Ritualist',
    'Invoker',
    'Acolyte of Chayula',
    'Stormweaver',
    'Chronomancer',
    'Disciple of Varashta',
    'Infernalist',
    'Blood Mage',
    'Lich',
    'Oracle',
    'Shaman',
  ],
  poe1: [
    'Ascendant',
    'Reliquarian',
    'Juggernaut',
    'Berserker',
    'Chieftain',
    'Slayer',
    'Gladiator',
    'Champion',
    'Deadeye',
    'Warden',
    'Pathfinder',
    'Assassin',
    'Saboteur',
    'Trickster',
    'Necromancer',
    'Elementalist',
    'Occultist',
    'Inquisitor',
    'Hierophant',
    'Guardian',
  ],
};

export type LinkSite = 'youtube' | 'mobalytics' | 'poe-ninja' | 'pob' | 'maxroll' | 'other';

const SITES: { site: LinkSite; hosts: readonly string[] }[] = [
  { site: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { site: 'mobalytics', hosts: ['mobalytics.gg'] },
  { site: 'poe-ninja', hosts: ['poe.ninja'] },
  { site: 'pob', hosts: ['pobb.in', 'pastebin.com'] },
  { site: 'maxroll', hosts: ['maxroll.gg'] },
];

/** The site a link points to, from its host (subdomains included). */
export function linkSite(url: string): LinkSite {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  const match = SITES.find(({ hosts }) => hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return match?.site ?? 'other';
}

/** Short text shown for a link: its label, else the host without `www.`. */
export function linkText(link: BuildLink): string {
  const label = link.label?.trim();
  if (label) return label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return link.url;
  }
}

/**
 * Turns what was typed into a link URL: trims it and adds `https://` when the scheme is
 * missing. Returns null when the result is not a valid web link.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  if (!buildLinkSchema.shape.url.safeParse(withScheme).success) return null;
  return new URL(withScheme).hostname.includes('.') ? withScheme : null;
}
