import type { SVGProps } from 'react';

/** Small stroke icons (24×24 grid, currentColor). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const TrendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);

export const SwapIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7 4L3 8l4 4" />
    <path d="M3 8h14" />
    <path d="M17 20l4-4-4-4" />
    <path d="M21 16H7" />
  </Icon>
);

export const CoinsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <ellipse cx="9" cy="7" rx="6" ry="3" />
    <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M9 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3" />
  </Icon>
);

export const HammerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M14 5l5 5" />
    <path d="M12 7l5 5-3 3-5-5z" />
    <path d="M10 13L4 19a1.4 1.4 0 0 0 2 2l6-6" />
  </Icon>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Icon>
);

/** App mark: a faceted gem. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <path d="M16 3l10 10-10 16L6 13z" fill="var(--c-accent)" />
      <path d="M6 13h20L16 3z" fill="#fff" fillOpacity={0.25} />
      <path d="M16 29l-4-16h8z" fill="#000" fillOpacity={0.15} />
    </svg>
  );
}
