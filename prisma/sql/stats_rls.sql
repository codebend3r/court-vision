-- Public NBA stat tables: anon-read RLS.
--
-- These tables hold public NBA stats served to the browser via the Supabase
-- anon key, so a permissive SELECT policy is intentional. RLS itself must be
-- enabled on every table in the `public` schema or Supabase flags it as
-- `rls_disabled_in_public` (anyone with the project URL could read/write it).
--
-- Idempotent and the source of truth: re-run after any `prisma migrate reset`
-- so a rebuilt schema never loses these policies. Server reads go through the
-- postgres role (Prisma), which bypasses RLS regardless.

-- Player
ALTER TABLE public."Player" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_player" ON public."Player";
CREATE POLICY "anon_read_player" ON public."Player"
  FOR SELECT TO anon, authenticated USING (true);

-- PlayerSeasonStats
ALTER TABLE public."PlayerSeasonStats" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_season_stats" ON public."PlayerSeasonStats";
CREATE POLICY "anon_read_season_stats" ON public."PlayerSeasonStats"
  FOR SELECT TO anon, authenticated USING (true);

-- PlayerGameLog
ALTER TABLE public."PlayerGameLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_game_log" ON public."PlayerGameLog";
CREATE POLICY "anon_read_game_log" ON public."PlayerGameLog"
  FOR SELECT TO anon, authenticated USING (true);

-- PlayerAdvancedGameLog
ALTER TABLE public."PlayerAdvancedGameLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_advanced_game_log" ON public."PlayerAdvancedGameLog";
CREATE POLICY "anon_read_advanced_game_log" ON public."PlayerAdvancedGameLog"
  FOR SELECT TO anon, authenticated USING (true);
