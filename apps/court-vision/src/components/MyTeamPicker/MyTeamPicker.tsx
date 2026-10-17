"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { setMyTeam } from "@/lib/yahoo/actions";

import styles from "@/components/MyTeamPicker/MyTeamPicker.module.scss";

export type MyTeamPickerProps = {
  leagueId: string;
  teams: FantasyTeam[];
};

const SAVE_FAILED = "Couldn't save your team. Try again.";

// Names the user's own team in an imported league that has none yet, which
// the Waiver Wire needs before it can compare anyone. A save refreshes the
// route so the page re-reads the league with its team set.
export function MyTeamPicker({ leagueId, teams }: MyTeamPickerProps) {
  const router = useRouter();
  const selectId = useId();
  const errorId = useId();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // aria-disabled, not disabled, while pending: a disabled button drops the
    // focus of the keyboard user who just pressed it.
    if (isPending || teamId === "") return;
    setFailed(false);
    startTransition(async () => {
      const result = await setMyTeam({ leagueId, teamId }).catch(() => null);
      if (result?.status !== "ok") {
        startTransition(() => setFailed(true));
        return;
      }
      router.refresh();
    });
  };

  return (
    <form className={styles.picker} onSubmit={onSave}>
      <label htmlFor={selectId} className={styles.label}>
        Your team
      </label>
      <div className={styles.row}>
        <select
          id={selectId}
          className={styles.select}
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
          aria-describedby={failed ? errorId : undefined}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.save} aria-disabled={isPending}>
          Save
        </button>
      </div>
      {failed && (
        <p id={errorId} role="alert" className={styles.error}>
          {SAVE_FAILED}
        </p>
      )}
    </form>
  );
}
