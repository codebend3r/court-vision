import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import { isRecord } from "@vision/core/util/record";

// CI's setup-bun reads `packageManager`, but Netlify ignores it and installs
// with its image's bun unless BUN_VERSION says otherwise (on 2026-11-07 its
// 1.3.12 hoisted the wrong copy of a dependency and failed every deploy). So each
// site's netlify.toml repeats the version, and this keeps the copies in step.
const ROOT = resolve(import.meta.dir, "..");

type NetlifyBunVersionProps = { path: string };
const netlifyBunVersion = async ({ path }: NetlifyBunVersionProps): Promise<unknown> => {
  const config: unknown = Bun.TOML.parse(await Bun.file(resolve(ROOT, path)).text());
  const build = isRecord(config) ? config.build : undefined;
  const environment = isRecord(build) ? build.environment : undefined;
  return isRecord(environment) ? environment.BUN_VERSION : undefined;
};

describe("Netlify bun version", () => {
  it("pins every netlify.toml to the packageManager bun", async () => {
    const manifest: unknown = await Bun.file(resolve(ROOT, "package.json")).json();
    const packageManager = isRecord(manifest) ? String(manifest.packageManager) : "";
    const [, expected] = packageManager.split("@");
    const paths = [
      "netlify.toml",
      ...(await Array.fromAsync(new Bun.Glob("apps/*/netlify.toml").scan({ cwd: ROOT }))),
    ];

    expect(expected).toMatch(/^\d+\.\d+\.\d+$/);
    expect(paths.length).toBeGreaterThan(1);
    const versions = await Promise.all(
      paths.map(async (path) => ({ path, version: await netlifyBunVersion({ path }) })),
    );
    expect(versions).toEqual(paths.map((path) => ({ path, version: expected })));
  });
});
