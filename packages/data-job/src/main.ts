/**
 * Data job entry point: one run per enabled game; a failing game does not stop the others
 * from publishing, but the job still fails at the end.
 *   pnpm job --data-dir <store dir> --out <site data dir> [--exchange-dir <dir>]
 */
import { parseArgs } from 'node:util';
import { ENABLED_GAMES } from '@poe-tools/shared';
import { createNinjaClient } from './poe-ninja/client.ts';
import { createWindowStore } from './exchange/window.ts';
import { runJob, type Logger } from './run.ts';
import { createSiteWriter } from './site.ts';
import { createStore } from './store.ts';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    out: { type: 'string' },
    'exchange-dir': { type: 'string' },
  },
});
const dataDir = values['data-dir'];
const outDir = values.out;
const exchangeDir = values['exchange-dir'];
if (!dataDir || !outDir) {
  console.error('Usage: pnpm job --data-dir <dir> --out <dir> [--exchange-dir <dir>]');
  process.exit(2);
}

const inActions = process.env.GITHUB_ACTIONS === 'true';
const log: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.log(inActions ? `::warning::${message}` : `WARN ${message}`),
};

const client = createNinjaClient();
let failed = false;
for (const game of ENABLED_GAMES) {
  try {
    await runJob({
      client,
      store: createStore(dataDir, game),
      site: createSiteWriter(outDir, game),
      windows: exchangeDir ? createWindowStore(exchangeDir, game) : undefined,
      now: new Date(),
      log,
    });
  } catch (error) {
    failed = true;
    console.log(`${inActions ? '::error::' : 'ERROR '}${game}: ${error}`);
  }
}
if (failed) process.exit(1);
