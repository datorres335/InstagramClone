import type { PaginationQuery } from '@instagram-clone/validation';

/** Shared by every paginated-list client method (`docs/API.md` §1's `?cursor=&limit=` shape). */
export function buildQueryString(query?: PaginationQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
