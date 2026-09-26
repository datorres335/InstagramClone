import axios from 'axios';

describe('OpenAPI', () => {
  it('serves the generated document as JSON', async () => {
    const res = await axios.get('/api/docs-json');

    expect(res.status).toBe(200);
    expect(res.data.info.title).toBe('Instagram Clone API');
    expect(res.data.paths).toHaveProperty('/api/v1/health');
  });

  it('serves the interactive Swagger UI', async () => {
    const res = await axios.get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
