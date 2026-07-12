import { describe, expect, it } from "vitest";

import { formatBirthDate, formatDraft, formatHeight, formatWeight } from "@/lib/players/format";

describe("formatHeight", () => {
  it("formats inches as feet and inches", () => {
    expect(formatHeight({ heightInches: 79 })).toBe(`6'7"`);
  });

  it("handles exact-foot heights", () => {
    expect(formatHeight({ heightInches: 84 })).toBe(`7'0"`);
  });

  it("returns null for null or non-positive values", () => {
    expect(formatHeight({ heightInches: null })).toBeNull();
    expect(formatHeight({ heightInches: 0 })).toBeNull();
  });
});

describe("formatWeight", () => {
  it("appends the unit", () => {
    expect(formatWeight({ weightLbs: 220 })).toBe("220 lb");
  });

  it("returns null for null or non-positive values", () => {
    expect(formatWeight({ weightLbs: null })).toBeNull();
    expect(formatWeight({ weightLbs: 0 })).toBeNull();
  });
});

describe("formatBirthDate", () => {
  it("formats the date in UTC", () => {
    expect(formatBirthDate({ birthDate: new Date("1994-12-06T00:00:00Z") })).toBe("Dec 6, 1994");
  });

  it("returns null when absent", () => {
    expect(formatBirthDate({ birthDate: null })).toBeNull();
  });
});

describe("formatDraft", () => {
  it("joins year, round, and pick", () => {
    expect(formatDraft({ draftYear: 2020, draftRound: 1, draftNumber: 5 })).toBe(
      "2020 · Rd 1 · Pick 5",
    );
  });

  it("drops missing round and pick", () => {
    expect(formatDraft({ draftYear: 2020, draftRound: null, draftNumber: null })).toBe("2020");
  });

  it("returns null without a draft year", () => {
    expect(formatDraft({ draftYear: null, draftRound: 1, draftNumber: 5 })).toBeNull();
  });
});
