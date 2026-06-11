import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma 7 CLI configuration. The datasource URL moved here from schema.prisma.
// We read DATABASE_URL directly (loaded via dotenv) with an empty-string fallback
// so `prisma generate` works in this no-database scaffold; commands that actually
// connect (e.g. `prisma migrate`) require a real DATABASE_URL in `.env`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
