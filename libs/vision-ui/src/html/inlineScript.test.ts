import { describe, expect, it } from "bun:test";

import { inlineScriptLiteral } from "#ui/html/inlineScript";

describe("inlineScriptLiteral", () => {
  it("leaves plain JSON untouched", () => {
    expect(inlineScriptLiteral(["dark", "light", "amber-crt"])).toBe(
      '["dark","light","amber-crt"]',
    );
  });

  it("cannot close the surrounding script element", () => {
    const literal = inlineScriptLiteral(["</script><script>alert(1)</script>"]);
    expect(literal).not.toContain("</script>");
    expect(literal).not.toContain("<");
  });

  it("escapes the line terminators JSON leaves raw", () => {
    expect(inlineScriptLiteral("a\u2028b\u2029c")).toBe('"a\\u2028b\\u2029c"');
  });

  it("still evaluates back to the original value", () => {
    const value = ["</script>", "a\u2028b", 'q"uote', "back\\slash"];
    expect(new Function(`return ${inlineScriptLiteral(value)};`)()).toEqual(value);
  });
});
