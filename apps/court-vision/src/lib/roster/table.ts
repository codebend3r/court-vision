import { type StatColumn } from "@/lib/players/statColumn";
import { type PlayerIdentity } from "@/lib/players/identity";
import { type RosterRow } from "@/lib/roster/members";

// The roster table as plain data. The page builds it on the server, where the
// columns' functions live, and hands the client table only what it shows and
// sorts on: a function cannot cross from a server component to a client one.
export type RosterTableColumn = {
  key: string;
  label: string;
  // The spoken full name of an advanced stat, shown as the header's tooltip.
  title: string | undefined;
};

export type RosterTableCell = {
  text: string;
  // What a sort reads; null where the cell shows a dash.
  value: number | null;
};

export type RosterTableRow = {
  id: number;
  slotLabel: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  cells: RosterTableCell[];
};

export type RosterTable = { columns: RosterTableColumn[]; rows: RosterTableRow[] };

export const buildRosterTable = <Row extends PlayerIdentity>({
  rows,
  columns,
}: {
  rows: readonly RosterRow<Row>[];
  columns: readonly StatColumn<Row>[];
}): RosterTable => ({
  columns: columns.map((column) => ({
    key: column.sortKey,
    label: column.label,
    title: column.meta?.fullName,
  })),
  rows: rows.map(({ slotLabel, row }) => ({
    id: row.id,
    slotLabel,
    fullName: row.fullName,
    teamAbbr: row.teamAbbr,
    position: row.position,
    nbaPersonId: row.nbaPersonId,
    cells: columns.map((column) => ({ text: column.cell(row), value: column.valueOf(row) })),
  })),
});
