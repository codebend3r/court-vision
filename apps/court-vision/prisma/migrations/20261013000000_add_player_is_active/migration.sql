-- Team rosters used "has a game log this season" as the roster test, which
-- hides rookies and new signings until they play. `sync:players` now marks
-- the players on Balldontlie's /v1/players/active list instead.

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;
