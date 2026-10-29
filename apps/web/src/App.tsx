import { Suspense } from 'react';
import {
  Navigate,
  RouterProvider,
  createHashRouter,
  useLocation,
  type RouteObject,
} from 'react-router';
import { Layout } from './components/Layout.tsx';
import { SettingsProvider } from './lib/SettingsProvider.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { RouteErrorPage } from './pages/RouteErrorPage.tsx';
import { REDIRECTS, TOOLS } from './tools/registry.ts';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        // Pathless: a page that fails to load or render keeps the top bar and navigation.
        errorElement: <RouteErrorPage />,
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
          ...Object.entries(REDIRECTS).map(([path, to]) => ({
            path,
            element: <Redirect to={to} />,
          })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

/** A renamed tool's old path: same page, same lookup (query string kept). */
function Redirect({ to }: { to: string }) {
  return <Navigate to={{ pathname: `/${to}`, search: useLocation().search }} replace />;
}

// Hash routing: GitHub Pages has no SPA fallback for deep links.
const router = createHashRouter(routes);

export function App() {
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  );
}
