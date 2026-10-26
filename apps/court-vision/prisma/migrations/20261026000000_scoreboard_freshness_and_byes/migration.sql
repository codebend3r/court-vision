-- A bye still has team totals; only its opponent is absent.
ALTER TABLE "LeagueMatchup" ALTER COLUMN "teamBId" DROP NOT NULL;

-- Existing scoreboard rows have unknown freshness, not the league's roster sync time.
ALTER TABLE "LeagueMatchup" ADD COLUMN "syncedAt" TIMESTAMP(3);
