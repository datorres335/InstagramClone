import { firstValueFrom, take } from 'rxjs';

import type { RealtimeEvent } from '@instagram-clone/validation';

import { EventsService } from './events.service';

const notificationEvent: RealtimeEvent = {
  type: 'notification',
  notification: {
    id: 'notif-1',
    type: 'FOLLOW',
    actor: { id: 'user-2', username: 'bob', fullName: 'Bob', avatarUrl: null },
    post: null,
    comment: null,
    isRead: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('EventsService', () => {
  it('delivers an emitted event only to a subscriber matching the recipient', async () => {
    const service = new EventsService();
    const received: RealtimeEvent[] = [];
    const subscription = service.stream('user-1').subscribe((event) => {
      received.push(event);
    });

    service.emit('user-2', notificationEvent); // a different recipient
    service.emit('user-1', notificationEvent);

    expect(received).toEqual([notificationEvent]);
    subscription.unsubscribe();
  });

  it('fans one emitted event out to every subscriber for that recipient', async () => {
    const service = new EventsService();
    const first = firstValueFrom(service.stream('user-1').pipe(take(1)));
    const second = firstValueFrom(service.stream('user-1').pipe(take(1)));

    // Subscriptions above are synchronous, so the emit below reaches both.
    service.emit('user-1', notificationEvent);

    await expect(first).resolves.toEqual(notificationEvent);
    await expect(second).resolves.toEqual(notificationEvent);
  });
});
