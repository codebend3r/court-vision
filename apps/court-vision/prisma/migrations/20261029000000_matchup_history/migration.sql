-- Matchups are now kept for every week of the season, read and replaced by week.
CREATE INDEX "LeagueMatchup_leagueId_week_idx" ON "LeagueMatchup"("leagueId", "week");
