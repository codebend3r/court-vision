import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ComponentProps } from "react";

const linkStatus = vi.fn(() => ({ pending: false }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useLinkStatus: () => linkStatus(),
}));

import { StatViewTabs, type StatViewTabEntry } from "#ui/components/StatViewTabs/StatViewTabs";

const ENTRIES: StatViewTabEntry[] = [
  { key: "regular", href: "/players", label: "Regular Stats", isActive: true },
  { key: "advanced", href: "/players?tab=advanced", label: "Advanced Stats", isActive: false },
];

afterEach(cleanup);

beforeEach(() => {
  linkStatus.mockReset();
  linkStatus.mockReturnValue({ pending: false });
});

describe("StatViewTabs", () => {
  it("renders one link per view in a labelled nav, the active one current", () => {
    render(<StatViewTabs label="Stat views" entries={ENTRIES} />);

    const nav = screen.getByRole("navigation", { name: "Stat views" });
    const active = within(nav).getByRole("link", { name: "Regular Stats" });
    const other = within(nav).getByRole("link", { name: "Advanced Stats" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-active", "true");
    expect(other).toHaveAttribute("href", "/players?tab=advanced");
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).not.toHaveAttribute("data-active");
  });

  it("shows no spinner while no tab is navigating", () => {
    const { container } = render(<StatViewTabs label="Stat views" entries={ENTRIES} />);

    expect(container.querySelector("[data-pending]")).toBeNull();
    screen.getAllByRole("status").map((region) => expect(region).toBeEmptyDOMElement());
  });

  it("spins and announces the view a clicked tab is loading", () => {
    linkStatus.mockReturnValue({ pending: true });

    render(<StatViewTabs label="Stat views" entries={ENTRIES.slice(1)} />);

    const link = screen.getByRole("link", { name: /^Advanced Stats/ });
    expect(link.querySelector('[data-pending="true"]')).toHaveAttribute("aria-hidden", "true");
    expect(within(link).getByRole("status")).toHaveTextContent("Loading Advanced Stats");
  });
});
