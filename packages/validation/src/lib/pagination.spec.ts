import { paginationQuerySchema } from './pagination';

describe('paginationQuerySchema', () => {
  it('defaults limit to 20 when omitted', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ limit: 20 });
  });

  it('accepts a cursor and a numeric limit', () => {
    const result = paginationQuerySchema.parse({
      cursor: 'opaque-cursor',
      limit: '10',
    });
    expect(result).toEqual({ cursor: 'opaque-cursor', limit: 10 });
  });

  it('rejects a limit above 50', () => {
    expect(paginationQuerySchema.safeParse({ limit: '51' }).success).toBe(
      false,
    );
  });

  it('rejects a limit below 1', () => {
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejects a non-integer limit', () => {
    expect(paginationQuerySchema.safeParse({ limit: '1.5' }).success).toBe(
      false,
    );
  });

  it('rejects an empty cursor', () => {
    expect(paginationQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });
});
