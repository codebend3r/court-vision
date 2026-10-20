"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";

import { type BridgeErrorReason, type BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";
import { useLeaguesStore } from "@/lib/leagues/store";
import { importYahooLeague, previewYahooLeague } from "@/lib/yahoo/actions";
import {
  extensionStoreUrl,
  fetchLeagueViaExtension,
  getExtensionId,
  pingExtension,
} from "@/lib/yahoo/extensionClient";
import {
  bridgeFailureMessage,
  notValuedMessage,
  unmatchedPlayersMessage,
  YAHOO_URL_HINT,
  yahooFailureMessage,
  type YahooMessageStatus,
} from "@/lib/yahoo/messages";
import { importYahooLeagueFromSnapshot, previewYahooSnapshot } from "@/lib/yahoo/snapshotActions";
import {
  type YahooImportResult,
  type YahooPreview,
  type YahooPreviewResult,
  type YahooPreviewTeam,
} from "@/lib/yahoo/types";
import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

import styles from "@/components/YahooImportForm/YahooImportForm.module.scss";

const WAIVER_WIRE_PATH = "/waiver-wire";

// Where a preview came from: the server reads public leagues itself, and the
// browser extension reads private ones with the user's own Yahoo login.
type PreviewMode = "server" | "extension";

// Paste a URL, then pick your team from the league it names, then (only when
// some players couldn't be matched) read the summary before moving on.
type Step =
  | { kind: "url" }
  | { kind: "team"; url: string; preview: YahooPreview; mode: PreviewMode }
  | { kind: "imported"; unmatched: string[] };

// Unknown until the ping answers; nothing about the extension renders before then.
type ExtensionState = "unknown" | "absent" | "present";

type Failure =
  | { status: "duplicate"; slug: string }
  | { status: Exclude<YahooMessageStatus, "duplicate"> }
  // The server couldn't read the league, so it may be private: the extension can try.
  | { status: "server_not_found"; url: string }
  | { status: "bridge"; reason: BridgeErrorReason | "missing" };

const failureMessage = ({ failure }: { failure: Failure }): string => {
  if (failure.status === "bridge") return bridgeFailureMessage({ reason: failure.reason });
  if (failure.status === "server_not_found") return yahooFailureMessage({ status: "not_found" });
  return yahooFailureMessage({ status: failure.status });
};

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

// The extension path parses the URL in the browser, then asks the extension to
// read the league. Every failure here reads as one of the form's messages.
const fetchThroughExtension = async ({
  extensionId,
  url,
}: {
  extensionId: string | null;
  url: string;
}): Promise<{ status: "ok"; payload: BridgeLeaguePayload } | Failure> => {
  const parsed = parseYahooLeagueUrl({ input: url });
  if (parsed.status === "invalid") return { status: "invalid_url" };
  if (parsed.status !== "ok") return { status: parsed.status };
  if (extensionId === null) return { status: "bridge", reason: "missing" };
  const fetched = await fetchLeagueViaExtension({ extensionId, leagueId: parsed.leagueId });
  if (fetched.status === "ok") return fetched;
  return { status: "bridge", reason: fetched.status === "failed" ? fetched.reason : "missing" };
};

const previewThroughExtension = async ({
  extensionId,
  url,
}: {
  extensionId: string | null;
  url: string;
}): Promise<YahooPreviewResult | Failure> => {
  const fetched = await fetchThroughExtension({ extensionId, url });
  if (fetched.status !== "ok") return fetched;
  return previewYahooSnapshot({ payload: fetched.payload }).catch((): YahooPreviewResult => ({
    status: "error",
  }));
};

// Reads the league through the extension again, so the import stores Yahoo's
// current rosters rather than the ones the preview showed. It's for freshness,
// not trust: both reads are client-supplied, and the server validates each.
const importThroughExtension = async ({
  extensionId,
  url,
  myTeamExternalKey,
}: {
  extensionId: string | null;
  url: string;
  myTeamExternalKey: string;
}): Promise<YahooImportResult | Failure> => {
  const fetched = await fetchThroughExtension({ extensionId, url });
  if (fetched.status !== "ok") return fetched;
  return importYahooLeagueFromSnapshot({ payload: fetched.payload, myTeamExternalKey }).catch(
    (): YahooImportResult => ({ status: "error" }),
  );
};

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
  // Which button started the pending request, for its pending label.
  const [pendingMode, setPendingMode] = useState<PreviewMode>("server");
  // The private-league miss "Try with the extension" is retrying. Clearing the
  // failure would unmount the button and drop its focus to the body, so it
  // stays mounted (aria-disabled) on this until the read settles.
  const [retryUrl, setRetryUrl] = useState<string | null>(null);
  const extensionId = getExtensionId();
  const [extension, setExtension] = useState<ExtensionState>(() =>
    extensionId === null ? "absent" : "unknown",
  );
  const hasPinged = useRef(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const waiverWireRef = useRef<HTMLAnchorElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // Set when a step change should move focus; the first render leaves it be.
  const shouldMoveFocus = useRef(false);

  useEffect(() => {
    if (!shouldMoveFocus.current) return;
    shouldMoveFocus.current = false;
    const targets: FocusTargets = {
      url: urlRef.current,
      team: legendRef.current,
      imported: waiverWireRef.current,
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

  // With an id configured, ask once whether the extension is installed here.
  useEffect(() => {
    if (extensionId === null || hasPinged.current) return;
    hasPinged.current = true;
    void pingExtension({ extensionId }).then((answered) => {
      setExtension(answered ? "present" : "absent");
    });
  }, [extensionId]);

  const goTo = ({ next }: { next: Step }) => {
    shouldMoveFocus.current = true;
    setStep(next);
  };

  const showPreview = ({
    leagueUrl,
    preview,
    mode,
  }: {
    leagueUrl: string;
    preview: YahooPreview;
    mode: PreviewMode;
  }) => {
    setFailure(null);
    setTeamKey(preview.teams.find((team) => team.isOwnedByCurrentLogin)?.externalKey ?? null);
    goTo({ next: { kind: "team", url: leagueUrl, preview, mode } });
  };

  const onFind = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const submitted = url.trim();
    // Unmounts the last alert, so a repeat of the same failure is announced.
    setFailure(null);
    setPendingMode("server");
    startTransition(async () => {
      const result = await previewOrError({ url: submitted });
      startTransition(() => {
        if (result.status === "not_found") {
          setFailure({ status: "server_not_found", url: submitted });
          return;
        }
        if (result.status !== "ok") {
          setFailure(result);
          return;
        }
        showPreview({ leagueUrl: submitted, preview: result.preview, mode: "server" });
      });
    });
  };

  // `retryUrl` is the missed URL when "Try with the extension" pressed it, and
  // null from the import button, so a stale retry never shows again.
  const onFindWithExtension = ({
    leagueUrl,
    retryUrl: nextRetryUrl,
  }: {
    leagueUrl: string;
    retryUrl: string | null;
  }) => {
    if (isPending) return;
    setFailure(null);
    setPendingMode("extension");
    setRetryUrl(nextRetryUrl);
    startTransition(async () => {
      const result = await previewThroughExtension({ extensionId, url: leagueUrl });
      startTransition(() => {
        setRetryUrl(null);
        if (result.status !== "ok") {
          setFailure(result);
          return;
        }
        showPreview({ leagueUrl, preview: result.preview, mode: "extension" });
      });
    });
  };

  const onImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || step.kind !== "team" || teamKey === null) return;
    const leagueUrl = step.url;
    const myTeamExternalKey = teamKey;
    const viaExtension = step.mode === "extension";
    setFailure(null);
    startTransition(async () => {
      const result = viaExtension
        ? await importThroughExtension({ extensionId, url: leagueUrl, myTeamExternalKey })
        : await importOrError({ url: leagueUrl, myTeamExternalKey });
      if (result.status !== "ok") {
        startTransition(() => setFailure(result));
        return;
      }
      // The import made this league the active one on the server.
      const store = useLeaguesStore.getState();
      store.upsert({ league: result.league });
      store.setActive({ leagueId: result.league.id });
      if (result.unmatched.length === 0) {
        router.push(WAIVER_WIRE_PATH);
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
  const missedUrl = failure !== null && failure.status === "server_not_found" ? failure.url : null;
  const isFindingOnServer = isPending && pendingMode === "server";
  const isReadingThroughExtension = isPending && pendingMode === "extension";
  const tryUrl = missedUrl ?? (isReadingThroughExtension ? retryUrl : null);

  return (
    <section className={styles.importer}>
      {!!failure && (
        <p ref={alertRef} role="alert" id={errorId} tabIndex={-1} className={styles.error}>
          {failureMessage({ failure })}
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

      {tryUrl !== null && extension === "present" && (
        // aria-disabled, not disabled, while pending: it stays mounted and
        // focused while the extension reads the league.
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onFindWithExtension({ leagueUrl: tryUrl, retryUrl: tryUrl })}
          aria-disabled={isPending}
        >
          Try with the extension
        </button>
      )}

      {missedUrl !== null && extension === "absent" && extensionId !== null && (
        // The hidden note, read as part of the name, says the link leaves for
        // a new tab.
        <a
          href={extensionStoreUrl({ extensionId })}
          target="_blank"
          rel="noreferrer"
          className={styles.secondary}
        >
          Get the Court Vision extension
          <span className={styles.srOnly}> (opens in new tab)</span>
        </a>
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
          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={isPending}>
              {isFindingOnServer ? "Finding league…" : "Find league"}
            </button>
            {extension === "present" && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => onFindWithExtension({ leagueUrl: url.trim(), retryUrl: null })}
                disabled={isPending}
              >
                {isReadingThroughExtension
                  ? "Reading your league…"
                  : "Import with the Court Vision extension"}
              </button>
            )}
          </div>
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
        <Link ref={waiverWireRef} href={WAIVER_WIRE_PATH} className={styles.submit}>
          Go to the Waiver Wire
        </Link>
      )}
    </section>
  );
}
