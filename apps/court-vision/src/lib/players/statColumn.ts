import { type AdvancedStatMeta } from "@/lib/players/advancedStatMeta";
import { type AdvancedSortKey, type PlayerSortKey } from "@/lib/players/searchParams";

// Each stat column pairs its sort key with how to read the value, so the
// header link and the body cell always agree on which column is highlighted.
// `meta` gives a column its header tooltip and spoken full name. Lives apart
// from PlayersTable so a client module can type its columns without importing
// the table, and through it the database client.
export type StatColumn<Row> = {
  label: string;
  sortKey: PlayerSortKey | AdvancedSortKey;
  meta?: AdvancedStatMeta;
  cell: (row: Row) => string;
  // The number the cell shows, which a sort reads; null where it shows a dash.
  valueOf: (row: Row) => number | null;
};
