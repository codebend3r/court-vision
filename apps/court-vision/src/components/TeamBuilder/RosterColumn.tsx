"use client";

import Link from "next/link";
import { type DragEvent } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PositionTag } from "@/components/PositionTag/PositionTag";
import { groupSlotsByKind, slotMeta } from "@vision/sport-basketball/engine";
import { SLOT_KIND_TITLES } from "@/lib/fantasyTeams/labels";
import { type FantasyTeamPlayer, type RosterSlot } from "@/lib/fantasyTeams/types";

import styles from "@/components/TeamBuilder/TeamBuilder.module.scss";

type CanDropProps = { slot: RosterSlot; player: FantasyTeamPlayer };

type OnDropProps = { slot: RosterSlot; playerId: number };

type OnHoverProps = { player: FantasyTeamPlayer };

type OnRemoveProps = { slot: RosterSlot; player: FantasyTeamPlayer };

export type RosterColumnProps = {
  slots: RosterSlot[];
  // The search card being dragged, if any: every slot then declares whether
  // it would take that player.
  dragging: FantasyTeamPlayer | null;
  canDrop: (args: CanDropProps) => boolean;
  onDrop: (args: OnDropProps) => void;
  onHover: (args: OnHoverProps) => void;
  onRemove: (args: OnRemoveProps) => void;
};

// The roster, one section per slot kind, each slot a drop target.
export function RosterColumn({
  slots,
  dragging,
  canDrop,
  onDrop,
  onHover,
  onRemove,
}: RosterColumnProps) {
  type DropStateForProps = { slot: RosterSlot };

  const dropStateFor = ({ slot }: DropStateForProps): "ok" | "no" | undefined => {
    if (dragging === null) return undefined;
    return canDrop({ slot, player: dragging }) ? "ok" : "no";
  };

  type HandleDropProps = { slot: RosterSlot };

  const handleDrop =
    ({ slot }: HandleDropProps) =>
    (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      onDrop({ slot, playerId: Number.parseInt(event.dataTransfer.getData("text/plain"), 10) });
    };

  return (
    <section className={styles.rosterColumn} aria-label="Roster">
      {groupSlotsByKind({ slots }).map((group) => (
        <section key={group.kind} className={styles.slotGroup}>
          <h3 className={styles.slotGroupTitle}>{SLOT_KIND_TITLES[group.kind]}</h3>
          <ul className={styles.slotList}>
            {group.slots.map((slot) => (
              <li
                key={slot.id}
                className={styles.slot}
                data-drop={dropStateFor({ slot })}
                data-slot-id={slot.id}
                onMouseEnter={() => slot.player !== null && onHover({ player: slot.player })}
                onFocus={() => slot.player !== null && onHover({ player: slot.player })}
                onDragOver={(event) => {
                  if (dragging !== null && canDrop({ slot, player: dragging })) {
                    event.preventDefault();
                  }
                }}
                onDrop={handleDrop({ slot })}
              >
                <span className={styles.slotType}>{slotMeta({ type: slot.type }).label}</span>
                {slot.player === null ? (
                  <span className={styles.slotEmpty}>Empty</span>
                ) : (
                  <FilledSlot slot={slot} player={slot.player} onRemove={onRemove} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

type FilledSlotProps = {
  slot: RosterSlot;
  player: FantasyTeamPlayer;
  onRemove: RosterColumnProps["onRemove"];
};

// The player's avatar, name and position are one link to their profile; the
// remove button stays outside it.
function FilledSlot({ slot, player, onRemove }: FilledSlotProps) {
  return (
    <span className={styles.slotPlayer}>
      <Link
        href={`/players/${player.playerId}`}
        className={styles.slotPlayerLink}
        aria-label={`View ${player.fullName}'s profile`}
      >
        <PlayerAvatar
          fullName={player.fullName}
          nbaPersonId={player.nbaPersonId}
          size="sm"
          teamAbbr={player.teamAbbr}
        />
        <span className={styles.slotPlayerName}>{player.fullName}</span>
        {!!player.position && (
          <PositionTag
            position={player.position}
            playerId={player.playerId}
            className={styles.slotPlayerPosition}
          />
        )}
      </Link>
      <button
        type="button"
        onClick={() => onRemove({ slot, player })}
        aria-label={`Remove ${player.fullName}`}
        className={styles.slotRemove}
      >
        ×
      </button>
    </span>
  );
}
