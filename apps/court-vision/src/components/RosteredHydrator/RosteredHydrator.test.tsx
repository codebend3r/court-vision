import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { RosteredHydrator } from "@/components/RosteredHydrator/RosteredHydrator";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>() });
});

afterEach(cleanup);

describe("RosteredHydrator", () => {
  it("seeds the rostered store from the server's ids and renders nothing", () => {
    const { container } = render(<RosteredHydrator playerIds={[115, 237]} />);

    expect([...useRosteredStore.getState().playerIds]).toEqual([115, 237]);
    expect(container).toBeEmptyDOMElement();
  });

  it("re-seeds when a refresh hands it a new list", () => {
    const { rerender } = render(<RosteredHydrator playerIds={[115]} />);

    rerender(<RosteredHydrator playerIds={[237]} />);

    expect([...useRosteredStore.getState().playerIds]).toEqual([237]);
  });
});
