import { pathToFileURL } from "node:url";

// Bun sets `import.meta.main` on the entry module, but @types/node's ImportMeta
// doesn't declare it, bun-types conflicts with the DOM `fetch` typings the tests
// rely on, and augmenting ImportMeta needs declaration merging via an interface,
// which this repo forbids. Comparing the module URL against the entry script
// path answers the same question with standard Node typings.
type IsMainModuleProps = { moduleUrl: string; argv?: readonly string[] };

export const isMainModule = (args: IsMainModuleProps): boolean => {
  const { moduleUrl, argv = process.argv } = args;
  const entry = argv[1] ?? "";
  return !!entry && moduleUrl === pathToFileURL(entry).href;
};
