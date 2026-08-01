"use client";

import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { FANTASY_METHODS, methodMeta, type FantasyMethodKey } from "@/lib/valuation/registry";
import { type FantasySortKey } from "@/lib/valuation/searchParams";
import { type FantasyPlayerValues, type FantasyStatLine } from "@/lib/valuation/types";

import styles from "@/components/FantasyValueTable/FantasyValueTable.module.scss";

export type FantasyTableRow = FantasyStatLine & { values: FantasyPlayerValues; rank: number };

export type FantasyValueTableProps = {
  rows: readonly FantasyTableRow[];
  sort: FantasySortKey;
  dir: "asc" | "desc";
  isSignedIn: boolean;
  onSort: (args: { sort: FantasySortKey }) => void;
};

type MethodColumn = {
  sortKey: FantasySortKey;
  methodKey: FantasyMethodKey;
  value: (values: FantasyPlayerValues) => number;
  signed: boolean;
};

// One sortable column per available method (PRD §9.3). Methods without math
// yet render as blocked placeholder columns after these.
const METHOD_COLUMNS: readonly MethodColumn[] = [
  { sortKey: "z", methodKey: "zscore", value: (values) => values.z, signed: true },
  { sortKey: "g", methodKey: "gscore", value: (values) => values.g, signed: true },
  { sortKey: "points", methodKey: "points", value: (values) => values.points, signed: false },
  { sortKey: "vorp", methodKey: "vorp", value: (values) => values.vorp, signed: true },
  { sortKey: "pos", methodKey: "positional", value: (values) => values.positional, signed: true },
  { sortKey: "sgp", methodKey: "sgp", value: (values) => values.sgp, signed: true },
  { sortKey: "sim", methodKey: "simvalue", value: (values) => values.sim, signed: true },
];

const formatScore = ({ value, signed }: { value: number; signed: boolean }): string =>
  signed && value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

// Every registry method that has no math behind it yet renders as one blocked
// column, so registering a new one is enough to surface it here.
const BLOCKED_METHODS = FANTASY_METHODS.filter((method) => !method.available);

export function FantasyValueTable({ rows, sort, dir, isSignedIn, onSort }: FantasyValueTableProps) {
  const isStatSort = sort !== "firstName" && sort !== "lastName";

  const header = ({
    label,
    sortKey,
    tip,
    isStatColumn = false,
  }: {
    label: string;
    sortKey: FantasySortKey;
    tip?: { name: string; description: string; whyItMatters: string; formula: string };
    isStatColumn?: boolean;
  }) => {
    const isActive = sort === sortKey;
    const tipId = tip && `fantasy-tip-${sortKey}`;
    return (
      <th
        key={sortKey}
        // Marked explicitly rather than by column position: the star column
        // shifts every index, and only for signed-in users.
        className={isStatColumn ? styles.statHeader : undefined}
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
            <span className={styles.headerTipWhy}>
              <span className={styles.headerTipWhyLabel}>Why it matters</span>
              {tip.whyItMatters}
            </span>
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
            {/* No visible header: the buttons name themselves, and a label
                would cost width on every row. Signed out the column is omitted
                — there is no watchlist to act on. */}
            {isSignedIn && (
              <th className={styles.starColumn}>
                <span className={styles.visuallyHidden}>Watchlist</span>
              </th>
            )}
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
                isStatColumn: true,
                tip: meta && {
                  name: `${meta.label} — ${meta.fullName}`,
                  description: meta.description,
                  whyItMatters: meta.whyItMatters,
                  formula: meta.formula,
                },
              });
            })}
            {BLOCKED_METHODS.map((method) => (
              <th key={method.key} className={`${styles.numeric} ${styles.blockedHeader}`}>
                <span aria-describedby={`fantasy-tip-${method.key}`}>{method.label}</span>
                <span
                  role="tooltip"
                  id={`fantasy-tip-${method.key}`}
                  className={styles.headerTip}
                  hidden
                >
                  <span className={styles.headerTipName}>
                    {method.label} — {method.fullName}
                  </span>
                  <span>{method.description}</span>
                  <span className={styles.headerTipWhy}>
                    <span className={styles.headerTipWhyLabel}>Why it matters</span>
                    {method.whyItMatters}
                  </span>
                  <span>{method.unavailableReason ?? ""}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              {isSignedIn && (
                <td className={styles.starCell}>
                  <StarButton playerId={row.playerId} fullName={row.fullName} isSignedIn />
                </td>
              )}
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
              {BLOCKED_METHODS.map((method) => (
                <td key={method.key} className={`${styles.numeric} ${styles.blockedCell}`}>
                  —
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
