/**
 * Minimal, polite poe.ninja HTTP client.
 *
 * poe.ninja asks third-party apps to call the economy endpoints from their own backend,
 * with a descriptive ASCII User-Agent and controlled volume. This client enforces a
 * minimum delay between requests and retries transient failures with back-off.
 */

export const NINJA_BASE_URL = 'https://poe.ninja';

export const USER_AGENT = 'POE-Tools/0.1 (+https://github.com/Bloosky333/POE-Tools)';

export interface NinjaResponse {
  url: string;
  status: number;
  contentType: string | null;
  body: string;
}

export interface NinjaClientOptions {
  /** Minimum delay between two requests, in ms. */
  minIntervalMs?: number;
  /** Retries on network errors, 429 and 5xx. */
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createNinjaClient(options: NinjaClientOptions = {}) {
  const minIntervalMs = options.minIntervalMs ?? 1500;
  const retries = options.retries ?? 2;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  let lastRequestAt = 0;

  async function throttle() {
    const wait = lastRequestAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  }

  /** Throttled GET returning raw bytes (used for icons). */
  async function getBinary(pathOrUrl: string): Promise<{ status: number; body: Uint8Array }> {
    await throttle();
    const res = await fetchImpl(new URL(pathOrUrl, NINJA_BASE_URL).toString(), {
      headers: { 'User-Agent': USER_AGENT },
    });
    return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) };
  }

  async function get(pathOrUrl: string): Promise<NinjaResponse> {
    const url = new URL(pathOrUrl, NINJA_BASE_URL).toString();
    for (let attempt = 0; ; attempt++) {
      await throttle();
      try {
        const res = await fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/*' },
        });
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < retries) {
          await sleep(2 ** attempt * 5000);
          continue;
        }
        return {
          url,
          status: res.status,
          contentType: res.headers.get('content-type'),
          body: await res.text(),
        };
      } catch (error) {
        if (attempt >= retries) throw error;
        await sleep(2 ** attempt * 5000);
      }
    }
  }

  return { get, getBinary };
}

export type NinjaClient = ReturnType<typeof createNinjaClient>;
