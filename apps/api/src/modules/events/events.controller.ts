import {
  Controller,
  type MessageEvent,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { merge, Observable, Subject, timer } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import { CurrentUser } from '../auth/current-user.decorator';
import { type AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';

// A heartbeat comment keeps intermediary proxies/load balancers from
// treating an idle-but-healthy connection as dead and closing it.
const HEARTBEAT_INTERVAL_MS = 20_000;

// Forces a periodic reconnect (re-running JwtAuthGuard) so a revoked
// tokenVersion (docs/ARCHITECTURE.md §7) closes a long-lived stream instead
// of it outliving the access token that authorized it indefinitely. Well
// under the 15m access-token TTL (packages/config's JWT_ACCESS_TOKEN_TTL)
// so a client's token is refreshed well before this ever bites.
const MAX_CONNECTION_MS = 10 * 60 * 1000;

/**
 * `GET /events` (docs/API.md §18, Milestone 22) — a long-lived
 * Server-Sent Events stream of the caller's own `notification`/`message`
 * push events (`RealtimeEvent`, packages/validation). Guarded by the same
 * `JwtAuthGuard` every other authenticated route uses: both real callers
 * (apps/web's Route Handler proxy, apps/mobile's `react-native-sse` client)
 * can attach a genuine `Authorization` header, so this needed no
 * query-param-token fallback the way a browser-native `EventSource` alone
 * would have.
 */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Subscribe to a live push stream of your own notifications and messages.",
  })
  stream(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ): Observable<MessageEvent> {
    const close$ = new Subject<void>();
    request.on('close', () => close$.next());

    const events$ = this.eventsService
      .stream(currentUser.id)
      .pipe(map((event): MessageEvent => ({ data: event })));

    const heartbeat$ = timer(HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: '' })),
    );

    return merge(events$, heartbeat$).pipe(
      takeUntil(merge(close$, timer(MAX_CONNECTION_MS))),
    );
  }
}
