# Court Vision

Find fantasy basketball players trending in the categories you care about.

Court Vision pulls NBA player stats, tracks how each player is performing over recent
windows, and surfaces who is "heating up" — powering a leaderboard, trend charts, and a
weighted **heat score**.

> **Status:** in progress. Today the app ships a themed shell (light/dark), a searchable
> `/players` table with headshots, and per-player season-average charts. The leaderboard
> and heat score are still to come.

## Getting started

You'll need [Bun](https://bun.sh/) installed.

```bash
bun install                 # install dependencies
cp .env.example .env        # fill in the values you need
bun dev                     # http://localhost:46644
```

Then open [http://localhost:46644](http://localhost:46644) in your browser.
