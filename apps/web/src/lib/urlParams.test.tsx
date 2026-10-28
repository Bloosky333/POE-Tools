// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { urlField, useUrlParams } from './urlParams.ts';

const DEFAULTS = {
  minPrice: 0.05,
  sort: 'score' as 'score' | 'name',
  desc: true,
  item: null as string | null,
  q: '',
};

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [params, update] = useUrlParams(DEFAULTS, {
        minPrice: urlField.number(),
        sort: urlField.oneOf(['score', 'name'] as const),
        desc: urlField.descending(),
        item: urlField.selection(),
        q: urlField.text(),
      });
      return { params, update, search: useLocation().search };
    },
    { wrapper },
  );
}

describe('useUrlParams', () => {
  it('reads valid values and falls back to the defaults', () => {
    const { result } = setup('/?minPrice=0.5&sort=foo&dir=asc&item=x');
    expect(result.current.params).toEqual({ ...DEFAULTS, minPrice: 0.5, desc: false, item: 'x' });
    expect(setup('/?minPrice=abc').result.current.params.minPrice).toBe(0.05);
  });

  it('writes only the values that differ from the defaults', () => {
    const { result } = setup('/?minPrice=0.5');
    act(() => result.current.update({ sort: 'name', minPrice: 0.05, q: 'orb' }));
    expect(result.current.search).toBe('?sort=name&q=orb');
    act(() => result.current.update({ desc: false, item: 'x' }));
    expect(result.current.search).toBe('?sort=name&dir=asc&item=x&q=orb');
  });
});
