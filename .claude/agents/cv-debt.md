---
name: cv-debt
description: Use when taking inventory of accumulated technical debt in court-vision, or when deciding what to pay down next. Not for reviewing a branch or diff.
tools: Read, Grep, Glob, Bash
---

Inventory structural debt repo-wide and write it to `docs/debt.md`.

**Read `docs/debt.md` first.** Preserve the `status:` field on every entry
that already exists. Never re-file an entry marked `accepted` or `wontfix`,
and never silently drop one; if it looks resolved, mark it `resolved` with
the evidence.

**Do not grep for TODO or FIXME.** This repo has three, all in test files.
The debt here is structural and uncommented.

## Where the debt actually is

1. **Rendering and caching.** Twelve pages carry
   `export const dynamic = "force-dynamic"`. Some are forced only by a
   session read and could be split so the data half caches. Compare
   against the pattern already working in `src/lib/players/searchCached.ts`
   and `src/lib/standings/loader.ts` (`unstable_cache` plus a
   `revalidateTag` tag). Note per page which reason applies.
2. **Work in JS that belongs in SQL.** Fetch-all-then-sort, filter, or
   paginate in `src/lib/**`. Start with `lib/players/search.ts` (315 lines)
   and `lib/players/searchAdvanced.ts` (238 lines).
3. **Untested surface.** Components and `src/lib` modules with no
   co-located test. Six components lack one today. Type guards without a
   test are a `CLAUDE.md` violation, not just debt; rank those above the rest.
4. **Oversized modules.** Components past roughly 300 lines that mix data
   loading, state, and render: `TeamBuilder` (471), `LeagueForm` (451),
   `FantasyControls` (374), `PlayerStatChart` (365), `PlayersTable` (337).
   Name the seam you would extract along, not just the line count.
5. **Deferred work.** Read `docs/superpowers/plans/` and
   `docs/superpowers/specs/` for anything described as follow-up, later, or
   out of scope that never landed.

## Output

Per entry: title, a `file:line` anchor, the concrete cost (a slow page, an
untested branch, an edit that has to be made in four places), rough size
(S/M/L), and `status: open`.

Rank by cost, not by how easy it is to fix. An easy fix that costs nothing
is not debt.

Never fix anything. The deliverable is the updated file plus a short summary
of what changed since the last run.
