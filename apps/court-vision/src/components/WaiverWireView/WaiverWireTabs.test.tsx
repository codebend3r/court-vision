import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { WaiverWireTabs } from "@/components/WaiverWireView/WaiverWireTabs";
import { type WaiverView } from "@/lib/waiverWire/searchParams";

afterEach(cleanup);

const panels: Record<WaiverView, string> = {
  available: "available panel",
  swap: "swap panel",
  h2h: "head-to-head panel",
  cut: "cut line panel",
};

// The tabs are controlled; this harness owns the selection like the view does.
type OnChangeProps = { view: WaiverView };

type HarnessProps = {
  initial: WaiverView;
  onChange: ({ view }: OnChangeProps) => void;
};

function Harness({ initial, onChange }: HarnessProps) {
  const [view, setView] = useState<WaiverView>(initial);
  return (
    <WaiverWireTabs
      view={view}
      onChange={({ view: next }) => {
        onChange({ view: next });
        setView(next);
      }}
      panels={{
        available: <p>{panels.available}</p>,
        swap: <p>{panels.swap}</p>,
        h2h: <p>{panels.h2h}</p>,
        cut: <p>{panels.cut}</p>,
      }}
    />
  );
}

type RenderTabsProps = { initial?: WaiverView };

const renderTabs = ({ initial = "available" }: RenderTabsProps = {}) => {
  const onChange = vi.fn<({ view }: OnChangeProps) => void>();
  render(<Harness initial={initial} onChange={onChange} />);
  return { onChange };
};

describe("WaiverWireTabs", () => {
  it("follows the WAI-ARIA tabs pattern", () => {
    renderTabs({ initial: "h2h" });

    const tablist = screen.getByRole("tablist", { name: "Compare players" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Available players",
      "Swap board",
      "Head-to-head",
      "Cut line",
    ]);

    const selected = screen.getByRole("tab", { name: "Head-to-head" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.tabIndex).toBe(0);
    ["Available players", "Swap board", "Cut line"].map((name) => {
      const tab = screen.getByRole("tab", { name });
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab.tabIndex).toBe(-1);
    });

    const panel = screen.getByRole("tabpanel", { name: "Head-to-head" });
    // A generic element takes the role; a <section> would have its own overridden.
    expect(panel.tagName).toBe("DIV");
    expect(panel).toHaveAttribute("aria-labelledby", selected.id);
    expect(selected).toHaveAttribute("aria-controls", panel.id);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(within(panel).getByText(panels.h2h)).toBeInTheDocument();
    expect(screen.queryByText(panels.swap)).not.toBeInTheDocument();
    expect(screen.queryByText(panels.cut)).not.toBeInTheDocument();
  });

  it("moves with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const { onChange } = renderTabs({ initial: "cut" });

    await user.click(screen.getByRole("tab", { name: "Cut line" }));
    await user.keyboard("{ArrowRight}");
    const first = screen.getByRole("tab", { name: "Available players" });
    expect(onChange).toHaveBeenLastCalledWith({ view: "available" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Available players" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Cut line" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith({ view: "cut" });

    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith({ view: "available" });

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Cut line" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith({ view: "cut" });

    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Head-to-head" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(panels.h2h)).toBeInTheDocument();
  });

  it("selects a tab on click", async () => {
    const user = userEvent.setup();
    const { onChange } = renderTabs();

    await user.click(screen.getByRole("tab", { name: "Cut line" }));

    expect(onChange).toHaveBeenLastCalledWith({ view: "cut" });
    expect(screen.getByRole("tabpanel", { name: "Cut line" })).toBeInTheDocument();
  });
});
