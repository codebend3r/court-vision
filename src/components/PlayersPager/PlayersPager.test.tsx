import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayersPager, type PlayersPagerProps } from "@/components/PlayersPager/PlayersPager";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(cleanup);

beforeEach(() => {
  replace.mockClear();
});

const defaultProps: PlayersPagerProps = {
  q: "",
  page: 1,
  size: 50,
  includeRetired: false,
  totalPages: 1,
  sort: "firstName",
  dir: "desc",
  range: "all",
  mode: "average",
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

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

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

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables the Next button on the last page", () => {
    render(<PlayersPager {...defaultProps} page={3} totalPages={3} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
