# Features

Functional specification for the 17 MVP features, two implemented post-MVP features
(Direct Messages, Milestone 21; Realtime Transport, Milestone 22), one planned
post-MVP feature (Consistent Visual Design, Milestones 23–26), plus explicit notes on
how the architecture anticipates the remaining future features. Each feature lists: summary, core
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

### 7. Image Posts (implemented Milestone 11)

- A post has 1..N images, an optional caption, optional free-text location.
- Created only from `READY` media the poster owns (enforced server-side, §6 of
  `API.md`), preventing posts referencing someone else's or still-processing media.
- **Out of scope**: video posts (future — see below), draft posts, scheduled posts.
- Entities/endpoints: `Post`, `PostMedia`, `Media` (`DATABASE.md` §3.3–3.5),
  `POST /posts`, `GET /posts/:id` (`API.md` §7).

### 8. Multiple Images Per Post (implemented Milestone 11)

- Carousel of up to 10 images per post (matching Instagram's own limit), ordered by the
  `position` the client specifies at creation time.
- **Deviation**: mobile's post detail screen renders a real swipeable, paged carousel
  (`FlatList` with `pagingEnabled`); web's post detail page renders every image in the
  carousel as a plain stacked list instead of a swipeable widget — building a
  from-scratch swipe/drag carousel in plain React (no carousel library is in this
  repo's dependency tree, and adding one wasn't judged worth it for one milestone's
  detail page) was deferred as a small, low-risk follow-up rather than blocking this
  milestone. All images are still present, in the correct `position` order, on both
  platforms — only the _browsing interaction_ differs.
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

### 10. Home Feed (implemented Milestone 12)

- Reverse-chronological posts from accounts the current user follows, paginated by
  cursor.
- Each feed item shows author, media carousel, caption, like/comment counts, and
  like/comment/save affordances inline. As of Milestone 12, counts are still the
  hardcoded-`0`/stubbed `PostResponse` fields Milestone 11 introduced (real once
  `Like`/`Comment`/`SavedPost` land in Milestones 13–15) — the feed itself, and every
  field's final shape, is real now; only the like/comment/save _values_ remain stubs,
  the same stub-now-fill-later pattern `PublicProfileResponse` used from Milestone 8
  through 11.
- **Explicit MVP scope decision, confirmed as-implemented**: no algorithmic ranking —
  chronological only. Fan-out computed at read time (`DATABASE.md` §6, §10;
  `ARCHITECTURE.md` risk #3, now marked "exercised").
- **Out of scope**: "New posts" live-update banner (would need realtime transport, out
  of scope per `ARCHITECTURE.md` non-goals), showing your own posts in your own feed
  (implemented as decided: **no**, matching Instagram — a real, tested consequence of
  `Follow` never containing a self-edge, not special-cased logic).
- Entities/endpoints: `GET /feed` (`API.md` §7).

### 11. Likes (implemented Milestone 13)

- Like/unlike a post; like count and "liked by me" state shown everywhere a post
  appears (feed, post detail). Profile grid tiles (`PostSummary`) deliberately don't
  show it — a grid tile is a thumbnail-only shape (`docs/API.md` §7), not a full post
  card; opening the post shows the real count.
- **Deviation, deliberately not implemented this milestone**: liking does not
  currently generate a `Notification` for the post's author. `docs/IMPLEMENTATION_PLAN.md`
  M13 explicitly offered pulling Milestone 16's whole `Notification` table/enqueue/
  consumer/list-endpoint/UI forward as an alternative to deferring it — building all
  of that as a side effect of "Likes" would mean implementing most of a different,
  much larger milestone early, so it was deferred to Milestone 16 as the plan's other
  sanctioned option (see `docs/PROGRESS.md`'s Milestone 13 deviations for the full
  reasoning). The like feature itself is functionally complete without it.
- **Out of scope**: liking comments (schema/API note it explicitly as future — would be
  a new `CommentLike` table, structurally identical to `Like`), seeing "liked by X and Y
  others" phrasing beyond a simple liker list/count.
- Entities/endpoints: `Like` (`DATABASE.md` §3.7), `PUT`/`DELETE
/posts/:postId/like`, `GET /posts/:postId/likes` (`API.md` §8).

### 12. Comments (implemented Milestone 14)

- Flat (non-threaded) comments on a post, paginated oldest-first. Rendered on the post
  detail page only, not the feed — a comment thread doesn't fit a feed card's compact
  shape the way the like button does; `PostCard`'s comments count is just a link to the
  post detail page from the feed.
- **Deviation, deliberately not implemented this milestone**: commenting does not
  currently generate a `Notification` for the post's author, for the identical reason
  Milestone 13 recorded for likes (`docs/PROGRESS.md`'s Milestone 13 deviations) —
  deferred to Milestone 16 in full rather than implementing `Notification`'s whole
  table/enqueue/consumer/list-endpoint/UI as a side effect of "Comments." The comment
  feature itself is functionally complete without it.
- Either the comment's author or the post's author may delete a comment (standard
  moderation baseline) — implemented as a real two-way authorization check, the first
  one this codebase needed (every prior delete endpoint checked a single owner).
- **Explicit MVP scope decision, confirmed as-implemented**: `Comment.parentCommentId`
  exists in the schema (`DATABASE.md` §3.8) but the API never accepts it from clients
  in the MVP — comments are flat. Threaded replies are additive later (new API field +
  UI), not a schema change.
- **Out of scope**: comment likes, @mentions-as-links within comments, comment editing
  (delete-and-recreate is the MVP workflow for corrections).
- Entities/endpoints: `Comment`, `POST`/`GET/DELETE
/posts/:postId/comments` (`API.md` §9).

### 13. Saved Posts (implemented Milestone 15)

- Bookmark a post privately (not visible to other users, matching Instagram's own
  "Saved" behavior); view your saved posts in a dedicated list.
- **Out of scope**: save collections/folders (a single flat saved list for MVP).
- Entities/endpoints: `SavedPost` (`DATABASE.md` §3.9), `PUT`/`DELETE
/posts/:postId/save`, `GET /me/saved` (`API.md` §10).

### 14. User Search (implemented Milestone 17)

- Search by username/full name, returns a ranked top-`limit` list of matching users —
  not paginated (no "page 2" of search results in the MVP; see `API.md` §11 for why
  trigram similarity ranking doesn't fit this codebase's keyset-cursor convention).
- Backed by Postgres `pg_trgm` similarity search (`DATABASE.md` §5, §6) — good enough
  for MVP scale, not a general-purpose search engine (see `ARCHITECTURE.md` risk #7).
- Debounced search input on both web and mobile (300ms) — the first debounced input
  in this codebase.
- **Out of scope**: searching posts by caption text, hashtag search, search history/
  suggestions.
- Entities/endpoints: `GET /search/users?q=` (`API.md` §11).

### 15. Explore Page (implemented Milestone 18)

- A grid of posts from accounts the current user does not follow (and never the
  viewer's own posts), to aid discovery.
- MVP ranking: like count (descending) within a 7-day recency window, `createdAt`/`id`
  tiebreak, computed live — not a personalized ML feed. Paginated with a real,
  stable keyset cursor.
- **Out of scope**: personalization beyond the simple heuristic, topic/category
  browsing, video content.
- Entities/endpoints: `GET /explore` (`API.md` §11).

### 16. Notifications (implemented Milestone 16)

- In-app notification list for follows, likes, and comments received, with an unread
  badge count.
- Realtime-pushed over SSE (`ARCHITECTURE.md` §5.4, implemented Milestone 22 — this
  was poll-based at this feature's own original Milestone 16 implementation): a
  pushed event increments the badge immediately, with a REST re-fetch on every
  (re)connect so a client that was briefly disconnected is never silently wrong.
  Marking as read happens on opening the notifications screen.
- Generated asynchronously via a background job (`ARCHITECTURE.md` §8/§12 risk #10),
  not written synchronously on the triggering request, so a burst of engagement on one
  post can't slow down the like/comment/follow endpoints themselves.
- **Out of scope**: push notifications (explicitly future — see below), email digest
  notifications, per-notification-type mute settings (a coarser global setting could be
  added under Account Settings later).
- Entities/endpoints: `Notification` (`DATABASE.md` §3.10), `GET /notifications`,
  `GET /notifications/unread-count`, `POST /notifications/mark-read` (`API.md` §12).

### 17. Account Settings (implemented Milestone 19)

- Edit profile fields (name, bio, website, `isPrivate` toggle — the toggle exists and
  is user-facing even though it has no follow-approval effect yet, see Feature 5's
  scope note), change password, change email, delete account (soft delete).
- Changing password bumps `User.tokenVersion`, invalidating access tokens on all other
  devices/sessions (they'll fail auth and be forced to re-login) — not just the
  presented refresh token, which only affects future refreshes. In practice this means
  change-password also revokes every other refresh-token family outright (not just the
  tokenVersion bump): a device that still held a valid refresh token could otherwise
  silently mint a fresh access token and never actually be forced to re-login. The
  _calling_ session gets a brand-new token pair in the response, so it's the one
  device that's never interrupted.
- Changing email and deleting the account both require re-entering the current
  password first (the same defense-in-depth change-password already needed) — deleting
  the account is this codebase's first genuinely destructive, irreversible-from-the-UI
  action, so both web and mobile also require an explicit confirmation checkbox/switch
  before the delete button is enabled.
- Deleting an account only soft-deletes the `User` row and revokes every session — it
  does not cascade to hide that account's existing posts/comments/likes from feed,
  explore, or other users' profiles (only the account's own profile and search
  disappear). Not a gap: `docs/IMPLEMENTATION_PLAN.md` M19's own test wording only
  calls for "soft-deleted users disappear from public reads (profile, search)."
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

## Post-MVP Features (implemented)

The 17 MVP features above are what this document originally specified; Milestone 20
(the MVP's own closing milestone) explicitly designated itself as the point to pick
the next feature, and Milestone 21 shipped it. Numbered on from the MVP list for a
single continuous reference, even though it's a later addition, not part of the
original 17.

### 18. Direct Messages (implemented Milestone 21)

- 1:1 conversations only in this MVP — start a conversation with another user by
  username (idempotent: messaging someone you already have a conversation with
  returns the existing one), then send/receive text messages in it.
- An inbox (newest-activity-first) and a per-conversation thread view, on both web
  and mobile — a `Conversation`/`ConversationParticipant`/`Message` schema designed
  to support group chat later without a breaking migration, even though nothing in
  the MVP ever creates a group.
- New-message detection is realtime-pushed over SSE (implemented Milestone 22 — see
  Feature 19 below; this was poll-based at this feature's own original Milestone 21
  implementation, matching `Notification`'s then-current MVP choice).
- Read receipts: a message's `readAt` is set once the other participant views the
  thread; the inbox surfaces this as a per-conversation unread count.
- **Out of scope**: group chat (schema allows it, nothing implements it), message
  editing/deletion, media attachments in messages, typing indicators, message
  reactions, blocking a user from messaging you (no block/mute feature exists
  anywhere in this codebase yet, per Feature 17's own scope note).
- Entities/endpoints: `Conversation`, `ConversationParticipant`, `Message`
  (`DATABASE.md` §3.11), `POST /conversations`, `GET /conversations`, `GET
/conversations/:id`, `GET /conversations/:id/messages`, `POST
/conversations/:id/messages` (`API.md` §17).

### 19. Realtime Transport (implemented Milestone 22)

- Retrofits Feature 16's unread badge and Feature 18's new-message detection with a
  real push transport: a connected client sees a new notification or message the
  instant it happens, with no polling.
- Server-Sent Events, not WebSocket — both consumers are purely server→client
  pushes, nothing sends over the realtime channel itself (every mutation already
  goes through the existing REST endpoints), so a one-directional transport is a
  complete fit, not a compromise. Full reasoning: `ARCHITECTURE.md` §5.4.
- REST stays authoritative: a client re-fetches the relevant REST endpoint on every
  connect/reconnect to catch up on anything missed while disconnected, rather than
  treating the stream as a guaranteed-delivery channel.
- **Out of scope**: typing indicators, presence/online status, read-receipt push
  (a message's `readAt` is still only visible on the next REST fetch of that
  thread) — none of this milestone's two consumers need them, and adding them
  would be the point to revisit SSE vs. WebSocket, not before.
- Entities/endpoints: `GET /events` (`API.md` §18); no new database entities — the
  pushed payload reuses `NotificationResponse`/`MessageResponse` verbatim
  (`packages/validation/src/lib/realtime.ts`).

## Post-MVP Features (planned)

### 20. Consistent Visual Design (planned, Milestones 23–26)

- Every web page and mobile screen gets a finished, Instagram-like visual design,
  replacing today's unstyled HTML (web) and ad-hoc `StyleSheet`s (mobile).
- **Web**: Material UI v9 components plus Tailwind CSS v4 for layout. **Mobile**: the
  closest equivalents, React Native Paper v5 components plus NativeWind v4 (Tailwind
  for React Native) for layout. The same Material icon set and the same font (Inter)
  are used on both.
- **As similar as possible across apps**: one `packages/design-tokens` package defines
  every color, font size, spacing step and corner radius. Both apps build their themes
  from it, and a fixed component parity map (`ARCHITECTURE.md` §5.5) pairs each UI
  element with its MUI and Paper counterpart. Navigation still follows each platform's
  convention: a left rail / bottom bar on web, a tab bar on mobile.
- Requirements:
  - An app shell with primary navigation (Home, Search, Explore, Messages,
    Notifications with an unread badge, Create, Profile, Settings).
  - Styled auth, feed, post, profile, explore, search, notification, saved, messages
    and settings screens.
  - Consistent loading, empty and error states.
  - Visible focus states on web, touch targets of at least 48 dp on mobile, and WCAG
    AA text contrast.
- Behavior doesn't change. Every action, label and accessible name stays the same, so
  existing end-to-end tests keep passing.
- **Out of scope**: dark mode (the tokens are structured so it can be added later),
  animations beyond the libraries' built-in ones, a shared web/mobile component
  library (`ARCHITECTURE.md` §6), i18n/RTL layouts, and any new feature behavior.
- Entities/endpoints: none. This is presentation only, with no database or API
  changes.

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
- **Direct messaging**: **implemented in Milestone 21 — see "Post-MVP Features
  (implemented)" below.** (This bullet originally described it as a not-yet-designed
  future feature; it's kept here, corrected, rather than deleted, so this section's
  own history stays legible.)
- **Push notifications**: the `Notification` table (`DATABASE.md` §3.10) already
  captures "what happened" independent of delivery mechanism; adding push is adding a
  delivery channel (device token registration + a push provider) that consumes the same
  notification-creation events, not a redesign of notifications themselves.
  **Scheduled as Milestone 27**, after the styling track (Feature 20).
- **Real-time events** (live like/comment counts, live feed updates): **notifications
  and DM delivery are implemented in Milestone 22 — see "Post-MVP Features
  (implemented)" Feature 19 above.** (This bullet originally described realtime as a
  not-yet-designed future feature for those two; kept here, corrected, rather than
  deleted.) Live like/comment counts on the feed/post-detail views remain out of
  scope — nothing currently pushes those over the Milestone 22 SSE channel, and
  extending it to them would be a new producer on the existing `EventsService`, not
  a transport redesign.
