import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("renders the Court Vision wordmark linking home", () => {
    render(<SiteHeader />);
    const wordmark = screen.getByRole("link", { name: "Court Vision" });
    expect(wordmark).toHaveAttribute("href", "/");
  });
});
