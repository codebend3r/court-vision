import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

const SRC = join(import.meta.dir, "..");

// The native arrow of a select sits inside its padding, so a select styled like
// a text input draws it against the edge, clipped. The `control-select` mixin
// (or `control-field`, which includes it for a select) gives it the room, and
// this test holds every <select> in the app to using one of them, so a new
// dropdown cannot bring the clipped arrow back.
const sourceFiles = readdirSync(SRC, { recursive: true })
  .filter((entry): entry is string => typeof entry === "string")
  .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"));

type SelectUse = { file: string; className: string; stylesheet: string };

const selectsIn = ({ file }: { file: string }): SelectUse[] => {
  const source = readFileSync(join(SRC, file), "utf8");
  const stylesheet = /import styles from "@\/([^"]+\.module\.scss)"/.exec(source)?.[1] ?? "";
  return [...source.matchAll(/<select\b/g)].map(({ index }) => ({
    file,
    stylesheet,
    // The first class after the tag opens, before it closes.
    className:
      /className=\{styles\.(\w+)\}/.exec(
        source.slice(index, source.indexOf("</select>", index)),
      )?.[1] ?? "",
  }));
};

// The text of `.name { ... }`, braces balanced.
const ruleFor = ({ scss, className }: { scss: string; className: string }): string => {
  const start = new RegExp(`\\.${className}\\b[^{]*\\{`).exec(scss);
  if (start === null) return "";
  const open = start.index + start[0].length;
  const end = [...scss.slice(open)].reduce(
    (state, char, offset) => {
      if (state.end !== -1) return state;
      const depth = state.depth + (char === "{" ? 1 : char === "}" ? -1 : 0);
      return depth < 0 ? { depth, end: open + offset } : { ...state, depth };
    },
    { depth: 0, end: -1 },
  ).end;
  return scss.slice(open, end === -1 ? undefined : end);
};

const selects = sourceFiles.flatMap((file) => selectsIn({ file }));

describe("every <select>", () => {
  it("is found, so this test cannot pass by looking at nothing", () => {
    expect(selects.length).toBeGreaterThan(5);
  });

  it.each(selects.map((use) => [`${use.file} (${use.className})`, use] as const))(
    "%s has room for its arrow",
    (_name, use) => {
      expect(use.className).not.toBe("");
      expect(use.stylesheet).not.toBe("");
      const scss = readFileSync(join(SRC, use.stylesheet), "utf8");
      const rule = ruleFor({ scss, className: use.className });
      expect(rule).toMatch(/@include (control-select|control-field)\b/);
    },
  );
});
