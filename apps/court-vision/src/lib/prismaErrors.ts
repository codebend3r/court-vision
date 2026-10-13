import { isRecord } from "@vision/core/util/record";

// Prisma's known-request error codes the actions branch on.
export const PRISMA_UNIQUE_VIOLATION = "P2002";
export const PRISMA_RECORD_NOT_FOUND = "P2025";

// Duck-typed rather than `instanceof`, so it holds for whichever Prisma
// runtime threw the error.
export const hasPrismaCode = ({ error, code }: { error: unknown; code: string }): boolean =>
  isRecord(error) && error.code === code;
