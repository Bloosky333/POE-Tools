import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROBE_DIR = join(import.meta.dirname, '../../../../fixtures/poe-ninja/probe');

export function probeFixture(name: string): string {
  return readFileSync(join(PROBE_DIR, name), 'utf8');
}

export function probeJson(name: string): unknown {
  return JSON.parse(probeFixture(name));
}

const EXCHANGE_DIR = join(import.meta.dirname, '../../../../fixtures/ggg-exchange/probe');

/** Raw GGG exchange digest captured by the probe, or null when there is none for `epoch`. */
export function exchangeFixture(epoch: number): string | null {
  try {
    return readFileSync(join(EXCHANGE_DIR, `exchange-${epoch}.json`), 'utf8');
  } catch {
    return null;
  }
}
