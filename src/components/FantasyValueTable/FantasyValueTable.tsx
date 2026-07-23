"use client";

import Link from "next/link";
import styles from "@/components/FantasyValueTable/FantasyValueTable.module.scss";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type FantasyMethodKey, methodMeta } from "@/lib/valuation/registry";
import type { FantasySortKey } from "@/lib/valuation/searchParams";
import type { FantasyPlayerValues, FantasyStatLine } from "@/lib/valuation/types";

export type FantasyTableRow = FantasyStatLine & { values: FantasyPlayerValues; rank: number };

export type FantasyValueTableProps = {
  rows: readonly FantasyTableRow[];
  sort: FantasySortKey;
  dir: "asc" | "desc";
  onSort: (args: { sort: FantasySortKey }) => void;
};

type MethodColumn = {
  sortKey: FantasySortKey;
  methodKey: FantasyMethodKey;
  value: (values: FantasyPlayerValues) => number;
  signed: boolean;
};

// One sortable column per available method (PRD §9.3). SGP renders as a
// blocked placeholder column after these.
const METHOD_COLUMNS: readonly MethodColumn[] = [
  { sortKey: "z", methodKey: "zscore", value: (values) => values.z, signed: true },
  { sortKey: "g", methodKey: "gscore", value: (values) => values.g, signed: true },
  { sortKey: "points", methodKey: "points", value: (values) => values.points, signed: false },
  { sortKey: "vorp", methodKey: "vorp", value: (values) => values.vorp, signed: true },
  { sortKey: "pos", methodKey: "positional", value: (values) => values.positional, signed: true },
];

const formatScore = ({ value, signed }: { value: number; signed: boolean }): string =>
  signed && value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

const sgpMeta = methodMeta("sgp");

export function FantasyValueTable({ rows, sort, dir, onSort }: FantasyValueTableProps) {
  const isStatSort = sort !== "firstName" && sort !== "lastName";

  const header = ({
    label,
    sortKey,
    tip,
  }: {
    label: string;
    sortKey: FantasySortKey;
    tip?: { name: string; description: string; formula: string };
  }) => {
    const isActive = sort === sortKey;
    const tipId = tip && `fantasy-tip-${sortKey}`;
    return (
      <th
        key={sortKey}
        aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={isActive || undefined}
      >
        <button
          type="button"
          onClick={() => onSort({ sort: sortKey })}
          className={styles.sortButton}
          data-active={isActive ? "true" : "false"}
          aria-describedby={tipId}
        >
          {label}
          {isActive && <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>}
        </button>
        {!!tip && (
          <span role="tooltip" id={tipId} className={styles.headerTip} hidden>
            <span className={styles.headerTipName}>{tip.name}</span>
            <span>{tip.description}</span>
            <span className={styles.headerTipFormula}>{tip.formula}</span>
          </span>
        )}
      </th>
    );
  };

  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isStatSort && (
              <th className={styles.numeric} title="Rank in the current sort">
                #
              </th>
            )}
            {header({ label: "First name", sortKey: "firstName" })}
            {header({ label: "Last name", sortKey: "lastName" })}
            <th>Team</th>
            <th>Position</th>
            {METHOD_COLUMNS.map((column) => {
              const meta = methodMeta(column.methodKey);
              return header({
                label: meta?.label ?? column.methodKey,
                sortKey: column.sortKey,
                tip: meta && {
                  name: `${meta.label} — ${meta.fullName}`,
                  description: meta.description,
                  formula: meta.formula,
                },
              });
            })}
            <th className={`${styles.numeric} ${styles.blockedHeader}`}>
              <span aria-describedby="fantasy-tip-sgp">{sgpMeta?.label ?? "SGP"}</span>
              <span role="tooltip" id="fantasy-tip-sgp" className={styles.headerTip} hidden>
                <span className={styles.headerTipName}>
                  {sgpMeta?.label ?? "SGP"} — {sgpMeta?.fullName ?? ""}
                </span>
                <span>{sgpMeta?.description ?? ""}</span>
                <span>{sgpMeta?.unavailableReason ?? ""}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              {isStatSort && <td className={`${styles.numeric} ${styles.rank}`}>{row.rank}</td>}
              <td data-sort-active={sort === "firstName" || undefined}>
                <span className={styles.nameCell}>
                  <PlayerAvatar
                    fullName={row.fullName}
                    nbaPersonId={row.nbaPersonId}
                    size="sm"
                    teamAbbr={row.teamAbbr}
                  />
                  <Link href={`/players/${row.playerId}`}>{row.firstName}</Link>
                </span>
              </td>
              <td data-sort-active={sort === "lastName" || undefined}>
                <Link href={`/players/${row.playerId}`}>{row.lastName}</Link>
              </td>
              <td>{row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}</td>
              <td>{row.position ?? "—"}</td>
              {METHOD_COLUMNS.map((column) => {
                const value = column.value(row.values);
                return (
                  <td
                    key={column.sortKey}
                    className={styles.numeric}
                    data-sort-active={sort === column.sortKey || undefined}
                    data-negative={value < 0 || undefined}
                  >
                    {formatScore({ value, signed: column.signed })}
                  </td>
                );
              })}
              <td className={`${styles.numeric} ${styles.blockedCell}`}>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
