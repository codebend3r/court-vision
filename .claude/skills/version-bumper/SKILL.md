---
name: version-bumper
description: Use when asked whether court-vision is due for a version bump, when main has taken on work since the last v* tag, or when cutting a release. Covers deciding patch vs minor vs major from the commit log and applying the bump.
---

# Version bumping in court-vision

The repo is at `0.1.x`. Every release so far is a `bun pm version` bump: a
`package.json` edit, a commit whose subject is the bare version (`0.1.4`),
and an annotated tag (`v0.1.4`) whose message is also the bare version.

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
so. `bun pm version` refuses on a dirty tree anyway, and `--force` is not
the answer.

## 2. Decide whether a bump is warranted at all

| Every changed path is under                                              | Verdict                   |
| ------------------------------------------------------------------------ | ------------------------- |
| `.claude/`, `docs/`, `.github/`, `*.md`                                  | No bump. Say so and stop. |
| anything in `src/`, `prisma/`, `public/`, or a `package.json` dependency | Bump warranted            |

A run that recommends nothing is a correct outcome. Do not manufacture a
patch bump so the skill has something to say.

## 3. Classify

**There are no conventional-commit prefixes in this repo.** Every subject is
`CV: <title>`, so `feat:`/`fix:` greps find nothing. Classify from the diff.

| Signal in `$LAST..main`                                                                                                                 | Level        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Migration dropping or renaming a column/table; a route deleted from `src/app`; a renamed required env var; a changed API response shape | **breaking** |
| New route or page under `src/app`; new component rendered somewhere reachable; new Prisma model; new `package.json` script              | **minor**    |
| Fix, refactor, test, style, copy, dependency bump                                                                                       | **patch**    |

**A new file is not a feature.** Ask what a user can now do that they could
not before. If the answer is nothing, it is a patch no matter how many files
were added. Two traps this repo has already produced:

- A new `src/lib` module that is an extraction — caching, a helper pulled out
  of a route — is a **patch**. `src/lib/players/seasonPool.ts` (v0.1.4..main)
  added a cached query behind an existing player page. New file, new export,
  zero new behavior.
- A migration that only adds an index is a **patch**. Only a dropped or
  renamed column, or a new model, moves the level.

Confirm a minor against `src/app`: if `git diff --stat "$LAST"..main -- src/app`
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
bun pm version patch    # or: minor
```

That single command writes `package.json`, commits, and tags. Do not hand-roll
the commit or the tag — the format is inherited from it and drifts the moment
you type it yourself.

Then confirm:

```bash
git log --oneline -1
git cat-file -p "v$(bun pm pkg get version | tr -d '\"')" | tail -3
```

## Gotchas

- **The bump commit is the one commit with no `CV:` prefix.** Its subject is
  the bare version. `commit-format` does not apply here; do not "fix" it,
  and do not amend it to `CV: 0.1.5`. Four tags of history say otherwise.
- **`pre-commit` runs `typecheck`, `lint`, `lint:scss`, and the full test
  suite** on the bump commit. It takes a while and it can fail. A failure
  means main is broken — report that, do not `--no-verify` past it.
- **Do not push and do not push tags.** `CLAUDE.md` is explicit. The bump
  and tag sit local until told otherwise; mention that they are unpushed.
- **`bun pm version` needs the increment word**, not the number. Bare
  `bun pm version` just prints the table.

## Checklist

- [ ] On `main`, clean, fast-forwarded to `origin/main`
- [ ] Diffed `$LAST..main`, not the current branch
- [ ] Checked the no-bump case before classifying
- [ ] Classified from changed paths, not subject-line prefixes
- [ ] Pre-1.0 mapping applied; did not recommend `1.0.0`
- [ ] Asked one yes/no question and got a yes
- [ ] Used `bun pm version <increment>`; did not hand-write commit or tag
- [ ] Did not push
