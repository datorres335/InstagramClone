import axios from 'axios';

describe('error responses', () => {
  it('returns RFC 7807 Problem Details for a 404', async () => {
    let error: unknown;

    try {
      await axios.get('/api/v1/this-route-does-not-exist');
    } catch (caught) {
      error = caught;
    }

    expect(axios.isAxiosError(error)).toBe(true);
    if (!axios.isAxiosError(error) || !error.response) {
      throw new Error('Expected an axios error response');
    }

    expect(error.response.status).toBe(404);
    expect(error.response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(error.response.data).toMatchObject({
      type: 'https://api.instagram-clone.dev/errors/not-found',
      title: 'NotFound',
      status: 404,
      instance: '/api/v1/this-route-does-not-exist',
    });
  });
});
