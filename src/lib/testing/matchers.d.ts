import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// `bun.setup.ts` registers the jest-dom matchers at runtime; this teaches
// bun:test's `expect` about them at the type level.
//
// This is the one place in the repo that declares an `interface` instead of a
// type alias (see CLAUDE.md). Bun exposes `Matchers<T>` as an interface
// specifically as a module-augmentation extension point, and TypeScript has no
// type-alias equivalent for declaration merging — the augmentation is only
// expressible this way.
declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type
  interface Matchers<T = unknown> extends TestingLibraryMatchers<T, void> {}
}
