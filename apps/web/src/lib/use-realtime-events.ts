'use client';

import { useEffect, useRef } from 'react';

import { realtimeEventSchema, type RealtimeEvent } from '@instagram-clone/validation';

/**
 * One `EventSource('/api/events')` per mounted caller (Milestone 22) — this
 * app never has two of `NotificationBadge`/`ConversationsList`/
 * `MessageThread` mounted on the same page at once (each lives on its own
 * route), so sharing a single connection through a context provider would
 * be speculative infrastructure for a case that doesn't exist yet
 * (CLAUDE.md's "avoid over-engineering").
 *
 * Calls `onEvent` for every real `notification`/`message` push. Heartbeat
 * messages never reach here at all — they're sent as a named `heartbeat`
 * SSE event (`EventsController`), and a native `EventSource` only routes
 * unnamed events to `onmessage`, so there's nothing to filter out.
 *
 * Calls `onConnect` once the stream is open, including after the browser's
 * own automatic reconnect following a drop, so a caller can re-fetch over
 * REST to catch up on anything missed while disconnected — this channel is
 * a push *optimization* layered on top of REST, never a guaranteed-delivery
 * replacement for it (see `apps/api`'s `EventsService` doc comment).
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
    const source = new EventSource('/api/events');

    source.onopen = () => onConnectRef.current?.();
    source.onmessage = (message) => {
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      const parsed = realtimeEventSchema.safeParse(data);
      if (parsed.success) onEventRef.current(parsed.data);
    };

    return () => source.close();
  }, []);
}
