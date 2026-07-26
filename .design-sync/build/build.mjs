// design-sync build: produce the browser dist the package-shape converter
// consumes. Two steps:
//   1. Vite lib build -> ds-dist/index.mjs + ds-dist/style.css (SCSS compiled,
//      react externalized, next/* shimmed).
//   2. tsc declaration emit -> types/**/*.d.ts, the shipped type tree the
//      converter reads for each component's <Name>Props contract.
// Step 2 is best-effort: tsc emits declarations even when the app's wider type
// graph has errors, so a non-zero exit there must not fail the build.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const buildDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(buildDir, "..", "..");
const bin = (name) => resolve(repoRoot, "node_modules", ".bin", name);

const run = (cmd, args, { tolerant = false } = {}) => {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit" });
  if (r.status !== 0 && !tolerant) {
    console.error(`\n[ds-build] ${cmd} ${args.join(" ")} failed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  return r.status;
};

run(bin("vite"), ["build", "--config", resolve(buildDir, "vite.config.mts")]);
run(bin("tsc"), ["-p", resolve(buildDir, "tsconfig.ds.json")], { tolerant: true });
console.error("[ds-build] done: ds-dist/ + types/");
