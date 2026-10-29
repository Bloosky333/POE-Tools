import { z } from 'zod';

/*
 * App-wide backup (spec 00 §3, local store): everything the app keeps in this browser
 * (settings, crafting recipes, Buy With / Sell For recents and favourites) as one JSON file,
 * to move to another browser. Each tool still validates its own data when it loads it.
 */

const PREFIX = 'poe-tools:';

const backupSchema = z.object({
  app: z.literal('poe-tools'),
  version: z.literal(1),
  exportedAt: z.string(),
  data: z.record(z.string().startsWith(PREFIX), z.unknown()),
});
export type Backup = z.infer<typeof backupSchema>;

export function createBackup(storage: Storage = localStorage, now = new Date()): Backup {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      data[key] = JSON.parse(storage.getItem(key) ?? 'null');
    } catch {
      // Not JSON: not ours to carry.
    }
  }
  return { app: 'poe-tools', version: 1, exportedAt: now.toISOString(), data };
}

/** Parses a backup file; throws with a readable message when it isn't one. */
export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('This file is not JSON.');
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error('This file is not a POE Tools backup.');
  return parsed.data;
}

/** Writes every entry of `backup` (entries it does not have are kept). */
export function restoreBackup(backup: Backup, storage: Storage = localStorage): number {
  const entries = Object.entries(backup.data);
  for (const [key, value] of entries) storage.setItem(key, JSON.stringify(value));
  return entries.length;
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
