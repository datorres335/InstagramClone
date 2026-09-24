/**
 * Opaque cursor for keyset pagination (docs/API.md §1). Always a
 * base64-encoded `(createdAt, id)` pair produced by the API — callers must
 * never construct one by hand, only pass one through from a previous
 * response's `meta.nextCursor` to the next request's `?cursor=`.
 *
 * Deliberately a plain string alias, not a branded type: the only place a
 * cursor value crosses a type boundary is API request/response bodies,
 * which are validated by `packages/validation` at that boundary anyway —
 * branding would add call-site friction (casts wherever a cursor arrives
 * from a URL query string) without a corresponding safety benefit here.
 */
export type Cursor = string;

/**
 * Response envelope for every paginated list endpoint (docs/API.md §1).
 * Single-resource responses are returned unwrapped and don't use this type.
 */
export interface PaginatedResponse<TItem> {
  data: TItem[];
  meta: {
    nextCursor: Cursor | null;
  };
}
