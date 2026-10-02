/**
 * Opaque cursor encode/decode for `GET /explore` (docs/API.md §11,
 * Milestone 18) — a genuinely different shape from `cursor.ts`'s
 * `(createdAt, id)` pair, not a generalization of it: Explore's ranking is
 * `(likesCount DESC, createdAt DESC, id DESC)`, a real, stable, three-column
 * sort key (unlike Milestone 17's trigram `similarity()`, which has none at
 * all), so a genuine keyset cursor is possible here — it just needs an
 * extra leading numeric field `cursor.ts`'s shape has no room for.
 * `cursor.ts`'s own doc comment says to add a second shape only once a
 * second, sufficiently different caller needs one — this is that caller.
 */
export interface DecodedExploreCursor {
  likesCount: number;
  createdAt: Date;
  id: string;
}

export function encodeExploreCursor(value: DecodedExploreCursor): string {
  const payload = JSON.stringify({
    likesCount: value.likesCount,
    createdAt: value.createdAt.toISOString(),
    id: value.id,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** `null` for a malformed cursor — callers turn that into a 400, not a 500. */
export function decodeExploreCursor(
  cursor: string,
): DecodedExploreCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { likesCount?: unknown }).likesCount !== 'number' ||
      typeof (parsed as { createdAt?: unknown }).createdAt !== 'string' ||
      typeof (parsed as { id?: unknown }).id !== 'string'
    ) {
      return null;
    }
    const { likesCount, createdAt, id } = parsed as {
      likesCount: number;
      createdAt: string;
      id: string;
    };
    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return { likesCount, createdAt: parsedDate, id };
  } catch {
    return null;
  }
}
