import { describe, expect, it } from "bun:test";

import { balanceText, formatScore, ownerText } from "@/lib/advisor/format";

describe("formatScore", () => {
  it("signs to one place", () => {
    expect(formatScore({ value: 1.56 })).toBe("+1.6");
    expect(formatScore({ value: -3.94 })).toBe("-3.9");
  });

  it("never prints a negative zero", () => {
    expect(formatScore({ value: -0.04 })).toBe("0.0");
    expect(formatScore({ value: 0.04 })).toBe("0.0");
    expect(formatScore({ value: 0 })).toBe("0.0");
  });
});

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
