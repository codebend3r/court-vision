import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "bun:test";

import { AccountMenu } from "./AccountMenu";

afterEach(cleanup);

describe("AccountMenu", () => {
  it("shows the username and reveals sign out on click", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
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
