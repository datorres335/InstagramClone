import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventsService],
  // NotificationsModule/ConversationsModule call EventsService.emit() after
  // creating a Notification/Message row — the same "exported for a producer
  // elsewhere" shape NotificationsModule itself already has.
  exports: [EventsService],
})
export class EventsModule {}
