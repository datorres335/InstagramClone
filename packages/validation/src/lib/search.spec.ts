import { searchUsersQuerySchema } from './search';

describe('searchUsersQuerySchema', () => {
  it('accepts a 2-character query with a default limit', () => {
    const result = searchUsersQuerySchema.safeParse({ q: 'al' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('trims surrounding whitespace', () => {
    const result = searchUsersQuerySchema.safeParse({ q: '  alice  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe('alice');
    }
  });

  it('rejects a query shorter than 2 characters', () => {
    const result = searchUsersQuerySchema.safeParse({ q: 'a' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing query', () => {
    const result = searchUsersQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('coerces and caps limit the same way paginationQuerySchema does', () => {
    const tooHigh = searchUsersQuerySchema.safeParse({
      q: 'alice',
      limit: '100',
    });
    expect(tooHigh.success).toBe(false);

    const valid = searchUsersQuerySchema.safeParse({ q: 'alice', limit: '10' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.limit).toBe(10);
    }
  });
});
