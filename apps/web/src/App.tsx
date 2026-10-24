import { Suspense } from 'react';
import { RouterProvider, createHashRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout.tsx';
import { SettingsProvider } from './lib/SettingsProvider.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { TOOLS } from './tools/registry.ts';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      ...TOOLS.flatMap(({ path, component: Tool }) =>
        Tool
          ? [
              {
                path,
                element: (
                  <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
                    <Tool />
                  </Suspense>
                ),
              },
            ]
          : [],
      ),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

// Hash routing: GitHub Pages has no SPA fallback for deep links.
const router = createHashRouter(routes);

export function App() {
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  );
}
