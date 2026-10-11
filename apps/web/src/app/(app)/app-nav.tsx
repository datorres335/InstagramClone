'use client';

import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ExploreIcon from '@mui/icons-material/Explore';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import Link from 'next/link';

import { logoutAction } from './logout-action';
import { NavLink, navItemClassName } from './nav-link';
import { NotificationBadge } from './notification-badge';

interface AppNavProps {
  username: string;
  unreadCount: number;
}

/**
 * The signed-in primary navigation (docs/ARCHITECTURE.md §5.5): a bottom
 * icon bar below the `md` breakpoint, a labelled left rail from `md` up.
 * One DOM tree for both layouts — only CSS changes — so every link exists
 * exactly once on the page whatever the viewport. Same order, labels and
 * Material icon glyphs as apps/mobile's tab bar.
 */
export function AppNav({ username, unreadCount }: AppNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex h-14 border-t border-border bg-background md:inset-y-0 md:right-auto md:h-auto md:w-nav-rail md:flex-col md:border-t-0 md:border-r md:px-3 md:py-6"
    >
      <Link
        href="/home"
        className="fixed top-0 left-4 flex h-14 items-center text-title font-semibold md:static md:mb-6 md:h-auto md:px-3"
      >
        Instagram Clone
      </Link>

      <ul className="flex flex-1 items-center justify-around md:flex-none md:flex-col md:items-stretch md:gap-1">
        <li className="flex-1 md:flex-none">
          <NavLink href="/home" label="Home" icon={<HomeIcon />} />
        </li>
        <li className="flex-1 md:flex-none">
          <NavLink href="/search" label="Search" icon={<SearchIcon />} />
        </li>
        <li className="flex-1 md:flex-none">
          <NavLink href="/explore" label="Explore" icon={<ExploreIcon />} />
        </li>
        <li className="flex-1 md:flex-none">
          <NavLink href="/messages" label="Messages" icon={<SendIcon />} />
        </li>
        <li className="flex-1 md:flex-none">
          <NotificationBadge initialCount={unreadCount} />
        </li>
        <li className="flex-1 md:flex-none">
          <NavLink href="/posts/new" label="Create" icon={<AddBoxIcon />} />
        </li>
        <li className="flex-1 md:flex-none">
          <NavLink
            href={`/${username}`}
            label="Profile"
            icon={<AccountCircleIcon />}
          />
        </li>
      </ul>

      {/* Top-right of the top bar on small screens; bottom of the rail from md up. */}
      <ul className="fixed top-1 right-2 flex md:static md:mt-auto md:flex-col md:gap-1">
        <li>
          <NavLink href="/settings" label="Settings" icon={<SettingsIcon />} />
        </li>
        <li>
          <form action={logoutAction}>
            <button
              type="submit"
              className={`${navItemClassName} text-text-secondary`}
            >
              <span aria-hidden="true" className="flex">
                <LogoutIcon />
              </span>
              <span className="sr-only md:not-sr-only">Log out</span>
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
