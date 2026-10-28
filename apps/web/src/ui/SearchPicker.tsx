import { useId, useState, type ReactNode } from 'react';
import { SearchIcon } from '../components/icons.tsx';
import { controlClass } from './form.tsx';

/**
 * Search box with a list of matches to pick from (combobox): arrow keys move, Enter picks,
 * Escape clears. The caller filters `options` from `query`. The list is as wide as the box
 * on phones, so it never runs off the screen.
 */
export function SearchPicker<T>({
  placeholder,
  query,
  onQueryChange,
  options,
  optionKey,
  renderOption,
  onPick,
}: {
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  options: readonly T[];
  optionKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  onPick: (option: T) => void;
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(true);
  const shown = open && query.trim() !== '' && options.length > 0;
  const current = Math.min(active, options.length - 1);

  const pick = (option: T) => {
    onPick(option);
    onQueryChange('');
    setActive(0);
  };

  return (
    <div className="relative w-full sm:w-auto">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-subtle"
          width={15}
          height={15}
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={shown}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={shown ? `${id}-${current}` : undefined}
          placeholder={placeholder}
          className={`${controlClass} w-full pl-7 sm:w-56`}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on an option lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onQueryChange('');
              return;
            }
            if (!shown) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setActive((current + step + options.length) % options.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const option = options[current];
              if (option !== undefined) pick(option);
            }
          }}
        />
      </label>
      {shown && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={placeholder}
          className="absolute right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl sm:right-auto sm:w-[min(28rem,90vw)]"
        >
          {options.map((option, i) => (
            <li
              key={optionKey(option)}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === current}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${
                i === current ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(option)}
            >
              {renderOption(option)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
