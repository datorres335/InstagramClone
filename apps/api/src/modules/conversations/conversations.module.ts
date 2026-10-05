import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MediaModule } from '../media/media.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  // MediaModule exports MediaService, used to resolve each participant's/
  // sender's avatarUrl — the same dependency shape `FollowsModule` has.
  // EventsModule exports EventsService, used to push a `message` event to
  // the other participant(s) after `sendMessage` commits (Milestone 22).
  imports: [AuthModule, MediaModule, EventsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
