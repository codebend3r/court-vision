"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useMemo, useState } from "react";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import styles from "@/components/TeamBuilder/TeamBuilder.module.scss";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import {
  autoAssignSlotId,
  buildSlots,
  clampSlotCount,
  countsFromSlots,
  DEFAULT_SLOT_COUNTS,
  eligibleForSlot,
  resizeSlots,
  rosteredIds,
  rosterSize,
  SLOT_META,
  type SlotKind,
  slotMeta,
} from "@/lib/fantasyTeams/slots";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import type {
  FantasyTeam,
  FantasyTeamPlayer,
  RosterSlot,
  RosterSlotType,
  SlotCounts,
} from "@/lib/fantasyTeams/types";

export type TeamBuilderProps = {
  players: FantasyTeamPlayer[];
  team?: FantasyTeam; // present = edit an existing team in place
};

const MAX_RESULTS = 20;

const KIND_TITLES: Record<SlotKind, string> = {
  starter: "Starters",
  bench: "Bench",
  injured: "Injured list",
};

export function TeamBuilder({ players, team }: TeamBuilderProps) {
  const router = useRouter();
  const addTeam = useFantasyTeamsStore((state) => state.addTeam);
  const updateTeam = useFantasyTeamsStore((state) => state.updateTeam);

  const [name, setName] = useState(team?.name ?? "");
  const [counts, setCounts] = useState<SlotCounts>(() =>
    team === undefined ? DEFAULT_SLOT_COUNTS : countsFromSlots({ slots: team.slots }),
  );
  const [slots, setSlots] = useState<RosterSlot[]>(() =>
    team === undefined ? buildSlots({ counts: DEFAULT_SLOT_COUNTS }) : team.slots,
  );
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<FantasyTeamPlayer | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    slotId: string;
    player: FantasyTeamPlayer;
  } | null>(null);

  const rostered = useMemo(() => rosteredIds({ slots }), [slots]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    return players
      .filter(
        (player) =>
          player.firstName.toLowerCase().includes(trimmed) ||
          player.lastName.toLowerCase().includes(trimmed) ||
          player.fullName.toLowerCase().includes(trimmed),
      )
      .slice(0, MAX_RESULTS);
  }, [players, query]);

  const canDrop = ({ slot, player }: { slot: RosterSlot; player: FantasyTeamPlayer }): boolean =>
    slot.player === null &&
    !rostered.has(player.playerId) &&
    eligibleForSlot({ slotType: slot.type, position: player.position });

  const assign = ({ slotId, player }: { slotId: string; player: FantasyTeamPlayer }) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId &&
        slot.player === null &&
        !rosteredIds({ slots: current }).has(player.playerId) &&
        eligibleForSlot({ slotType: slot.type, position: player.position })
          ? { ...slot, player }
          : slot,
      ),
    );
  };

  const clearSlot = ({ slotId }: { slotId: string }) => {
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, player: null } : slot)),
    );
  };

  const confirmRemoval = () => {
    if (pendingRemoval !== null) clearSlot({ slotId: pendingRemoval.slotId });
    setPendingRemoval(null);
  };

  const onCountChange =
    ({ type }: { type: RosterSlotType }) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = clampSlotCount({ type, value: Number.parseInt(event.target.value, 10) });
      const next = { ...counts, [type]: value };
      setCounts(next);
      setSlots((current) => resizeSlots({ slots: current, counts: next }));
    };

  const onAdd = ({ player }: { player: FantasyTeamPlayer }) => {
    const slotId = autoAssignSlotId({ slots, player });
    if (slotId !== null) assign({ slotId, player });
  };

  const onDrop =
    ({ slot }: { slot: RosterSlot }) =>
    (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const playerId = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
      const player = players.find((entry) => entry.playerId === playerId) ?? dragging;
      if (player !== null && player !== undefined && canDrop({ slot, player })) {
        assign({ slotId: slot.id, player });
      }
      setDragging(null);
    };

  const onSave = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    if (team === undefined) {
      addTeam({
        team: {
          id: crypto.randomUUID(),
          name: trimmed,
          slots,
          createdAt: new Date().toISOString(),
        },
      });
    } else {
      updateTeam({ team: { ...team, name: trimmed, slots } });
    }
    router.push("/my-teams");
  };

  const filled = slots.filter((slot) => slot.player !== null).length;

  return (
    <section className={styles.builder}>
      <section className={styles.head}>
        <label className={styles.nameLabel}>
          Team name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Bench Mob"
            aria-label="Team name"
            maxLength={40}
            className={styles.nameInput}
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={name.trim() === ""}
          className={styles.save}
        >
          Save team
        </button>
      </section>

      <details className={styles.settings}>
        <summary className={styles.summary}>
          <span className={styles.chevron} aria-hidden="true">
            ▸
          </span>
          Roster settings — {rosterSize({ counts })} slots
        </summary>
        <span className={styles.settingsBody}>
          {SLOT_META.map((meta) => (
            <label key={meta.type} className={styles.countLabel} title={meta.fullName}>
              {meta.label}
              <input
                key={`${meta.type}:${counts[meta.type]}`}
                type="number"
                min={0}
                max={meta.max}
                defaultValue={counts[meta.type]}
                onBlur={onCountChange({ type: meta.type })}
                aria-label={`${meta.fullName} slots`}
                className={styles.countInput}
              />
            </label>
          ))}
        </span>
      </details>

      <section className={styles.columns}>
        <section className={styles.rosterColumn} aria-label="Roster">
          <p className={styles.rosterSummary}>
            {filled} of {slots.length} slots filled
          </p>
          {(["starter", "bench", "injured"] as const).map((kind) => {
            const kindSlots = slots.filter((slot) => slotMeta(slot.type).kind === kind);
            if (kindSlots.length === 0) return null;
            return (
              <section key={kind} className={styles.slotGroup}>
                <h3 className={styles.slotGroupTitle}>{KIND_TITLES[kind]}</h3>
                <ul className={styles.slotList}>
                  {kindSlots.map((slot) => {
                    const dropState =
                      dragging === null
                        ? undefined
                        : canDrop({ slot, player: dragging })
                          ? "ok"
                          : "no";
                    return (
                      <li
                        key={slot.id}
                        className={styles.slot}
                        data-drop={dropState}
                        data-slot-id={slot.id}
                        onDragOver={(event) => {
                          if (dragging !== null && canDrop({ slot, player: dragging })) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={onDrop({ slot })}
                      >
                        <span className={styles.slotType}>{slotMeta(slot.type).label}</span>
                        {slot.player === null ? (
                          <span className={styles.slotEmpty}>Empty</span>
                        ) : (
                          <span className={styles.slotPlayer}>
                            <PlayerAvatar
                              fullName={slot.player.fullName}
                              nbaPersonId={slot.player.nbaPersonId}
                              size="sm"
                              teamAbbr={slot.player.teamAbbr}
                            />
                            <span className={styles.slotPlayerName}>{slot.player.fullName}</span>
                            {!!slot.player.position && (
                              <span className={styles.slotPlayerPosition}>
                                {slot.player.position}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                slot.player !== null &&
                                setPendingRemoval({ slotId: slot.id, player: slot.player })
                              }
                              aria-label={`Remove ${slot.player.fullName}`}
                              className={styles.slotRemove}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </section>

        <section className={styles.searchColumn} aria-label="Player search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players by first or last name…"
            aria-label="Search players"
            className={styles.search}
          />
          {query.trim().length >= 2 && results.length === 0 && (
            <p className={styles.noResults}>No players match “{query.trim()}”.</p>
          )}
          <ul className={styles.results}>
            {results.map((player) => {
              const onRoster = rostered.has(player.playerId);
              const target = autoAssignSlotId({ slots, player });
              return (
                <li
                  key={player.playerId}
                  className={styles.card}
                  draggable={!onRoster}
                  data-rostered={onRoster || undefined}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", String(player.playerId));
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(player);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <PlayerAvatar
                    fullName={player.fullName}
                    nbaPersonId={player.nbaPersonId}
                    size="sm"
                    teamAbbr={player.teamAbbr}
                  />
                  <span className={styles.cardName}>{player.fullName}</span>
                  {player.teamAbbr !== null && <TeamChip team={player.teamAbbr} size="sm" />}
                  <span className={styles.cardPosition}>{player.position ?? "—"}</span>
                  <button
                    type="button"
                    onClick={() => onAdd({ player })}
                    disabled={onRoster || target === null}
                    aria-label={`Add ${player.fullName}`}
                    title={
                      onRoster
                        ? "Already on the roster"
                        : target === null
                          ? "No eligible open slot"
                          : `Add to ${target}`
                    }
                    className={styles.cardAdd}
                  >
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </section>

      {pendingRemoval !== null && (
        // biome-ignore lint/a11y/noStaticElementInteractions: the overlay is a pointer-only dismiss target behind the dialog.
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => setPendingRemoval(null)}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click handler only stops overlay-dismiss propagation; it triggers no action. */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-player-title"
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="remove-player-title" className={styles.modalTitle}>
              Remove {pendingRemoval.player.fullName}?
            </h2>
            <p className={styles.modalBody}>
              They&apos;ll come off the{" "}
              {slotMeta(
                slots.find((slot) => slot.id === pendingRemoval.slotId)?.type ?? "UTIL",
              ).fullName.toLowerCase()}{" "}
              slot. You can add them back any time.
            </p>
            <span className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className={styles.modalCancel}
              >
                Cancel
              </button>
              <button type="button" onClick={confirmRemoval} className={styles.modalConfirm}>
                Remove player
              </button>
            </span>
          </section>
        </div>
      )}
    </section>
  );
}
