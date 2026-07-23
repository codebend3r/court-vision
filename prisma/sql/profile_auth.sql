-- Case-insensitive uniqueness (source of truth; wins races).
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_username_lower_key"
  ON public."Profile" (lower(username));

-- Seed a Profile row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."Profile" (id, email, username, "updatedAt")
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'username',
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: defense-in-depth. Server reads via postgres (bypasses RLS).
ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile owner can read" ON public."Profile";
CREATE POLICY "Profile owner can read" ON public."Profile"
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profile owner can update" ON public."Profile";
CREATE POLICY "Profile owner can update" ON public."Profile"
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Column-level UPDATE privileges. RLS gates the ROW (owner-only) but not which
-- COLUMNS change, so the owner-update policy alone would let any signed-in user
-- PATCH their own `tier` (entitlements), `email`, or `username` (reserved-name
-- bypass) straight through the public anon key + PostgREST. Restrict client
-- writes to `displayName` only; `tier`/`email`/`username` are written solely by
-- server code via the postgres role (Prisma), which bypasses these grants.
REVOKE UPDATE ON public."Profile" FROM anon, authenticated;
GRANT UPDATE ("displayName") ON public."Profile" TO authenticated;
