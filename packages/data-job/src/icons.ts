import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CurrentItem } from '@poe-tools/shared';
import { USER_AGENT, type NinjaClient } from './poe-ninja/client.ts';
import type { Logger } from './run.ts';

/*
 * Item icons are self-hosted: browsers must not call poe.ninja (project rule and
 * poe.ninja's policy). Icons use GGG's image paths (`/gen/image/<b64>/<hash>/<Name>.png`),
 * so they are downloaded once from GGG's CDN (fallback: poe.ninja through the throttled
 * client), stored in the data branch under `icons/`, and published with the site.
 */

export const ICON_CDN = 'https://web.poecdn.com';
export const ICONS_DIR = 'icons';

/** Local file name of a `/gen/image/...` path: `<hash>-<Name>.png`, or null if unknown. */
export function iconFileName(source: string): string | null {
  const match = /^\/gen\/image\/[^/]+\/([0-9a-f]+)\/([\w-]+\.png)$/i.exec(source);
  return match ? `${match[1]}-${match[2]}` : null;
}

export interface IconSyncOptions {
  storeDir: string;
  client: NinjaClient;
  log: Logger;
  fetchImpl?: typeof fetch;
  /** Max downloads per run. */
  maxDownloads?: number;
}

/**
 * Downloads the icons not stored yet, then rewrites every item's `icon` from its
 * `/gen/image/...` source to the site-relative `icons/<file>` (or '' if unavailable).
 */
export async function syncIcons(
  items: readonly CurrentItem[],
  options: IconSyncOptions,
): Promise<CurrentItem[]> {
  const dir = join(options.storeDir, ICONS_DIR);
  await mkdir(dir, { recursive: true });
  const stored = new Set(await readdir(dir));
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxDownloads = options.maxDownloads ?? 1000;

  const missing = new Map<string, string>();
  for (const item of items) {
    const file = iconFileName(item.icon);
    if (file && !stored.has(file)) missing.set(file, item.icon);
  }

  let downloaded = 0;
  let failed = 0;
  for (const [file, source] of [...missing].slice(0, maxDownloads)) {
    const png = (await fromCdn(source, fetchImpl)) ?? (await fromNinja(source, options.client));
    if (!png) {
      failed++;
      continue;
    }
    await writeFile(join(dir, file), png);
    stored.add(file);
    downloaded++;
  }
  if (downloaded || failed) {
    options.log.info(`Icons: ${downloaded} downloaded, ${failed} failed, ${stored.size} stored`);
  }
  if (failed) options.log.warn(`Icons: ${failed} could not be downloaded`);

  return items.map((item) => {
    const file = iconFileName(item.icon);
    return { ...item, icon: file && stored.has(file) ? `${ICONS_DIR}/${file}` : '' };
  });
}

async function fromCdn(source: string, fetchImpl: typeof fetch): Promise<Uint8Array | null> {
  try {
    const res = await fetchImpl(new URL(source, ICON_CDN), {
      headers: { 'User-Agent': USER_AGENT },
    });
    return await asPng(res);
  } catch {
    return null;
  }
}

async function fromNinja(source: string, client: NinjaClient): Promise<Uint8Array | null> {
  try {
    const res = await client.getBinary(source);
    return res.status === 200 && isPng(res.body) ? res.body : null;
  } catch {
    return null;
  }
}

async function asPng(res: Response): Promise<Uint8Array | null> {
  if (!res.ok) return null;
  const body = new Uint8Array(await res.arrayBuffer());
  return isPng(body) ? body : null;
}

/** PNG signature check, so error pages are never stored as icons. */
export function isPng(body: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return body.length > signature.length && signature.every((byte, i) => body[i] === byte);
}
