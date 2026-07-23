import { PrismaClient } from "@generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting the database connection pool. The global is typed via declaration
// merging so we never cast (see CLAUDE.md TypeScript rules). Prisma 7 requires a
// driver adapter; the empty-string fallback lets this module load without a live
// database in the current no-DB scaffold.
declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });

export const prisma = globalThis.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
