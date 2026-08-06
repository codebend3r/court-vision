---
name: active-rebaser
description: Use when main has moved locally in court-vision and the other branches are now stale, or when asked to rebase every branch and worktree onto main. Covers the per-branch rebase, when a conflict may be resolved versus abandoned, and the force-with-lease push approval.
---

# Rebasing every branch onto main

One pass over every local branch. Rebase what rebases cleanly, resolve only
the conflicts that are mechanical, abandon the rest untouched, report, then
push only what is approved branch by branch.

**Nothing is pushed without a yes for that specific branch.**

## 0. Preflight — record state before touching anything

```bash
git fetch -p
git rev-parse --short main origin/main
git status --porcelain          # must be empty
git worktree list
git branch --format='%(refname:short) %(upstream:short)'
```

Stop if the working tree is dirty. Stop if `main` is behind `origin/main` —
rebasing onto a stale main just means doing it twice.

**Record `origin/<branch>` for every branch now, before any rebase.** These
shas are the push leases in step 4 and cannot be recovered later:

```bash
git for-each-ref --format='%(refname:short) %(objectname)' refs/remotes/origin
```

## 1. Enumerate

Every local branch except `main`. Two kinds, and they are handled differently:

| Branch is                                                    | Rebase it                      |
| ------------------------------------------------------------ | ------------------------------ |
| Checked out in a real worktree (including the main checkout) | **In place**, in that worktree |
| Not checked out anywhere                                     | In a **throwaway worktree**    |

`git worktree add` hard-fails with `fatal: '<branch>' is already used by
worktree at ...` when the branch is checked out. Read `git worktree list`
first rather than discovering this from an exit code — piping the failure
through `head` swallows it and reports success.

Never check a branch out in the user's main working tree to rebase it.

## 2. Rebase, one branch at a time

```bash
WT=$(mktemp -d)/rb-$BRANCH
git worktree add -q "$WT" "$BRANCH"
git -C "$WT" rebase main
```

Exit 0 → clean. Record ahead/behind, remove the worktree, next branch.

```bash
git -C "$WT" rev-list --left-right --count main...HEAD
git worktree remove "$WT"
```

Exit non-zero → conflict. Size it before deciding anything.

### Sizing a conflict

**`git diff --numstat --diff-filter=U` reports `0 0` for conflicted files.**
It is useless here. Count the markers instead:

```bash
git -C "$WT" diff --name-only --diff-filter=U | while read -r f; do
  awk -v F="$f" '
    /^<<<<<<< /{inside=1; n=0; hunks++}
    inside{n++}
    /^>>>>>>> /{inside=0; total+=n}
    END{printf "%s hunks=%d lines=%d\n", F, hunks+0, total+0}
  ' "$WT/$f"
done
```

### Resolve or abandon

Resolve **only** when the conflict is one of these, or small enough to hold
in your head:

| Class                                                                              | Resolution                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `bun.lock`                                                                         | Take main's side, then `bun install` and stage the result |
| `package.json` version field                                                       | Take main's side                                          |
| Both sides added different entries to the same import block, array, or export list | Union both, in the file's existing order                  |
| Vanishes under formatting                                                          | `oxfmt --write` the file, then stage                      |
| **≤ 20 conflicted lines across ≤ 3 files**, and both sides are legible             | Read both sides and resolve                               |

Anything else — overlapping edits to the same logic, a conflict spanning
more than 3 files, more than 20 conflicted lines, or two sides you cannot
confidently reconcile — **abandon it**:

```bash
git -C "$WT" rebase --abort
git worktree remove "$WT"
```

Abort restores the branch exactly. That is the point: an abandoned branch is
a clean outcome, not a failure. Do not partially resolve, do not `--skip` a
commit, and do not drop a commit to make a rebase go through.

After a resolve, continue and verify:

```bash
git -C "$WT" add <resolved-files>
GIT_EDITOR=true git -C "$WT" rebase --continue
```

If a second conflict appears in a later commit of the same branch, size it
under the same rules. A branch that keeps conflicting has earned an abort.

Never `--force` a worktree removal to escape a stuck rebase; abort first.

## 3. Report

One row per branch, after every branch is done. Report before asking for any
push.

```
branch             result      detail
audit/a11y         rebased     clean, 3 commits replayed
audit/perf         rebased     resolved bun.lock (took main)
audit/security     up to date  already on main
audit/styles       abandoned   14 conflicted lines across 6 files
audit/tech-debt    rebased     resolved 1 import block in charts.ts
```

State what was resolved and how, per branch. "Resolved conflicts" alone is
not a report — the user is about to approve a force push based on it.

## 4. Approve, then push

Ask per branch. Not one prompt for all of them, and not one prompt per
report. Skipping a branch is a normal answer.

Push with the **explicit** lease, using the sha recorded in step 0:

```bash
git push --force-with-lease="$BRANCH:$RECORDED_SHA" origin "$BRANCH"
```

**Bare `--force-with-lease` is not safe here.** It compares against
`origin/<branch>`, and any `git fetch` between the rebase and the push
refreshes that ref — the lease then passes and silently overwrites whatever
someone else pushed in the meantime. This run fetches in step 0, and
`.husky/pre-push` runs `git fetch -p` on every push. The explicit
`=<branch>:<sha>` form compares against a literal sha and is immune.

A `! [rejected] ... (stale info)` means the remote branch moved during the
run. Do not retry, do not re-lease, do not `--force`. Report it and move on;
that branch needs a human.

## Checklist

- [ ] Fetched, working tree clean, `main` level with `origin/main`
- [ ] Recorded every `origin/<branch>` sha before the first rebase
- [ ] Branches checked out in a worktree rebased in place; the rest in throwaways
- [ ] User's working tree and current branch never changed
- [ ] Sized every conflict by marker count, not `--numstat`
- [ ] Resolved only mechanical conflicts or ones under the 20-line / 3-file bar
- [ ] Aborted cleanly otherwise; no `--skip`, no dropped commits
- [ ] Every throwaway worktree removed (`git worktree list` is back to baseline)
- [ ] Reported all branches before asking about any push
- [ ] Asked per branch; pushed only with `--force-with-lease=<branch>:<sha>`
