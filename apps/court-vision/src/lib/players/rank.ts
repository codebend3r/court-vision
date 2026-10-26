import { type SortDirection } from "@/lib/players/searchParams";

// What every ranked list needs to know about a row to search and name-sort it.
export type NamedRow = { id: number; firstName: string; lastName: string; fullName: string };

export type NameSortKey = "firstName" | "lastName";

export const isNameSort = (sort: string): sort is NameSortKey =>
  sort === "firstName" || sort === "lastName";

// One page of an ordered list, with the total it was cut from.
export type Page<Row> = { rows: Row[]; total: number; page: number };

// A stat sort's key for one row. A `sink` row (below a qualifying minimum, or
// missing the stat entirely) falls to the bottom whatever the direction, so
// leaders are real leaders.
export type SortValue = { value: number; sink: boolean };

// How a value sort breaks a tie: by name (last, first, then id), or by id
// alone for a list whose order must not move when a name is spelled
// differently.
export type ValueTiebreak = "name" | "id";

export type RankOrder<Row> =
  | { by: "name"; sort: NameSortKey }
  | { by: "value"; valueOf: (row: Row) => SortValue; tiebreak?: ValueTiebreak };

// One collator for every name comparison: String#localeCompare builds its
// collation state per call, which dominates a 1,500-row sort.
const collator = new Intl.Collator();

// Name sorts order by the chosen name, then the other name, in the requested
// direction; id breaks exact ties ascending so paging is stable.
type CompareByNameProps = {
  a: NamedRow;
  b: NamedRow;
  sort: NameSortKey;
  dir: SortDirection;
};

export const compareByName = ({ a, b, sort, dir }: CompareByNameProps): number => {
  const primary = (row: NamedRow): string => (sort === "lastName" ? row.lastName : row.firstName);
  const secondary = (row: NamedRow): string => (sort === "lastName" ? row.firstName : row.lastName);
  const difference =
    collator.compare(primary(a), primary(b)) || collator.compare(secondary(a), secondary(b));
  return (dir === "asc" ? difference : -difference) || a.id - b.id;
};

// Stat-sort ties fall back to last name, first name, id, always ascending.
type CompareByNameAscendingProps = { a: NamedRow; b: NamedRow };

export const compareByNameAscending = ({ a, b }: CompareByNameAscendingProps): number =>
  collator.compare(a.lastName, b.lastName) ||
  collator.compare(a.firstName, b.firstName) ||
  a.id - b.id;

// Case-insensitive substring match on the full name, the in-memory twin of
// Prisma's `contains` + `mode: "insensitive"`.
type MatchesQueryProps = { fullName: string; q: string };

export const matchesQuery = ({ fullName, q }: MatchesQueryProps): boolean =>
  q === "" || fullName.toLowerCase().includes(q.toLowerCase());

// The requested page of an ordered list, clamped to the last page so a stale
// page number (after a narrowing search) still lands on real rows.
type PageOfProps<Row> = {
  rows: readonly Row[];
  page: number;
  size: number;
};

export const pageOf = <Row>({ rows, page, size }: PageOfProps<Row>): Page<Row> => {
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / size));
  const clampedPage = Math.min(page, lastPage);
  return {
    rows: rows.slice((clampedPage - 1) * size, clampedPage * size),
    total,
    page: total === 0 ? 1 : clampedPage,
  };
};

// Filters a list by the search text, orders it and cuts the requested page.
// Pure, so every search, sort and page change over a cached pool costs a
// millisecond-scale sort, not a query. `nameOf` reads a row's identity, so
// rows that nest it (a scored line, say) rank without being reshaped; each
// row's name and sort key are read once, not once per comparison.
type RankRowsProps<Row> = {
  rows: readonly Row[];
  nameOf: (row: Row) => NamedRow;
  q: string;
  page: number;
  size: number;
  dir: SortDirection;
  order: RankOrder<Row>;
};

export const rankRows = <Row>({
  rows,
  nameOf,
  q,
  page,
  size,
  dir,
  order,
}: RankRowsProps<Row>): Page<Row> => {
  const candidates = rows
    .map((row) => ({ row, name: nameOf(row) }))
    .filter(({ name }) => matchesQuery({ fullName: name.fullName, q }));
  const ordered =
    order.by === "name"
      ? candidates.toSorted((a, b) =>
          compareByName({ a: a.name, b: b.name, sort: order.sort, dir }),
        )
      : candidates
          .map((candidate) => ({ ...candidate, ...order.valueOf(candidate.row) }))
          .toSorted((a, b) => {
            if (a.sink !== b.sink) return a.sink ? 1 : -1;
            const difference = a.value - b.value;
            if (difference !== 0) return dir === "asc" ? difference : -difference;
            return order.tiebreak === "id"
              ? a.name.id - b.name.id
              : compareByNameAscending({ a: a.name, b: b.name });
          });
  return pageOf({ rows: ordered.map(({ row }) => row), page, size });
};
