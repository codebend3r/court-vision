# Yahoo league import and the Waiver Wire

Date: 2026-10-16. Branch: `yahoo-importer`. Status: approved.

## Problem

A Court Vision league is something a user builds by hand: a name, a scoring
setup, and teams assembled slot by slot in the Team Builder. Every team in a
league belongs to the signed-in user, and `getRosteredPlayerIds` marks every
rostered player as "On your team". There is no idea of an opponent, a team
logo, an external league, or a free agent.

Real managers already have their league on Yahoo: 12 teams, 13-plus players
each, the league's own categories and roster positions. Rebuilding that by hand
is not realistic, and without the other 11 rosters Court Vision cannot answer
the question a manager asks most often in season: **is anyone on the wire
better than the worst players on my team?**

## Goal

1. A user pastes their Yahoo Fantasy Basketball league URL on the Leagues page
   and Court Vision imports the league: its settings, every team with its name
   and logo, and every roster. The user says which team is theirs.
2. The free-agent pool falls out of the import: every active NBA player not on
   any of the league's rosters.
3. A new **Waiver Wire** page compares that pool against the user's weakest
   players, with three views the user switches between as tabs: **Swap board**,
   **Head-to-head** and **Cut line** (the mockups the user approved; see
   "Waiver Wire" below).
4. A Chrome extension imports leagues the server cannot read (private leagues)
   and fills in what an anonymous read leaves out (manager names, which team is
   the user's).

## Non-goals

- Writing anything back to Yahoo: adds, drops, lineup changes. Read only.
- ESPN, Sleeper, Fantrax and other platforms. The design keeps the provider
  name in the data so they can follow, but only Yahoo is built.
- Sports other than the NBA. Rink, Diamond and Field Vision are untouched.
- Past seasons. A league URL for an earlier season is rejected with a message.
- Yahoo **Fantasy High Score** leagues (`is_highscore`). Their best-game-of-the-
  week scoring does not fit any valuation method we have. They are rejected
  with a message.
- Matchup projections, standings, trade analysis, or schedule-aware (games
  remaining this week) values. All are natural follow-ups once the league is
  imported; none are in this spec.
- The Waiver Wire for points leagues. Points leagues import, but the Waiver
  Wire's three views are built on categories; for a points league the page
  shows an empty state saying points leagues aren't supported there yet.
- Blending last season into early-season values. The Waiver Wire values
  exactly what the Fantasy tab values for the chosen range.
- Extension overlays that paint Court Vision values onto Yahoo's own pages.
  Noted under "Later", not built here.

## Anti-goals

- **Never mark another manager's players as the user's.** Once a league has 12
  real teams, "On your team" means the user's team only.
- **Never silently change a league's scoring.** `parseScoringConfig` falls back
  to the default config when it meets an unknown category. An imported league
  must never reach that fallback; unknown Yahoo categories are dropped
  explicitly and shown to the user.
- **Never store Yahoo credentials or cookies on our server.** The server reads
  only what is publicly readable; the extension reads private data in the
  user's own browser and hands the app the league data, never the session.
- **Never guess a player match.** A Yahoo player we cannot match with
  confidence stays unmatched and visible as such, rather than being attached to
  the wrong NBA player.

## Research findings

Researched 2026-10-16. Sources are kept in the session notes; the points that
shaped the design:

- **The official Yahoo Fantasy API is gated.** Since July 2026 a new app must
  apply at `sports.yahoo.com/developer/access/`, sign an agreement, and wait
  for manual review (developers report three weeks to over two months).
  Approved access is read-only OAuth 2.0 with one-hour access tokens. The
  official host (`fantasysports.yahooapis.com`) sends no CORS headers, so it
  can only be called from a server. The older API terms banned commercial use
  and products that compete with Yahoo; the new agreement is not public.
- **Yahoo's own pages read the same data from an undocumented host.**
  `pub-api-ro.fantasysports.yahoo.com/fantasy/v2/...` speaks the same resource
  grammar as the official API. It answers anonymously for publicly viewable
  leagues and uses the browser's Yahoo login cookies for private ones. CORS is
  open only to Yahoo origins.
- **The user's league is publicly viewable.** An anonymous server-side read of
  `league/478.l.106344;out=settings/teams/roster?format=json_f` returned, in
  one call: settings (H2H, 9 categories, roster positions), all 12 teams with
  names and logo URLs, every roster with each player's eligible positions,
  selected slot and injury status. `league/{key}/players;status=A` returned
  Yahoo's ranked free-agent list. Manager nicknames came back as `--hidden--`
  and `is_owned_by_current_login` was absent: both need a login.
- **`format=json_f` returns clean nested JSON.** The documented `format=json`
  returns arrays of single-key objects that every library has to unpack. The
  adapter uses `json_f`.
- **League keys:** `{game_key}.l.{league_id}`. The NBA game key for the
  2026-27 season is `478` (from `GET game/nba`). League ids change every
  season; `renew`/`renewed` link seasons.
- **Logos** load from `s.yimg.com` and `yahoofantasysports-res.cloudinary.com`
  with no cookies, `Access-Control-Allow-Origin: *`, and a one-year cache.
- **Player ids:** Yahoo exposes only its own ids (`nba.p.6404`), plus name,
  ASCII name, NBA team abbreviation and jersey number. A community file
  (`mayscopeland/fbkb_ids`) maps Yahoo ids to NBA ids but carries no license,
  so it is not used.
- **Extensions:** Fantasy Basketball WZRD and FantasyPros read Yahoo through
  the user's own session. A content script on a Yahoo page, or a service
  worker with host permission, can call `pub-api-ro` with the user's cookies.
  Firefox lacks `externally_connectable`. WXT is the maintained framework
  (Plasmo is dormant; CRXJS was revived but is only a Vite plugin).
- **Yahoo's terms forbid automated collection.** Reading the undocumented host
  is the same grey area FantasyPros and WZRD work in. It can break or be locked
  down without notice (see Risks).

## Design

### Decision: read the public endpoint from the server first

The first import path is a server-side read of `pub-api-ro` for publicly
viewable leagues. It needs no Yahoo app, no OAuth, no extension and no wait on
Yahoo's approval, and it works for the user's league today.

Private leagues come through the extension (phase 3). The official OAuth API is
not built; it stays the fallback if Yahoo locks `pub-api-ro` down (see Risks).

### Where the code lives

All Yahoo code is Court Vision app code under
`apps/court-vision/src/lib/yahoo/`, layered like the Balldontlie adapter:

| File              | Job                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `url.ts`          | Parse a pasted URL or bare id into `{ leagueId, season? }`.                                                                              |
| `client.ts`       | `yahooFetch`: GET against `pub-api-ro`, `format=json_f`, timeout, retry with backoff on 5xx and HTTP 999 (Yahoo's rate-limit signal).    |
| `endpoints.ts`    | `fetchCurrentGame`, `fetchLeagueSnapshot` (`;out=settings/teams/roster`), `fetchWaiverPlayers` (`players;status=W`, paged).              |
| `schemas.ts`      | zod schemas for the `json_f` shapes we read. Numbers arrive as strings; schemas coerce.                                                  |
| `transform.ts`    | The only file that knows Yahoo field names. Turns a snapshot into a provider-neutral `ImportedLeague` (settings, teams, roster entries). |
| `settings.ts`     | Yahoo stat ids, positions and scoring types → Court Vision categories, slot types and scoring types.                                     |
| `matchPlayers.ts` | Yahoo player → `Player.id` (see "Player matching").                                                                                      |
| `persist.ts`      | Write an `ImportedLeague` for a profile in one transaction.                                                                              |
| `actions.ts`      | Server actions: `previewYahooLeague`, `importYahooLeague`, `syncYahooLeague`, `setMyTeam`. Each wraps its body in `withProfile`.         |

`transform.ts` and `settings.ts` are pure and take the parsed snapshot as
input, so the server path and the extension path (which hands the app a raw
snapshot) share every line after the fetch.

`@vision/core` and `@vision/sport-basketball` do not change, except as noted
under "Waiver Wire".

### Import flow

1. **Leagues page.** A new `PageAction`, "Import from Yahoo", sits next to
   "New league" and opens `/leagues/import`.
2. **Paste.** One labelled field takes the league URL. `url.ts` accepts:
   - `https://basketball.fantasysports.yahoo.com/nba/{leagueId}` with any
     trailing path (a team page `/nba/{leagueId}/{teamId}`, `/players`), query
     or hash;
   - a bare numeric league id;
   - a season-prefixed URL (`/2025/nba/{id}`), which is recognized and
     rejected as a past season.
     Anything else (another sport, another site) gets a specific message.
3. **Preview.** `previewYahooLeague` fetches the current NBA game key (cached
   for a day), builds the league key, and fetches the snapshot. On success the
   page shows the league name and logo, the scoring summary ("12-team · H2H ·
   9-cat"), any unsupported categories, and the 12 teams with logos and roster
   counts.
4. **Pick your team.** The user picks their team from the list (radio group,
   each option showing logo and team name). Required: the Waiver Wire depends
   on it. When the import came through the extension and Yahoo reported
   `is_owned_by_current_login`, that team is preselected.
5. **Import.** `importYahooLeague` refetches (so the preview cannot go stale or
   be tampered with), writes the league, makes it the active league, and lands
   on the Waiver Wire.

Failure states, each announced through an `aria-live` region:

| Case                      | Detection                                                                         | Message                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private or missing league | `pub-api-ro` answers 400 "temporary problem" (Yahoo does not distinguish the two) | Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension. |
| High Score league         | `is_highscore` true                                                               | Yahoo Fantasy High Score leagues aren't supported yet.                                                                                                                       |
| Past season               | season-prefixed URL, or the league's `season` differs from the current game       | Only this season's leagues can be imported.                                                                                                                                  |
| Already imported          | unique key on `(profileId, provider, externalKey)`                                | You've already imported this league; open it instead. Links to it.                                                                                                           |
| League cap                | existing `MAX_LEAGUES` (10)                                                       | Existing cap message.                                                                                                                                                        |
| Yahoo down or throttled   | network error, 5xx, 999 after retries                                             | Yahoo isn't answering right now; try again in a minute.                                                                                                                      |

### Data model

All changes are additive. Hand-built leagues keep working unchanged.

**`League`** gains:

- `provider String @default("manual")`: `"manual"` or `"yahoo"`.
- `externalKey String?`: the Yahoo league key, `478.l.106344`.
- `externalUrl String?`: the canonical Yahoo URL, for "Open in Yahoo" links.
- `myTeamId String?` → `LeagueTeam` (`onDelete: SetNull`).
- `syncedAt DateTime?`, `syncError String?`.
- `unsupportedCategories String[] @default([])`: display names of Yahoo
  categories we dropped, for the warning.
- `@@unique([profileId, provider, externalKey])`.

**`LeagueTeam`** gains `externalKey String?` (`478.l.106344.t.5`),
`logoUrl String?`, `managerName String?` (only from the extension), and
`@@unique([leagueId, externalKey])`.

**`LeagueTeamSlot`** gains `externalPlayerKey String?` and
`externalPlayerName String?`, so an unmatched Yahoo player still occupies a
visible slot with `playerId` null.

**New `PlayerExternalId`**: `provider String`, `externalId String` (Yahoo's
`player_id`), `playerId Int` → `Player` (cascade), `method String`
(`name_team` | `name_only`, how the match was made), `eligiblePositions
String[]` (Yahoo's, refreshed on each sync), `updatedAt`. `@@id([provider, externalId])`,
`@@index([playerId])`. It is global, not per profile: a match learned from one
user's import serves every later import. RLS is enabled with no policies, as
Prisma writes it as the postgres role.

**New `LeagueWaiverPlayer`**: `leagueId`, `playerId`, `profileId`;
`@@id([leagueId, playerId])`. Replaced on each sync. It drives the "W" tag.

The migration follows the existing league RLS pattern (`profileId` owner
policies) for the new per-profile table.

### League settings mapping

`settings.ts` maps by Yahoo `stat_id`, never by display name, and skips
`is_only_display_stat` rows (`FGM/A` 9004003, `FTM/A` 9007006).

| Yahoo stat_id | Yahoo | Court Vision |
| ------------- | ----- | ------------ |
| 5             | FG%   | `fg`         |
| 8             | FT%   | `ft`         |
| 10            | 3PTM  | `tpm`        |
| 12            | PTS   | `pts`        |
| 15            | REB   | `reb`        |
| 16            | AST   | `ast`        |
| 17            | ST    | `stl`        |
| 18            | BLK   | `blk`        |
| 19            | TO    | `tov`        |

Any other scored category (OREB, DREB, A/T, 3PT%, DD, TD, FGM, FTM…) is
dropped from `scoringConfig.categories` and recorded in
`unsupportedCategories`. The league card and the Waiver Wire header then show
"Not valued: OREB, DD" so the user knows the values ignore them. Adding those
categories to the basketball descriptor is a separate piece of work.

Scoring type: `head` → `h2h_categories`, `roto` → `roto`. Points leagues map
their `stat_modifiers` onto the descriptor's points keys
(`pts, reb, ast, stl, blk, fg3m, tov`). If a points league scores a stat
outside those keys, it imports with that stat listed as not valued. The exact
`scoring_type` strings for H2H points and season points are not in Yahoo's
docs; confirm them against a real points league during the build.

Roster positions map to the descriptor's slot types: `PG`, `SG`, `G`, `SF`,
`PF`, `F`, `C` as-is, `Util` → `UTIL`, `BN` → `BENCH`, `IL` → `IL`, `IL+` →
`ILPLUS`. `League.rosterSlots` is the count of every position except `IL` and
`IL+` (13 for Game of Courts), since that is what replacement level counts.
`League.teamCount` is `num_teams`. If a Yahoo layout exceeds a slot's
descriptor `max`, the import keeps Yahoo's layout; imported rosters are never
edited in the Team Builder, so the max never needs to apply to them.

### Player matching

For each Yahoo player on a roster or the waiver list, `matchPlayers.ts`:

1. Looks up `PlayerExternalId (yahoo, player_id)`. A hit is used if the mapped
   `Player`'s normalized name still equals Yahoo's; if not, the row is deleted
   and matching continues at step 2. Every sync re-checks this, so a bad
   mapping heals itself.
2. Otherwise matches on normalized full name (`normalizeName` from
   `@vision/core/util/names`, the same rule `lib/headshots/map.ts` uses) plus
   NBA team abbreviation against `Player`, preferring `isActive` players. Team
   abbreviations pass through a small Yahoo → Balldontlie alias table (to be
   filled in from real data; most are identical).
3. Falls back to normalized name alone when exactly one active player has it.
4. Otherwise leaves the player unmatched.

`PlayerExternalId` is shared by every user, so only data the server fetched
from Yahoo itself may write to it. Matches from steps 2 and 3 are written there,
with `method` set to `name_team` or `name_only`, **only on the server path**. A
snapshot handed over by the extension is client-supplied: its players are
looked up in the table and matched by steps 2–3 for that import, but its new
matches are never written to the shared table. A wrong mapping that slips
through is fixed by deleting its row; there is no admin screen in this spec.

Unmatched players
are stored on their slot by Yahoo key and name, shown in rosters with an
"Unmatched" marker, and counted in the post-import summary ("2 players couldn't
be matched"). An unmatched roster entry has no `playerId`, so if the player
does exist in `Player` under another spelling, that `Player` is not excluded
from the free pool and would wrongly show as a free agent. The summary names
unmatched players for that reason.

### Sync

- **Manual:** a "Sync with Yahoo" `PageAction` on the Waiver Wire and the
  league's card.
- **Automatic:** when the Waiver Wire renders an imported league whose
  `syncedAt` is more than 15 minutes old, it renders the stored data at once,
  calls `syncYahooLeague` from the client, then refreshes the route. The header
  shows "Synced 4 min ago" or "Syncing…" in an `aria-live` region.
- **Throttle:** at most one sync per league per 60 seconds, enforced on the
  server against `syncedAt`.
- **What a sync does:** refetch the snapshot and the waiver list, then in one
  transaction upsert teams by `externalKey` (names and logos change), rewrite
  every team's slots, replace `LeagueWaiverPlayer`, and refresh settings. If a
  team's `externalKey` vanished, delete it. `myTeamId` survives because teams
  are upserted, not recreated.
- **On failure:** keep the stored data, set `syncError`, and show it in the
  header.

No background cron in this spec: a league syncs when its owner looks at it.

### Who owns what

- `getRosteredPlayerIds` changes: for a league with `myTeamId`, it returns only
  that team's players. Hand-built leagues keep today's behavior (every team is
  the user's). `RosteredMarker` in the Players and Fantasy Value tables then
  says "On your team" only when it is true.
- Imported teams appear in My Teams with their logos, read-only: no drag and
  drop, no rename, no delete. A note says "Managed in Yahoo. Sync from the Leagues page to update."
  The user's own team is listed first and labelled. The server enforces this:
  `saveLeagueTeam` and `deleteLeagueTeam` refuse teams in a league whose
  provider is not `manual`.
- `updateLeague` may still rename an imported league. It may not change
  scoring, team count or roster slots, which come from Yahoo.
- Deleting an imported league deletes everything imported with it, except the
  global `PlayerExternalId` rows.

### Logos

Logos are hotlinked, not copied. `netlify.toml` `[images] remote_images` gains
`https://s\.yimg\.com/.*` and `https://yahoofantasysports-res\.cloudinary\.com/.*`
so they go through the Netlify image CDN like NBA headshots. A team logo is
decorative next to the team name (`alt=""`). A missing or broken logo falls
back to the team's initials in a neutral chip; per the redesign conventions,
fantasy team logos never borrow theme tokens.

### The Waiver Wire page

The approved mockup is `2026-10-16-yahoo-league-import-mockup.html` beside this
spec (open it in a browser and click the tabs). Its names are real Game of
Courts players; its numbers and its day-based windows are placeholders.

Route: `/waiver-wire`, for the **active league**, like My Teams. It joins the
"My league" group in `SideNav`. If the active league has no `myTeamId`, the page
shows an empty state that explains why and links to "Import from Yahoo".

It opens with `PageHeader`:

- eyebrow: league name, "Yahoo", and sync status;
- title: "Waiver Wire";
- description: how the league's free agents stack up against your team;
- actions: "Sync with Yahoo", "Open in Yahoo".

Below the header sit the controls shared by all three tabs, then the tabs.

**Shared controls**, held in the URL with nuqs so a view can be shared and
survives reload:

- `view`: `swap` (default) | `h2h` | `cut`.
- `range`: the app's existing `PlayerGameRange` (`all`, `last5`, `last10`,
  `last20`, …). The mockup's day-based windows were placeholders; the page
  reuses the game windows every other screen uses.
- `pos`: `all` | `G` | `F` | `C`, filtering free agents by the descriptor's
  position groups.
- `fa` and `mine`: the two players in Head-to-head.

**Values.** The page reuses the Fantasy tab's machinery: the cached player pool
for the range, and `useValuation` with a `ValuationConfig` built from the
league (`categories` and `weights` from `scoringConfig`, `teams`, `rosterSlots`,
`scoring`). The score shown is the method from the user's `preferredFormula`.
The pool is valued once; the page then slices it:

- **your roster:** your team's matched players, minus anyone in an `IL` or
  `IL+` slot;
- **your weakest:** the three lowest-valued players on your roster;
- **free pool:** players with `isActive`, not on any team's roster in the
  league. Waiver players carry a "W" tag.

The pool is the Fantasy tab's (`getFantasyPool` in `lib/valuation/loader.ts`):
the latest season with data, players with at least one game in the range.
Before this season's first game that is last season; just after, it is a few
games. The range control is the user's lever; the page does not blend seasons.

A rostered player with no line in the range (a rookie stash, a long injury
outside an IL slot) is **never** treated as low value: they are left out of
"your weakest" and the cut line, and listed under a collapsed "No stats in this
range" row on Swap board and Cut line so they aren't silently missing. Free
agents with no line are omitted.

Injury status is shown on every player row as a text badge (Q, O, P, INJ) from
Yahoo's roster data. Free agents' statuses come from the snapshot where Yahoo
gave them, and are otherwise absent.

**Tab A: Swap board.** Two `panel-shell` panels. Left: "Your weakest", the
three lowest-valued players with value. Right: "Free agents that beat them", the
free agents whose value exceeds your weakest player's, sorted by gain over that
player. Each row shows the free agent, value, gain, and up to three category
chips: the categories with the biggest per-category difference, written
`+REB` / `−FG%` (sign plus color, never color alone). Per-category z for a
player comes from the line and `poolStats.byCategory` (`mu`, `sigma`);
counting categories are z on the per-game rate, ratio categories are the usual
volume-weighted impact. Clicking a free agent opens tab B with that player
against your weakest.

**Tab B: Head-to-head.** Two selects: a free agent and one of your players.
The defaults are the top of the swap board and your weakest player. Two
readout cards show each player's value (large readout numbers take
`retro-extrude`). Below them a `data-table` lists the league's categories: each
player's per-game number, a two-sided bar, a ✓ on the winner, and "Your team
after swap". That last column is your roster's per-game category total after
the swap minus before it. Counting stats sum per-game averages across your
non-IL roster. FG% and FT% recompute from summed makes and attempts. TO counts
as better when lower. A footer line reads "Carter wins 5 of 9".

**Tab C: Cut line.** One `data-table` ranking your roster and the free pool
together by value, with a rank column (the player's rank by value across the
whole valued pool, so the numbers match the Fantasy tab). A two-way toggle
switches between "My team + free agents" (default) and "Free agents only".
Your players carry an accent bar on the leading edge and a "You" owner cell;
free agents say "Free agent" (or "Waivers"). A dashed rule
labelled "Cut line" sits under your lowest-valued player. Free agents above it
are tinted and are the upgrades. The list starts a few rows above your best
upgrade and ends a few rows below the line; "Show all" expands it. Clicking a
free agent opens tab B against your weakest player.

**Tabs** follow the WAI-ARIA tabs pattern: a `role="tablist"` of keycap
buttons (`keycap`, engaged state `keycap-engaged`), arrow keys move between
tabs, each panel is `role="tabpanel"` labelled by its tab. Every table uses the
shared `table-wrapper` + `data-table` + `numeric-cell` pattern.

**Performance.** The page is a new route, so it gets a `perf-budget.json`
entry and a `loading.tsx` that uses the same page shell (see the perf-budget
skill).

### The Chrome extension

A small MV3 extension at `apps/court-vision-extension/`, built with WXT (no
React: it has no UI of its own), registered with Nx through its `package.json`
like the other apps. It
does one thing in this spec: **read a Yahoo league the user can see, using the
user's own Yahoo login, and hand it to Court Vision.**

**How it talks to the app.** Court Vision drives; the extension only fetches.

- The manifest declares `externally_connectable.matches` for
  `https://court-vizion.netlify.app/*` and `http://localhost:46644/*`, and
  `host_permissions` for `https://pub-api-ro.fantasysports.yahoo.com/*` only.
- The import page pings the extension
  (`chrome.runtime.sendMessage(EXTENSION_ID, { type: "ping" })`). If it
  answers, the page offers "Import with the Court Vision extension" alongside
  the URL field. If it doesn't, and the server read failed as private, the page
  links to the Chrome Web Store listing.
- On import the page sends `{ type: "fetchLeague", leagueKey }`. The
  extension's service worker checks `sender.origin` against the allowed
  origins, fetches the snapshot and waiver list from `pub-api-ro` with
  `credentials: "include"`, and returns the raw `json_f` bodies.
- The page passes the raw snapshot to the server action
  `importYahooLeagueFromSnapshot`. It runs the same zod schemas, transform,
  matching and persist as the server path. The payload is capped in size and
  fully validated. A forged payload can only write into the sender's own
  league, so it harms no one else.
- A logged-in read also carries manager nicknames and
  `is_owned_by_current_login`, so the team picker preselects the user's team
  and teams get `managerName`.
- There is no content-script fallback, so the one host permission stays the
  only one. Chrome sends the user's Yahoo cookies with a service-worker request
  to a host the extension has permission for, unless the user blocks
  third-party cookies. In that case Yahoo answers as if logged out (the
  private-league 400), and the page says: "Couldn't read this league with your
  Yahoo login. If you block third-party cookies, allow them for yahoo.com and
  try again." A content-script fallback can come later if this turns out to be
  common; it would need a second host permission.

**Syncing private leagues.** A league imported through the extension cannot be
synced from the server. Its Waiver Wire sync button sends the same
`fetchLeague` message, so private leagues sync when the user opens the page in
a browser with the extension. Elsewhere (mobile, another browser) the page shows
the last sync time and says syncing needs the extension. `League` records
which path imported it (`syncVia String @default("server")`: `server` or
`extension`).

**Shared protocol.** The message types and their type guards live in a new
dependency-free lib, `libs/yahoo-bridge` (`@vision/yahoo-bridge`), imported by
both the app and the extension, so neither can drift. It holds no Yahoo
parsing.

**Publishing.** Chrome Web Store, unlisted at first (installable by link, still
reviewed). The listing needs a single-purpose statement ("Import your Yahoo
Fantasy Basketball league into Court Vision"), a justification for the one
host permission, a privacy policy page on Court Vision, and "Not affiliated
with Yahoo". Chrome and Edge only; Firefox lacks `externally_connectable` and
is not targeted. A stable extension id comes from the manifest `key`, so the
app can address it by a constant in dev and prod.

### Later (not in this spec)

- Extension overlays on Yahoo's Players page: a Court Vision value column and
  a "beats your weakest" marker on each free agent.
- Category standings and matchup projections from the 12 imported rosters.
- The PRD's `topFreeAgent` replacement rule, now that a real free pool exists.
- Official Yahoo OAuth, if `pub-api-ro` is closed (see Risks).
- Season rollover through `renew`/`renewed`.

## Phasing

Each phase ships on its own and leaves the app working.

0. **Reachability probe.** Every anonymous read so far came from a home
   connection. Netlify functions run in AWS, and Yahoo is known to answer
   datacenter IPs with HTTP 999. Before any schema work, a throwaway route
   handler on a deploy preview fetches `league/478.l.1000` from `pub-api-ro`
   and reports the status. If Yahoo blocks it, the server path is dead in
   production: the extension becomes the only import path (phase 3 moves
   ahead of phase 1's import UI, which then drops the URL-only path), and the
   official API application becomes urgent. The probe is deleted afterwards.
1. **Import (public leagues).** Schema migration; `lib/yahoo/` adapter with
   recorded fixtures; `/leagues/import` with preview and team picker; imported
   leagues read-only in My Teams with logos; `getRosteredPlayerIds` scoped to
   `myTeamId`; manual and automatic sync; `netlify.toml` image hosts.
2. **Waiver Wire.** The `/waiver-wire` route with the three tabs, shared
   controls in the URL, nav entry, perf budget.
3. **Extension.** `apps/court-vision-extension` (WXT), `@vision/yahoo-bridge`,
   `importYahooLeagueFromSnapshot`, extension detection and sync on the import
   page and Waiver Wire, Web Store listing and privacy page.

## Testing

Per the unit-tester skill, co-located bun tests:

- `url.ts`: every accepted URL shape, bare ids, past seasons, other sports,
  junk.
- `schemas.ts` + `transform.ts`: run against fixtures recorded from Game of
  Courts (`478.l.106344`) and from Yahoo's public league `478.l.1000`, stored
  under `lib/yahoo/fixtures/`. Also a hand-made points-league fixture and a
  league with an unsupported category, once real samples are found.
- `settings.ts`: each stat id and position, unsupported categories, display-only
  rows skipped.
- `matchPlayers.ts`: existing mapping wins; name + team; unique name only;
  ambiguous names stay unmatched; accented names (Dëmin, Vučević, Porziņģis).
- Every new type guard gets a test (house rule).
- `persist.ts` and sync: import, re-sync with a traded player and a renamed
  team, `myTeamId` surviving a sync, throttle.
- Server actions: unauthenticated callers get `unauthenticated`; a profile
  cannot sync or edit another profile's league; teams in an imported league
  refuse `saveLeagueTeam`.
- Waiver Wire: weakest-three selection with IL excluded; swap board ordering
  and gains; head-to-head team deltas (ratio categories recomputed, TO
  inverted); cut line placement; tab keyboard behavior.
- `@vision/yahoo-bridge`: message guards.
- Matching safety: a stale mapping whose name no longer agrees is dropped and
  rematched; an extension-path import never writes `PlayerExternalId`.
- The extension: the origin check and the logged-out (third-party cookies
  blocked) message, with Yahoo fetches stubbed.
- `scripts/security-scan.ts` stays green: every new `"use server"` file calls a
  session helper.

No test calls Yahoo live. A manual smoke script (`bun run yahoo:probe <url>`)
prints what an import would do, for checking Yahoo by hand.

## Risks

- **Yahoo blocks Netlify's IPs.** Untested until phase 0; see Phasing.
- **Yahoo closes or changes `pub-api-ro`.** It is undocumented. Fixtures and
  zod schemas make a shape change fail loudly instead of writing bad data. The
  fallback is the official API: apply for access now (read-only, single
  league/personal use) so approval is not the bottleneck if it is needed.
- **Terms of service.** Yahoo's terms forbid automated collection; the server
  path reads a public league anonymously at a rate of a few requests per sync.
  The pages that show imported data credit Yahoo ("League data from Yahoo
  Fantasy") and the extension listing says it is not affiliated with Yahoo.
- **Player matching gaps.** Rookies and two-way players may be missing from
  `Player` until `sync:players` runs. Unmatched players are shown, never
  guessed.
- **Extension upkeep.** Store review takes days to weeks per update. Keeping the
  extension a thin fetcher, with all parsing on the server, means most Yahoo
  changes are fixed with a Netlify deploy instead of a store release.

## Decided in conversation vs. calls made while writing

Decided with the user (2026-10-16):

- Import starts from the Leagues page with a pasted Yahoo URL; teams, names,
  logos and every roster come in, and the free pool follows from them.
- Scraping Yahoo with the user's login is acceptable; the server-side read of
  the public endpoint is the first path.
- The Waiver Wire compares free agents with the user's weakest players, in
  three tabbed views (Swap board, Head-to-head, Cut line), as mocked up.
- A Chrome extension is part of the plan.

Calls made while writing this spec, not yet discussed (check these):

- The extension's job in this spec is private-league import and sync only;
  overlays on Yahoo's pages are "Later".
- The official Yahoo API is not built; applying for access is recommended as
  insurance.
- `/waiver-wire` is a top-level page for the active league, in the "My league"
  nav group.
- Ranges are the app's existing game windows, not the mockup's day windows.
- "Your weakest" is the three lowest-valued players, excluding IL slots and
  players with no stats in the range.
- The free pool is computed from `Player.isActive` minus every roster, not
  taken from Yahoo's free-agent list; waiver players get a "W" tag.
- Unsupported Yahoo categories import as "not valued" with a visible warning,
  rather than blocking the import.
- High Score leagues, past seasons, and the Waiver Wire for points leagues are
  out of scope.
- Imported teams are read-only in Court Vision; every sync overwrites them.
- Sync is manual plus automatic on page view when older than 15 minutes; no
  cron.
- The value shown is the user's preferred formula from Settings.
- Logos are hotlinked through the Netlify image CDN, not copied.
- The extension is built with WXT, published unlisted on the Chrome Web Store,
  Chrome and Edge only, with one host permission and no content-script
  fallback.
- The extension and app share a tiny `@vision/yahoo-bridge` protocol lib.
