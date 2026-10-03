import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { LinkPending } from "#ui/components/LinkPending/LinkPending";

const linkStatus = vi.fn(() => ({ pending: false }));

vi.mock("next/link", () => ({
  useLinkStatus: () => linkStatus(),
}));

afterEach(cleanup);

beforeEach(() => {
  linkStatus.mockReset();
  linkStatus.mockReturnValue({ pending: false });
});

describe("LinkPending", () => {
  it("renders no spinner and an empty status region while idle", () => {
    const { container } = render(<LinkPending announcement="Sorting by PTS, descending" />);

    expect(container.querySelector("[data-pending]")).toBeNull();
    // Mounted empty up front: a live region only announces changes, so it has
    // to exist before the pending text arrives.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows a decorative spinner that flags the page as pending", () => {
    linkStatus.mockReturnValue({ pending: true });

    const { container } = render(<LinkPending announcement="Sorting by PTS, descending" />);

    const spinner = container.querySelector("[data-pending]");
    expect(spinner).toHaveAttribute("data-pending", "true");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(spinner).toHaveClass("spinner");
  });

  it("announces the navigation to screen readers while pending", () => {
    linkStatus.mockReturnValue({ pending: true });

    render(<LinkPending announcement="Sorting by PTS, descending" />);

    expect(screen.getByRole("status")).toHaveTextContent("Sorting by PTS, descending");
  });
});
