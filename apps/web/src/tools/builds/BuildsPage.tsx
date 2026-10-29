import {
  ASCENDANCIES,
  linkSite,
  linkText,
  normalizeUrl,
  type Build,
  type Game,
  type LinkSite,
} from '@poe-tools/shared';
import { useMemo, useState } from 'react';
import { formatAge } from '../../lib/format.ts';
import { urlField, useUrlParams } from '../../lib/urlParams.ts';
import { useNow } from '../../lib/useNow.ts';
import { useSettings } from '../../lib/useSettings.ts';
import {
  Badge,
  Button,
  Card,
  Field,
  FilterBar,
  Input,
  PageHeader,
  Panel,
  SearchInput,
} from '../../ui/index.ts';
import { loadBuilds, newBuild, storeBuilds } from './storage.ts';

/** Builds (spec 10): the player's builds with their guides, videos and planners. */
export default function BuildsPage() {
  const { settings } = useSettings();
  // Keyed by game: each game has its own saved builds.
  return <Builds key={settings.game} game={settings.game} />;
}

const SITE_LABELS: Record<LinkSite, string> = {
  youtube: 'YouTube',
  mobalytics: 'Mobalytics',
  'poe-ninja': 'poe.ninja',
  pob: 'PoB',
  maxroll: 'Maxroll',
  other: 'Link',
};

function Builds({ game }: { game: Game }) {
  const [builds, setBuilds] = useState(() => loadBuilds(game));
  const [{ q }, setParams] = useUrlParams({ q: '' }, { q: urlField.text() });
  /** Build being edited (a new one is not in `builds` yet). */
  const [editing, setEditing] = useState<Build | null>(null);
  const now = useNow();

  const save = (next: Build[]) => {
    setBuilds(next);
    storeBuilds(game, next);
  };

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return [...builds]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((b) => {
        const text = `${b.name} ${b.ascendancy}`.toLowerCase();
        return words.every((w) => text.includes(w));
      });
  }, [builds, q]);

  const editor = editing && (
    <BuildEditor
      key={editing.id}
      build={editing}
      game={game}
      isNew={!builds.some((b) => b.id === editing.id)}
      onCancel={() => setEditing(null)}
      onSave={(saved) => {
        const exists = builds.some((b) => b.id === saved.id);
        save(exists ? builds.map((b) => (b.id === saved.id ? saved : b)) : [...builds, saved]);
        setEditing(null);
      }}
    />
  );
  const editingNew = editing !== null && !builds.some((b) => b.id === editing.id);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Builds"
        description="Your builds with their guides, videos and planners. Saved in this browser."
        actions={
          <Button
            variant="primary"
            disabled={editing !== null}
            onClick={() => setEditing(newBuild(game))}
          >
            New build
          </Button>
        }
      />
      {editingNew && editor}
      {builds.length > 0 && (
        <FilterBar>
          <SearchInput
            value={q}
            onChange={(value) => setParams({ q: value })}
            placeholder="Search builds"
          />
        </FilterBar>
      )}
      {builds.length === 0 && !editingNew && (
        <Card>
          <p className="text-sm text-muted">
            No build yet. Add one with its ascendancy and links to YouTube, Mobalytics, poe.ninja or
            any other site.
          </p>
        </Card>
      )}
      {builds.length > 0 && shown.length === 0 && (
        <p className="text-sm text-muted">No build matches “{q}”.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((build) =>
          editing?.id === build.id ? (
            <div key={build.id} className="md:col-span-2">
              {editor}
            </div>
          ) : (
            <BuildCard
              key={build.id}
              build={build}
              updated={formatAge(build.updatedAt, now)}
              onEdit={editing ? undefined : () => setEditing(build)}
              onDelete={() => {
                if (!window.confirm(`Delete "${build.name}"? This can't be undone.`)) return;
                save(builds.filter((b) => b.id !== build.id));
              }}
            />
          ),
        )}
      </div>
    </section>
  );
}

function BuildCard({
  build,
  updated,
  onEdit,
  onDelete,
}: {
  build: Build;
  updated: string;
  onEdit: (() => void) | undefined;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{build.name}</h2>
          <p className="text-xs text-muted">
            {build.ascendancy || 'No ascendancy'} · updated {updated}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" disabled={!onEdit} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      {build.links.length > 0 ? (
        <ul className="space-y-1.5">
          {build.links.map((link, i) => {
            const site = SITE_LABELS[linkSite(link.url)];
            return (
              <li key={i} className="flex min-w-0 items-center gap-2 text-sm">
                <Badge tone="neutral">{site}</Badge>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-accent hover:underline"
                  title={link.url}
                >
                  {linkText(link)}
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-subtle">No links.</p>
      )}
    </Card>
  );
}

interface LinkDraft {
  key: number;
  url: string;
  label: string;
}

function BuildEditor({
  build,
  game,
  isNew,
  onSave,
  onCancel,
}: {
  build: Build;
  game: Game;
  isNew: boolean;
  onSave: (build: Build) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(build.name);
  const [ascendancy, setAscendancy] = useState(build.ascendancy);
  const [links, setLinks] = useState<LinkDraft[]>(() =>
    (build.links.length ? build.links : [{ url: '', label: '' }]).map((l, key) => ({
      key,
      url: l.url,
      label: l.label ?? '',
    })),
  );
  const [nextKey, setNextKey] = useState(links.length);
  const [tried, setTried] = useState(false);

  const filled = links.filter((l) => l.url.trim());
  const badUrls = new Set(filled.filter((l) => !normalizeUrl(l.url)).map((l) => l.key));
  const valid = name.trim() !== '' && badUrls.size === 0;
  const listId = `ascendancies-${game}`;

  const update = (key: number, patch: Partial<LinkDraft>) =>
    setLinks(links.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <Panel title={isNew ? 'New build' : `Edit: ${build.name}`}>
      <form
        className="space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!valid) return;
          onSave({
            ...build,
            name: name.trim(),
            ascendancy: ascendancy.trim(),
            links: filled.map((l) => {
              const label = l.label.trim();
              return { url: normalizeUrl(l.url) ?? l.url, ...(label ? { label } : {}) };
            }),
            updatedAt: new Date().toISOString(),
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={name}
              autoFocus
              placeholder="e.g. Lightning Spear"
              aria-invalid={tried && !name.trim()}
              onChange={(e) => setName(e.target.value)}
            />
            {tried && !name.trim() && <span className="text-xs text-loss">A name is needed.</span>}
          </Field>
          <Field label="Ascendancy">
            <Input
              value={ascendancy}
              list={listId}
              placeholder="Pick or type"
              onChange={(e) => setAscendancy(e.target.value)}
            />
            <datalist id={listId}>
              {ASCENDANCIES[game].map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs text-muted">
            Links (YouTube, Mobalytics, poe.ninja, PoB…)
          </legend>
          {links.map((link) => {
            const bad = badUrls.has(link.key);
            return (
              <div key={link.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Input
                  className="w-full sm:flex-1"
                  value={link.url}
                  inputMode="url"
                  placeholder="https://…"
                  aria-label="Link URL"
                  aria-invalid={bad}
                  onChange={(e) => update(link.key, { url: e.target.value })}
                />
                <Input
                  className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                  value={link.label}
                  placeholder="Label (optional)"
                  aria-label="Link label"
                  onChange={(e) => update(link.key, { label: e.target.value })}
                />
                <Button
                  variant="ghost"
                  aria-label="Remove link"
                  onClick={() => setLinks(links.filter((l) => l.key !== link.key))}
                >
                  ✕
                </Button>
                {bad && (
                  <span className="w-full text-xs text-loss">Not a web link (http or https).</span>
                )}
              </div>
            );
          })}
          <Button
            onClick={() => {
              setLinks([...links, { key: nextKey, url: '', label: '' }]);
              setNextKey(nextKey + 1);
            }}
          >
            + Add link
          </Button>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            Save
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}
