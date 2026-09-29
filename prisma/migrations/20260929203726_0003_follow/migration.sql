-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id"),
    -- Prisma's schema DSL has no portable `@@check` attribute, so this is added
    -- by hand (docs/DATABASE.md §3.6) — self-follows are also rejected in
    -- `FollowsService` for a clean 409, but the DB-level constraint is the real
    -- backstop against any future write path that skips that check.
    CONSTRAINT "follows_no_self_follow" CHECK ("follower_id" <> "following_id")
);

-- CreateIndex
CREATE INDEX "follows_following_id_follower_id_idx" ON "follows"("following_id", "follower_id");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

