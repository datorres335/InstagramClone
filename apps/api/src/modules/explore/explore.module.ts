import { Module } from '@nestjs/common';

import { ExploreService } from './explore.service';

@Module({
  providers: [ExploreService],
  // PostsModule needs getRankedPostIds for GET /explore — the same split
  // SavedPostsModule/PostsService already established (Milestone 15):
  // this module owns the ranked-id-list concern, PostsService does the
  // fetch + render pipeline. No controller here — unlike SavedPostsModule,
  // Explore has no mutation side of its own to own a controller for.
  exports: [ExploreService],
})
export class ExploreModule {}
