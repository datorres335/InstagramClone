import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommentsModule } from '../comments/comments.module';
import { ExploreModule } from '../explore/explore.module';
import { LikesModule } from '../likes/likes.module';
import { MediaModule } from '../media/media.module';
import { SavedPostsModule } from '../saved-posts/saved-posts.module';
import { ExploreController } from './explore.controller';
import { FeedController } from './feed.controller';
import { MeSavedController } from './me-saved.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // MediaModule exports MediaService, used to validate each mediaId is the
  // caller's own, READY, POST_IMAGE-purpose media (docs/API.md §7).
  // LikesModule/CommentsModule/SavedPostsModule export their services, used
  // to resolve real likesCount/isLikedByMe (Milestone 13), commentsCount
  // (Milestone 14), and isSavedByMe (Milestone 15) on every PostResponse —
  // the same dependency shape as MediaModule; none of them import
  // PostsModule back (each does its own small, self-contained
  // post-existence check), so this isn't circular. ExploreModule exports
  // ExploreService, used to resolve the ranked post-id list for `GET
  // /explore` (Milestone 18) — same one-way shape.
  imports: [
    AuthModule,
    MediaModule,
    LikesModule,
    CommentsModule,
    SavedPostsModule,
    ExploreModule,
  ],
  // FeedController/MeSavedController/ExploreController live here rather
  // than their own modules — `GET /feed` (Milestone 12), `GET /me/saved`
  // (Milestone 15), and `GET /explore` (Milestone 18) are all top-level
  // resources by URL, but each is really just another read path over
  // PostsService, with no state or dependencies of its own that would
  // justify a separate module.
  controllers: [
    PostsController,
    FeedController,
    MeSavedController,
    ExploreController,
  ],
  providers: [PostsService],
  // UsersModule needs getPostsByAuthor for GET /users/:username/posts (the
  // profile grid) — the same dependency shape MediaModule/FollowsModule
  // already established for UsersModule.
  exports: [PostsService],
})
export class PostsModule {}
