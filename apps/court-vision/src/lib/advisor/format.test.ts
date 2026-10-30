import { describe, expect, it } from "bun:test";

import { balanceText, ownerText } from "@/lib/advisor/format";

describe("ownerText", () => {
  it("names the team, or says where a free player is", () => {
    expect(
      ownerText({ owner: { kind: "team", teamId: "t", teamName: "Two", managerName: null } }),
    ).toBe("Two");
    expect(ownerText({ owner: { kind: "waivers" } })).toBe("On waivers");
    expect(ownerText({ owner: { kind: "free_agent" } })).toBe("Free agent");
    expect(ownerText({ owner: { kind: "mine" } })).toBe("Your team");
  });
});

describe("balanceText", () => {
  it("says who a trade favors, and by how much", () => {
    expect(balanceText({ balance: -5.08 })).toBe("5.1 value in your favor");
    expect(balanceText({ balance: 2.9 })).toBe("2.9 value in their favor");
    expect(balanceText({ balance: 0.04 })).toBe("Even on value");
  });
});
