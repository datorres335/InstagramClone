import { SearchBox } from './search-box';

export const metadata = {
  title: 'Search',
};

/**
 * `GET /search/users?q=` (docs/API.md §11, docs/FEATURES.md #14, Milestone
 * 17) — optional auth, no redirect for an anonymous visitor (the API
 * endpoint itself works without a session, the same "optional" posture
 * `GET /posts/:postId/likes` already has).
 */
export default function SearchPage() {
  return (
    <main>
      <h1>Search</h1>
      <SearchBox />
    </main>
  );
}
