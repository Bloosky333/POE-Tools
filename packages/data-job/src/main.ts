/**
 * Data job entry point.
 *   pnpm job --data-dir <store dir> --out <site data dir> [--exchange-dir <dir>]
 */
import { parseArgs } from 'node:util';
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
if (!dataDir || !outDir) {
  console.error('Usage: pnpm job --data-dir <dir> --out <dir> [--exchange-dir <dir>]');
  process.exit(2);
}

const inActions = process.env.GITHUB_ACTIONS === 'true';
const log: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.log(inActions ? `::warning::${message}` : `WARN ${message}`),
};

await runJob({
  client: createNinjaClient(),
  store: createStore(dataDir),
  site: createSiteWriter(outDir),
  windows: values['exchange-dir'] ? createWindowStore(values['exchange-dir']) : undefined,
  now: new Date(),
  log,
});
