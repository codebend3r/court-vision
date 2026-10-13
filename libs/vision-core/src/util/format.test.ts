import { describe, expect, it } from "bun:test";

import {
  formatBirthDate,
  formatDraft,
  formatExperience,
  formatHeight,
  formatOrdinal,
  formatRate,
  formatSigned,
  formatWeight,
} from "#core/util/format";

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

describe("formatExperience", () => {
  it("counts seasons inclusively from the draft season", () => {
    expect(formatExperience({ draftYear: 2021, seasonStartYear: 2025 })).toBe("5 seasons");
  });

  it("labels a player drafted this season with a single season", () => {
    expect(formatExperience({ draftYear: 2025, seasonStartYear: 2025 })).toBe("1 season");
  });

  it("returns null for undrafted players and future draft years", () => {
    expect(formatExperience({ draftYear: null, seasonStartYear: 2025 })).toBeNull();
    expect(formatExperience({ draftYear: 2026, seasonStartYear: 2025 })).toBeNull();
  });
});

describe("formatOrdinal", () => {
  it("adds the right suffix", () => {
    expect(formatOrdinal({ value: 1 })).toBe("1st");
    expect(formatOrdinal({ value: 2 })).toBe("2nd");
    expect(formatOrdinal({ value: 3 })).toBe("3rd");
    expect(formatOrdinal({ value: 4 })).toBe("4th");
    expect(formatOrdinal({ value: 21 })).toBe("21st");
    expect(formatOrdinal({ value: 22 })).toBe("22nd");
    expect(formatOrdinal({ value: 30 })).toBe("30th");
  });

  it("uses th for the 11 to 13 exceptions", () => {
    expect(formatOrdinal({ value: 11 })).toBe("11th");
    expect(formatOrdinal({ value: 12 })).toBe("12th");
    expect(formatOrdinal({ value: 13 })).toBe("13th");
    expect(formatOrdinal({ value: 113 })).toBe("113th");
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

describe("formatSigned", () => {
  it("prefixes a plus on positive values at the requested precision", () => {
    expect(formatSigned({ value: 1.44, digits: 1 })).toBe("+1.4");
    expect(formatSigned({ value: 3, digits: 1 })).toBe("+3.0");
    expect(formatSigned({ value: 2.137, digits: 2 })).toBe("+2.14");
  });

  it("keeps the minus on negative values", () => {
    expect(formatSigned({ value: -2.06, digits: 1 })).toBe("-2.1");
    expect(formatSigned({ value: -0.4, digits: 2 })).toBe("-0.40");
  });

  it("leaves zero unsigned by default", () => {
    expect(formatSigned({ value: 0, digits: 1 })).toBe("0.0");
  });

  it("signs zero when asked", () => {
    expect(formatSigned({ value: 0, digits: 2, signZero: true })).toBe("+0.00");
    expect(formatSigned({ value: -1, digits: 2, signZero: true })).toBe("-1.00");
  });

  it("prints whole numbers with zero digits", () => {
    expect(formatSigned({ value: 7, digits: 0 })).toBe("+7");
    expect(formatSigned({ value: -3, digits: 0 })).toBe("-3");
  });
});

describe("formatRate", () => {
  it("drops the leading zero of a sub-one rate", () => {
    expect(formatRate({ value: 0.48 })).toBe(".480");
    expect(formatRate({ value: 0.0456 })).toBe(".046");
    expect(formatRate({ value: 0 })).toBe(".000");
  });

  it("keeps the whole-number digit of a perfect rate", () => {
    expect(formatRate({ value: 1 })).toBe("1.000");
  });
});
