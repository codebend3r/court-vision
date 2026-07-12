-- AlterTable
ALTER TABLE "Player"
ADD COLUMN "heightInches" INTEGER,
ADD COLUMN "weightLbs" INTEGER,
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "college" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "draftYear" INTEGER,
ADD COLUMN "draftRound" INTEGER,
ADD COLUMN "draftNumber" INTEGER;
