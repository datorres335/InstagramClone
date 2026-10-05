import { NotAuthenticatedError } from '@instagram-clone/api-client';

import { env } from '../../../lib/env';
import { getApiClient } from '../../../lib/get-api-client';

// Never statically optimized/cached — every call needs this viewer's own
// live stream, the same reasoning every cookie-reading Route Handler in
// this app already follows.
export const dynamic = 'force-dynamic';

/**
 * Proxies the real SSE stream (Milestone 22, docs/API.md §18) from
 * `apps/api`'s `GET /events`. A browser's native `EventSource` can't attach
 * a custom `Authorization` header the way `fetch` can, and this app's
 * access token is never exposed to browser JS in the first place — only an
 * httpOnly refresh cookie (docs/ARCHITECTURE.md §5.1/§7). So the Next
 * server does here what it already does for every other request: acts as
 * the one trusted caller holding a real Bearer token, just forwarding a
 * live stream instead of a single JSON response.
 */
export async function GET(request: Request): Promise<Response> {
  let accessToken: string;
  try {
    accessToken = await getApiClient().http.getAccessToken();
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(null, { status: 401 });
    }
    throw error;
  }

  // Tie the upstream connection to the browser's: without this, a closed
  // EventSource leaves its API stream open until the server's own ~10-minute
  // forced disconnect, one lingering connection per page navigation.
  const upstream = await fetch(`${env.NEXT_PUBLIC_API_URL}/events`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: request.signal,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
