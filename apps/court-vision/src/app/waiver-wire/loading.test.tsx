import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { WAIVER_WIRE_PAGE_HEADER } from "@/app/waiver-wire/header";
import Loading from "@/app/waiver-wire/loading";

afterEach(cleanup);

describe("waiver wire loading boundary", () => {
  it("keeps the real page heading while the pool loads", () => {
    render(<Loading />);
    expect(
      screen.getByRole("heading", { level: 1, name: WAIVER_WIRE_PAGE_HEADER.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the Waiver Wire");
  });
});
