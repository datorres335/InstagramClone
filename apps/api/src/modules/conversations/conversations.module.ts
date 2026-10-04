import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  // MediaModule exports MediaService, used to resolve each participant's/
  // sender's avatarUrl — the same dependency shape `FollowsModule` has.
  imports: [AuthModule, MediaModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
