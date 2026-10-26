import { type ReactNode } from "react";

import { type SportDescriptor, type SportKeys } from "@vision/core/sport/types";
import { categoryDef } from "@vision/core/valuation/categories";

import styles from "#ui/components/SportOverview/SportOverview.module.scss";

type FormatPointsProps = { value: number };

const formatPoints = ({ value }: FormatPointsProps): string =>
  value > 0 ? `+${value}` : String(value);

type OverviewColumn = {
  label: string;
  numeric?: boolean;
};

type OverviewRow = {
  key: string;
  // The row's header cell, under the first column.
  header: ReactNode;
  // One cell per remaining column, in order.
  cells: readonly ReactNode[];
};

// One titled panel holding one table: the shape every overview section shares.
type OverviewTableProps = {
  id: string;
  title: string;
  columns: readonly OverviewColumn[];
  rows: readonly OverviewRow[];
};

const OverviewTable = ({ id, title, columns, rows }: OverviewTableProps) => (
  <section className={styles.panel} aria-labelledby={id}>
    <h2 id={id} className={styles.title}>
      {title}
    </h2>
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={column.numeric ? styles.numeric : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.header}</th>
              {columns.slice(1).map((column, index) => (
                <td key={column.label} className={column.numeric ? styles.numeric : undefined}>
                  {row.cells[index]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

// What a sport's fantasy game is made of, read straight from its descriptor:
// the categories each pool competes in, the points table, and the roster.
// Server-safe; the descriptor never crosses to the client.
type SportOverviewProps<K extends SportKeys> = { sport: SportDescriptor<K> };

export const SportOverview = <K extends SportKeys>({ sport }: SportOverviewProps<K>) => (
  <div className={styles.overview}>
    {sport.pools
      .filter((pool) => pool.categories.length > 0)
      .map((pool) => (
        <OverviewTable
          key={pool.key}
          id={`${sport.id}-${pool.key}-categories`}
          title={
            sport.pools.length > 1 ? `Scoring categories: ${pool.label}` : "Scoring categories"
          }
          columns={[
            { label: "Category" },
            { label: "Name" },
            { label: "Type" },
            { label: "Better" },
          ]}
          rows={pool.categories.map((category) => {
            const def = categoryDef({ sport, category });
            return {
              key: category,
              header: def.label,
              cells: [
                def.fullName,
                def.kind === "ratio" ? "Rate" : "Total",
                def.direction === "lower" ? "Lower" : "Higher",
              ],
            };
          })}
        />
      ))}

    <OverviewTable
      id={`${sport.id}-points`}
      title="Points scoring"
      columns={[{ label: "Stat" }, { label: "Points", numeric: true }]}
      rows={sport.points.keys.map((key) => ({
        key,
        header: sport.statLabels[key],
        cells: [formatPoints({ value: sport.points.defaults[key] })],
      }))}
    />

    <OverviewTable
      id={`${sport.id}-roster`}
      title="Roster slots"
      columns={[
        { label: "Slot" },
        { label: "Name" },
        { label: "Takes" },
        { label: "Default", numeric: true },
      ]}
      rows={sport.slots.map((slot) => ({
        key: slot.type,
        header: slot.label,
        cells: [
          slot.fullName,
          slot.accepts === "any" ? "Anyone" : slot.accepts.join(", "),
          slot.defaultCount,
        ],
      }))}
    />
  </div>
);
