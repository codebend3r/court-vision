import { beforeEach, describe, expect, it } from "vitest";

import { useStatModeStore } from "@/lib/stats/modeStore";
import { DEFAULT_MODE } from "@/lib/stats/searchParams";

// The store is a module-level singleton, so reset it between tests.
beforeEach(() => {
  useStatModeStore.setState({ mode: DEFAULT_MODE });
});

describe("useStatModeStore", () => {
  it("starts at the default mode", () => {
    expect(useStatModeStore.getState().mode).toBe(DEFAULT_MODE);
  });

  it("remembers the picked mode", () => {
    useStatModeStore.getState().setMode({ mode: "per36" });

    expect(useStatModeStore.getState().mode).toBe("per36");
  });
});
