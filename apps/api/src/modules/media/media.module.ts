import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import { MediaProcessor } from './media.processor';
import { MediaService } from './media.service';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: 'media' })],
  controllers: [MediaController],
  providers: [MediaService, MediaProcessor],
  // `UsersModule` needs `MediaService.resolveAvatarUrl` (`GET
  // /users/:username`) and to drive `setAsAvatar` (`PATCH /me/avatar`).
  exports: [MediaService],
})
export class MediaModule {}
