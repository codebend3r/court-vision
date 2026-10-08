---
name: version-bumper
description: Use when asked whether court-vision is due for a version bump, when main has taken on work since the last v* tag, or when cutting a release. Covers deciding patch vs minor vs major from the commit log and applying the bump.
---

# Version bumping in court-vision

The repo is at `0.x`. A release is three things: the `version` line in
`apps/court-vision/package.json`, a commit whose subject is `vX.Y.Z`, and an
annotated tag `vX.Y.Z` whose message is also `vX.Y.Z`. No tag ever uses the
bare number (`0.1.4`), in its name or its message.

The repo is an Nx monorepo. The `v*` tags and the version belong to the
Court Vision app, so the version lives in `apps/court-vision/package.json`
(the root `package.json` has none). `bun pm version` still writes the new
number, run from `apps/court-vision/`, but from there it no longer commits or
tags. Step 5 does both.

Recommend, then wait for a yes or a no. Never bump unasked.

## 1. Read main, not your branch

```bash
git fetch -p
git switch main && git pull --ff-only
LAST=$(git describe --tags --abbrev=0 --match 'v*')
git log --oneline "$LAST"..main
git diff --stat "$LAST"..main
git diff --name-only "$LAST"..main | sort -u
```

If `git status` is not clean or `main` is behind `origin/main`, stop and say
so. The bump commit carries the version line and nothing else.

## 2. Decide whether a bump is warranted at all

| Every changed path is under                                                                                           | Verdict                   |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `.claude/`, `docs/`, `.github/`, `*.md`                                                                               | No bump. Say so and stop. |
| anything in `apps/court-vision/{src,prisma,public}/`, a `libs/*/src/` the app imports, or a `package.json` dependency | Bump warranted            |

A run that recommends nothing is a correct outcome. Do not manufacture a
patch bump so the skill has something to say.

## 3. Classify

**There are no conventional-commit prefixes in this repo.** Every subject is
`CV: <title>`, so `feat:`/`fix:` greps find nothing. Classify from the diff.

| Signal in `$LAST..main`                                                                                                                                   | Level        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Migration dropping or renaming a column/table; a route deleted from `apps/court-vision/src/app`; a renamed required env var; a changed API response shape | **breaking** |
| New route or page under `apps/court-vision/src/app`; new component rendered somewhere reachable; new Prisma model; new `package.json` script              | **minor**    |
| Fix, refactor, test, style, copy, dependency bump                                                                                                         | **patch**    |

**A new file is not a feature.** Ask what a user can now do that they could
not before. If the answer is nothing, it is a patch no matter how many files
were added. Two traps this repo has already produced:

- A new `src/lib` module (or a module moved into a `libs/*` package) that is
  an extraction — caching, a helper pulled out of a route — is a **patch**.
  `src/lib/players/seasonPool.ts` (v0.1.4..main)
  added a cached query behind an existing player page. New file, new export,
  zero new behavior.
- A migration that only adds an index is a **patch**. Only a dropped or
  renamed column, or a new model, moves the level.

Confirm a minor against the app's routes: if
`git diff --stat "$LAST"..main -- apps/court-vision/src/app`
shows no added route, be skeptical of your own minor.

Then map to a version, **pre-1.0 rules**:

- breaking → **minor** (`0.1.4` → `0.2.0`)
- minor → **minor** (`0.1.4` → `0.2.0`)
- patch only → **patch** (`0.1.4` → `0.1.5`)
- **Never recommend `1.0.0`.** Leaving `0.x` is a product decision. If the
  log contains a breaking change, recommend the minor and say plainly that
  a breaking change landed and 1.0.0 is available if they want it.

Highest level present wins. One breaking change among nine patches is a
minor bump.

## 4. Recommend

Give the verdict first, then the evidence, then one yes/no question. Keep it
short enough to read without scrolling:

```
Recommend patch: 0.1.4 -> 0.1.5

  fd334fe  removed the last type cast, covered the standings loader   patch
  c271786  renamed a skill, fixed the pre-push message                patch

No new routes, models, or migrations since v0.1.4.

Bump to 0.1.5? (yes/no)
```

Do not bump on ambiguity, silence, or "sounds good, what else". Bump on yes.

## 5. Apply

```bash
cd apps/court-vision
bun pm version patch    # or: minor
V="v$(bun pm pkg get version | tr -d '"')"
cd ../..
git add apps/court-vision/package.json
git commit -m "$V"
git tag -a "$V" -m "$V"
```

From `apps/court-vision/`, `bun pm version` rewrites `package.json` and
nothing else: no commit, no tag. The three git lines are the release, not a
workaround to skip. Build all three from `$V`, never a typed number, so the
commit subject, tag name, and tag message can't drift apart.

Then confirm against the previous release:

```bash
git show --stat --format=%s HEAD    # subject vX.Y.Z; one file, apps/court-vision/package.json
git cat-file -p "$V" | tail -3      # annotated; message vX.Y.Z
git cat-file -p "$LAST" | tail -3   # same shape
```

## Gotchas

- **The bump commit is the one commit with no `CV:` prefix.** Its subject is
  `vX.Y.Z`, the same as the tag. `commit-format` does not apply here; do not
  "fix" it, and do not amend it to `CV: v0.1.5`. The whole tag history says
  otherwise.
- **`pre-commit` runs only `lint-staged`** (oxfmt on the staged
  `package.json`), so the bump commit is quick. `pre-push` runs
  `bun run system-check` (format, typecheck, lint, test, build) when the
  release is eventually pushed. A failure there means main is broken —
  report that, do not `--no-verify` past it.
- **Leave `bun.lock` alone.** It records the app's version as of the last
  install and goes stale after a bump, but `bun install --frozen-lockfile`
  (CI) accepts the mismatch. Do not stage it into the bump commit.
- **Do not push and do not push tags.** `CLAUDE.md` is explicit. The bump
  and tag sit local until told otherwise; mention that they are unpushed.
- **`bun pm version` needs the increment word**, not the number. Bare
  `bun pm version` just prints the table.
- **Run `bun pm version` from `apps/court-vision/`.** From the repo root it
  finds no version to bump. Run the git lines from the repo root.

## Checklist

- [ ] On `main`, clean, fast-forwarded to `origin/main`
- [ ] Diffed `$LAST..main`, not the current branch
- [ ] Checked the no-bump case before classifying
- [ ] Classified from changed paths, not subject-line prefixes
- [ ] Pre-1.0 mapping applied; did not recommend `1.0.0`
- [ ] Asked one yes/no question and got a yes
- [ ] Used `bun pm version <increment>` for the number; built commit subject, tag name, and tag message from `$V`
- [ ] Did not push
