import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SavedPostsController } from './saved-posts.controller';
import { SavedPostsService } from './saved-posts.service';

@Module({
  imports: [AuthModule],
  controllers: [SavedPostsController],
  providers: [SavedPostsService],
  // PostsModule needs getSavedStateForPosts (PostResponse.isSavedByMe) and
  // getSavedPostIdsForViewer (GET /me/saved's underlying id list).
  exports: [SavedPostsService],
})
export class SavedPostsModule {}
