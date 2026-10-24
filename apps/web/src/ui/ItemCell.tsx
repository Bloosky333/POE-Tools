/** Item icon tile + name + secondary line, as in poe.ninja tables. */
export function ItemCell({
  icon,
  name,
  subtitle,
  size = 'md',
}: {
  icon: string | undefined;
  name: string;
  subtitle?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-12 w-12' }[size];
  const img = { sm: 'h-7 w-7', md: 'h-7.5 w-7.5', lg: 'h-10 w-10' }[size];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex shrink-0 items-center justify-center rounded-md bg-surface-2 ${box}`}>
        {icon && <img src={icon} alt="" loading="lazy" className={img} />}
      </div>
      <div className="min-w-0">
        <div className={`truncate font-medium ${size === 'lg' ? 'text-lg font-semibold' : ''}`}>
          {name}
        </div>
        {subtitle && <div className="truncate text-xs text-subtle">{subtitle}</div>}
      </div>
    </div>
  );
}
