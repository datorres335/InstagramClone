import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  // AuthModule for OptionalAuthGuard; MediaModule exports MediaService, used
  // to resolve each result's avatarUrl (same dependency shape as
  // FollowsModule/LikesModule).
  imports: [AuthModule, MediaModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
