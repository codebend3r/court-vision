-- A watchlist is personal: unlike the stats tables, this one is NOT
-- anon-readable. Prisma connects as the Postgres role and bypasses RLS; these
-- policies close the anon-key path.
alter table "WatchlistPlayer" enable row level security;

create policy "watchlist_owner_select" on "WatchlistPlayer"
  for select using (auth.uid() = "profileId");

create policy "watchlist_owner_insert" on "WatchlistPlayer"
  for insert with check (auth.uid() = "profileId");

create policy "watchlist_owner_delete" on "WatchlistPlayer"
  for delete using (auth.uid() = "profileId");
