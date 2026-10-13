import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { MAIN_CONTENT_ID, SkipLink } from "#ui/components/SkipLink/SkipLink";

afterEach(cleanup);

describe("SkipLink", () => {
  it("links past the header to the main content wrapper", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      `#${MAIN_CONTENT_ID}`,
    );
  });
});
