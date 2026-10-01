'use client';

import { useEffect, useState } from 'react';

import type { FollowListItem as FollowListItemType } from '@instagram-clone/validation';

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

export function SearchBox() {
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
    <div>
      <label htmlFor="search-query">Search for people</label>
      <input
        id="search-query"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by username or name"
      />
      {pending && <p>Searching…</p>}
      {error && <p role="alert">{error}</p>}
      {!pending && trimmed.length >= 2 && results.length === 0 && !error && (
        <p>No results found.</p>
      )}
      {results.length > 0 && (
        <ul>
          {results.map((item) => (
            <FollowListItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
