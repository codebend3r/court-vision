-- Leagues are personal. Prisma connects as the Postgres role and bypasses RLS;
-- these policies close the anon-key path for all four league tables.
alter table "League" enable row level security;
create policy "league_owner_select" on "League" for select using (auth.uid() = "profileId");
create policy "league_owner_insert" on "League" for insert with check (auth.uid() = "profileId");
create policy "league_owner_update" on "League" for update using (auth.uid() = "profileId");
create policy "league_owner_delete" on "League" for delete using (auth.uid() = "profileId");

alter table "LeagueTeam" enable row level security;
create policy "league_team_owner_select" on "LeagueTeam" for select using (auth.uid() = "profileId");
create policy "league_team_owner_insert" on "LeagueTeam" for insert with check (auth.uid() = "profileId");
create policy "league_team_owner_update" on "LeagueTeam" for update using (auth.uid() = "profileId");
create policy "league_team_owner_delete" on "LeagueTeam" for delete using (auth.uid() = "profileId");

alter table "LeagueTeamSlot" enable row level security;
create policy "league_team_slot_owner_select" on "LeagueTeamSlot" for select using (auth.uid() = "profileId");
create policy "league_team_slot_owner_insert" on "LeagueTeamSlot" for insert with check (auth.uid() = "profileId");
create policy "league_team_slot_owner_update" on "LeagueTeamSlot" for update using (auth.uid() = "profileId");
create policy "league_team_slot_owner_delete" on "LeagueTeamSlot" for delete using (auth.uid() = "profileId");

alter table "LeagueWatchlistPlayer" enable row level security;
create policy "league_watchlist_owner_select" on "LeagueWatchlistPlayer" for select using (auth.uid() = "profileId");
create policy "league_watchlist_owner_insert" on "LeagueWatchlistPlayer" for insert with check (auth.uid() = "profileId");
create policy "league_watchlist_owner_delete" on "LeagueWatchlistPlayer" for delete using (auth.uid() = "profileId");
