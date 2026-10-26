import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

export const USERNAME_RETRY_SECONDS = 60;
export const USERNAME_RATE_LIMIT_MESSAGE = "Too many username checks. Try again in a minute.";

type UsernameRateKeyProps = { netlify: boolean; clientIp: string | null };

// Netlify supplies this header; untrusted forwarding headers never create new buckets.
export const usernameRateKey = ({ netlify, clientIp }: UsernameRateKeyProps): string => {
  const identity = netlify && clientIp !== null && !!isIP(clientIp) ? clientIp : "shared";
  return `username:${createHash("sha256").update(identity).digest("hex")}`;
};

export const allowUsernameAttempt = async (): Promise<boolean> => {
  try {
    const requestHeaders = await headers();
    const key = usernameRateKey({
      netlify: process.env.NETLIFY === "true",
      clientIp: requestHeaders.get("x-nf-client-connection-ip"),
    });
    await prisma.$executeRaw`DELETE FROM "RequestRateLimit" WHERE key IN (
      SELECT key FROM "RequestRateLimit" WHERE "expiresAt" <= CURRENT_TIMESTAMP FOR UPDATE SKIP LOCKED
    )`;
    // A global ceiling still applies if clients can vary or forge their IP identity.
    const rows = await prisma.$queryRaw<{ key: string }[]>`
      WITH global_budget AS (
        INSERT INTO "RequestRateLimit" (key, attempts, "expiresAt")
        VALUES ('username:global', 1, CURRENT_TIMESTAMP + INTERVAL '1 minute')
        ON CONFLICT (key) DO UPDATE SET attempts = "RequestRateLimit".attempts + 1
        WHERE "RequestRateLimit".attempts < 1000
        RETURNING key
      )
      INSERT INTO "RequestRateLimit" (key, attempts, "expiresAt")
      SELECT ${key}, 1, CURRENT_TIMESTAMP + INTERVAL '1 minute' FROM global_budget
      ON CONFLICT (key) DO UPDATE SET attempts = "RequestRateLimit".attempts + 1
      WHERE "RequestRateLimit".attempts < 30
      RETURNING key
    `;
    return rows.length === 1;
  } catch (error) {
    console.error("Username rate limit failed", error);
    return false;
  }
};
