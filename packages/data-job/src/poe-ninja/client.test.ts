import { describe, expect, it, vi } from 'vitest';
import { USER_AGENT, createNinjaClient } from './client.ts';

function response(status: number, body = '{}') {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

describe('createNinjaClient', () => {
  it('sends the descriptive ASCII User-Agent', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response(200));
    const client = createNinjaClient({ fetchImpl, sleep: async () => {} });
    await client.get('/poe2/api/economy/leagues');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT);
    expect(/^[\x20-\x7e]+$/.test(USER_AGENT)).toBe(true);
  });

  it('retries on 5xx then returns the response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, '{"ok":true}'));
    const client = createNinjaClient({ fetchImpl, sleep: async () => {} });
    const res = await client.get('/x');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });

  it('does not retry on 404', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response(404));
    const client = createNinjaClient({ fetchImpl, sleep: async () => {} });
    expect((await client.get('/missing')).status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
