import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "bun:test";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";

afterEach(cleanup);

describe("AccountMenu", () => {
  it("shows the username and reveals sign out on click", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    // A menuitem, not a button: inside role="menu" a plain button is skipped
    // entirely by assistive tech in menu mode.
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("moves focus into the menu on open", async () => {
    render(<AccountMenu username="steve" />);
    await userEvent.click(screen.getByRole("button", { name: /@steve/i }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    await userEvent.click(trigger);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("points the trigger at the menu it controls", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toHaveAttribute("id", trigger.getAttribute("aria-controls"));
  });

  it("shows a Settings menu item that links to /settings and closes the menu on click", async () => {
    render(<AccountMenu username="steve" />);
    await userEvent.click(screen.getByRole("button", { name: /@steve/i }));
    const settingsLink = screen.getByRole("menuitem", { name: "Settings" });
    expect(settingsLink).toHaveAttribute("href", "/settings");
    await userEvent.click(settingsLink);
    expect(screen.queryByRole("menuitem", { name: "Settings" })).not.toBeInTheDocument();
  });
});
