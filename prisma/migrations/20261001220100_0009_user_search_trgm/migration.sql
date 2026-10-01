-- Trigram similarity search for User Search (docs/DATABASE.md §5/§6, Milestone 17).
-- Hand-added, same as citext in migration 0001 — `prisma migrate diff` has no
-- schema-DSL representation for enabling an extension itself, only for the
-- indexes/columns that depend on one already being enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users" USING GIN ("username" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_full_name_idx" ON "users" USING GIN ("full_name" gin_trgm_ops);

-- `pg_trgm`'s default similarity threshold (0.3) is too strict for the
-- documented 2-character minimum query length: e.g. similarity('alice',
-- 'al') = 0.2857, just under the default cutoff, so a legitimate 2-char
-- prefix match would silently return zero results with the default
-- threshold. Lowered to 0.1 at the database level (confirmed empirically
-- against seeded data: still correctly excludes unrelated queries, e.g.
-- similarity('bob', 'zzqx') never clears 0.1) so the `%` operator's match/
-- no-match decision in search.service.ts's query actually behaves the way
-- the 2-character minimum implies it should. `current_database()` via a
-- dynamic DO block, not a literal database name, so this migration applies
-- correctly regardless of what the database is actually named in any given
-- environment.
DO $$ BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET pg_trgm.similarity_threshold = 0.1',
    current_database()
  );
END $$;

