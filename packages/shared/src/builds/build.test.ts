import { describe, expect, it } from 'vitest';
import { buildLinkSchema, linkSite, linkText, normalizeUrl } from './build.ts';

describe('build links', () => {
  it('recognises the usual sites', () => {
    expect(linkSite('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(linkSite('https://youtu.be/abc')).toBe('youtube');
    expect(linkSite('https://mobalytics.gg/poe-2/builds/x')).toBe('mobalytics');
    expect(linkSite('https://poe.ninja/poe2/builds/x')).toBe('poe-ninja');
    expect(linkSite('https://pobb.in/abc')).toBe('pob');
    expect(linkSite('https://maxroll.gg/poe2/build-guides/x')).toBe('maxroll');
    expect(linkSite('https://notyoutube.com/x')).toBe('other');
  });

  it('adds https:// and refuses non-web links', () => {
    expect(normalizeUrl('  poe.ninja/poe2/builds ')).toBe('https://poe.ninja/poe2/builds');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('hello')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(buildLinkSchema.safeParse({ url: 'data:text/html,x' }).success).toBe(false);
  });

  it('shows the label, else the host', () => {
    expect(linkText({ url: 'https://www.youtube.com/watch?v=abc' })).toBe('youtube.com');
    expect(linkText({ url: 'https://pobb.in/abc', label: ' PoB ' })).toBe('PoB');
  });
});
