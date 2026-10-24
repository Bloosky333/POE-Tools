import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROBE_DIR = join(import.meta.dirname, '../../../../fixtures/poe-ninja/probe');

export function probeFixture(name: string): string {
  return readFileSync(join(PROBE_DIR, name), 'utf8');
}

export function probeJson(name: string): unknown {
  return JSON.parse(probeFixture(name));
}
