-- Season-scoped reads (leaderboard ranking, team and valuation loaders) filter
-- on season/seasonType alone. The existing unique indexes lead with playerId,
-- so none of those queries could use one and every read fell back to a scan.

-- CreateIndex
CREATE INDEX "PlayerSeasonStats_season_seasonType_idx" ON "PlayerSeasonStats"("season", "seasonType");

-- CreateIndex
CREATE INDEX "PlayerGameLog_season_seasonType_idx" ON "PlayerGameLog"("season", "seasonType");
