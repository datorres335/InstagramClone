import type { paths } from '../generated/openapi-types';

/**
 * A compile-time drift detector, not a runtime one: `packages/validation`'s
 * hand-authored Zod-inferred types (not these generated ones) are what
 * `auth-client.ts` is actually typed against — see the Milestone 6
 * deviation in docs/PROGRESS.md for why. This file's job is narrower but
 * still real: if `apps/api` ever stops serving one of these five auth
 * routes (a rename, a removed endpoint), the type references below fail to
 * compile, catching the drift before anything downstream notices at
 * runtime. This is also the thing that proves the openapi-typescript
 * codegen pipeline (docs/ARCHITECTURE.md §6.2, risk #2) actually works
 * end-to-end, not just that the Nx targets ran without erroring.
 */
type _RegisterRoute = paths['/api/v1/auth/register']['post'];
type _LoginRoute = paths['/api/v1/auth/login']['post'];
type _RefreshRoute = paths['/api/v1/auth/refresh']['post'];
type _LogoutRoute = paths['/api/v1/auth/logout']['post'];
type _SessionRoute = paths['/api/v1/auth/session']['get'];
type _ProfileRoute = paths['/api/v1/users/{username}']['get'];
type _UserPostsRoute = paths['/api/v1/users/{username}/posts']['get'];
type _UpdateProfileRoute = paths['/api/v1/me']['patch'];
type _UpdateAvatarRoute = paths['/api/v1/me/avatar']['patch'];
type _PresignMediaRoute = paths['/api/v1/media/presign']['post'];
type _CompleteMediaRoute = paths['/api/v1/media/{id}/complete']['post'];
type _GetMediaRoute = paths['/api/v1/media/{id}']['get'];
type _FollowRoute = paths['/api/v1/users/{username}/follow']['put'];
type _UnfollowRoute = paths['/api/v1/users/{username}/follow']['delete'];
type _FollowersRoute = paths['/api/v1/users/{username}/followers']['get'];
type _FollowingRoute = paths['/api/v1/users/{username}/following']['get'];
type _CreatePostRoute = paths['/api/v1/posts']['post'];
type _GetPostRoute = paths['/api/v1/posts/{id}']['get'];
type _DeletePostRoute = paths['/api/v1/posts/{id}']['delete'];
type _FeedRoute = paths['/api/v1/feed']['get'];
type _LikeRoute = paths['/api/v1/posts/{postId}/like']['put'];
type _UnlikeRoute = paths['/api/v1/posts/{postId}/like']['delete'];
type _LikersRoute = paths['/api/v1/posts/{postId}/likes']['get'];
type _CreateCommentRoute = paths['/api/v1/posts/{postId}/comments']['post'];
type _ListCommentsRoute = paths['/api/v1/posts/{postId}/comments']['get'];
type _DeleteCommentRoute =
  paths['/api/v1/posts/{postId}/comments/{commentId}']['delete'];
type _SaveRoute = paths['/api/v1/posts/{postId}/save']['put'];
type _UnsaveRoute = paths['/api/v1/posts/{postId}/save']['delete'];
type _MeSavedRoute = paths['/api/v1/me/saved']['get'];

describe('generated OpenAPI types', () => {
  it('describes every route this client wraps (see the type references above)', () => {
    // The real assertion is at compile time (the type aliases above); this
    // keeps the file a valid, reportable test module.
    expect(true).toBe(true);
  });
});
