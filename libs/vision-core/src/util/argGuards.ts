// Runtime guards for server action arguments.
//
// A "use server" export is a public HTTP endpoint whose action id ships in the
// client bundle. Next.js deserializes the argument object straight from the
// request body, and the TypeScript annotations on that object are erased at
// build time, so nothing stops a caller from sending `{ not: "" }` where a
// `string` is declared.
//
// That matters because Prisma reads an object in a scalar `where` slot as a
// filter: `where: { id: { not: "" } }` is valid and matches nearly everything,
// silently converting a scoped query into an unscoped one. Every action
// argument that reaches a `where` clause must therefore be checked at runtime,
// not just typed.

export const isActionId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const isOptionalActionId = (value: unknown): value is string | null =>
  value === null || isActionId(value);

export const isActionInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

export const isActionText = (value: unknown): value is string => typeof value === "string";

// Array arguments get dereferenced (`.length`, `.every`) before the action's
// try block in several places, where a non-array escapes as an unhandled 500
// rather than a result union. Check the shape before touching it.
export const isActionArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);
