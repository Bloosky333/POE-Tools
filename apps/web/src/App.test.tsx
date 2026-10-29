import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from './App.tsx';
import { SettingsProvider } from './lib/SettingsProvider.tsx';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>,
  );
  return router;
}

describe('App shell', () => {
  afterEach(cleanup);

  it('lists the tools on the home page', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Tools' })).toBeDefined();
    expect(screen.getAllByText('Currency Speculation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Currency Flipping').length).toBeGreaterThan(0);
  });

  it('opens the currency speculation tool', async () => {
    renderAt('/tools/currency-speculation');
    expect(await screen.findByRole('heading', { name: 'Currency Speculation' })).toBeDefined();
    expect(screen.getByText('Runes of Aldur')).toBeDefined();
  });

  it('sends the old Cheapest Currency path to Buy With, lookup kept', async () => {
    const router = renderAt('/tools/cheapest-currency?item=x&qty=3');
    expect(await screen.findByRole('heading', { name: 'Buy With' })).toBeDefined();
    expect(router.state.location).toMatchObject({
      pathname: '/tools/buy-with',
      search: '?item=x&qty=3',
    });
  });

  it('shows a not-found page for unknown routes', () => {
    renderAt('/nope');
    expect(screen.getByText('Page not found')).toBeDefined();
  });
});
