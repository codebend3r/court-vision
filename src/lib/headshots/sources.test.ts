import { describe, expect, it, vi } from "vitest";

import { fetchNbaPlayerIndex, NBA_DATA_PY_URL } from "@/lib/headshots/sources";

// Mirrors the real nba_api `data.py` shape: a flat
// `players = [[id, lastName, firstName, fullName, isActive], ...]` block, plus
// unrelated trailing blocks (`wnba_players`, `teams`) that must NOT be parsed.
const extraRows = Array.from({ length: 4200 }, (_, index) => {
  const id = 900000 + index;
  return `    [${id}, "Filler${index}", "Player", "Player Filler${index}", False],`;
}).join("\n");

const dataPySource = `player_index_id = 0

players = [
    [1629029, "Dončić", "Luka", "Luka Dončić", True],
    [406, "O'Neal", "Shaquille", "Shaquille O'Neal", False],
${extraRows}
]

wnba_players = [
    [999999999, "ShouldNotMatch", "WNBA", "WNBA ShouldNotMatch", True],
]

teams = [
    [1610612747, "Lakers"],
]
`;

const textResponse = (body: string, init: { status?: number } = {}): Response =>
  new Response(body, { status: init.status ?? 200 });

describe("fetchNbaPlayerIndex", () => {
  it("fetches the nba_api data.py fallback and parses id + full name rows", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse(dataPySource));

    const rows = await fetchNbaPlayerIndex({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(NBA_DATA_PY_URL);
    expect(rows).toContainEqual({ personId: 1629029, fullName: "Luka Dončić" });
    expect(rows).toContainEqual({ personId: 406, fullName: "Shaquille O'Neal" });
    expect(rows).not.toContainEqual(expect.objectContaining({ fullName: "WNBA ShouldNotMatch" }));
    expect(rows.length).toBeGreaterThan(4000);
  });

  it("throws when the fetch response is not ok", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(textResponse("nope", { status: 500 }));

    await expect(fetchNbaPlayerIndex({ fetchImpl })).rejects.toThrow(/500/);
  });

  it("throws when the parsed row count looks implausibly small", async () => {
    const smallSource = `players = [\n    [1629029, "Dončić", "Luka", "Luka Dončić", True],\n]\n`;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse(smallSource));

    await expect(fetchNbaPlayerIndex({ fetchImpl })).rejects.toThrow(/rows/);
  });
});
