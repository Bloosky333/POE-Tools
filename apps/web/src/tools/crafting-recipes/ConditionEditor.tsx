import { modText, type ModCondition, type ModFamily } from '@poe-tools/shared';
import { useState } from 'react';
import { Button, Input, SearchInput, Select } from '../../ui/index.ts';
import { familyText, searchFamilies, useCatalog } from './catalog.ts';

type Mode = 'mod' | 'anyOf' | 'allOf' | 'atLeast';

const MODES: { value: Mode; label: string }[] = [
  { value: 'mod', label: 'Mod' },
  { value: 'anyOf', label: 'Any of' },
  { value: 'allOf', label: 'All of' },
  { value: 'atLeast', label: 'At least N of' },
];

function modeOf(c: ModCondition): Mode {
  if ('family' in c) return 'mod';
  if ('anyOf' in c) return 'anyOf';
  if ('allOf' in c) return 'allOf';
  return 'atLeast';
}

function children(c: ModCondition): ModCondition[] {
  if ('anyOf' in c) return c.anyOf;
  if ('allOf' in c) return c.allOf;
  if ('of' in c) return c.of;
  return [c];
}

function withMode(c: ModCondition, mode: Mode): ModCondition {
  const list = children(c).filter((x) => !('family' in x) || x.family);
  switch (mode) {
    case 'mod':
      return list[0] ?? { family: '' };
    case 'anyOf':
      return { anyOf: list.length ? list : [{ family: '' }] };
    case 'allOf':
      return { allOf: list.length ? list : [{ family: '' }] };
    case 'atLeast':
      return { atLeast: 'atLeast' in c ? c.atLeast : 2, of: list.length ? list : [{ family: '' }] };
  }
}

function withChildren(c: ModCondition, list: ModCondition[]): ModCondition {
  if ('anyOf' in c) return { anyOf: list };
  if ('allOf' in c) return { allOf: list };
  if ('of' in c) return { ...c, of: list };
  return c;
}

/**
 * A mod condition (C3): one mod family at a tier or better, or any / all / N of several.
 * Families come from the mod list, filtered to what rolls on the recipe's bases.
 */
export function ConditionEditor({
  value,
  onChange,
  onRemove,
  families,
  depth = 0,
}: {
  value: ModCondition;
  onChange: (value: ModCondition) => void;
  onRemove?: () => void;
  families: readonly ModFamily[];
  depth?: number;
}) {
  const mode = modeOf(value);
  const list = children(value);
  return (
    <div className={`space-y-2 ${depth > 0 ? 'border-l border-line pl-3' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Condition type"
          value={mode}
          onChange={(e) => onChange(withMode(value, e.target.value as Mode))}
        >
          {MODES.filter((m) => depth < 2 || m.value === 'mod').map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        {'atLeast' in value && (
          <Input
            type="number"
            min={1}
            max={list.length}
            aria-label="How many"
            className="w-16"
            value={value.atLeast}
            onChange={(e) =>
              onChange({ ...value, atLeast: Math.max(1, Math.floor(Number(e.target.value)) || 1) })
            }
          />
        )}
        {'family' in value && <ModPicker value={value} onChange={onChange} families={families} />}
        {onRemove && (
          <Button variant="danger" onClick={onRemove} aria-label="Remove condition">
            Remove
          </Button>
        )}
      </div>
      {mode !== 'mod' && (
        <div className="space-y-2">
          {list.map((child, i) => (
            <ConditionEditor
              key={i}
              value={child}
              families={families}
              depth={depth + 1}
              onChange={(next) =>
                onChange(
                  withChildren(
                    value,
                    list.map((c, j) => (j === i ? next : c)),
                  ),
                )
              }
              {...(list.length > 1
                ? {
                    onRemove: () =>
                      onChange(
                        withChildren(
                          value,
                          list.filter((_, j) => j !== i),
                        ),
                      ),
                  }
                : {})}
            />
          ))}
          <Button
            variant="ghost"
            onClick={() => onChange(withChildren(value, [...list, { family: '' }]))}
          >
            + Add mod
          </Button>
        </div>
      )}
    </div>
  );
}

function ModPicker({
  value,
  onChange,
  families,
}: {
  value: { family: string; tier?: number | undefined };
  onChange: (value: ModCondition) => void;
  families: readonly ModFamily[];
}) {
  const { familyLabel } = useCatalog();
  const [q, setQ] = useState('');
  const family = families.find((f) => f.family === value.family);
  const matches = searchFamilies(families, q);

  if (value.family && !q) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-line bg-surface-2 px-2 py-1 text-left text-sm hover:border-subtle"
          title={
            family
              ? family.tiers.map((t, i) => `T${i + 1} ${modText(t.text)}`).join('\n')
              : value.family
          }
          onClick={() => setQ(familyLabel(value.family))}
        >
          {family ? familyText(family) : familyLabel(value.family)}
          <span className="ml-1.5 text-xs text-subtle">{family?.kind ?? 'not on these bases'}</span>
        </button>
        <Select
          aria-label="Tier"
          value={value.tier ?? ''}
          onChange={(e) =>
            onChange({
              family: value.family,
              ...(e.target.value ? { tier: Number(e.target.value) } : {}),
            })
          }
        >
          <option value="">Any tier</option>
          {(family?.tiers ?? []).map((t, i) => (
            <option key={t.id} value={i + 1}>
              {i === 0 ? 'T1' : `T1–T${i + 1}`} (ilvl {t.level}+)
            </option>
          ))}
        </Select>
      </span>
    );
  }

  return (
    <div className="relative">
      <SearchInput placeholder="Search a mod (e.g. life)" value={q} onChange={setQ} />
      {matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-[min(28rem,90vw)] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl">
          {matches.map((f) => (
            <li key={f.family}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-surface-2"
                onClick={() => {
                  setQ('');
                  onChange({ family: f.family });
                }}
              >
                <span>{familyText(f)}</span>
                <span className="shrink-0 text-xs text-subtle">
                  {f.kind}, {f.tiers.length} tiers
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
