-- Auth database: the account's role (#8, #9).
-- Applied by `npm run db:migrate:auth` after 0001. Idempotent, like every file in this folder.
--
-- The role is chosen once, at registration (`SignUp`), and is never changed by a later request:
-- Better Auth's `/update-user` path is disabled (create-auth.ts). Accounts created before this
-- migration were all parents, so the default backfills them. A value outside the closed set is
-- refused by the database; the actor provider also treats an unknown value as signed out.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'parent';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_check') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('parent', 'teacher'));
  END IF;
END
$$;
