-- Two gaps this closes.
--
-- 1. `handle_new_user` wrote `raw_user_meta_data->>'username'` verbatim. That
--    field is attacker-controlled: anyone holding the publishable key can POST
--    /auth/v1/signup with it directly and claim a reserved name like `admin`,
--    or any shape `usernameSchema` rejects. The app-side check never runs.
--
-- 2. The league child tables' RLS only asserted `auth.uid() = profileId`, which
--    the caller supplies. An authenticated PostgREST caller could therefore
--    insert rows pointing at another user's league or team, bypassing the
--    MAX_LEAGUES / MAX_WATCHLIST limits enforced in the server actions.

-- Single source of truth for the username rules, mirroring `usernameSchema` in
-- src/lib/auth/username.ts. IMMUTABLE so a CHECK constraint may call it.
CREATE OR REPLACE FUNCTION public.is_valid_username(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT value = lower(value)
     AND length(value) BETWEEN 3 AND 20
     AND value ~ '^[a-z0-9_]+$'
     AND value NOT IN (
       'admin', 'administrator', 'root', 'login', 'logout', 'signup', 'signin',
       'signout', 'auth', 'api', 'settings', 'account', 'profile',
       'courtvision', 'support'
     );
$$;

-- NOT VALID: enforced on every insert and update from here on without failing
-- the migration on any row that predates the rule.
ALTER TABLE public."Profile" DROP CONSTRAINT IF EXISTS "Profile_username_valid_check";
ALTER TABLE public."Profile"
  ADD CONSTRAINT "Profile_username_valid_check"
  CHECK (username IS NULL OR public.is_valid_username(username)) NOT VALID;

-- Reject a forged signup outright rather than seeding a profile with a name the
-- application would never have allowed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := NEW.raw_user_meta_data->>'username';
BEGIN
  IF requested IS NOT NULL AND NOT public.is_valid_username(requested) THEN
    RAISE EXCEPTION 'invalid username';
  END IF;

  INSERT INTO public."Profile" (id, email, username, "updatedAt")
  VALUES (NEW.id, NEW.email, requested, now());
  RETURN NEW;
END;
$$;

-- Child-table writes must prove the parent is owned by the caller too, not just
-- that the denormalized profileId matches.
DROP POLICY IF EXISTS "league_team_owner_insert" ON "LeagueTeam";
CREATE POLICY "league_team_owner_insert" ON "LeagueTeam" FOR INSERT
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "League" l
      WHERE l.id = "leagueId" AND l."profileId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "league_team_owner_update" ON "LeagueTeam";
CREATE POLICY "league_team_owner_update" ON "LeagueTeam" FOR UPDATE
  USING (auth.uid() = "profileId")
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "League" l
      WHERE l.id = "leagueId" AND l."profileId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "league_team_slot_owner_insert" ON "LeagueTeamSlot";
CREATE POLICY "league_team_slot_owner_insert" ON "LeagueTeamSlot" FOR INSERT
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "LeagueTeam" t
      WHERE t.id = "teamId" AND t."profileId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "league_team_slot_owner_update" ON "LeagueTeamSlot";
CREATE POLICY "league_team_slot_owner_update" ON "LeagueTeamSlot" FOR UPDATE
  USING (auth.uid() = "profileId")
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "LeagueTeam" t
      WHERE t.id = "teamId" AND t."profileId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "league_watchlist_owner_insert" ON "LeagueWatchlistPlayer";
CREATE POLICY "league_watchlist_owner_insert" ON "LeagueWatchlistPlayer" FOR INSERT
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "League" l
      WHERE l.id = "leagueId" AND l."profileId" = auth.uid()
    )
  );

-- The server connects as the Postgres role and bypasses RLS entirely, so no
-- anon/authenticated PostgREST client has a legitimate reason to write here.
-- The policies above stay as defense in depth.
REVOKE INSERT, UPDATE, DELETE ON "League" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON "LeagueTeam" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON "LeagueTeamSlot" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON "LeagueWatchlistPlayer" FROM anon, authenticated;
