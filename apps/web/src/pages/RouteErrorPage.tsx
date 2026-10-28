import { isRouteErrorResponse, useRouteError } from 'react-router';

/**
 * Error raised while loading or rendering a page. The usual cause is a tab left open across
 * a deploy: its old code chunks are gone, and a reload fetches the new ones.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        The site may have been updated since this tab was opened. Reloading usually fixes it.
      </p>
      <p className="font-mono text-xs text-subtle">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90"
      >
        Reload
      </button>
    </section>
  );
}
