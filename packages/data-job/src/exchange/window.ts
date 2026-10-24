import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hubSchema, type ExchangeHour } from '@poe-tools/shared';
import { z } from 'zod';

/** Hours kept in the rolling window (spec 04, §4). */
export const WINDOW_HOURS = 24;

/** `[item, hub, itemVolume, hubVolume, low, high]`, prices in hub units per item. */
const marketTupleSchema = z.tuple([
  z.string(),
  hubSchema,
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

const windowFileSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  hours: z.array(z.object({ epoch: z.number(), markets: z.array(marketTupleSchema) })),
});

/**
 * Rolling window of hourly exchange data per league, kept between runs outside the `data`
 * branch (Actions cache) so that the hourly job does not commit.
 */
export function createWindowStore(dir: string, game = 'poe2') {
  const pathOf = (leagueId: string) => join(dir, game, leagueId, 'exchange-window.json');

  return {
    async read(leagueId: string): Promise<ExchangeHour[]> {
      let text: string;
      try {
        text = await readFile(pathOf(leagueId), 'utf8');
      } catch {
        return [];
      }
      const parsed = windowFileSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return [];
      return parsed.data.hours.map((hour) => ({
        epoch: hour.epoch,
        markets: hour.markets.map(([item, hub, itemVolume, hubVolume, low, high]) => ({
          item,
          hub,
          itemVolume,
          hubVolume,
          low,
          high,
        })),
      }));
    },
    async write(leagueId: string, hours: readonly ExchangeHour[]): Promise<void> {
      const file: z.infer<typeof windowFileSchema> = {
        version: 1,
        leagueId,
        hours: hours.map((hour) => ({
          epoch: hour.epoch,
          markets: hour.markets.map((m) => [
            m.item,
            m.hub,
            m.itemVolume,
            m.hubVolume,
            m.low,
            m.high,
          ]),
        })),
      };
      await mkdir(dirname(pathOf(leagueId)), { recursive: true });
      await writeFile(pathOf(leagueId), JSON.stringify(file));
    },
  };
}

export type WindowStore = ReturnType<typeof createWindowStore>;
