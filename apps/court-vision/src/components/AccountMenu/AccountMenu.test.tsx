import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "bun:test";

import { AccountMenu } from "@/components/AccountMenu/AccountMenu";

afterEach(cleanup);

const openMenu = async () => {
  render(
    <>
      <AccountMenu username="steve" />
      <button type="button">Elsewhere</button>
    </>,
  );
  const trigger = screen.getByRole("button", { name: /@steve/i });
  await userEvent.click(trigger);
  return trigger;
};

describe("AccountMenu", () => {
  it("shows the username and reveals sign out on click", async () => {
    render(<AccountMenu username="steve" />);
    const trigger = screen.getByRole("button", { name: /@steve/i });
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("is a disclosure of plain links, not an ARIA menu", async () => {
    const trigger = await openMenu();

    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("moves focus into the panel on open", async () => {
    await openMenu();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveFocus();
  });

  it("keeps Tab inside the open panel", async () => {
    await openMenu();
    const settings = screen.getByRole("link", { name: "Settings" });
    const signOut = screen.getByRole("button", { name: /sign out/i });

    await userEvent.tab();
    expect(signOut).toHaveFocus();
    await userEvent.tab();
    expect(settings).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(signOut).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = await openMenu();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("closes on a pointer down outside it", async () => {
    await openMenu();

    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("points the trigger at the panel it controls", async () => {
    const trigger = await openMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panelId = trigger.getAttribute("aria-controls") ?? "";
    expect(document.getElementById(panelId)).toContainElement(
      screen.getByRole("link", { name: "Settings" }),
    );
  });

  it("links Settings to /settings and closes the panel on click", async () => {
    await openMenu();
    const settingsLink = screen.getByRole("link", { name: "Settings" });
    expect(settingsLink).toHaveAttribute("href", "/settings");

    await userEvent.click(settingsLink);

    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });
});
