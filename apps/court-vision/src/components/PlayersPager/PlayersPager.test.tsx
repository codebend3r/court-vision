import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ReactNode, use, useEffect, useState } from "react";

import { PlayersPager, type PlayersPagerProps } from "@/components/PlayersPager/PlayersPager";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(cleanup);

beforeEach(() => {
  replace.mockReset();
});

// A server render that never lands. Suspending on it inside the transition that
// called `replace` holds that transition pending, the way a cold /players query
// does, so the optimistic state is observable before the new props arrive.
const unresolvedNavigation = new Promise<never>(() => {});

function AwaitNavigation() {
  use(unresolvedNavigation);
  return null;
}

function PendingNavigation({ children }: { children: ReactNode }) {
  const [hasNavigated, setHasNavigated] = useState(false);
  useEffect(() => {
    replace.mockImplementation(() => setHasNavigated(true));
  }, []);
  return (
    <>
      {children}
      {hasNavigated && <AwaitNavigation />}
    </>
  );
}

const defaultProps: PlayersPagerProps = {
  q: "",
  page: 1,
  size: 50,
  totalPages: 1,
  sort: "pts",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
};

describe("PlayersPager", () => {
  it("navigates to the next page, preserving size", () => {
    render(<PlayersPager {...defaultProps} page={2} size={25} totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?page=3&size=25");
  });

  it("navigates to the previous page", () => {
    render(<PlayersPager {...defaultProps} page={2} totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Prev" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players");
  });

  it("preserves a non-default sort and dir on navigation", () => {
    render(<PlayersPager {...defaultProps} sort="lastName" dir="asc" totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?page=2&sort=lastName&dir=asc");
  });

  it("disables the Previous button on the first page", () => {
    render(<PlayersPager {...defaultProps} page={1} totalPages={3} />);

    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("disables the Next button on the last page", () => {
    render(<PlayersPager {...defaultProps} page={3} totalPages={3} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("changes the page size and resets to page 1, preserving other filters", () => {
    render(<PlayersPager {...defaultProps} page={4} range="last20" totalPages={9} />);

    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "25" } });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?size=25&range=last20");
  });

  it("labels the page size control", () => {
    render(<PlayersPager {...defaultProps} size={25} />);

    const select = screen.getByLabelText("Page size");
    expect(select).toHaveValue("25");
  });

  it("includes the tab when navigating to another page", () => {
    render(<PlayersPager {...defaultProps} tab="advanced" sort="pie" totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledWith("/players?page=2&tab=advanced");
  });

  it("leaves the status region empty when nothing is pending", () => {
    render(<PlayersPager {...defaultProps} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  describe("while the navigation is pending", () => {
    const renderPending = (props: Partial<PlayersPagerProps> = {}) =>
      render(
        <PendingNavigation>
          <PlayersPager {...defaultProps} {...props} />
        </PendingNavigation>,
      );

    // Awaited, as React asks when a render suspends inside the act scope.
    const click = async ({ name }: { name: string }) => {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
      });
    };

    it("shows the requested page immediately and announces it", async () => {
      renderPending({ page: 2, totalPages: 3 });

      await click({ name: "Next" });

      expect(replace).toHaveBeenCalledWith("/players?page=3");
      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveAttribute(
        "data-pending",
        "true",
      );
      expect(screen.getByRole("status")).toHaveTextContent("Loading page 3…");
    });

    it("advances from the requested page when Next is pressed again before it lands", async () => {
      renderPending({ page: 1, totalPages: 5 });

      await click({ name: "Next" });
      await click({ name: "Next" });

      expect(replace).toHaveBeenLastCalledWith("/players?page=3");
      expect(screen.getByText("Page 3 of 5")).toBeInTheDocument();
    });

    it("shows the chosen page size and drops the stale page total", async () => {
      renderPending({ page: 4, totalPages: 9 });

      await act(async () => {
        fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "25" } });
      });

      expect(replace).toHaveBeenCalledWith("/players?size=25");
      expect(screen.getByLabelText("Page size")).toHaveValue("25");
      // The total for the new size isn't known until the server answers, so the
      // count reads "Page 1" rather than the old size's "of 9".
      expect(screen.getByText("Page 1")).toBeInTheDocument();
      expect(screen.queryByText(/of 9/)).not.toBeInTheDocument();
    });
  });
});
