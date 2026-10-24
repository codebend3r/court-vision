import { describe, expect, it } from "bun:test";

import { type StatColumn } from "@/lib/players/statColumn";
import { type PlayerIdentity } from "@/lib/players/identity";
import { buildRosterTable } from "@/lib/roster/table";

type Row = PlayerIdentity & { pts: number | null };

const row = ({ id, pts }: { id: number; pts: number | null }): Row => ({
  id,
  firstName: "A",
  lastName: `P${id}`,
  fullName: `A P${id}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: 100 + id,
  pts,
});

const columns: StatColumn<Row>[] = [
  {
    label: "PTS",
    sortKey: "pts",
    cell: ({ pts }) => pts?.toFixed(1) ?? "—",
    valueOf: ({ pts }) => pts,
  },
];

describe("buildRosterTable", () => {
  const table = buildRosterTable({
    rows: [
      { slotLabel: "PG", row: row({ id: 1, pts: 28.5 }) },
      { slotLabel: "IL", row: row({ id: 2, pts: null }) },
    ],
    columns,
  });

  it("names each column by its sort key and label", () => {
    expect(table.columns).toEqual([{ key: "pts", label: "PTS", title: undefined }]);
  });

  it("carries the spoken name of an advanced stat as the header's title", () => {
    const [column] = buildRosterTable({
      rows: [],
      columns: [
        {
          label: "PIE",
          sortKey: "pie",
          meta: {
            key: "pie",
            label: "PIE",
            fullName: "Player Impact Estimate",
            description: "",
            formula: "",
            kind: "percentage",
          },
          cell: () => "",
          valueOf: () => null,
        },
      ],
    }).columns;
    expect(column?.title).toBe("Player Impact Estimate");
  });

  it("keeps each row's slot and identity", () => {
    expect(table.rows.map(({ id, slotLabel, fullName }) => [id, slotLabel, fullName])).toEqual([
      [1, "PG", "A P1"],
      [2, "IL", "A P2"],
    ]);
  });

  it("pairs every cell's text with the number a sort reads", () => {
    expect(table.rows.map((entry) => entry.cells)).toEqual([
      [{ text: "28.5", value: 28.5 }],
      [{ text: "—", value: null }],
    ]);
  });

  it("holds only plain data, so it can cross to a client component", () => {
    expect(JSON.parse(JSON.stringify(table))).toEqual(JSON.parse(JSON.stringify(table)));
    expect(Object.values(table.rows[0] ?? {}).some((value) => typeof value === "function")).toBe(
      false,
    );
  });
});
