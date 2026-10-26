ALTER TABLE "League"
  ADD COLUMN "syncStartedAt" TIMESTAMP(3),
  ADD COLUMN "syncLeaseUntil" TIMESTAMP(3);

CREATE TABLE "RequestRateLimit" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL CHECK ("attempts" > 0),
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RequestRateLimit_expiresAt_idx" ON "RequestRateLimit" ("expiresAt");
ALTER TABLE "RequestRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RequestRateLimit" FROM anon, authenticated;
