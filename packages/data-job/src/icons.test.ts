import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CurrentItem } from '@poe-tools/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iconFileName, isPng, syncIcons } from './icons.ts';
import { createNinjaClient } from './poe-ninja/client.ts';

const SOURCE =
  '/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9SYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9b80b44821/CurrencyUpgradeToRare.png';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const item = (icon: string): CurrentItem => ({
  id: 'alch',
  detailsId: 'orb-of-alchemy',
  name: 'Orb of Alchemy',
  icon,
  type: 'Currency',
  price: 0.005,
  volume: 77,
  change7d: null,
});

describe('icons', () => {
  let dir: string;
  const log = { info: () => {}, warn: vi.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'poe-tools-icons-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('names files from the GGG image path', () => {
    expect(iconFileName(SOURCE)).toBe('9b80b44821-CurrencyUpgradeToRare.png');
    expect(iconFileName('https://example.com/x.png')).toBeNull();
    expect(isPng(PNG)).toBe(true);
    expect(isPng(new TextEncoder().encode('<html>'))).toBe(false);
  });

  it('downloads missing icons from the CDN once and rewrites items to local paths', async () => {
    const cdn = vi.fn<typeof fetch>(async () => new Response(PNG));
    const ninja = vi.fn<typeof fetch>(async () => new Response('', { status: 500 }));
    const client = createNinjaClient({ fetchImpl: ninja, sleep: async () => {} });

    const first = await syncIcons([item(SOURCE), item(SOURCE)], {
      storeDir: dir,
      client,
      log,
      fetchImpl: cdn,
    });
    expect(first[0]?.icon).toBe('icons/9b80b44821-CurrencyUpgradeToRare.png');
    expect(cdn).toHaveBeenCalledTimes(1);
    expect(String(cdn.mock.calls[0]?.[0])).toBe(`https://web.poecdn.com${SOURCE}`);
    expect(await readFile(join(dir, 'icons', '9b80b44821-CurrencyUpgradeToRare.png'))).toEqual(
      Buffer.from(PNG),
    );

    await syncIcons([item(SOURCE)], { storeDir: dir, client, log, fetchImpl: cdn });
    expect(cdn).toHaveBeenCalledTimes(1);
    expect(ninja).not.toHaveBeenCalled();
  });

  it('falls back to poe.ninja, and leaves the icon empty when both fail', async () => {
    const cdn = vi.fn<typeof fetch>(
      async () => new Response('<html>blocked</html>', { status: 200 }),
    );
    const ninja = vi.fn<typeof fetch>(async () => new Response(PNG));
    const client = createNinjaClient({ fetchImpl: ninja, sleep: async () => {} });
    const ok = await syncIcons([item(SOURCE)], { storeDir: dir, client, log, fetchImpl: cdn });
    expect(ok[0]?.icon).toMatch(/^icons\//);
    expect(ninja).toHaveBeenCalledTimes(1);

    const other = SOURCE.replace('9b80b44821', 'aaaaaaaaaa');
    const failing = createNinjaClient({
      fetchImpl: async () => new Response('', { status: 404 }),
      sleep: async () => {},
    });
    const none = await syncIcons([item(other)], {
      storeDir: dir,
      client: failing,
      log,
      fetchImpl: cdn,
    });
    expect(none[0]?.icon).toBe('');
    expect(await readdir(join(dir, 'icons'))).toHaveLength(1);
  });
});
