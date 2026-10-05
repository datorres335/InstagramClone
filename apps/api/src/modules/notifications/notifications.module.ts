import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    EventsModule,
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  // LikesModule/CommentsModule/FollowsModule each need enqueueNotification
  // to fire their own producer side effect after a like/comment/follow
  // succeeds — none of them are depended on back, so this isn't circular.
  exports: [NotificationsService],
})
export class NotificationsModule {}
