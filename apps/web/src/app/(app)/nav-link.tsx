'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const navItemClassName =
  'flex min-h-12 w-full items-center justify-center gap-4 rounded-md px-3 text-body-large hover:bg-surface-variant focus-visible:outline-2 focus-visible:outline-primary md:justify-start';

interface NavLinkProps {
  href: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  /** Shown while the link is the current page; defaults to `icon`. */
  activeIcon?: React.ReactNode;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One primary-navigation entry. The active entry is drawn in the text color
 * and semibold, inactive ones in the secondary text color — the same tints
 * as apps/mobile's tab bar. The label is visually hidden below the `md`
 * breakpoint (icon-only bottom bar) but stays in the DOM, so the link keeps
 * its accessible name at every width.
 */
export function NavLink({ href, label, icon, activeIcon }: NavLinkProps) {
  const active = isActivePath(usePathname(), href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${navItemClassName} ${active ? 'font-semibold text-text' : 'text-text-secondary'}`}
    >
      <span aria-hidden="true" className="flex">
        {active ? (activeIcon ?? icon) : icon}
      </span>
      <span className="sr-only md:not-sr-only">{label}</span>
    </Link>
  );
}
