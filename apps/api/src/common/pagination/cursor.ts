/**
 * Opaque cursor encode/decode for keyset pagination (docs/API.md §1: an
 * opaque, base64-encoded `(createdAt, id)` pair). First real implementation
 * of `packages/types`' `Cursor` contract — `GET /users/:username/posts`
 * (Milestone 8) never actually paginated anything (always an empty page), so
 * this is the shape every future paginated endpoint (feed, comments, ...)
 * should reuse.
 *
 * Deliberately just encode/decode, not a generic Prisma `where`-clause
 * builder: each model's keyset comparison needs its own typed `orderBy`/
 * `where` (e.g. `Follow`'s "other side" column differs between the
 * followers and following queries), and Prisma's generated `WhereInput`
 * types are per-model — a fully generic builder would need unsafe casts for
 * a single current caller. Add one only once a second, sufficiently similar
 * caller makes the duplication actually costly.
 */
export interface DecodedCursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(value: DecodedCursor): string {
  const payload = JSON.stringify({
    createdAt: value.createdAt.toISOString(),
    id: value.id,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** `null` for a malformed cursor — callers turn that into a 400, not a 500. */
export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { createdAt?: unknown }).createdAt !== 'string' ||
      typeof (parsed as { id?: unknown }).id !== 'string'
    ) {
      return null;
    }
    const { createdAt, id } = parsed as { createdAt: string; id: string };
    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return { createdAt: parsedDate, id };
  } catch {
    return null;
  }
}
