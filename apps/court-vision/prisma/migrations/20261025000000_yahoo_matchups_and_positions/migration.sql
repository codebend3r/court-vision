-- AlterTable
ALTER TABLE "League" ADD COLUMN     "statCategories" JSONB;

-- AlterTable
ALTER TABLE "LeagueTeamSlot" ADD COLUMN     "displayPosition" TEXT;

-- AlterTable
ALTER TABLE "LeagueWaiverPlayer" ADD COLUMN     "displayPosition" TEXT;

-- CreateTable
CREATE TABLE "LeagueMatchup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "week" INTEGER NOT NULL,
    "weekStart" TEXT,
    "weekEnd" TEXT,
    "status" TEXT,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "statsA" JSONB NOT NULL,
    "statsB" JSONB NOT NULL,

    CONSTRAINT "LeagueMatchup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueMatchup_leagueId_idx" ON "LeagueMatchup"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueMatchup_profileId_idx" ON "LeagueMatchup"("profileId");

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatchup" ADD CONSTRAINT "LeagueMatchup_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security, as for the waiver pool: owners may read their own rows;
-- the server (which bypasses RLS) is the only writer.
ALTER TABLE public."LeagueMatchup" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_matchup_owner_select" ON public."LeagueMatchup";
CREATE POLICY "league_matchup_owner_select" ON public."LeagueMatchup" FOR SELECT
  USING (auth.uid() = "profileId");

REVOKE INSERT, UPDATE, DELETE ON public."LeagueMatchup" FROM anon, authenticated;
