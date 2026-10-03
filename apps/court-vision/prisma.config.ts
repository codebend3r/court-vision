import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma 7 CLI configuration. The datasource URL moved here from schema.prisma.
// Prefer the direct connection for migrations; the transaction pooler used by
// the application cannot reliably run Prisma's migration advisory locks.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
