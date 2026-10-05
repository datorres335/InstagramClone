import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';

import { realtimeEventSchema, type RealtimeEvent } from '@instagram-clone/validation';

import { apiClient } from './api-client';
import { env } from './env';

/**
 * Mobile's half of Milestone 22's realtime transport (docs/API.md §18) —
 * unlike `apps/web` (which proxies through a Route Handler because a
 * browser's `EventSource` can't attach a custom header), mobile connects
 * straight to `apps/api`'s `GET /events` with a genuine `Authorization`
 * header, since `react-native-sse`'s `EventSource` (unlike the browser-
 * native one) supports exactly that — the reason it was chosen over the
 * platform built-in.
 *
 * `react-native-sse` auto-reconnects on its own after the server's forced
 * ~10-minute disconnect (`EventsController`), but reuses the header it was
 * constructed with rather than re-reading a fresh token — acceptable here
 * since that's comfortably inside the access token's 15-minute TTL for a
 * connection that was valid when opened; a token that goes stale for other
 * reasons (e.g. a revoked `tokenVersion`) is a known gap, not solved by
 * this milestone.
 *
 * Calls `onEvent` for every real `notification`/`message` push, and
 * `onConnect` on every open (including reconnects) so a caller can re-fetch
 * over REST to cover anything missed while disconnected — the same
 * contract `apps/web`'s `useRealtimeEvents` exposes.
 */
export function useRealtimeEvents(
  onEvent: (event: RealtimeEvent) => void,
  onConnect?: () => void,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    apiClient.http
      .getAccessToken()
      .then((accessToken) => {
        if (cancelled) return;
        source = new EventSource(`${env.EXPO_PUBLIC_API_URL}/events`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        source.addEventListener('open', () => onConnectRef.current?.());
        source.addEventListener('message', (event) => {
          if (!event.data) return;
          let data: unknown;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          const parsed = realtimeEventSchema.safeParse(data);
          if (parsed.success) onEventRef.current(parsed.data);
        });
      })
      .catch(() => {
        // No session to connect with — every caller of this hook only
        // renders behind auth anyway, so there's nothing more to do.
      });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);
}
