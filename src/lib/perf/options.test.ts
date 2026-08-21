import { describe, expect, it } from "bun:test";

import { parseCheckOptions } from "@/lib/perf/options";

const parse = (args: Parameters<typeof parseCheckOptions>[0]) => parseCheckOptions(args);

describe("parseCheckOptions", () => {
  it("falls back to the default base url", () => {
    expect(parse({ argv: [], databaseUrl: "postgres://x" }).baseUrl).toBe("http://localhost:46644");
  });

  it("prefers PERF_BASE_URL over the default", () => {
    expect(
      parse({ argv: [], perfBaseUrl: "http://example.test", databaseUrl: "postgres://x" }).baseUrl,
    ).toBe("http://example.test");
  });

  it("prefers the flag over PERF_BASE_URL", () => {
    expect(
      parse({
        argv: ["--base-url=http://flag.test"],
        perfBaseUrl: "http://env.test",
        databaseUrl: "postgres://x",
      }).baseUrl,
    ).toBe("http://flag.test");
  });

  it("keeps a base url containing an equals sign intact", () => {
    expect(parse({ argv: ["--base-url=http://x.test/?a=b"], databaseUrl: "x" }).baseUrl).toBe(
      "http://x.test/?a=b",
    );
  });

  it("ignores arguments it does not recognise", () => {
    const options = parse({ argv: ["--verbose", "extra"], databaseUrl: "postgres://x" });
    expect(options).toEqual({ baseUrl: "http://localhost:46644", skipDbRoutes: false });
  });

  it("measures database routes when a DATABASE_URL is present", () => {
    expect(parse({ argv: [], databaseUrl: "postgres://x" }).skipDbRoutes).toBe(false);
  });

  it("skips database routes when DATABASE_URL is absent or empty", () => {
    expect(parse({ argv: [] }).skipDbRoutes).toBe(true);
    expect(parse({ argv: [], databaseUrl: "" }).skipDbRoutes).toBe(true);
  });

  it("skips database routes on --skip-db even with a DATABASE_URL", () => {
    expect(parse({ argv: ["--skip-db"], databaseUrl: "postgres://x" }).skipDbRoutes).toBe(true);
  });
});
