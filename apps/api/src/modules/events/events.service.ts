import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import type { RealtimeEvent } from '@instagram-clone/validation';

interface Envelope {
  recipientId: string;
  event: RealtimeEvent;
}

/**
 * The fan-out side of Milestone 22's realtime transport
 * (docs/ARCHITECTURE.md §5.3): one in-process RxJS `Subject` shared by every
 * connected client, filtered per-subscriber by `recipientId` — not a
 * `Map<userId, Subject>`, since a plain filter is simpler and this doesn't
 * need per-user teardown bookkeeping. In-process only, the same single-
 * instance MVP trade-off `NotificationsProcessor`/`ThrottlerModule` already
 * make: a second `apps/api` instance would miss events emitted on the
 * other one. `EventsController` covers the gap for any client that wasn't
 * connected (or was on the other instance) when an event fired by having
 * the client re-fetch over REST on (re)connect — this is a push
 * *optimization*, not a guaranteed-delivery channel.
 */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<Envelope>();

  emit(recipientId: string, event: RealtimeEvent): void {
    this.subject.next({ recipientId, event });
  }

  stream(recipientId: string): Observable<RealtimeEvent> {
    return this.subject.asObservable().pipe(
      filter((envelope) => envelope.recipientId === recipientId),
      map((envelope) => envelope.event),
    );
  }
}
