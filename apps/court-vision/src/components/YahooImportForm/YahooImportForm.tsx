"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";

import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";
import { useLeaguesStore } from "@/lib/leagues/store";
import { importYahooLeague, previewYahooLeague } from "@/lib/yahoo/actions";
import {
  notValuedMessage,
  unmatchedPlayersMessage,
  YAHOO_URL_HINT,
  yahooFailureMessage,
  type YahooMessageStatus,
} from "@/lib/yahoo/messages";
import {
  type YahooImportResult,
  type YahooPreview,
  type YahooPreviewResult,
  type YahooPreviewTeam,
} from "@/lib/yahoo/types";

import styles from "@/components/YahooImportForm/YahooImportForm.module.scss";

const MY_TEAMS_PATH = "/my-teams";

// Paste a URL, then pick your team from the league it names, then (only when
// some players couldn't be matched) read the summary before moving on.
type Step =
  | { kind: "url" }
  | { kind: "team"; url: string; preview: YahooPreview }
  | { kind: "imported"; unmatched: string[] };

type Failure =
  | { status: "duplicate"; slug: string }
  | { status: Exclude<YahooMessageStatus, "duplicate"> };

// An action that throws (the network dropped) reads as the generic failure.
const previewOrError = ({ url }: { url: string }): Promise<YahooPreviewResult> =>
  previewYahooLeague({ url }).catch((): YahooPreviewResult => ({ status: "error" }));

const importOrError = ({
  url,
  myTeamExternalKey,
}: {
  url: string;
  myTeamExternalKey: string;
}): Promise<YahooImportResult> =>
  importYahooLeague({ url, myTeamExternalKey }).catch((): YahooImportResult => ({
    status: "error",
  }));

const teamDetails = ({ team }: { team: YahooPreviewTeam }): string =>
  [team.managerName, team.rosterCount === 1 ? "1 player" : `${team.rosterCount} players`]
    .filter((part) => !!part)
    .join(" · ");

// The step that comes next gets focus, so a keyboard or screen-reader user
// lands on the new question rather than on whatever control just unmounted.
type FocusTargets = {
  url: HTMLInputElement | null;
  team: HTMLLegendElement | null;
  imported: HTMLAnchorElement | null;
};

export function YahooImportForm() {
  const router = useRouter();
  const baseId = useId();
  const fieldId = `${baseId}-url`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>({ kind: "url" });
  const [teamKey, setTeamKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isPending, startTransition] = useTransition();
  const urlRef = useRef<HTMLInputElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const myTeamsRef = useRef<HTMLAnchorElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // Set when a step change should move focus; the first render leaves it be.
  const shouldMoveFocus = useRef(false);

  useEffect(() => {
    if (!shouldMoveFocus.current) return;
    shouldMoveFocus.current = false;
    const targets: FocusTargets = {
      url: urlRef.current,
      team: legendRef.current,
      imported: myTeamsRef.current,
    };
    const target = targets[step.kind];
    if (target !== null) target.focus();
  }, [step]);

  // Buttons are disabled while a request is pending, which drops the focus of
  // the one just pressed; a failure takes focus so keyboard users land on it.
  useEffect(() => {
    const alert = alertRef.current;
    if (failure !== null && alert !== null) alert.focus();
  }, [failure]);

  const goTo = ({ next }: { next: Step }) => {
    shouldMoveFocus.current = true;
    setStep(next);
  };

  const onFind = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const submitted = url.trim();
    // Unmounts the last alert, so a repeat of the same failure is announced.
    setFailure(null);
    startTransition(async () => {
      const result = await previewOrError({ url: submitted });
      startTransition(() => {
        if (result.status !== "ok") {
          setFailure(result);
          return;
        }
        const { preview } = result;
        setFailure(null);
        setTeamKey(preview.teams.find((team) => team.isOwnedByCurrentLogin)?.externalKey ?? null);
        goTo({ next: { kind: "team", url: submitted, preview } });
      });
    });
  };

  const onImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || step.kind !== "team" || teamKey === null) return;
    const leagueUrl = step.url;
    setFailure(null);
    startTransition(async () => {
      const result = await importOrError({ url: leagueUrl, myTeamExternalKey: teamKey });
      if (result.status !== "ok") {
        startTransition(() => setFailure(result));
        return;
      }
      // The import made this league the active one on the server.
      const store = useLeaguesStore.getState();
      store.upsert({ league: result.league });
      store.setActive({ leagueId: result.league.id });
      if (result.unmatched.length === 0) {
        router.push(MY_TEAMS_PATH);
        router.refresh();
        return;
      }
      startTransition(() => {
        setFailure(null);
        goTo({ next: { kind: "imported", unmatched: result.unmatched } });
      });
      router.refresh();
    });
  };

  const onChangeLeague = () => {
    setFailure(null);
    setTeamKey(null);
    goTo({ next: { kind: "url" } });
  };

  const urlDescription = !!failure && step.kind === "url" ? `${hintId} ${errorId}` : hintId;

  return (
    <section className={styles.importer}>
      {!!failure && (
        <p ref={alertRef} role="alert" id={errorId} tabIndex={-1} className={styles.error}>
          {yahooFailureMessage({ status: failure.status })}
          {failure.status === "duplicate" && (
            <>
              {" "}
              <Link href={`/leagues/${failure.slug}`} className={styles.inlineLink}>
                Open it
              </Link>
            </>
          )}
        </p>
      )}

      <p role="status" className={styles.status}>
        {step.kind === "imported" && unmatchedPlayersMessage({ names: step.unmatched })}
      </p>

      {step.kind === "url" && (
        <form className={styles.form} onSubmit={onFind}>
          <div className={styles.field}>
            <label htmlFor={fieldId} className={styles.label}>
              Yahoo league URL
            </label>
            <input
              ref={urlRef}
              id={fieldId}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              className={styles.input}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-describedby={urlDescription}
            />
            <p id={hintId} className={styles.hint}>
              {YAHOO_URL_HINT}
            </p>
          </div>
          <button type="submit" className={styles.submit} disabled={isPending}>
            {isPending ? "Finding league…" : "Find league"}
          </button>
        </form>
      )}

      {step.kind === "team" && (
        <form className={styles.form} onSubmit={onImport}>
          <div className={styles.league}>
            <FantasyTeamLogo name={step.preview.name} logoUrl={step.preview.logoUrl} size="md" />
            <div className={styles.leagueText}>
              <h2 className={styles.leagueName}>{step.preview.name}</h2>
              <p className={styles.meta}>{step.preview.meta}</p>
              {!!step.preview.unsupportedCategories.length && (
                <p className={styles.warning}>
                  {notValuedMessage({ categories: step.preview.unsupportedCategories })}
                </p>
              )}
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend ref={legendRef} tabIndex={-1} className={styles.legend}>
              Which team is yours?
            </legend>
            <ul className={styles.teams}>
              {step.preview.teams.map((team, index) => {
                const nameId = `${baseId}-team-${index}-name`;
                const detailId = `${baseId}-team-${index}-detail`;
                return (
                  <li key={team.externalKey} className={styles.teamItem}>
                    <label className={styles.team}>
                      <input
                        type="radio"
                        name="myTeam"
                        value={team.externalKey}
                        className={styles.radio}
                        checked={teamKey === team.externalKey}
                        onChange={() => setTeamKey(team.externalKey)}
                        aria-labelledby={nameId}
                        aria-describedby={detailId}
                      />
                      <FantasyTeamLogo name={team.name} logoUrl={team.logoUrl} />
                      <span id={nameId} className={styles.teamName}>
                        {team.name}
                      </span>
                      <span id={detailId} className={styles.teamDetail}>
                        {teamDetails({ team })}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submit}
              disabled={teamKey === null || isPending}
            >
              {isPending ? "Importing league…" : "Import league"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={onChangeLeague}
              disabled={isPending}
            >
              Change league
            </button>
          </div>
        </form>
      )}

      {step.kind === "imported" && (
        <Link ref={myTeamsRef} href={MY_TEAMS_PATH} className={styles.submit}>
          Go to My Teams
        </Link>
      )}
    </section>
  );
}
