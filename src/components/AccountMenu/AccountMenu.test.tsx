import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

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
});
