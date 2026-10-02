import { decodeExploreCursor, encodeExploreCursor } from './explore-cursor';

describe('explore-cursor', () => {
  describe('encodeExploreCursor / decodeExploreCursor', () => {
    it('round-trips a likesCount/createdAt/id triple', () => {
      const value = {
        likesCount: 42,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-1',
      };

      const decoded = decodeExploreCursor(encodeExploreCursor(value));

      expect(decoded).toEqual(value);
    });

    it('round-trips a zero likesCount', () => {
      const value = {
        likesCount: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-1',
      };

      const decoded = decodeExploreCursor(encodeExploreCursor(value));

      expect(decoded).toEqual(value);
    });

    it('produces an opaque, non-JSON-looking string', () => {
      const cursor = encodeExploreCursor({
        likesCount: 42,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-1',
      });

      expect(cursor).not.toContain('{');
      expect(cursor).not.toContain('post-1');
    });
  });

  describe('decodeExploreCursor', () => {
    it('returns null for a non-base64 garbage string', () => {
      expect(decodeExploreCursor('not a real cursor')).toBeNull();
    });

    it('returns null for valid base64 that is not the expected JSON shape', () => {
      const cursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64url',
      );
      expect(decodeExploreCursor(cursor)).toBeNull();
    });

    it('returns null when likesCount is missing', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'post-1',
        }),
      ).toString('base64url');
      expect(decodeExploreCursor(cursor)).toBeNull();
    });

    it('returns null when createdAt is not a valid date string', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          likesCount: 1,
          createdAt: 'not-a-date',
          id: 'post-1',
        }),
      ).toString('base64url');
      expect(decodeExploreCursor(cursor)).toBeNull();
    });

    it('rejects a plain cursor.ts-shaped cursor (missing likesCount)', () => {
      const cursor = Buffer.from(
        JSON.stringify({
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'post-1',
        }),
      ).toString('base64url');
      expect(decodeExploreCursor(cursor)).toBeNull();
    });
  });
});
