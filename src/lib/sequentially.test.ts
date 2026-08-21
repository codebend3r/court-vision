import { describe, expect, it } from "bun:test";

import { sequentially } from "@/lib/sequentially";

describe("sequentially", () => {
  it("returns results in input order", async () => {
    const result = await sequentially({
      items: [1, 2, 3],
      run: async ({ item }) => item * 2,
    });
    expect(result).toEqual([2, 4, 6]);
  });

  it("passes the index alongside the item", async () => {
    const result = await sequentially({
      items: ["a", "b"],
      run: async ({ item, index }) => `${index}:${item}`,
    });
    expect(result).toEqual(["0:a", "1:b"]);
  });

  // The whole reason this helper exists: overlapping runs would measure
  // contention rather than the thing being measured.
  it("never overlaps two runs", async () => {
    const running: number[] = [];
    const peak: number[] = [];
    await sequentially({
      items: [1, 2, 3, 4],
      run: async ({ item }) => {
        running.push(item);
        peak.push(running.length);
        await Promise.resolve();
        running.pop();
        return item;
      },
    });
    expect(Math.max(...peak)).toBe(1);
  });

  it("returns an empty array for no items without calling run", async () => {
    const calls: number[] = [];
    const result = await sequentially({
      items: [],
      run: async ({ index }) => {
        calls.push(index);
        return index;
      },
    });
    expect(result).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("rejects with the first failure and stops there", async () => {
    const seen: number[] = [];
    const attempt = sequentially({
      items: [1, 2, 3],
      run: async ({ item }) => {
        seen.push(item);
        if (item === 2) throw new Error("boom");
        return item;
      },
    });
    await expect(attempt).rejects.toThrow("boom");
    expect(seen).toEqual([1, 2]);
  });
});
