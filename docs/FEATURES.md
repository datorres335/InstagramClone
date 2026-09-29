# Features

Functional specification for the 17 MVP features plus explicit notes on how the
architecture anticipates the 5 post-MVP features. Each MVP feature lists: summary, core
requirements, explicit out-of-scope items (so scope creep during implementation has a
written line to check against), and the primary entities/endpoints it touches (cross-
referenced to `DATABASE.md` / `API.md`).

## MVP Features

### 1. User Registration

- Email + username + password. Username is unique (case-insensitive), 3–30 chars,
  alphanumeric + underscore/period (exact rule lives in `packages/validation`).
  Password strength validated client- and server-side via the shared Zod schema.
- On success, the user is logged in immediately (access + refresh tokens issued) — no
  mandatory email verification step in the MVP.
- **Out of scope for MVP**: mandatory email verification before login, social
  login/OAuth, phone-number signup. `User.emailVerifiedAt` exists in the schema so
  verification can be added later without a migration.
- Entities/endpoints: `User` (`DATABASE.md` §3.1), `POST /auth/register` (`API.md` §3).

### 2. Login / Logout

- Login by email-or-username + password, returns access token + refresh token (cookie
  on web, token pair on mobile).
- Logout revokes the current session's refresh token family; a "log out of all devices"
  option revokes every family for the user (settings page affordance).
- **Out of scope**: "remember me" toggle beyond the standard refresh-token lifetime,
  magic-link login.
- Entities/endpoints: `RefreshToken` (`DATABASE.md` §3.2), `POST /auth/login`,
  `POST /auth/logout`, `POST /auth/refresh` (`API.md` §3).

### 3. User Profiles

- Public profile page: avatar, full name, username, bio, website link, post count,
  follower count, following count, post grid.
- Own profile has edit affordances; viewing another user's profile shows a
  Follow/Unfollow button (see Feature 5) instead.
- **Out of scope**: profile view analytics, profile highlights/pinned content beyond the
  post grid itself.
- Entities/endpoints: `User`, `GET /users/:username`, `GET /users/:username/posts`
  (`API.md` §4).

### 4. Profile Photos (implemented Milestone 9)

- Upload/replace avatar via the presign → direct-upload → complete flow shared with post
  images (`ARCHITECTURE.md` §8); server still stores/serves a generated set of variants
  (`thumbnail`/`feed` + a `blurhash` placeholder).
- **Client-side square crop, as implemented**: mobile uses `expo-image-picker`'s native
  cropper (`allowsEditing`/`aspect: [1,1]`) before upload. Web has no comparable free
  native crop widget, so it skips a client-side crop step entirely and relies on the
  server's `sharp` center-crop (always applied to `thumbnail`, regardless of platform) to
  guarantee a square result either way — a deliberate scoping decision (see
  `docs/PROGRESS.md`), not a gap.
- **Out of scope**: animated avatars, avatar frames/badges.
- Entities/endpoints: `Media` with `purpose: AVATAR` (`DATABASE.md` §3.3),
  `POST /media/presign`, `POST /media/:id/complete`, `PATCH /me/avatar` (`API.md` §6, §4).

### 5. Follow / Unfollow (implemented Milestone 10)

- One user follows another; immediate effect (the followed account's posts appear in
  the follower's feed right away — the feed itself lands Milestone 12).
- **Explicit MVP scope decision**: `User.isPrivate` exists in the schema, but the MVP
  does **not** implement a follow-request/approval workflow — following a private
  account behaves identically to following a public one. This is called out because it
  is the one place the schema is more forward-looking than the MVP behavior; implementing
  approval later means adding a `FollowRequest` table and gating the follow endpoint,
  not changing `Follow` itself.
- Self-follow is rejected (`409`).
- Entities/endpoints: `Follow` (`DATABASE.md` §3.6), `PUT`/`DELETE
/users/:username/follow` (`API.md` §5).

### 6. Followers / Following Lists (implemented Milestone 10)

- Paginated lists on a profile, each entry showing avatar/username/full name and a
  follow/unfollow affordance inline.
- **As implemented**: the inline affordance renders for any authenticated viewer
  browsing any followers/following list (not gated to "only when it's your own list") —
  `isFollowedByMe` is already computed per row regardless of whose list is being
  viewed, so restricting the button to the viewer's own list would be a strictly less
  useful subset of what the API already supports. See docs/PROGRESS.md's Milestone 10
  deviations.
- **Out of scope**: mutual-followers indicator, search-within-list.
- Entities/endpoints: `GET /users/:username/followers`, `GET
/users/:username/following` (`API.md` §5).

### 7. Image Posts

- A post has 1..N images, an optional caption, optional free-text location.
- Created only from `READY` media the poster owns (enforced server-side, §6 of
  `API.md`), preventing posts referencing someone else's or still-processing media.
- **Out of scope**: video posts (future — see below), draft posts, scheduled posts.
- Entities/endpoints: `Post`, `PostMedia`, `Media` (`DATABASE.md` §3.3–3.5),
  `POST /posts`, `GET /posts/:id` (`API.md` §7).

### 8. Multiple Images Per Post

- Carousel of up to 10 images per post (matching Instagram's own limit), ordered by the
  `position` the client specifies at creation time; web/mobile render a swipeable
  carousel with a page indicator.
- **Out of scope**: reordering images after the post is created (create is atomic —
  editing media composition after the fact is not part of the MVP; caption editing may
  still be allowed, see below).
- Entities/endpoints: `PostMedia.position` (`DATABASE.md` §3.5).

### 9. Captions

- Plain text, up to ~2200 characters (Instagram's own limit), rendered with line breaks
  preserved; no rich formatting.
- **Out of scope**: @mentions/#hashtags as _linked, indexed_ entities (the text may
  contain `@`/`#` characters, but the MVP does not parse, link, or make them
  searchable — that's a natural post-MVP addition, not a schema change, since caption
  stays a plain `text` column).
- Entities/endpoints: `Post.caption` (`DATABASE.md` §3.4).

### 10. Home Feed

- Reverse-chronological posts from accounts the current user follows, paginated by
  cursor.
- Each feed item shows author, media carousel, caption, like/comment counts, and
  like/comment/save affordances inline.
- **Explicit MVP scope decision**: no algorithmic ranking — chronological only. Fan-out
  computed at read time (`DATABASE.md` §6, §10; `ARCHITECTURE.md` risk #3).
- **Out of scope**: "New posts" live-update banner (would need realtime transport, out
  of scope per `ARCHITECTURE.md` non-goals), showing your own posts in your own feed
  (a product decision left to implementation — default: no, matching Instagram).
- Entities/endpoints: `GET /feed` (`API.md` §7).

### 11. Likes

- Like/unlike a post; like count and "liked by me" state shown everywhere a post
  appears (feed, profile grid detail, post detail).
- Liking generates a `Notification` for the post's author (unless the author liked
  their own post).
- **Out of scope**: liking comments (schema/API note it explicitly as future — would be
  a new `CommentLike` table, structurally identical to `Like`), seeing "liked by X and Y
  others" phrasing beyond a simple liker list/count.
- Entities/endpoints: `Like` (`DATABASE.md` §3.7), `PUT`/`DELETE
/posts/:postId/like`, `GET /posts/:postId/likes` (`API.md` §8).

### 12. Comments

- Flat (non-threaded) comments on a post, paginated oldest-first.
- Commenting generates a `Notification` for the post's author (unless commenting on
  one's own post).
- Either the comment's author or the post's author may delete a comment (standard
  moderation baseline).
- **Explicit MVP scope decision**: `Comment.parentCommentId` exists in the schema
  (`DATABASE.md` §3.8) but the API never accepts it from clients in the MVP — comments
  are flat. Threaded replies are additive later (new API field + UI), not a schema
  change.
- **Out of scope**: comment likes, @mentions-as-links within comments, comment editing
  (delete-and-recreate is the MVP workflow for corrections).
- Entities/endpoints: `Comment`, `POST`/`GET/DELETE
/posts/:postId/comments` (`API.md` §9).

### 13. Saved Posts

- Bookmark a post privately (not visible to other users, matching Instagram's own
  "Saved" behavior); view your saved posts in a dedicated list.
- **Out of scope**: save collections/folders (a single flat saved list for MVP).
- Entities/endpoints: `SavedPost` (`DATABASE.md` §3.9), `PUT`/`DELETE
/posts/:postId/save`, `GET /me/saved` (`API.md` §10).

### 14. User Search

- Search by username/full name, returns a ranked, paginated list of matching users.
- Backed by Postgres `pg_trgm` similarity search (`DATABASE.md` §5, §6) — good enough
  for MVP scale, not a general-purpose search engine (see `ARCHITECTURE.md` risk #7).
- **Out of scope**: searching posts by caption text, hashtag search, search history/
  suggestions.
- Entities/endpoints: `GET /search/users?q=` (`API.md` §11).

### 15. Explore Page

- A grid of posts from accounts the current user does not follow, to aid discovery.
- MVP ranking: recency + engagement heuristic (e.g. like count within a recent time
  window), computed live — not a personalized ML feed.
- **Out of scope**: personalization beyond the simple heuristic, topic/category
  browsing, video content.
- Entities/endpoints: `GET /explore` (`API.md` §11).

### 16. Notifications

- In-app notification list for follows, likes, and comments received, with an unread
  badge count.
- Poll-based: clients refetch the unread-count endpoint periodically (no realtime
  transport, per `ARCHITECTURE.md` non-goals); marking as read happens on opening the
  notifications screen.
- Generated asynchronously via a background job (`ARCHITECTURE.md` §8/§12 risk #10),
  not written synchronously on the triggering request, so a burst of engagement on one
  post can't slow down the like/comment/follow endpoints themselves.
- **Out of scope**: push notifications (explicitly future — see below), email digest
  notifications, per-notification-type mute settings (a coarser global setting could be
  added under Account Settings later).
- Entities/endpoints: `Notification` (`DATABASE.md` §3.10), `GET /notifications`,
  `GET /notifications/unread-count`, `POST /notifications/mark-read` (`API.md` §12).

### 17. Account Settings

- Edit profile fields (name, bio, website, `isPrivate` toggle — the toggle exists and
  is user-facing even though it has no follow-approval effect yet, see Feature 5's
  scope note), change password, change email, delete account (soft delete).
- Changing password bumps `User.tokenVersion`, invalidating access tokens on all other
  devices/sessions (they'll fail auth and be forced to re-login) — not just the
  presented refresh token, which only affects future refreshes.
- **Out of scope**: two-factor authentication, connected-apps/OAuth management, data
  export/download-your-data, blocking/muting other users (a plausible near-future
  addition, but not in the given MVP list, so not designed here to avoid scope creep).
- Entities/endpoints: `PATCH /me`, `POST /me/change-password`, `POST
/me/change-email`, `DELETE /me` (`API.md` §13).

## Cross-Cutting Notes

- **Accessibility**: image posts and avatars carry an optional `altText` field
  (`PostMedia.altText`, `DATABASE.md` §3.5) from the start, even though authoring UI for
  it is a small, low-priority piece of whichever milestone implements post creation —
  the schema doesn't need to change to support it fully later.
- **Content moderation / reporting** is not in the given MVP feature list and is not
  designed in this document; if added later it is a new, additive `reports` domain
  (`ARCHITECTURE.md` §13, Open Questions), not a change to existing tables.
- **Internationalization** is not addressed — all validation messages/content are
  English-only in the MVP; no schema decision here blocks adding i18n later (user-
  authored content like captions/bios is stored as opaque `text`, not locale-tagged).

## Future Features (explicitly out of MVP)

For each, a note on how the current design avoids foreclosing it:

- **Stories**: would be a new `Story` entity (media + 24h expiry) reusing the existing
  `Media` pipeline (presign/upload/process) unchanged; no MVP schema change needed.
- **Reels / video**: `Media.contentType`/`purpose` are already open enums-in-spirit;
  adding a `REEL` purpose and video-specific processing (transcoding) extends the
  existing `Media`/processing-job model rather than replacing it. Video transcoding is a
  materially bigger background-job workload than image variants, which is exactly why
  it's excluded from the MVP (`ARCHITECTURE.md` risk #4 already flags the in-process
  job runner as an MVP-only choice partly in anticipation of this).
- **Direct messaging**: a genuinely new domain (conversations/messages, likely needing
  its own read/delivery-state model); does not reuse existing tables, and is not
  designed here.
- **Push notifications**: the `Notification` table (`DATABASE.md` §3.10) already
  captures "what happened" independent of delivery mechanism; adding push is adding a
  delivery channel (device token registration + a push provider) that consumes the same
  notification-creation events, not a redesign of notifications themselves.
- **Real-time events** (live like/comment counts, live feed updates, DM delivery): the
  API is REST-only in the MVP by explicit non-goal; a future WebSocket/SSE gateway would
  sit alongside the REST API (Nest supports this natively via `@nestjs/websockets`) and
  would primarily push the same domain events already flowing through the background-job
  system, rather than requiring a new event model.
