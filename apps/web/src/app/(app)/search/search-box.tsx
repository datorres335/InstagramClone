'use client';

import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

import { EmptyState } from '../../../components/ui/empty-state';
import { FollowListItem } from '../follow-list-item';
import { searchUsersAction } from './actions';

/**
 * The first debounced input in this codebase (Milestone 17) — 300ms, a
 * reasonable default balancing "feels live while typing" against not
 * firing a request per keystroke. Local state only, no `router.refresh()`,
 * the same `LikeButton`/`SaveButton` pattern — nothing else on the page
 * depends on this component's results.
 */
const DEBOUNCE_MS = 300;

interface SearchBoxProps {
  /** The signed-in viewer, whose own result row gets no follow button. */
  viewerUsername: string | null;
}

export function SearchBox({ viewerUsername }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FollowListItemType[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setPending(false);
      return;
    }

    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchUsersAction(query);
        setResults(response.data);
        setError(null);
      } catch {
        setError('Something went wrong searching. Please try again.');
      } finally {
        setPending(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-2">
      <TextField
        id="search-query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by username or name"
        size="small"
        fullWidth
        slotProps={{
          htmlInput: {
            'aria-label': 'Search for people',
            autoComplete: 'off',
          },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className="text-text-secondary" />
              </InputAdornment>
            ),
          },
        }}
      />
      {pending && (
        <CircularProgress
          size={24}
          aria-label="Searching"
          className="mx-auto my-4"
        />
      )}
      {error && (
        <p role="alert" className="text-center text-error">
          {error}
        </p>
      )}
      {!pending && trimmed.length >= 2 && results.length === 0 && !error && (
        <EmptyState icon={<SearchOffIcon />} message="No results found." />
      )}
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((item) => (
            <FollowListItem
              key={item.id}
              item={item}
              isViewer={item.username === viewerUsername}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
