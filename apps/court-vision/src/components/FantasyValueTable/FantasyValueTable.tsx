"use client";

import Link from "next/link";

import { PlayerPositionText } from "@/components/PositionTag/PositionTag";
import { OwnershipChip } from "@/components/OwnershipChip/OwnershipChip";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { RosteredMarker } from "@/components/RosteredMarker/RosteredMarker";
import { SortButton } from "@/components/SortButton/SortButton";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { formatSigned } from "@vision/core/util/format";
import { type FantasyMethodMeta } from "@vision/core/valuation/registry";
import { isNameSort } from "@/lib/players/rank";
import { type FantasyTableRow, type ListSortProps } from "@/lib/valuation/fantasyRows";
import { type FantasySortKey } from "@/lib/valuation/searchParams";

import styles from "@/components/FantasyValueTable/FantasyValueTable.module.scss";

export type FantasyValueTableProps = ListSortProps & {
  rows: readonly FantasyTableRow[];
};

export function FantasyValueTable({ rows, sort, dir, isSignedIn, onSort }: FantasyValueTableProps) {
  // Rank only means something when the rows are ordered by a score.
  const isStatSort = !isNameSort(sort);

  // A method column's header also carries the method's explanation tip.
  type HeaderProps = {
    label: string;
    sortKey: FantasySortKey;
    method?: FantasyMethodMeta;
  };

  const header = ({ label, sortKey, method }: HeaderProps) => {
    const isActive = sort === sortKey;
    const tipId = method && `fantasy-tip-${sortKey}`;
    return (
      <th
        key={sortKey}
        aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={isActive || undefined}
      >
        <SortButton
          label={label}
          isActive={isActive}
          dir={dir}
          onClick={() => onSort({ sort: sortKey })}
          // Marked explicitly rather than by column position: the star column
          // shifts every index, and only for signed-in users.
          className={method && styles.statSort}
          aria-describedby={tipId}
        />
        {!!method && (
          <span role="tooltip" id={tipId} className={styles.headerTip} hidden>
            <span className={styles.headerTipName}>{`${method.label} — ${method.fullName}`}</span>
            <span>{method.description}</span>
            <span className={styles.headerTipWhy}>
              <span className={styles.headerTipWhyLabel}>Why it matters</span>
              {method.whyItMatters}
            </span>
            <span className={styles.headerTipFormula}>{method.formula}</span>
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
            {/* One sortable column per registry method (PRD §9.3). */}
            {FANTASY_METHODS.map((method) =>
              header({ label: method.label, sortKey: method.sortKey, method }),
            )}
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
                  <RosteredMarker playerId={row.playerId} />
                </span>
              </td>
              <td data-sort-active={sort === "lastName" || undefined}>
                <span className={styles.lastNameCell}>
                  <Link href={`/players/${row.playerId}`}>{row.lastName}</Link>
                  <OwnershipChip playerId={row.playerId} />
                </span>
              </td>
              <td>{row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}</td>
              <td>
                <PlayerPositionText playerId={row.playerId} position={row.position} />
              </td>
              {FANTASY_METHODS.map((method) => {
                const value = row.values[method.valueKey];
                return (
                  <td
                    key={method.sortKey}
                    className={styles.numeric}
                    data-sort-active={sort === method.sortKey || undefined}
                    data-negative={value < 0 || undefined}
                  >
                    {method.signed ? formatSigned({ value, digits: 1 }) : value.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
