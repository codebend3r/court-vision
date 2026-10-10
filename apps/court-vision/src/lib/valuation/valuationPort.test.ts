import { afterEach, describe, expect, it } from "bun:test";

import { createValuationPort } from "@/lib/valuation/valuationPort";

const NativeWorker: unknown = Reflect.get(globalThis, "Worker");

afterEach(() => {
  Reflect.set(globalThis, "Worker", NativeWorker);
});

describe("createValuationPort", () => {
  it("returns null where there is no Worker, as in the server render", () => {
    Reflect.deleteProperty(globalThis, "Worker");

    expect(createValuationPort()).toBeNull();
  });

  it("returns null when the worker cannot start", () => {
    Reflect.set(
      globalThis,
      "Worker",
      class {
        constructor() {
          throw new Error("blocked by policy");
        }
      },
    );

    expect(createValuationPort()).toBeNull();
  });
});
