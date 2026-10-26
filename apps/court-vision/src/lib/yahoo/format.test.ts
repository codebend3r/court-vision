import { describe, expect, it } from "bun:test";

import { formatSyncedAgo } from "@/lib/yahoo/format";

const NOW = new Date("2026-10-17T12:00:00.000Z");

type BeforeProps = { seconds: number };

const before = ({ seconds }: BeforeProps): string =>
  new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("formatSyncedAgo", () => {
  it("says a league that has never synced was never synced", () => {
    expect(formatSyncedAgo({ syncedAt: null, now: NOW })).toBe("Never synced");
  });

  it("says just now for a sync under a minute old", () => {
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 59 }), now: NOW })).toBe(
      "Synced just now",
    );
  });

  it("says just now for a sync stamped a moment after now", () => {
    expect(formatSyncedAgo({ syncedAt: before({ seconds: -5 }), now: NOW })).toBe(
      "Synced just now",
    );
  });

  it("counts whole minutes under an hour", () => {
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 60 }), now: NOW })).toBe(
      "Synced 1 min ago",
    );
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 4 * 60 + 30 }), now: NOW })).toBe(
      "Synced 4 min ago",
    );
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 59 * 60 + 59 }), now: NOW })).toBe(
      "Synced 59 min ago",
    );
  });

  it("counts whole hours under a day", () => {
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 60 * 60 }), now: NOW })).toBe(
      "Synced 1 h ago",
    );
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 2 * 60 * 60 + 59 }), now: NOW })).toBe(
      "Synced 2 h ago",
    );
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 24 * 60 * 60 - 1 }), now: NOW })).toBe(
      "Synced 23 h ago",
    );
  });

  it("counts whole days from a day on", () => {
    expect(formatSyncedAgo({ syncedAt: before({ seconds: 24 * 60 * 60 }), now: NOW })).toBe(
      "Synced 1 d ago",
    );
    expect(
      formatSyncedAgo({ syncedAt: before({ seconds: 3 * 24 * 60 * 60 + 600 }), now: NOW }),
    ).toBe("Synced 3 d ago");
  });

  it("treats an unreadable timestamp as never synced", () => {
    expect(formatSyncedAgo({ syncedAt: "not a date", now: NOW })).toBe("Never synced");
  });
});
