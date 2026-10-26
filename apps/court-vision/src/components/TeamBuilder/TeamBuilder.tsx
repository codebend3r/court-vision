"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmDialog } from "@vision/ui/components/ConfirmDialog/ConfirmDialog";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import { PlayerInsightPanel } from "@/components/PlayerInsightPanel/PlayerInsightPanel";
import { RosterColumn } from "@/components/TeamBuilder/RosterColumn";
import { MIN_QUERY_LENGTH, SearchResults } from "@/components/TeamBuilder/SearchResults";
import { useRoster } from "@/components/TeamBuilder/useRoster";
import { type PlayerInsight } from "@vision/sport-basketball/types";
import { rosterSize, SLOT_META, slotMeta } from "@vision/sport-basketball/engine";
import {
  type FantasyTeam,
  type FantasyTeamPlayer,
  type RosterSlot,
} from "@/lib/fantasyTeams/types";
import { saveLeagueTeam } from "@/lib/leagues/teamActions";

import styles from "@/components/TeamBuilder/TeamBuilder.module.scss";

export type TeamBuilderProps = {
  leagueId: string;
  players: FantasyTeamPlayer[];
  team: FantasyTeam | null; // present = edit an existing team in place
  insights: PlayerInsight[]; // per-player quick stats + z ranks for the hover panel
};

const GENERIC_ERROR = "Something went wrong — try again.";

export function TeamBuilder({ leagueId, players, team, insights }: TeamBuilderProps) {
  const router = useRouter();
  const roster = useRoster({ team });

  const [name, setName] = useState(team?.name ?? "");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<FantasyTeamPlayer | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<FantasyTeamPlayer | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    slot: RosterSlot;
    player: FantasyTeamPlayer;
  } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const insightById = useMemo(
    () => new Map(insights.map((insight) => [insight.playerId, insight])),
    [insights],
  );

  type OnDropProps = { slot: RosterSlot; playerId: number };

  const onDrop = ({ slot, playerId }: OnDropProps) => {
    const player = players.find((entry) => entry.playerId === playerId) ?? dragging;
    if (player !== null && roster.canDrop({ slot, player })) {
      roster.assign({ slotId: slot.id, player });
    }
    setDragging(null);
  };

  const confirmRemoval = () => {
    if (pendingRemoval !== null) roster.clearSlot({ slotId: pendingRemoval.slot.id });
    setPendingRemoval(null);
  };

  // A transition, so Save stays disabled while the action runs and comes back
  // however it ends: a result, or a throw (a dropped connection, a deploy
  // mid-request) that would otherwise have left it disabled for good.
  const onSave = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setErrorMessage(null);
    startSaving(async () => {
      try {
        const result = await saveLeagueTeam({
          leagueId,
          teamId: team?.id ?? null,
          name: trimmed,
          slots: roster.slots,
        });
        if (result.status === "ok") {
          router.push("/my-teams");
          router.refresh();
          return;
        }
        setErrorMessage(
          result.status === "invalid" ? "Check the team name and roster." : GENERIC_ERROR,
        );
      } catch {
        setErrorMessage(GENERIC_ERROR);
      }
    });
  };

  const filled = roster.slots.filter((slot) => slot.player !== null).length;
  const isSearching = query.trim().length >= MIN_QUERY_LENGTH;

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
      </section>

      <Disclosure
        className={styles.settings}
        summaryClassName={styles.summary}
        summary={<>Roster settings — {rosterSize({ counts: roster.counts })} slots</>}
      >
        <span className={styles.settingsBody}>
          {SLOT_META.map((meta) => (
            <label key={meta.type} className={styles.countLabel} title={meta.fullName}>
              {meta.label}
              <input
                key={`${meta.type}:${roster.counts[meta.type]}`}
                type="number"
                min={0}
                max={meta.max}
                defaultValue={roster.counts[meta.type]}
                onBlur={(event) => roster.setCount({ type: meta.type, raw: event.target.value })}
                aria-label={`${meta.fullName} slots`}
                className={styles.countInput}
              />
            </label>
          ))}
        </span>
      </Disclosure>

      <section className={styles.searchBar} aria-label="Player search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players by first or last name…"
          aria-label="Search players"
          className={styles.search}
        />
      </section>

      <p className={styles.rosterSummary}>
        {filled} of {roster.slots.length} slots filled
      </p>

      <section className={styles.columns}>
        <RosterColumn
          slots={roster.slots}
          dragging={dragging}
          canDrop={roster.canDrop}
          onDrop={onDrop}
          onHover={({ player }) => setHoveredPlayer(player)}
          onRemove={({ slot, player }) => setPendingRemoval({ slot, player })}
        />

        <section className={styles.searchColumn} aria-label="Search results">
          {!isSearching && (
            <div className={styles.insightColumn}>
              <h3 className={styles.slotGroupTitle}>Quick look</h3>
              <PlayerInsightPanel
                player={hoveredPlayer}
                insight={
                  hoveredPlayer !== null ? (insightById.get(hoveredPlayer.playerId) ?? null) : null
                }
              />
            </div>
          )}
          <SearchResults
            query={query}
            players={players}
            rostered={roster.rostered}
            openSlotFor={roster.openSlotFor}
            onAdd={roster.add}
            onDragStart={({ player }) => setDragging(player)}
            onDragEnd={() => setDragging(null)}
          />
        </section>
      </section>

      <section className={styles.saveBar}>
        {!!errorMessage && (
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={name.trim() === "" || isSaving}
          className={styles.save}
        >
          <svg
            viewBox="0 0 16 16"
            width="15"
            height="15"
            aria-hidden="true"
            focusable="false"
            className={styles.saveIcon}
          >
            <path
              d="M2.75 2.75h8.19L13.25 5.06V13.25H2.75V2.75Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path
              d="M5.25 2.75v3.5h5.5v-3.5M5.5 13.25v-3.5h5v3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </svg>
          Save team
        </button>
      </section>

      {pendingRemoval !== null && (
        <ConfirmDialog
          title={`Remove ${pendingRemoval.player.fullName}?`}
          confirmLabel="Remove player"
          destructive
          onConfirm={confirmRemoval}
          onCancel={() => setPendingRemoval(null)}
        >
          They&apos;ll come off the{" "}
          {slotMeta({ type: pendingRemoval.slot.type }).fullName.toLowerCase()} slot. You can add
          them back any time.
        </ConfirmDialog>
      )}
    </section>
  );
}
