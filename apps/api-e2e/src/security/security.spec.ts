import axios from 'axios';

/**
 * Milestone 20's security/hardening review against `docs/ARCHITECTURE.md` §11 —
 * confirms Helmet headers, the CORS allow-list, and rate limiting are
 * genuinely configured and *effective under test*, not just documented as
 * intended. All three were verified manually against a live dev server
 * before writing this file (see docs/PROGRESS.md Milestone 20 Validation
 * Performed) — this formalizes that into permanent, real-HTTP coverage, the
 * same "verify against real data/behavior first" discipline every prior
 * milestone's own hardening-adjacent findings have followed.
 */

describe('security: Helmet response headers', () => {
  it('sets Helmet security headers on every response, not just a documented intent', async () => {
    const res = await axios.get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    // Helmet never sets this header permissively when configured correctly.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('security: CORS allow-list', () => {
  it('reflects an allowed origin in Access-Control-Allow-Origin', async () => {
    const res = await axios.get('/api/v1/health', {
      headers: { Origin: 'http://localhost:4200' },
    });

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('omits Access-Control-Allow-Origin entirely for a disallowed origin', async () => {
    const res = await axios.get('/api/v1/health', {
      headers: { Origin: 'http://evil.example.com' },
    });

    // The request still succeeds server-side (axios isn't a browser and
    // doesn't enforce CORS itself) — what matters is that the response
    // carries no permissive header a real browser would need to let
    // cross-origin JS read it. No header at all, not a wildcard, is what
    // `credentials: true` CORS correctly produces for a non-allow-listed
    // origin.
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security: rate limiting is real, not just documented', () => {
  // Verified via the `X-RateLimit-*` response headers `@nestjs/throttler`
  // attaches to every throttled request, not by actually tripping a 429
  // against a route this whole suite shares. An earlier draft of this test
  // did exactly that — hammered `GET /health` 110 times to force a real
  // 429 — and intermittently (observed in roughly 1 of 5 runs) 429'd
  // `health.spec.ts`'s own unrelated single health check running
  // concurrently in a different Jest worker, since exceeding a route's
  // bucket starves every other caller of that same route for the rest of
  // the throttle window, not just the caller that exceeded it. That
  // finding is also *why* `GET /health` itself is now `@SkipThrottle()`'d
  // (`health.controller.ts`) — a real liveness/readiness endpoint must
  // never be rate-limited, the same reasoning a real load balancer/k8s
  // probe setup would require. The actual "does exceeding the limit
  // produce a genuine 429" behavior was independently confirmed live against
  // a real dev server before writing this file (`/auth/login`, 10 rapid
  // wrong-password attempts, the 11th+ returning 429 — see docs/PROGRESS.md
  // Milestone 20 Validation Performed) — this header-based check locks in
  // the same mechanism permanently without that collision risk.
  it('tags the global default throttle (100/min) on a route with no override', async () => {
    const res = await axios.get('/api/v1/search/users?q=ab');

    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThan(100);
  });

  it('tags a stricter per-route override (20/min) on /auth/login, distinct from the global default', async () => {
    const res = await axios
      .post('/api/v1/auth/login', {
        emailOrUsername: 'security-spec-header-probe',
        password: 'wrong',
      })
      .catch((error) => {
        if (!axios.isAxiosError(error) || !error.response) throw error;
        return error.response;
      });

    expect(res.headers['x-ratelimit-limit']).toBe('20');
  });
});
