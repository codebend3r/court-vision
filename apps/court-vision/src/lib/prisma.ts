import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@generated/prisma/client";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting the database connection pool. The global is typed via declaration
// merging so we never cast (see CLAUDE.md TypeScript rules). Prisma 7 requires a
// driver adapter; the empty-string fallback lets this module load without a live
// database in the current no-DB scaffold.
declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
