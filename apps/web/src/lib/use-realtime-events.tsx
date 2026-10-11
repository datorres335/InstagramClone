'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import {
  realtimeEventSchema,
  type RealtimeEvent,
} from '@instagram-clone/validation';

interface RealtimeListener {
  onEvent: (event: RealtimeEvent) => void;
  onConnect?: () => void;
}

type Subscribe = (listener: RealtimeListener) => () => void;

const RealtimeContext = createContext<Subscribe | null>(null);

/**
 * One `EventSource('/api/events')` for the whole signed-in app shell
 * (Milestone 22's push channel). Milestone 22 opened one connection per
 * caller because no two callers were ever on screen together; since
 * Milestone 23 the notification badge lives in the persistent shell, so it
 * shares the page with `ConversationsList`/`MessageThread`, and they now
 * share this one connection instead of opening two.
 *
 * Heartbeats never reach `onmessage` — they're sent as a named `heartbeat`
 * SSE event (`EventsController`), and a native `EventSource` only routes
 * unnamed events there.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const listeners = useRef(new Set<RealtimeListener>());
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/events');
    sourceRef.current = source;

    source.onopen = () => {
      for (const listener of listeners.current) listener.onConnect?.();
    };
    source.onmessage = (message) => {
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      const parsed = realtimeEventSchema.safeParse(data);
      if (!parsed.success) return;
      for (const listener of listeners.current) listener.onEvent(parsed.data);
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, []);

  const subscribe = useCallback<Subscribe>((listener) => {
    listeners.current.add(listener);
    // Joining an already-open stream counts as connecting: the caller
    // re-fetches over REST to cover anything between its render and now.
    if (sourceRef.current?.readyState === EventSource.OPEN) {
      listener.onConnect?.();
    }
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return <RealtimeContext value={subscribe}>{children}</RealtimeContext>;
}

/**
 * Calls `onEvent` for every real `notification`/`message` push, and
 * `onConnect` whenever the stream (re)opens — or immediately, if it's already
 * open when the caller mounts — so the caller can re-fetch over REST to catch
 * up on anything missed. This channel is a push *optimization* layered on top
 * of REST, never a guaranteed-delivery replacement for it (see `apps/api`'s
 * `EventsService` doc comment).
 */
export function useRealtimeEvents(
  onEvent: (event: RealtimeEvent) => void,
  onConnect?: () => void,
): void {
  const subscribe = useContext(RealtimeContext);
  if (!subscribe) {
    throw new Error('useRealtimeEvents must be used inside <RealtimeProvider>');
  }

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;

  useEffect(
    () =>
      subscribe({
        onEvent: (event) => onEventRef.current(event),
        onConnect: () => onConnectRef.current?.(),
      }),
    [subscribe],
  );
}
