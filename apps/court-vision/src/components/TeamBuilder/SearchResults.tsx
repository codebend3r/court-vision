"use client";

import Link from "next/link";
import { useMemo } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PositionTag } from "@/components/PositionTag/PositionTag";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

import styles from "@/components/TeamBuilder/TeamBuilder.module.scss";

const MAX_RESULTS = 20;

// A search needs two characters before it lists anyone.
export const MIN_QUERY_LENGTH = 2;

type OpenSlotForProps = { player: FantasyTeamPlayer };

type OnAddProps = { player: FantasyTeamPlayer };

type OnDragStartProps = { player: FantasyTeamPlayer };

export type SearchResultsProps = {
  query: string;
  players: FantasyTeamPlayer[];
  rostered: ReadonlySet<number>;
  openSlotFor: (args: OpenSlotForProps) => string | null;
  onAdd: (args: OnAddProps) => void;
  onDragStart: (args: OnDragStartProps) => void;
  onDragEnd: () => void;
};

type AddTitleProps = { onRoster: boolean; target: string | null };

const addTitle = ({ onRoster, target }: AddTitleProps): string => {
  if (onRoster) return "Already on the roster";
  return target === null ? "No eligible open slot" : `Add to ${target}`;
};

// Players matching the search by first, last or full name: each card drags
// onto a slot, or its + button fills the first open eligible slot.
export function SearchResults({
  query,
  players,
  rostered,
  openSlotFor,
  onAdd,
  onDragStart,
  onDragEnd,
}: SearchResultsProps) {
  const trimmed = query.trim();

  const results = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (needle.length < MIN_QUERY_LENGTH) return [];
    return players
      .filter(
        (player) =>
          player.firstName.toLowerCase().includes(needle) ||
          player.lastName.toLowerCase().includes(needle) ||
          player.fullName.toLowerCase().includes(needle),
      )
      .slice(0, MAX_RESULTS);
  }, [players, trimmed]);

  return (
    <>
      {trimmed.length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <p className={styles.noResults}>No players match “{trimmed}”.</p>
      )}
      <ul className={styles.results}>
        {results.map((player) => {
          const onRoster = rostered.has(player.playerId);
          const target = openSlotFor({ player });
          return (
            <li
              key={player.playerId}
              className={styles.card}
              draggable={!onRoster}
              data-rostered={onRoster || undefined}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", String(player.playerId));
                event.dataTransfer.effectAllowed = "move";
                onDragStart({ player });
              }}
              onDragEnd={onDragEnd}
            >
              <PlayerAvatar
                fullName={player.fullName}
                nbaPersonId={player.nbaPersonId}
                size="sm"
                teamAbbr={player.teamAbbr}
              />
              <span className={styles.cardName}>{player.fullName}</span>
              {player.teamAbbr !== null && <TeamChip team={player.teamAbbr} size="sm" />}
              {player.position !== null ? (
                <PositionTag
                  position={player.position}
                  playerId={player.playerId}
                  className={styles.cardPosition}
                />
              ) : (
                <span className={styles.cardPosition}>—</span>
              )}
              <Link
                href={`/players/${player.playerId}`}
                className={styles.cardView}
                aria-label={`View ${player.fullName}'s profile`}
              >
                View player
              </Link>
              <button
                type="button"
                onClick={() => onAdd({ player })}
                disabled={onRoster || target === null}
                aria-label={`Add ${player.fullName}`}
                title={addTitle({ onRoster, target })}
                className={styles.cardAdd}
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
