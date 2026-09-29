import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a createdAt/id pair', () => {
      const value = {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'row-1',
      };

      const decoded = decodeCursor(encodeCursor(value));

      expect(decoded).toEqual(value);
    });

    it('produces an opaque, non-JSON-looking string', () => {
      const cursor = encodeCursor({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'row-1',
      });

      expect(cursor).not.toContain('{');
      expect(cursor).not.toContain('row-1');
    });
  });

  describe('decodeCursor', () => {
    it('returns null for a non-base64 garbage string', () => {
      expect(decodeCursor('not a real cursor')).toBeNull();
    });

    it('returns null for valid base64 that is not the expected JSON shape', () => {
      const cursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64url',
      );
      expect(decodeCursor(cursor)).toBeNull();
    });

    it('returns null when createdAt is not a valid date string', () => {
      const cursor = Buffer.from(
        JSON.stringify({ createdAt: 'not-a-date', id: 'row-1' }),
      ).toString('base64url');
      expect(decodeCursor(cursor)).toBeNull();
    });
  });
});
