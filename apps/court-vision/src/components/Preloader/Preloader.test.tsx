import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { Preloader } from "@/components/Preloader/Preloader";

afterEach(cleanup);

describe("Preloader", () => {
  it("announces itself as a status region with a default label", () => {
    render(<Preloader />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading page");
  });

  it("uses the provided label", () => {
    render(<Preloader label="Loading players" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading players");
  });

  it("hides the skeleton blocks from assistive tech", () => {
    const { container } = render(<Preloader lines={6} />);
    const blocks = container.querySelector("[aria-hidden='true']");
    expect(blocks).not.toBeNull();
    expect(blocks?.childElementCount ?? 0).toBe(6);
  });
});
