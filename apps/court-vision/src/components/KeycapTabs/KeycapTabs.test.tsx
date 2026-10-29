import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "bun:test";

import { KeycapTabs } from "@/components/KeycapTabs/KeycapTabs";

afterEach(cleanup);

const TABS = ["one", "two", "three"] as const;
type Tab = (typeof TABS)[number];

const LABELS: Record<Tab, string> = { one: "One", two: "Two", three: "Three" };

function Harness() {
  const [view, setView] = useState<Tab>("one");
  return (
    <KeycapTabs
      label="Views"
      tabs={TABS}
      labels={LABELS}
      view={view}
      onChange={({ view: next }) => setView(next)}
      panels={{ one: <p>first</p>, two: <p>second</p>, three: <p>third</p> }}
    />
  );
}

describe("KeycapTabs", () => {
  it("renders only the selected panel, labelled by its tab", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "One" }).textContent).toBe("first");
    expect(screen.queryByText("second")).toBeNull();
  });

  it("switches on click and moves with the arrow keys, wrapping", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("second");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tabpanel").textContent).toBe("third");
  });
});
