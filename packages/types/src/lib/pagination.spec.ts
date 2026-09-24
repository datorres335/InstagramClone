import type { PaginatedResponse } from './pagination';

describe('PaginatedResponse', () => {
  it('describes a { data, meta.nextCursor } envelope', () => {
    const page: PaginatedResponse<{ id: string }> = {
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { nextCursor: 'opaque-cursor' },
    };

    expect(page.data).toHaveLength(2);
    expect(page.meta.nextCursor).toBe('opaque-cursor');
  });

  it('allows a null nextCursor for the last page', () => {
    const page: PaginatedResponse<{ id: string }> = {
      data: [],
      meta: { nextCursor: null },
    };

    expect(page.meta.nextCursor).toBeNull();
  });
});
